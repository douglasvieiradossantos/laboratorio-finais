import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Chess } from "chess.js";
import { Tablebase } from "./tablebase.ts";

/**
 * O gate testado contra si mesmo (plano da F1, §3.4).
 *
 * Cada mutação é um estrago plantado numa **cópia** do conteúdo — o
 * `content/` do repositório não é tocado. Cada uma precisa ficar vermelha,
 * e vermelha *pelo motivo certo*: o teste exige o código de erro esperado,
 * não só um exit diferente de zero.
 *
 *   npm run validate:mutations
 */

const VERDE = "\u001b[32m";
const VERMELHO = "\u001b[31m";
const CINZA = "\u001b[90m";
const NORMAL = "\u001b[0m";

const repo = process.cwd();
const source = path.join(repo, "content");
const validator = path.join(repo, "scripts", "validate-content.ts");

type Mutation = {
  titulo: string;
  /** O código de erro que esta mutação *precisa* provocar. */
  codigo: string;
  /** Pedaço de texto que a mensagem precisa conter, quando o código é genérico. */
  contem?: string;
  aplicar: (dir: string) => Promise<string>;
};

function lerAula(dir: string) {
  const file = path.join(dir, "lessons", "N0-R-MATE.json");
  return { file, json: JSON.parse(readFileSync(file, "utf8")) };
}
function lerPosicao(dir: string, id: string) {
  const file = path.join(dir, "positions", "N0", `${id}.json`);
  return { file, json: JSON.parse(readFileSync(file, "utf8")) };
}
function gravar(file: string, json: unknown) {
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, "utf8");
}

const MUTACOES: Mutation[] = [
  {
    titulo: "FEN ilegal (reis adjacentes) na posição de ensino",
    codigo: "FEN_ILEGAL",
    aplicar: async (dir) => {
      const { file, json } = lerPosicao(dir, "pos-n0-rmate-fx-a");
      json.fen = "8/8/8/4k3/4K3/8/8/7R w - - 0 1";
      gravar(file, json);
      return "fen → 8/8/8/4k3/4K3/8/8/7R (rei branco em e4, colado no preto em e5)";
    },
  },
  {
    titulo: "resultado esperado errado",
    codigo: "RESULTADO_ERRADO",
    aplicar: async (dir) => {
      const { file, json } = lerPosicao(dir, "pos-n0-rmate-fx-a");
      json.expectedResult = "draw";
      gravar(file, json);
      return 'expectedResult → "draw" numa posição que a tablebase dá como ganha';
    },
  },
  {
    titulo: "campo de proveniência faltando",
    codigo: "SCHEMA_POSICAO",
    contem: "fenMethod",
    aplicar: async (dir) => {
      const { file, json } = lerPosicao(dir, "pos-n0-rmate-fx-a");
      delete json.provenance.fenMethod;
      gravar(file, json);
      return "provenance.fenMethod apagado (sobram 8 dos 9 campos)";
    },
  },
  {
    titulo: "fixture referenciada por aula publicável",
    codigo: "POSICAO_NAO_PUBLICAVEL",
    aplicar: async (dir) => {
      const { file, json } = lerAula(dir);
      json.status = "published";
      gravar(file, json);
      return 'status da aula → "published", com as 4 posições ainda em "fixture"';
    },
  },
  {
    titulo: "lance perdedor marcado como método",
    codigo: "METODO_NAO_GANHA",
    aplicar: async (dir) => {
      const { file, json } = lerAula(dir);
      const node = json.stages.guided.nodes.n2;
      node.expects[0].moves = ["h4c4"];
      node.mistakes = node.mistakes.filter((m: { moves: string[] }) => m.moves[0] !== "h4c4");
      gravar(file, json);
      return "n2: expects passa a ser Rc4, que entrega a torre ao rei preto";
    },
  },
  {
    titulo: "nó terminal sem mate",
    codigo: "TERMINAL_SEM_MATE",
    aplicar: async (dir) => {
      const { file, json } = lerAula(dir);
      const node = json.stages.guided.nodes.n14;
      const naoDaMate = node.winningMoves.find((uci: string) => {
        const game = new Chess(node.fen);
        game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
        return !game.isCheckmate();
      });
      node.expects[0].moves = [naoDaMate];
      gravar(file, json);
      return `n14: o lance final vira ${naoDaMate}, que ganha mas não dá mate`;
    },
  },
  {
    titulo: "defensor frouxo (resposta que encurta o mate)",
    codigo: "DEFENSOR_FROUXO",
    aplicar: async (dir) => {
      const { file, json } = lerAula(dir);
      const tablebase = new Tablebase(path.join(dir, "tablebase-cache"), true);
      for (const nodeId of Object.keys(json.stages.guided.nodes)) {
        const node = json.stages.guided.nodes[nodeId];
        const expect = node.expects[0];
        if (!expect.reply) continue;
        const game = new Chess(node.fen);
        const move = expect.moves[0];
        game.move({ from: move.slice(0, 2), to: move.slice(2, 4) });
        const entry = await tablebase.lookup(game.fen());
        const defesas = entry.moves
          .map((m) => ({ uci: m.uci, plies: m.checkmate ? 0 : Math.abs(m.dtm ?? 0) }))
          .sort((a, b) => a.plies - b.plies);
        const pior = defesas[0];
        const melhor = defesas[defesas.length - 1];
        if (melhor.plies - pior.plies <= 2) continue;
        expect.reply = pior.uci;
        gravar(file, json);
        return (
          `${nodeId}: a resposta do defensor vira ${pior.uci} (mate em ${pior.plies} plies), ` +
          `quando a melhor defesa aguenta ${melhor.plies}`
        );
      }
      throw new Error("nenhum nó tem defesa fraca o bastante para plantar a mutação");
    },
  },
  {
    titulo: "teto de lances impossível na etapa 4",
    codigo: "TETO_IMPOSSIVEL",
    aplicar: async (dir) => {
      const { file, json } = lerAula(dir);
      json.stages.solo.moveLimit = 2;
      gravar(file, json);
      return "moveLimit da etapa 4 → 2, numa posição que precisa de 8 lances";
    },
  },
];

function rodarValidador(dir: string) {
  const result = spawnSync(process.execPath, [validator, "--content", dir, "--refresh-cache"], {
    cwd: repo,
    encoding: "utf8",
  });
  return { status: result.status ?? -1, saida: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

/** Tira as cores da saída do validador, para poder procurar texto nela. */
const limpar = (texto: string) => texto.replace(/\u001b\[\d+m/g, "");

function linhasDoCodigo(saida: string, codigo: string): string[] {
  const linhas = saida.split(/\r?\n/);
  const encontradas: string[] = [];
  for (const [i, linha] of linhas.entries()) {
    if (!limpar(linha).includes(`[${codigo}]`)) continue;
    const cabeca = limpar(linha).replace(/^\s*✖\s*/, "").trim();
    encontradas.push(`${cabeca}\n      ${limpar(linhas[i + 1] ?? "").trim()}`);
  }
  return encontradas;
}

const base = mkdtempSync(path.join(tmpdir(), "labfinais-mutacoes-"));
let vermelhos = 0;

console.log("");
console.log("Teste do gate contra si mesmo — 8 mutações plantadas (§3.4 do plano da F1)");
console.log(`${CINZA}cópia de trabalho em ${base}${NORMAL}`);
console.log("");

// Controle: a cópia intacta precisa passar. Sem isso, um vermelho não prova nada.
const controle = path.join(base, "controle");
cpSync(source, controle, { recursive: true });
const resultadoControle = rodarValidador(controle);
if (resultadoControle.status === 0) {
  console.log(`  ${VERDE}✔${NORMAL} controle — a cópia intacta passa no validador`);
} else {
  console.log(`  ${VERMELHO}✖ controle — a cópia intacta já falha; o teste não vale${NORMAL}`);
  console.log(limpar(resultadoControle.saida));
  process.exit(1);
}
console.log("");

for (const [i, mutacao] of MUTACOES.entries()) {
  const dir = path.join(base, `m${i + 1}`);
  cpSync(source, dir, { recursive: true });
  const detalhe = await mutacao.aplicar(dir);
  const { status, saida } = rodarValidador(dir);
  const achados = linhasDoCodigo(saida, mutacao.codigo);
  const contemOk = mutacao.contem ? achados.some((l) => l.includes(mutacao.contem as string)) : true;
  const passou = status !== 0 && achados.length > 0 && contemOk;
  if (passou) vermelhos += 1;

  console.log(`${i + 1}. ${mutacao.titulo}`);
  console.log(`   ${CINZA}${detalhe}${NORMAL}`);
  if (passou) {
    console.log(`   ${VERMELHO}✖ ${achados[0]}${NORMAL}`);
  } else {
    console.log(
      `   ${VERDE}!! a mutação passou batido${NORMAL} — exit ${status}, ` +
        `esperado o código ${mutacao.codigo}${mutacao.contem ? ` com "${mutacao.contem}"` : ""}`,
    );
    console.log(limpar(saida));
  }
  console.log("");
}

rmSync(base, { recursive: true, force: true });

const cor = vermelhos === MUTACOES.length ? VERDE : VERMELHO;
console.log(`${cor}${vermelhos} de ${MUTACOES.length} mutações ficaram vermelhas${NORMAL}`);
process.exit(vermelhos === MUTACOES.length ? 0 : 1);
