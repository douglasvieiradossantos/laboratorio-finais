import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Chess, validateFen } from "chess.js";
import { z } from "zod";
import { applyUci, samePosition } from "../lib/chess/fen.ts";
import { OutOfScopeError, techniqueScope } from "../lib/chess/technique.ts";
import {
  lessonSchema,
  positionSchema,
  PROVENANCE_FIELDS,
  type Lesson,
  type MoveTree,
  type Position,
} from "../lib/lesson/schema.ts";
import {
  alternativesDiffer,
  authorialExpects,
  branchesDiffer,
  generateAlternatives,
  generateBranches,
  GENERATED_ID,
  GeneratorError,
  longestLine,
  type GeneratedTree,
} from "./branches.ts";
import { CacheMissError, Tablebase, winningMovesOf, type TbEntry } from "./tablebase.ts";

/**
 * O gate de conteúdo (plano da F1, §3.4).
 *
 * Confere tudo que o motor vai acreditar em runtime: a legalidade das posições,
 * a proveniência, a coerência das árvores de lances, e — o ponto central — a
 * verdade xadrezística de cada nó, certificada pela tablebase e não pelo
 * palpite de quem escreveu a aula.
 *
 *   npm run validate:content                       # offline, a partir do cache
 *   npm run validate:content -- --refresh-cache    # autoria: pode usar a rede
 *   npm run validate:content -- --refresh-cache --write
 *                                                  # grava os winningMoves
 */

const VERDE = "\u001b[32m";
const VERMELHO = "\u001b[31m";
const NORMAL = "\u001b[0m";

type Issue = { code: string; where: string; message: string };

const issues: Issue[] = [];
function fail(code: string, where: string, message: string) {
  issues.push({ code, where, message });
}

/* ------------------------------------------------------------------ *
 * Argumentos
 * ------------------------------------------------------------------ */

const argv = process.argv.slice(2);
function flag(name: string): boolean {
  return argv.includes(`--${name}`);
}
function option(name: string, fallback: string): string {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const contentDir = path.resolve(option("content", "content"));
const allowNetwork = flag("refresh-cache");
const writeBack = flag("write");
const pruneCache = flag("prune-cache");

const positionsDir = path.join(contentDir, "positions");
const lessonsDir = path.join(contentDir, "lessons");
const cacheDir = path.join(contentDir, "tablebase-cache");
const tablebase = new Tablebase(cacheDir, allowNetwork);

/* ------------------------------------------------------------------ *
 * Ferramentas de xadrez
 * ------------------------------------------------------------------ */

function squareDistance(a: string, b: string): number {
  return Math.max(
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
    Math.abs(a.charCodeAt(1) - b.charCodeAt(1)),
  );
}

/** Devolve o problema da FEN em português, ou `null` se ela é jogável. */
function fenProblem(fen: string): string | null {
  const basic = validateFen(fen);
  if (!basic.ok) return basic.error ?? "FEN recusada pela chess.js";

  let game: Chess;
  try {
    game = new Chess(fen);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  const whiteKing = game.findPiece({ type: "k", color: "w" })[0];
  const blackKing = game.findPiece({ type: "k", color: "b" })[0];
  if (!whiteKing || !blackKing) return "falta um dos reis";
  if (squareDistance(whiteKing, blackKing) <= 1) {
    return `reis adjacentes (${whiteKing} e ${blackKing}) — posição impossível`;
  }

  const waiting = game.turn() === "w" ? blackKing : whiteKing;
  if (game.isAttacked(waiting, game.turn())) {
    return "o lado que não está na vez está em xeque — posição impossível";
  }
  return null;
}

function pieceCount(fen: string): number {
  return (fen.split(" ")[0].match(/[pnbrqkPNBRQK]/g) ?? []).length;
}

/** Consulta a tablebase e devolve `null` (registrando o erro) quando não dá. */
async function ask(fen: string, where: string): Promise<TbEntry | null> {
  if (pieceCount(fen) > 7) {
    fail("TABLEBASE_FORA_DE_ALCANCE", where, `posição com mais de 7 peças: ${fen}`);
    return null;
  }
  try {
    return await tablebase.lookup(fen);
  } catch (error) {
    const code = error instanceof CacheMissError ? "CACHE_FALTANDO" : "TABLEBASE_FALHOU";
    fail(code, where, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Carga dos arquivos
 * ------------------------------------------------------------------ */

function walkJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkJson(full));
    else if (entry.name.endsWith(".json")) found.push(full);
  }
  return found.sort();
}

function reportZod(where: string, code: string, error: z.ZodError) {
  for (const problem of error.issues) {
    const at = problem.path.length ? problem.path.join(".") : "(raiz)";
    fail(code, where, `${at}: ${problem.message}`);
  }
}

function relative(file: string): string {
  const fromCwd = path.relative(process.cwd(), file).replace(/\\/g, "/");
  // Conteúdo fora do projeto (o teste de mutações usa uma cópia em /tmp) fica
  // ilegível como "../../AppData/..."; nesse caso o caminho sai a partir dele.
  if (fromCwd && !fromCwd.startsWith("..")) return fromCwd;
  return path.relative(contentDir, file).replace(/\\/g, "/") || file.replace(/\\/g, "/");
}

type LoadedLesson = { lesson: Lesson; file: string; raw: Record<string, unknown> };

const positions = new Map<string, Position>();
const lessons: LoadedLesson[] = [];

for (const file of walkJson(positionsDir)) {
  const where = relative(file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail("JSON_INVALIDO", where, error instanceof Error ? error.message : String(error));
    continue;
  }
  const parsed = positionSchema.safeParse(raw);
  if (!parsed.success) {
    reportZod(where, "SCHEMA_POSICAO", parsed.error);
    continue;
  }
  const expectedName = `${parsed.data.id}.json`;
  if (path.basename(file) !== expectedName) {
    fail("NOME_DE_ARQUIVO", where, `o id é "${parsed.data.id}", o arquivo deveria ser ${expectedName}`);
  }
  if (positions.has(parsed.data.id)) {
    fail("ID_DUPLICADO", where, `já existe outra posição com o id "${parsed.data.id}"`);
    continue;
  }
  positions.set(parsed.data.id, parsed.data);
}

for (const file of walkJson(lessonsDir)) {
  const where = relative(file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail("JSON_INVALIDO", where, error instanceof Error ? error.message : String(error));
    continue;
  }
  const parsed = lessonSchema.safeParse(raw);
  if (!parsed.success) {
    reportZod(where, "SCHEMA_AULA", parsed.error);
    continue;
  }
  if (path.basename(file) !== `${parsed.data.id}.json`) {
    fail("NOME_DE_ARQUIVO", where, `o id é "${parsed.data.id}", o arquivo deveria ser ${parsed.data.id}.json`);
  }
  lessons.push({ lesson: parsed.data, file, raw: raw as Record<string, unknown> });
}

/* ------------------------------------------------------------------ *
 * Conferência por posição
 * ------------------------------------------------------------------ */

async function checkPosition(position: Position) {
  const where = `posição ${position.id}`;

  const problem = fenProblem(position.fen);
  if (problem) {
    fail("FEN_ILEGAL", where, problem);
    return; // sem posição legal, nada mais faz sentido conferir
  }

  const missing = PROVENANCE_FIELDS.filter((field) => position.provenance[field] === null);
  if (position.status !== "fixture" && missing.length > 0) {
    fail(
      "PROVENIENCIA_INCOMPLETA",
      where,
      `status "${position.status}" exige os 9 campos preenchidos; nulos: ${missing.join(", ")}`,
    );
  }

  const entry = await ask(position.fen, where);
  if (!entry) return;

  const real =
    entry.category === "win"
      ? new Chess(position.fen).turn() === "w"
        ? "win-white"
        : "win-black"
      : entry.category === "loss"
        ? new Chess(position.fen).turn() === "w"
          ? "win-black"
          : "win-white"
        : entry.category === "draw"
          ? "draw"
          : null;

  if (real === null) {
    fail("TABLEBASE_INDEFINIDA", where, `a tablebase devolveu "${entry.category}" — resultado não decidido`);
  } else if (real !== position.expectedResult) {
    fail(
      "RESULTADO_ERRADO",
      where,
      `expectedResult diz "${position.expectedResult}", a tablebase diz "${real}"`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Conferência das árvores de lances
 * ------------------------------------------------------------------ */

type TreeOptions = {
  /** Etapa 4 não pode ter dica nem destaque — é o fading do currículo. */
  allowHelp: boolean;
  moveLimit?: number;
};

async function checkTree(lesson: Lesson, stage: string, tree: MoveTree, options: TreeOptions) {
  const where = `${lesson.id} / ${stage}`;
  const start = positions.get(tree.positionId);
  if (!start) return; // a ausência já foi registrada na conferência de referências
  if (fenProblem(start.fen)) return;

  const root = tree.nodes[tree.root];
  if (!root) {
    fail("NO_RAIZ_AUSENTE", where, `o nó raiz "${tree.root}" não existe em nodes`);
    return;
  }
  if (!samePosition(root.fen, start.fen)) {
    fail("FEN_DO_NO", `${where} / ${tree.root}`, `a FEN do nó raiz não é a da posição ${start.id}`);
  }

  if (options.moveLimit !== undefined) {
    const entry = await ask(start.fen, where);
    if (entry) {
      if (entry.dtm === null) {
        fail("DTM_INDISPONIVEL", where, "a tablebase não deu DTM — impossível conferir o moveLimit");
      } else {
        const studentMoves = Math.ceil(Math.abs(entry.dtm) / 2);
        if (options.moveLimit < studentMoves) {
          fail(
            "TETO_IMPOSSIVEL",
            where,
            `moveLimit ${options.moveLimit} é menor que o DTM da posição (${studentMoves} lances do aluno)`,
          );
        }
      }
    }
  }

  const visited = new Set<string>();
  const queue: string[] = [tree.root];

  while (queue.length > 0) {
    const nodeId = queue.shift() as string;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = tree.nodes[nodeId];
    const nodeWhere = `${where} / ${nodeId}`;

    if (!options.allowHelp && (node.hint !== undefined || node.highlights !== undefined)) {
      fail("AJUDA_NA_ETAPA_4", nodeWhere, "a etapa sem ajuda não pode ter hint nem highlights");
    }

    const problem = fenProblem(node.fen);
    if (problem) {
      fail("FEN_ILEGAL", nodeWhere, problem);
      continue;
    }

    // winningMoves: gerado pela tablebase, conferido contra o arquivo.
    const entry = await ask(node.fen, nodeWhere);
    const winning = entry ? winningMovesOf(entry) : null;
    if (winning) {
      if (writeBack) {
        node.winningMoves = winning;
      } else if (
        node.winningMoves.length !== winning.length ||
        [...node.winningMoves].sort().some((m, i) => m !== winning[i])
      ) {
        fail(
          "WINNING_MOVES_DESATUALIZADO",
          nodeWhere,
          `a lista do arquivo não bate com a tablebase (arquivo: ${node.winningMoves.length} lances, ` +
            `tablebase: ${winning.length}) — rode com --refresh-cache --write`,
        );
      }
    }
    const winningSet = new Set(winning ?? node.winningMoves);

    const expectedMoves = new Set<string>();
    for (const expect of node.expects) {
      for (const move of expect.moves) {
        expectedMoves.add(move);

        const afterMove = applyUci(node.fen, move);
        if (!afterMove) {
          fail("LANCE_ILEGAL", nodeWhere, `o lance esperado "${move}" não é legal nesta posição`);
          continue;
        }
        if (winning && !winningSet.has(move)) {
          fail(
            "METODO_NAO_GANHA",
            nodeWhere,
            `"${move}" está em expects mas não preserva a vitória (não está em winningMoves)`,
          );
        }

        if (expect.next === undefined) {
          if (!afterMove.game.isCheckmate()) {
            fail("TERMINAL_SEM_MATE", nodeWhere, `"${move}" encerra o nó sem dar mate`);
          }
          continue;
        }

        if (afterMove.game.isGameOver()) {
          fail(
            "PARTIDA_ENCERRADA",
            nodeWhere,
            `"${move}" encerra a partida, mas o nó aponta para "${expect.next}"`,
          );
          continue;
        }

        const reply = expect.reply as string;
        const afterReply = applyUci(afterMove.fen, reply);
        if (!afterReply) {
          fail("RESPOSTA_ILEGAL", nodeWhere, `a resposta "${reply}" não é legal depois de "${move}"`);
          continue;
        }

        // Defensor resistente: não pode encurtar o mate em mais de 2 plies
        // em relação à melhor defesa da tablebase.
        const afterMoveEntry = await ask(afterMove.fen, nodeWhere);
        if (afterMoveEntry) {
          const options_ = afterMoveEntry.moves
            .map((m) => ({ uci: m.uci, plies: m.checkmate ? 0 : m.dtm === null ? null : Math.abs(m.dtm) }))
            .filter((m): m is { uci: string; plies: number } => m.plies !== null);
          const chosen = options_.find((m) => m.uci === reply);
          const best = options_.reduce((acc, m) => Math.max(acc, m.plies), -1);
          if (chosen && best >= 0 && best - chosen.plies > 2) {
            fail(
              "DEFENSOR_FROUXO",
              nodeWhere,
              `a resposta "${reply}" leva ao mate em ${chosen.plies} plies; a melhor defesa aguenta ` +
                `${best} — diferença de ${best - chosen.plies}, o teto é 2`,
            );
          }
        }

        const target = tree.nodes[expect.next];
        if (!target) {
          fail("NO_AUSENTE", nodeWhere, `o nó "${expect.next}" não existe em nodes`);
          continue;
        }
        if (!samePosition(target.fen, afterReply.fen)) {
          fail(
            "FEN_DO_NO",
            `${where} / ${expect.next}`,
            `a FEN gravada não bate com a derivada de ${nodeId} (${move} ${reply}): ` +
              `esperada "${afterReply.fen}"`,
          );
        }
        queue.push(expect.next);
      }
    }

    for (const mistake of node.mistakes ?? []) {
      const declared = lesson.errors[mistake.errorId];
      if (!declared) {
        fail("ERRO_NAO_DECLARADO", nodeWhere, `errorId "${mistake.errorId}" não existe em errors`);
        continue;
      }
      for (const move of mistake.moves) {
        if (!applyUci(node.fen, move)) {
          fail("LANCE_ILEGAL", nodeWhere, `o erro "${move}" não é um lance legal nesta posição`);
          continue;
        }
        if (expectedMoves.has(move)) {
          fail("ERRO_E_METODO", nodeWhere, `"${move}" está ao mesmo tempo em expects e em mistakes`);
        }
        if (!winning) continue;
        const preservesWin = winningSet.has(move);
        if (declared.verdict === "off-method" && !preservesWin) {
          fail(
            "VEREDITO_ERRADO",
            nodeWhere,
            `"${move}" é anunciado como off-method ("ainda ganha"), mas joga a vitória fora`,
          );
        }
        if (declared.verdict === "loses-win" && preservesWin) {
          fail(
            "VEREDITO_ERRADO",
            nodeWhere,
            `"${move}" é anunciado como loses-win, mas ainda ganha — o texto mentiria para o aluno`,
          );
        }
      }
    }
  }

  for (const nodeId of Object.keys(tree.nodes)) {
    if (!visited.has(nodeId)) {
      fail("NO_ORFAO", `${where} / ${nodeId}`, "nó inalcançável a partir da raiz por lances legais");
    }
  }
}

/* ------------------------------------------------------------------ *
 * Ramos equivalentes — geração na autoria, conferência offline
 * ------------------------------------------------------------------ */

/**
 * O ramo gerado é derivado, não escrito: o mesmo contrato do `winningMoves`.
 * Com `--write` ele é regravado; sem `--write` o validador recomputa e compara.
 * A regeneração começa sempre da árvore autoral, então é idempotente.
 */

type RawNode = { expects?: Array<Record<string, unknown>>; [key: string]: unknown };
type RawTree = { nodes?: Record<string, RawNode> };

const EMPTY_BRANCHES: GeneratedTree = { expects: new Map(), nodes: new Map() };

/** A posição é KRK/KQK? Fora disso o gerador recusa em vez de gerar lixo. */
function inScope(tree: MoveTree): boolean {
  const root = tree.nodes[tree.root];
  if (!root) return false;
  try {
    techniqueScope(root.fen);
    return true;
  } catch (error) {
    if (error instanceof OutOfScopeError) return false;
    throw error;
  }
}

function stripGeneratedFrom(tree: MoveTree, raw: RawTree | undefined) {
  for (const id of Object.keys(tree.nodes)) {
    if (GENERATED_ID.test(id)) {
      delete tree.nodes[id];
      if (raw?.nodes) delete raw.nodes[id];
      continue;
    }
    const node = tree.nodes[id];
    node.expects = authorialExpects(node);
    delete node.methodAlternatives;

    const rawNode = raw?.nodes?.[id];
    if (!rawNode) continue;
    if (Array.isArray(rawNode.expects)) {
      rawNode.expects = rawNode.expects.filter((expect) => expect.generated !== true);
    }
    delete rawNode.methodAlternatives;
  }
}

function writeBranches(tree: MoveTree, raw: RawTree | undefined, generated: GeneratedTree) {
  stripGeneratedFrom(tree, raw);
  for (const [id, list] of generated.expects) {
    tree.nodes[id]?.expects.push(...list);
    const rawNode = raw?.nodes?.[id];
    if (rawNode && Array.isArray(rawNode.expects)) {
      rawNode.expects.push(...(structuredClone(list) as Array<Record<string, unknown>>));
    }
  }
  for (const [id, node] of generated.nodes) {
    tree.nodes[id] = node;
    if (raw?.nodes) raw.nodes[id] = structuredClone(node) as unknown as RawNode;
  }
}

function writeAlternatives(
  tree: MoveTree,
  raw: RawTree | undefined,
  alternatives: Map<string, string[]>,
) {
  stripGeneratedFrom(tree, raw);
  for (const [id, list] of alternatives) {
    const node = tree.nodes[id];
    if (node) node.methodAlternatives = [...list];
    const rawNode = raw?.nodes?.[id];
    if (rawNode) rawNode.methodAlternatives = [...list];
  }
}

async function generateFor(loaded: LoadedLesson) {
  const { lesson } = loaded;
  const rawStages = (loaded.raw as { stages?: Record<string, RawTree> }).stages ?? {};
  const ask2 = (fen: string, at: string) => ask(fen, at);

  // Teto da autoria: o schema deixa 8 expects por nó, mas 4 deles no máximo
  // podem ter sido escritos por gente — o resto é do gerador.
  for (const stageName of ["guided", "solo"] as const) {
    const tree = lesson.stages[stageName];
    if (!tree) continue;
    for (const [id, node] of Object.entries(tree.nodes)) {
      if (authorialExpects(node).length > 4) {
        fail(
          "EXPECTS_AUTORAIS_DEMAIS",
          `aula ${lesson.id} / ${stageName} / ${id}`,
          `${authorialExpects(node).length} expects escritos à mão; o teto da autoria é 4`,
        );
      }
    }
  }

  /* Etapa 3 — só a lista de alternativas, sem ramo. */
  const guided = lesson.stages.guided;
  if (guided) {
    const where = `aula ${lesson.id} / guided`;
    for (const id of Object.keys(guided.nodes)) {
      if (GENERATED_ID.test(id)) {
        fail("ID_RESERVADO", `${where} / ${id}`, `"g<número>" é reservado ao gerador de ramos`);
      }
    }

    const derived = inScope(guided) ? await generateAlternatives(guided, ask2, where) : new Map();
    if (writeBack) {
      writeAlternatives(guided, rawStages.guided, derived);
    } else {
      const problem = alternativesDiffer(guided, derived);
      if (problem) {
        fail(
          "ALTERNATIVAS_DESATUALIZADAS",
          where,
          `${problem} — rode \`npm run validate:content -- --refresh-cache --write\``,
        );
      }
    }
  }

  /* Etapa 4 — os ramos de verdade. */
  const solo = lesson.stages.solo;
  if (!solo) return;
  const where = `aula ${lesson.id} / solo`;

  for (const [id, node] of Object.entries(solo.nodes)) {
    if (node.methodAlternatives) {
      fail(
        "ALTERNATIVA_NO_SOLO",
        `${where} / ${id}`,
        "methodAlternatives é da etapa 3; na etapa 4 o equivalente vira ramo, não elogio",
      );
    }
  }

  let generated = EMPTY_BRANCHES;
  if (inScope(solo)) {
    // Saber se haveria ramo é barato e não depende dos textos — por isso a
    // conferência dos templates vem antes de gerar.
    const candidates = await generateAlternatives(solo, ask2, where);
    if (candidates.size > 0 && !lesson.generatedTemplates) {
      fail(
        "TEMPLATE_FALTANDO",
        where,
        `${candidates.size} nó(s) têm lance equivalente, mas a aula não tem generatedTemplates — ` +
          `sem os textos o ramo gerado ficaria mudo`,
      );
    } else if (lesson.generatedTemplates) {
      try {
        generated = await generateBranches(solo, lesson.generatedTemplates, ask2, where);
      } catch (error) {
        if (error instanceof GeneratorError) {
          fail(error.code, where, error.message);
          return;
        }
        if (error instanceof OutOfScopeError) {
          fail("GERADOR_FORA_DE_ESCOPO", where, error.message);
          return;
        }
        throw error;
      }
    }
  }

  if (writeBack) {
    writeBranches(solo, rawStages.solo, generated);
  } else {
    const problem = branchesDiffer(solo, generated);
    if (problem) {
      fail(
        "RAMO_DESATUALIZADO",
        where,
        `${problem} — rode \`npm run validate:content -- --refresh-cache --write\``,
      );
    }
  }

  // Por caminho, não por nó: com transposição, contar nós engana.
  const longest = longestLine(solo);
  if (longest === "ciclo") {
    fail("LINHA_ESTOURA_TETO", where, "há um ciclo na árvore — alguma linha nunca termina");
  } else if (longest > solo.moveLimit) {
    fail(
      "LINHA_ESTOURA_TETO",
      where,
      `a linha mais longa pede ${longest} lances do aluno e o moveLimit é ${solo.moveLimit} — ` +
        `a saída honesta é subir o moveLimit da aula`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Conferência por aula
 * ------------------------------------------------------------------ */

function referencedPositionIds(lesson: Lesson): Array<{ id: string; stage: string }> {
  const refs: Array<{ id: string; stage: string }> = [];
  const s = lesson.stages;
  if (s.objective) refs.push({ id: s.objective.positionId, stage: "objective" });
  if (s.example) refs.push({ id: s.example.positionId, stage: "example" });
  if (s.guided) refs.push({ id: s.guided.positionId, stage: "guided" });
  if (s.solo) refs.push({ id: s.solo.positionId, stage: "solo" });
  if (s.practice) refs.push({ id: s.practice.positionId, stage: "practice" });
  for (const id of s.review?.reviewPositionIds ?? []) refs.push({ id, stage: "review" });
  return refs;
}

async function checkLesson(loaded: LoadedLesson) {
  const { lesson } = loaded;
  const where = `aula ${lesson.id}`;

  const refs = referencedPositionIds(lesson);
  for (const ref of refs) {
    const position = positions.get(ref.id);
    if (!position) {
      fail("POSICAO_INEXISTENTE", `${where} / ${ref.stage}`, `não existe a posição "${ref.id}"`);
      continue;
    }
    if (lesson.status === "published" && position.status !== "approved") {
      fail(
        "POSICAO_NAO_PUBLICAVEL",
        `${where} / ${ref.stage}`,
        `aula publicada referencia a posição "${ref.id}", de status "${position.status}" — ` +
          `só "approved" chega ao aluno`,
      );
    }
  }

  // Etapa 4 e etapa 6 pedem posições que o aluno não viu no ensino (§6, §2.3).
  const teaching = new Set(
    refs.filter((r) => ["objective", "example", "guided"].includes(r.stage)).map((r) => r.id),
  );
  for (const ref of refs.filter((r) => r.stage === "solo" || r.stage === "review")) {
    if (teaching.has(ref.id)) {
      fail(
        "POSICAO_REAPROVEITADA",
        `${where} / ${ref.stage}`,
        `"${ref.id}" já é usada no ensino; a etapa ${ref.stage} exige posição nova`,
      );
    }
  }

  // Etapa 2: a linha roteirizada precisa ser jogável do início ao fim.
  const example = lesson.stages.example;
  if (example) {
    const start = positions.get(example.positionId);
    if (start && !fenProblem(start.fen)) {
      let fen = start.fen;
      for (const [index, step] of example.steps.entries()) {
        const stepWhere = `${where} / example / lance ${index + 1} (${step.move})`;
        const beforeTurn = new Chess(fen).turn();
        const isStudentSide = beforeTurn === (lesson.orientation === "white" ? "w" : "b");
        if (isStudentSide && start.expectedResult === `win-${lesson.orientation}`) {
          const entry = await ask(fen, stepWhere);
          if (entry && !winningMovesOf(entry).includes(step.move)) {
            fail("EXEMPLO_NAO_GANHA", stepWhere, "o lance mostrado como técnica joga a vitória fora");
          }
        }
        const applied = applyUci(fen, step.move);
        if (!applied) {
          fail("EXEMPLO_ILEGAL", stepWhere, "lance ilegal — a linha da etapa 2 não é jogável");
          break;
        }
        fen = applied.fen;
      }
    }
  }

  if (lesson.stages.guided) {
    await checkTree(lesson, "guided", lesson.stages.guided, { allowHelp: true });
  }
  if (lesson.stages.solo) {
    const solo = lesson.stages.solo;
    await checkTree(lesson, "solo", solo, { allowHelp: false, moveLimit: solo.moveLimit });
  }
}

/* ------------------------------------------------------------------ *
 * Execução
 * ------------------------------------------------------------------ */

// A geração vem primeiro: o que ela produz passa pelas mesmas conferências que
// o resto da árvore — nó gerado é nó comum.
for (const loaded of lessons) {
  await generateFor(loaded);
}
for (const position of positions.values()) {
  await checkPosition(position);
}
for (const loaded of lessons) {
  await checkLesson(loaded);
}

if (writeBack) {
  for (const loaded of lessons) {
    const stages = (loaded.raw as { stages?: Record<string, unknown> }).stages ?? {};
    for (const stageName of ["guided", "solo"] as const) {
      const parsedStage = loaded.lesson.stages[stageName];
      const rawStage = stages[stageName] as { nodes?: Record<string, { winningMoves?: string[] }> };
      if (!parsedStage || !rawStage?.nodes) continue;
      for (const [nodeId, node] of Object.entries(parsedStage.nodes)) {
        if (rawStage.nodes[nodeId]) rawStage.nodes[nodeId].winningMoves = node.winningMoves;
      }
    }
    writeFileSync(loaded.file, `${JSON.stringify(loaded.raw, null, 2)}\n`, "utf8");
  }
}

const orphanCache = tablebase
  .existingFiles()
  .filter((file) => !tablebase.usedFiles().has(file));

// Só é seguro apagar cache órfão quando a conferência inteira rodou: se alguma
// posição nem chegou a ser consultada, "sem uso" não quer dizer "não serve".
if (pruneCache && issues.length === 0) {
  for (const file of orphanCache) rmSync(path.join(cacheDir, file));
}

console.log("");
console.log(`Conteúdo conferido em ${relative(contentDir)}`);
console.log(`  posições: ${positions.size}   aulas: ${lessons.length}`);
console.log(
  `  tablebase: ${tablebase.usedFiles().size} posições consultadas ` +
    `(${tablebase.hits} do cache, ${tablebase.fetched} pela rede)`,
);
if (orphanCache.length > 0) {
  console.log(
    pruneCache && issues.length === 0
      ? `  cache: ${orphanCache.length} arquivo(s) sem uso — removidos`
      : `  cache: ${orphanCache.length} arquivo(s) sem uso — rode com --prune-cache para remover`,
  );
}
console.log("");

if (issues.length === 0) {
  console.log(`${VERDE}✔ tudo verde — ${positions.size} posições e ${lessons.length} aula(s) sem nenhum problema${NORMAL}`);
  process.exit(0);
}

for (const issue of issues) {
  console.log(`${VERMELHO}✖ [${issue.code}] ${issue.where}${NORMAL}`);
  console.log(`    ${issue.message}`);
}
console.log("");
console.log(`${VERMELHO}✖ ${issues.length} problema(s) — conteúdo recusado${NORMAL}`);
process.exit(1);
