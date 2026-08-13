import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Chess } from "chess.js";
import { lessonSchema } from "./schema.ts";
import { judgeMove, throwsWinAway } from "./tree.ts";

/**
 * A tabela da §3.2 do plano, linha por linha, rodando sobre a aula de verdade:
 * método avança, erro nomeado tem texto próprio, e os dois fallbacks honestos
 * cobrem todo o resto. É o que o aluno vai ouvir a cada lance — e o que
 * garante que **nenhum** lance recusado saia sem mensagem.
 */

const lesson = lessonSchema.parse(
  JSON.parse(
    readFileSync(path.join(process.cwd(), "content/lessons/N0-R-MATE.json"), "utf8"),
  ),
);
const guided = lesson.stages.guided!;
const root = guided.nodes[guided.root];

function legalMoves(fen: string): string[] {
  return new Chess(fen)
    .moves({ verbose: true })
    .map((move) => `${move.from}${move.to}${move.promotion ?? ""}`);
}

test("lance do método: avança e traz a resposta do defensor", () => {
  const verdict = judgeMove(lesson, root, "h1h4");
  assert.equal(verdict.kind, "method");
  assert.equal(verdict.next, "n2");
  assert.equal(verdict.reply, "e5d5");
  assert.equal(throwsWinAway(verdict), false);
});

test("erro nomeado: devolve o texto declarado na aula, não um genérico", () => {
  const verdict = judgeMove(lesson, root, "h1h5");
  assert.equal(verdict.kind, "named-error");
  assert.equal(verdict.errorId, "cheque-inutil");
  assert.equal(verdict.text, lesson.errors["cheque-inutil"].text);
  assert.notEqual(verdict.text, lesson.fallbacks.winningOffMethod);
});

test("lance que ganha mas não é o método: fallback honesto de off-method", () => {
  const naoListado = root.winningMoves.filter(
    (move) =>
      !root.expects.some((e) => e.moves.includes(move)) &&
      !(root.mistakes ?? []).some((m) => m.moves.includes(move)),
  );
  assert.ok(naoListado.length > 0, "o nó raiz precisa ter algum lance vencedor fora das listas");

  const verdict = judgeMove(lesson, root, naoListado[0]);
  assert.equal(verdict.kind, "off-method");
  assert.equal(verdict.text, lesson.fallbacks.winningOffMethod);
  assert.equal(throwsWinAway(verdict), false);
});

test("lance que joga a vitória fora: fallback honesto de loses-win", () => {
  // A raiz do mate de torre é generosa demais (todo lance legal ainda ganha),
  // então o caso vem do primeiro nó da árvore em que existe lance perdedor.
  const encontrado = Object.values(guided.nodes)
    .flatMap((node) =>
      legalMoves(node.fen)
        .filter(
          (move) =>
            !node.winningMoves.includes(move) &&
            !(node.mistakes ?? []).some((m) => m.moves.includes(move)),
        )
        .map((move) => ({ node, move })),
    )
    .at(0);
  assert.ok(encontrado, "a árvore precisa ter ao menos um lance que perde a vitória");

  const verdict = judgeMove(lesson, encontrado.node, encontrado.move);
  assert.equal(verdict.kind, "loses-win");
  assert.equal(verdict.text, lesson.fallbacks.losesWin);
  assert.equal(throwsWinAway(verdict), true);
});

test("nenhum lance legal da árvore fica sem mensagem", () => {
  let julgados = 0;
  for (const node of Object.values(guided.nodes)) {
    for (const move of legalMoves(node.fen)) {
      const verdict = judgeMove(lesson, node, move);
      const texto = verdict.kind === "method" ? verdict.feedback : verdict.text;
      assert.ok(texto.length > 0, `lance ${move} sem texto`);
      julgados += 1;
    }
  }
  assert.ok(julgados > 100, `poucos lances julgados: ${julgados}`);
  console.log(`  ${julgados} lances legais julgados, todos com mensagem`);
});
