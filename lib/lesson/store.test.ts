import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Chess } from "chess.js";
import { lessonSchema, type MoveTree } from "./schema.ts";
import {
  restingMessage,
  restingPracticeMessage,
  reviewKey,
  useLessonStore,
  type TreeKey,
  type TreeState,
} from "./store.ts";
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

/* ------------------------------------------------------------------ *
 * Etapas 5 e 6 — a partida contra o motor (F1/B4)
 * ------------------------------------------------------------------ */

const practice = lesson.stages.practice!;
const PRACTICE_FEN = "8/8/8/8/8/2k5/8/2K4R w - - 0 1";

/** Abre a aula já com a partida da etapa 5 registrada, como o `LessonPlayer` faz. */
function openWithPractice() {
  useLessonStore
    .getState()
    .open(lesson.id, "practice", { solo: lesson.stages.solo!.root }, [
      { key: "practice", positionId: practice.positionId, startFen: PRACTICE_FEN },
    ]);
}

/** O replay que o `PracticeStage` faz: origem mais lances reconstroem a partida. */
function replay(state: { startFen: string; moves: string[] }): Chess {
  const game = new Chess(state.startFen);
  for (const uci of state.moves) {
    game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4) : undefined,
    });
  }
  return game;
}

test("a partida sobrevive a sair da etapa e voltar, reproduzindo a mesma posição", () => {
  openWithPractice();
  const store = useLessonStore.getState();
  // Aluno e motor alternando: os dois lados entram pela mesma ação.
  for (const uci of ["h1h3", "c3c4", "c1c2", "c4b4"]) store.practiceMove("practice", uci);

  const antes = replay(useLessonStore.getState().practices.practice!).fen();

  useLessonStore.getState().goToStage("solo");
  useLessonStore.getState().goToStage("practice");

  const depois = replay(useLessonStore.getState().practices.practice!).fen();
  assert.equal(depois, antes, "voltar à etapa ressuscitou outra posição");
  assert.equal(useLessonStore.getState().practices.practice!.moves.length, 4);
});

test("guardar lances, e não a FEN, é o que mantém a repetição visível", () => {
  // A razão de `PracticeState` ter `moves` em vez de `fen`: `isThreefoldRepetition`
  // conta o histórico da instância, e uma FEN não carrega histórico. Se a store
  // guardasse só a posição corrente, este desfecho seria invisível.
  openWithPractice();
  const store = useLessonStore.getState();
  for (const uci of ["h1h2", "c3c4", "h2h1", "c4c3", "h1h2", "c3c4", "h2h1", "c4c3"]) {
    store.practiceMove("practice", uci);
  }
  assert.equal(replay(useLessonStore.getState().practices.practice!).isThreefoldRepetition(), true);
});

test("o desfecho volta ao painel depois de sair e voltar", () => {
  openWithPractice();
  useLessonStore.getState().practiceMove("practice", "h1h3");
  useLessonStore.getState().practiceFinish("practice", {
    result: "draw",
    text: "50 lances sem progresso — empate. A caixa precisa encolher mais rápido.",
    passed: false,
  });

  useLessonStore.getState().goToStage("solo");
  useLessonStore.getState().goToStage("practice");

  const painel = restingPracticeMessage(useLessonStore.getState().practices.practice);
  assert.equal(painel?.tone, "warn", "empate reprovado é âmbar, não rubro");
  assert.equal(painel?.seq, 0, "estado reencontrado não é evento novo");
  assert.equal(painel?.done, false, "reprovação não carimba etapa concluída");
  assert.ok(painel?.text.startsWith("50 lances"));
});

test("recomeçar zera os lances e sobe a tentativa", () => {
  openWithPractice();
  const store = useLessonStore.getState();
  for (const uci of ["h1h3", "c3c4"]) store.practiceMove("practice", uci);
  store.practiceFinish("practice", { result: "draw", text: "empatou", passed: false });

  useLessonStore.getState().practiceRestart("practice");

  const state = useLessonStore.getState().practices.practice!;
  assert.deepEqual(state.moves, []);
  assert.equal(state.attempt, 2);
  assert.equal(state.status, "playing");
  assert.equal(restingPracticeMessage(state), null, "recomeçar limpa o painel junto");
  assert.equal(replay(state).fen(), PRACTICE_FEN);
});

test("lance depois do fim da partida é recusado pela store", () => {
  openWithPractice();
  useLessonStore.getState().practiceFinish("practice", {
    result: "win-white",
    text: "venceu",
    passed: true,
  });
  useLessonStore.getState().practiceMove("practice", "h1h3");
  assert.deepEqual(useLessonStore.getState().practices.practice!.moves, []);
});

test("a etapa 4 vencida liga o selo, e recomeçá-la não o desliga", () => {
  // O critério de domínio é "na mesma sessão" (§6 do plano): quem zera é trocar
  // de aula. Recomeçar a etapa 4 por curiosidade não pode tirar o que foi feito.
  playScriptedLine("solo", lesson.stages.solo!);
  assert.equal(useLessonStore.getState().cleared.solo, true);

  useLessonStore.getState().treeRestart("solo");
  assert.equal(useLessonStore.getState().cleared.solo, true, "o selo não é revogável");
});

test("só a etapa 5 vencida liga o selo da prática — revisão não conta", () => {
  useLessonStore.getState().open(lesson.id, "practice", {}, [
    { key: "practice", positionId: practice.positionId, startFen: PRACTICE_FEN },
    { key: reviewKey("pos-n0-rmate-fx-d"), positionId: "pos-n0-rmate-fx-d", startFen: PRACTICE_FEN },
  ]);

  useLessonStore.getState().practiceFinish(reviewKey("pos-n0-rmate-fx-d"), {
    result: "win-white",
    text: "venceu a revisão",
    passed: true,
  });
  assert.equal(useLessonStore.getState().cleared.practice, false, "revisão não afere domínio");

  useLessonStore.getState().practiceFinish("practice", {
    result: "win-white",
    text: "venceu a prática",
    passed: true,
  });
  assert.equal(useLessonStore.getState().cleared.practice, true);
});

test("abrir a aula zera o selo — é o que define a mesma sessão", () => {
  playScriptedLine("solo", lesson.stages.solo!);
  assert.equal(useLessonStore.getState().cleared.solo, true);
  openWithPractice();
  assert.deepEqual(useLessonStore.getState().cleared, { solo: false, practice: false });
});
