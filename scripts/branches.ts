import { Chess } from "chess.js";
import { applyUci, samePosition } from "../lib/chess/fen.ts";
import {
  boxArea,
  classify,
  cuts,
  isEquivalent,
  techniqueScope,
  type MoveClass,
} from "../lib/chess/technique.ts";
import type { Expect, GeneratedTemplates, MoveTree, TreeNode } from "../lib/lesson/schema.ts";
import { pliesAfter, winningMovesOf, type TbEntry } from "./tablebase.ts";

/**
 * O gerador de ramos equivalentes (plano da Parte D).
 *
 * **O princípio que não muda (§3 da F1): runtime só compara listas.** Toda a
 * computação daqui roda na autoria, offline a partir do cache da tablebase, e
 * o resultado é gravado no arquivo da aula. Um ramo gerado é um nó comum, com
 * expects comuns — a etapa 4 não sabe que ele foi derivado.
 *
 * Duas coisas saem daqui:
 *
 * - **etapa 4 (`solo`)**: o lance equivalente vira um `expect` de verdade, e a
 *   aula segue por um ramo novo até o mate. É a decisão do Doug: "Th7 em vez
 *   de Tb1 é a mesma técnica; aceite e siga";
 * - **etapa 3 (`guided`)**: só a lista `methodAlternatives`, sem ramo. Lá o
 *   aluno é elogiado e a peça volta, para a linha escrita seguir valendo.
 *
 * Tudo é determinístico: a mesma entrada dá exatamente a mesma saída, sempre —
 * é isso que permite ao gate offline recomputar e comparar com o gravado, do
 * mesmo jeito que já faz com o `winningMoves`.
 */

/** Ids reservados ao gerador. Nó autoral com esse nome é erro do gate. */
export const GENERATED_ID = /^g\d+$/;

/** Teto duro de nós por árvore. Estourar é vermelho, nunca poda silenciosa. */
export const NODE_CEILING = 40;

/** Trava contra laço infinito: nenhuma linha de mate da N0 chega perto disso. */
const MAX_BRANCH_DEPTH = 60;

export class GeneratorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GeneratorError";
  }
}

/** Como o gerador consulta a tablebase. Devolve `null` quando não conseguiu. */
export type Lookup = (fen: string, where: string) => Promise<TbEntry | null>;

export type GeneratedTree = {
  /** Expects gerados a acrescentar ao nó, por id de nó autoral. */
  expects: Map<string, Expect[]>;
  /** Nós novos, na ordem em que foram criados (g1, g2, …). */
  nodes: Map<string, TreeNode>;
};

/* ------------------------------------------------------------------ *
 * Leitura da árvore
 * ------------------------------------------------------------------ */

/** Os expects escritos por gente. */
export function authorialExpects(node: TreeNode): Expect[] {
  return node.expects.filter((expect) => expect.generated !== true);
}

/**
 * A árvore como o autor a escreveu: sem nó gerado, sem expect gerado, sem
 * `methodAlternatives`. É a partir daqui que a geração recomeça do zero —
 * é o que torna a regeneração idempotente.
 */
export function withoutGenerated(tree: MoveTree): MoveTree {
  const nodes: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (GENERATED_ID.test(id)) continue;
    const clean: TreeNode = { ...node, expects: authorialExpects(node) };
    delete clean.methodAlternatives;
    delete clean.generated;
    nodes[id] = clean;
  }
  return { ...tree, nodes };
}

/* ------------------------------------------------------------------ *
 * Escolha de lance
 * ------------------------------------------------------------------ */

type Scored = { uci: string; plies: number };

function scored(entry: TbEntry, keep: (move: TbEntry["moves"][number]) => boolean): Scored[] {
  return entry.moves
    .filter(keep)
    .map((move) => ({ uci: move.uci, plies: pliesAfter(move) }))
    .filter((move): move is Scored => move.plies !== null);
}

/**
 * A defesa perfeita: a que aguenta mais plies. O desempate é o menor UCI, e
 * ele não afrouxa nada — entre duas defesas de mesmo DTM a diferença é 0, bem
 * dentro do teto de 2 plies que o `DEFENSOR_FROUXO` já cobra.
 */
function bestDefense(entry: TbEntry): string | null {
  let best: Scored | null = null;
  for (const move of scored(entry, () => true)) {
    if (!best || move.plies > best.plies || (move.plies === best.plies && move.uci < best.uci)) {
      best = move;
    }
  }
  return best?.uci ?? null;
}

/** O mate mais curto entre os lances permitidos. Desempate pelo menor UCI. */
function shortestWin(entry: TbEntry, allowed: Set<string>): string | null {
  let best: Scored | null = null;
  for (const move of scored(entry, (m) => m.category === "loss" && allowed.has(m.uci))) {
    if (!best || move.plies < best.plies || (move.plies === best.plies && move.uci < best.uci)) {
      best = move;
    }
  }
  return best?.uci ?? null;
}

/**
 * O filtro de técnica da política híbrida (§D.3 do plano).
 *
 * DTM puro, sozinho, joga lances que só funcionam por zugzwang: o template
 * diria "a torre corta" numa posição em que ela fez outra coisa, e o texto
 * mentiria para o aluno. Uma máquina de fases escrita à mão seria mais código
 * e mais modos de falha. O meio-termo é este: filtrar pelo que a técnica
 * admite, e dentro do filtro deixar a tablebase escolher.
 *
 * Duas regras: a caixa nunca cresce, e a peça maior só larga a linha de corte
 * para dar mate.
 */
function techniqueFilter(fen: string, moves: string[]): string[] {
  const scope = techniqueScope(fen);
  const boxNow = boxArea(fen);
  const axesNow = new Set(
    cuts(fen)
      .filter((cut) => cut.color === scope.attacker)
      .map((cut) => cut.axis),
  );

  return moves.filter((uci) => {
    const after = applyUci(fen, uci);
    if (!after) return false;
    if (after.game.isCheckmate()) return true;

    if (boxArea(after.fen) > boxNow) return false;

    if (uci.slice(0, 2) === scope.major) {
      const axesAfter = new Set(
        cuts(after.fen)
          .filter((cut) => cut.color === scope.attacker)
          .map((cut) => cut.axis),
      );
      for (const axis of axesNow) if (!axesAfter.has(axis)) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Os candidatos equivalentes
 * ------------------------------------------------------------------ */

/**
 * Os lances que aplicam a mesma técnica do roteiro neste nó, em ordem UCI.
 * Vazio quando o lance do roteiro não é um corte — a equivalência só é
 * avaliada em nó de corte, senão todo tempo de torre viraria ramo.
 */
export function equivalentCandidates(node: TreeNode, winning: string[]): string[] {
  const script = authorialExpects(node).flatMap((expect) => expect.moves);
  if (script.length === 0) return [];
  const excluded = new Set([...script, ...(node.mistakes ?? []).flatMap((m) => m.moves)]);

  return winning
    .filter((uci) => !excluded.has(uci))
    .filter((uci) => isEquivalent(node.fen, script, uci))
    .sort();
}

/* ------------------------------------------------------------------ *
 * Etapa 3 — só a lista de alternativas
 * ------------------------------------------------------------------ */

export async function generateAlternatives(
  tree: MoveTree,
  ask: Lookup,
  where: string,
): Promise<Map<string, string[]>> {
  const authorial = withoutGenerated(tree);
  const found = new Map<string, string[]>();

  for (const [id, node] of Object.entries(authorial.nodes)) {
    const entry = await ask(node.fen, `${where} / ${id}`);
    if (!entry) continue;
    const candidates = equivalentCandidates(node, winningMovesOf(entry));
    if (candidates.length > 0) found.set(id, candidates);
  }
  return found;
}

/* ------------------------------------------------------------------ *
 * Etapa 4 — os ramos de verdade
 * ------------------------------------------------------------------ */

export async function generateBranches(
  tree: MoveTree,
  templates: GeneratedTemplates,
  ask: Lookup,
  where: string,
): Promise<GeneratedTree> {
  const authorial = withoutGenerated(tree);

  /** Todos os nós conhecidos, para fundir transposição pela FEN. */
  const known = new Map<string, TreeNode>(Object.entries(authorial.nodes));
  const expects = new Map<string, Expect[]>();
  const nodes = new Map<string, TreeNode>();
  const pending: string[] = [];
  let counter = 0;

  function nodeFor(fen: string, winning: string[]): string {
    for (const [id, node] of known) {
      if (samePosition(node.fen, fen)) return id;
    }
    counter += 1;
    const id = `g${counter}`;
    const node: TreeNode = { fen, expects: [], winningMoves: winning, generated: true };
    known.set(id, node);
    nodes.set(id, node);
    pending.push(id);
    if (known.size > NODE_CEILING) {
      throw new GeneratorError(
        "EXPLOSAO_DE_ARVORE",
        `a árvore passou de ${NODE_CEILING} nós ao gerar os ramos equivalentes — ` +
          `reveja os expects da autoria ou aceite menos equivalentes à mão`,
      );
    }
    return id;
  }

  /** Monta o expect de um lance do atacante, criando o nó seguinte se preciso. */
  async function expectFor(fen: string, uci: string, at: string): Promise<Expect> {
    const feedback = templates[classify(fen, uci) satisfies MoveClass];
    const after = applyUci(fen, uci);
    if (!after) {
      throw new GeneratorError("GERADOR_SEM_LANCE", `"${uci}" não é legal em ${fen}`);
    }
    if (after.game.isCheckmate()) {
      return { moves: [uci], feedback, generated: true };
    }

    const afterEntry = await ask(after.fen, at);
    if (!afterEntry) {
      throw new GeneratorError("GERADOR_SEM_LANCE", `sem tablebase para ${after.fen}`);
    }
    const reply = bestDefense(afterEntry);
    if (!reply) {
      throw new GeneratorError(
        "GERADOR_SEM_LANCE",
        `o defensor não tem resposta medível depois de "${uci}" em ${fen}`,
      );
    }

    const afterReply = applyUci(after.fen, reply);
    if (!afterReply) {
      throw new GeneratorError("GERADOR_SEM_LANCE", `a resposta "${reply}" não é legal em ${after.fen}`);
    }
    const targetEntry = await ask(afterReply.fen, at);
    if (!targetEntry) {
      throw new GeneratorError("GERADOR_SEM_LANCE", `sem tablebase para ${afterReply.fen}`);
    }

    return {
      moves: [uci],
      reply,
      next: nodeFor(afterReply.fen, winningMovesOf(targetEntry)),
      feedback,
      generated: true,
    };
  }

  // Fase 1 — os nós autorais, em BFS a partir da raiz. É esta ordem, com os
  // candidatos em ordem UCI, que torna a numeração g1, g2, … determinística.
  const queue = [authorial.root];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = authorial.nodes[id];
    if (!node) continue;

    for (const expect of authorialExpects(node)) {
      if (expect.next) queue.push(expect.next);
    }

    const entry = await ask(node.fen, `${where} / ${id}`);
    if (!entry) continue;
    const candidates = equivalentCandidates(node, winningMovesOf(entry));
    if (candidates.length === 0) continue;

    const built: Expect[] = [];
    for (const uci of candidates) built.push(await expectFor(node.fen, uci, `${where} / ${id}`));
    expects.set(id, built);
  }

  // Fase 2 — cada ramo segue sozinho até o mate, um lance por nó.
  let steps = 0;
  while (pending.length > 0) {
    const id = pending.shift() as string;
    const node = nodes.get(id);
    if (!node) continue;

    steps += 1;
    if (steps > MAX_BRANCH_DEPTH) {
      throw new GeneratorError("EXPLOSAO_DE_ARVORE", "o ramo não terminou — laço na continuação");
    }

    const at = `${where} / ${id}`;
    const entry = await ask(node.fen, at);
    if (!entry) {
      throw new GeneratorError("GERADOR_SEM_LANCE", `sem tablebase para o nó gerado ${id}`);
    }

    const allowed = techniqueFilter(node.fen, winningMovesOf(entry));
    const move = allowed.length > 0 ? shortestWin(entry, new Set(allowed)) : null;
    if (!move) {
      throw new GeneratorError(
        "GERADOR_SEM_LANCE",
        `nenhum lance vencedor do nó gerado ${id} (${node.fen}) cabe na técnica — ` +
          `o ramo não pode ser continuado sem mentir no texto`,
      );
    }

    node.expects = [await expectFor(node.fen, move, at)];
  }

  return { expects, nodes };
}

/* ------------------------------------------------------------------ *
 * Comparação com o que está gravado
 * ------------------------------------------------------------------ */

/** Forma canônica de um expect, para comparar arquivo com derivação. */
function expectKey(expect: Expect): string {
  return JSON.stringify([expect.moves, expect.reply ?? null, expect.next ?? null, expect.feedback]);
}

/**
 * O que o arquivo tem de gerado bate com o que a derivação produziu?
 * Devolve a primeira divergência em português, ou `null` se está tudo igual.
 */
export function branchesDiffer(tree: MoveTree, generated: GeneratedTree): string | null {
  const fileNodes = new Set(Object.keys(tree.nodes).filter((id) => GENERATED_ID.test(id)));
  for (const id of generated.nodes.keys()) {
    if (!fileNodes.has(id)) return `falta o nó gerado "${id}"`;
    fileNodes.delete(id);
  }
  if (fileNodes.size > 0) {
    return `sobram nós gerados que a derivação não produz: ${[...fileNodes].sort().join(", ")}`;
  }

  for (const [id, node] of generated.nodes) {
    const inFile = tree.nodes[id];
    if (!samePosition(inFile.fen, node.fen)) return `a FEN do nó gerado "${id}" não bate`;
    const derived = node.expects.map(expectKey).sort();
    const stored = inFile.expects.filter((e) => e.generated === true).map(expectKey).sort();
    if (derived.join("|") !== stored.join("|")) return `os expects do nó gerado "${id}" não batem`;
  }

  for (const [id, node] of Object.entries(tree.nodes)) {
    if (GENERATED_ID.test(id)) continue;
    const derived = (generated.expects.get(id) ?? []).map(expectKey).sort();
    const stored = node.expects.filter((e) => e.generated === true).map(expectKey).sort();
    if (derived.join("|") !== stored.join("|")) {
      return `os expects gerados do nó "${id}" não batem com a derivação`;
    }
  }

  return null;
}

/** Idem, para a lista `methodAlternatives` da etapa 3. */
export function alternativesDiffer(
  tree: MoveTree,
  generated: Map<string, string[]>,
): string | null {
  for (const [id, node] of Object.entries(tree.nodes)) {
    const derived = generated.get(id) ?? [];
    const stored = node.methodAlternatives ?? [];
    if (derived.join(",") !== [...stored].sort().join(",")) {
      return `as alternativas do nó "${id}" não batem: arquivo [${stored.join(", ")}], ` +
        `derivação [${derived.join(", ")}]`;
    }
  }
  return null;
}

/** Só para o gate: quantos lances do aluno a linha mais longa da árvore tem. */
export function longestLine(tree: MoveTree): number | "ciclo" {
  const memo = new Map<string, number>();

  function walk(id: string, path: Set<string>): number | "ciclo" {
    if (path.has(id)) return "ciclo";
    const cached = memo.get(id);
    if (cached !== undefined) return cached;

    const node = tree.nodes[id];
    if (!node) return 0;

    path.add(id);
    let worst = 0;
    for (const expect of node.expects) {
      if (!expect.next) continue;
      const deeper = walk(expect.next, path);
      if (deeper === "ciclo") return "ciclo";
      worst = Math.max(worst, deeper);
    }
    path.delete(id);

    const result = worst + 1; // o lance do aluno neste nó
    memo.set(id, result);
    return result;
  }

  return walk(tree.root, new Set());
}

/** Existe algum lance legal do atacante nesta FEN? Guarda contra FEN torta. */
export function attackerToMove(fen: string): boolean {
  const game = new Chess(fen);
  return game.turn() === techniqueScope(fen).attacker;
}
