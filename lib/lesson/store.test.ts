import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Chess } from "chess.js";
import { lessonSchema, type MoveTree } from "./schema.ts";
import { restingMessage, useLessonStore, type TreeKey, type TreeState } from "./store.ts";
import { judgeMove, throwsWinAway } from "./tree.ts";

/**
 * A store da aula vista de fora, como o `TreeStage` a usa. O que se cobra aqui
 * é o que a store precisa **carregar sozinha**: sair de uma etapa desmonta o
 * componente e leva junto tudo que era estado local dele. O que não estiver
 * guardado aqui não existe mais quando o aluno volta.
 */

const lesson = lessonSchema.parse(
  JSON.parse(readFileSync(path.join(process.cwd(), "content/lessons/N0-R-MATE.json"), "utf8")),
);
const guided = lesson.stages.guided!;

/**
 * Reproduz o que o `TreeStage` faz quando o aluno joga o roteiro do autor até o
 * lance que dá mate: um `treeAdvance` por lance, e no nó terminal o `null` que
 * encerra a etapa. Devolve a posição final — a que o tabuleiro mostra na
 * comemoração.
 */
function playScriptedLine(key: TreeKey, tree: MoveTree) {
  useLessonStore.getState().open(lesson.id, key, { [key]: tree.root });

  let nodeId = tree.root;
  for (;;) {
    const node = tree.nodes[nodeId];
    const expect = node.expects.find((e) => !e.generated)!;
    const uci = expect.moves[0];
    const game = new Chess(node.fen);
    game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });

    if (expect.next === undefined) {
      const end = {
        fen: game.fen(),
        lastMove: [uci.slice(0, 2), uci.slice(2, 4)] as [string, string],
        text: expect.feedback,
      };
      useLessonStore.getState().treeAdvance(key, null, end);
      useLessonStore.getState().celebrate(expect.feedback);
      return end;
    }

    // O componente responde pelo defensor antes de avançar; a store só registra
    // o nó novo, então a resposta não muda nada aqui.
    useLessonStore.getState().treeAdvance(key, expect.next);
    nodeId = expect.next;
  }
}

function legalMoves(fen: string): string[] {
  return new Chess(fen)
    .moves({ verbose: true })
    .map((move) => `${move.from}${move.to}${move.promotion ?? ""}`);
}

/**
 * Abre a etapa e caminha pelo roteiro do autor até o primeiro nó em que existe
 * um lance legal fora de `winningMoves` — o lance que encerra a tentativa.
 * Devolve o nó parado e esse lance.
 */
function advanceToLosingChance(key: TreeKey, tree: MoveTree) {
  useLessonStore.getState().open(lesson.id, key, { [key]: tree.root });

  let nodeId = tree.root;
  for (;;) {
    const node = tree.nodes[nodeId];
    const losing = legalMoves(node.fen).find((uci) => !node.winningMoves.includes(uci));
    if (losing) return { nodeId, node, losing };

    const expect = node.expects.find((e) => !e.generated)!;
    assert.ok(expect.next, `nenhum nó da linha de ${key} admite lance perdedor`);
    useLessonStore.getState().treeAdvance(key, expect.next);
    nodeId = expect.next;
  }
}

/**
 * A posição que a etapa desenha ao remontar. Sem o `drawn` local do componente,
 * sobra só o que a store guardou: o nó parado é o **anterior** ao mate, porque
 * o lance terminal não tem nó de destino.
 */
function fenOnReentry(state: TreeState, tree: MoveTree): string {
  return state.end?.fen ?? tree.nodes[state.nodeId].fen;
}

test("etapa concluída continua concluída depois de sair e voltar", () => {
  const end = playScriptedLine("guided", guided);

  // O aluno vai para outra etapa e volta — é isso que desmonta o `TreeStage` e
  // apaga a mensagem do painel.
  useLessonStore.getState().goToStage("solo");
  useLessonStore.getState().goToStage("guided");

  const state = useLessonStore.getState().trees.guided!;
  assert.equal(state.status, "done");
  assert.equal(useLessonStore.getState().message, null, "sair da etapa apaga a mensagem");

  const drawn = fenOnReentry(state, guided);
  assert.ok(
    new Chess(drawn).isCheckmate(),
    `a etapa concluída precisa desenhar o mate, e não a posição anterior a ele (${drawn})`,
  );
  assert.equal(drawn, end.fen);
  assert.deepEqual(state.end?.lastMove, end.lastMove);

  const resting = restingMessage(state);
  assert.equal(resting?.text, end.text, "o texto da conclusão volta ao painel");
  assert.equal(resting?.done, true, "e volta com o selo de conclusão, não como feedback comum");
  assert.equal(resting?.tone, "good");
});

test("tentativa encerrada continua explicada depois de sair e voltar", () => {
  const solo = lesson.stages.solo!;
  // Na raiz não há o que errar de fatal: com a torre longe do rei preto, todo
  // lance legal ainda ganha. O lance que joga a vitória fora aparece um nó
  // adiante, quando a torre já pode ser capturada.
  const { node, losing } = advanceToLosingChance("solo", solo);
  const verdict = judgeMove(lesson, node, losing);
  assert.ok(verdict.kind !== "method", "um lance fora de `winningMoves` não pode ser o método");
  assert.ok(throwsWinAway(verdict), "o lance escolhido precisa mesmo jogar a vitória fora");

  const text = `${verdict.text} Sem a vitória não há o que treinar: a tentativa acabou.`;
  useLessonStore.getState().treeFail("solo", { tone: "bad", text });
  useLessonStore.getState().say("bad", text, losing.slice(2, 4));

  useLessonStore.getState().goToStage("guided");
  useLessonStore.getState().goToStage("solo");

  const state = useLessonStore.getState().trees.solo!;
  assert.equal(state.status, "failed");
  assert.equal(useLessonStore.getState().message, null, "sair da etapa apaga a mensagem");

  const resting = restingMessage(state);
  assert.equal(resting?.text, text, "o aluno precisa reencontrar o motivo, não só o botão");
  assert.equal(resting?.tone, "bad");
  assert.notEqual(resting?.done, true, "tentativa encerrada não é conclusão: sem selo");
  assert.equal(
    fenOnReentry(state, solo),
    node.fen,
    "o lance foi recusado, então a posição continua a do nó",
  );
});

test("teto de lances estourado: o texto do limite também sobrevive", () => {
  const solo = lesson.stages.solo!;
  useLessonStore.getState().open(lesson.id, "solo", { solo: solo.root });

  const text = `O teto de ${solo.moveLimit} lances acabou e o mate não saiu. Recomece: o método precisa caber no limite.`;
  useLessonStore.getState().treeFail("solo", { tone: "warn", text });
  useLessonStore.getState().goToStage("guided");
  useLessonStore.getState().goToStage("solo");

  const resting = restingMessage(useLessonStore.getState().trees.solo);
  assert.equal(resting?.text, text);
  assert.equal(resting?.tone, "warn", "o teto avisa, não repreende: o tom é o âmbar");
});

test("sem desfecho não há mensagem de descanso", () => {
  useLessonStore.getState().open(lesson.id, "guided", { guided: guided.root });
  assert.equal(restingMessage(useLessonStore.getState().trees.guided), null);
  assert.equal(restingMessage(undefined), null, "etapa que nem existe não fala");
});

test("recomeçar apaga a conclusão e devolve a etapa à raiz", () => {
  playScriptedLine("solo", lesson.stages.solo!);
  useLessonStore.getState().treeRestart("solo");

  const state = useLessonStore.getState().trees.solo!;
  assert.equal(state.status, "playing");
  assert.equal(state.end, null, "a conclusão da tentativa anterior não pode sobreviver");
  assert.equal(state.failure, null);
  assert.equal(restingMessage(state), null, "recomeçar limpa o painel junto com a árvore");
  assert.equal(state.nodeId, state.rootId);
  assert.equal(state.studentMoves, 0);
  assert.equal(state.attempt, 2);
  assert.equal(fenOnReentry(state, lesson.stages.solo!), lesson.stages.solo!.nodes[state.rootId].fen);
});

test("o lance que dá mate conta como lance do aluno", () => {
  const solo = lesson.stages.solo!;
  playScriptedLine("solo", solo);

  let expected = 0;
  let nodeId = solo.root;
  for (;;) {
    expected += 1;
    const expect = solo.nodes[nodeId].expects.find((e) => !e.generated)!;
    if (expect.next === undefined) break;
    nodeId = expect.next;
  }

  const state = useLessonStore.getState().trees.solo!;
  assert.equal(state.studentMoves, expected);
  assert.ok(state.studentMoves <= solo.moveLimit, "o roteiro do autor cabe no teto da etapa");
});
