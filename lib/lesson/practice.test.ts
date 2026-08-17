import assert from "node:assert/strict";
import test from "node:test";
import type { GameOutcome } from "../chess/status.ts";
import { judgePractice, type PracticeGoal, type PracticeSide } from "./practice.ts";

/**
 * O juiz da etapa 5 (plano da F1, §5 / bloco B4.3).
 *
 * A matriz inteira: 2 objetivos × 3 resultados × 2 lados, mais a partida em
 * andamento. Treze combinações, porque errar o cruzamento de "lado do aluno"
 * com "quem venceu" dá o pior tipo de bug — o aluno perde a partida e a tela o
 * parabeniza.
 */

const mate = (result: "win-white" | "win-black"): GameOutcome => ({
  over: true,
  result,
  reason: "Xeque-mate.",
});

const empate = (reason: string): GameOutcome => ({ over: true, result: "draw", reason });

const CINQUENTA = empate("50 lances sem progresso — empate.");
const REPETICAO = empate("A posição repetiu três vezes — empate.");
const AFOGADO = empate("Rei afogado — empate.");
const MATERIAL = empate("Material insuficiente para dar mate — empate.");

test("partida em andamento não é aprovada nem reprovada", () => {
  for (const goal of ["win", "draw"] as PracticeGoal[]) {
    for (const side of ["white", "black"] as PracticeSide[]) {
      assert.deepEqual(judgePractice({ over: false }, goal, side), { kind: "playing" });
    }
  }
});

test("o aluno vence do seu lado, qualquer que seja ele", () => {
  assert.equal(judgePractice(mate("win-white"), "win", "white").kind, "passed");
  assert.equal(judgePractice(mate("win-black"), "win", "black").kind, "passed");
});

test("vencer quando bastava empatar é aprovação, não erro", () => {
  const v = judgePractice(mate("win-white"), "draw", "white");
  assert.equal(v.kind, "passed");
  assert.equal(v.kind === "passed" && v.text.includes("bastava empatar"), true);
});

test("o computador vencendo reprova em rubro, dos dois lados", () => {
  for (const [outcome, side] of [
    [mate("win-black"), "white"],
    [mate("win-white"), "black"],
  ] as const) {
    const v = judgePractice(outcome, "win", side);
    assert.equal(v.kind, "failed");
    assert.equal(v.kind === "failed" && v.tone, "bad");
  }
});

test("empate reprova em âmbar quando o objetivo era vencer", () => {
  for (const side of ["white", "black"] as PracticeSide[]) {
    const v = judgePractice(CINQUENTA, "win", side);
    assert.equal(v.kind, "failed");
    // Âmbar, não rubro: demorar não é o mesmo que jogar a vitória fora. É a
    // convenção que a etapa 4 já usa para o teto de lances.
    assert.equal(v.kind === "failed" && v.tone, "warn");
  }
});

test("empate aprova quando o objetivo era empatar", () => {
  for (const side of ["white", "black"] as PracticeSide[]) {
    assert.equal(judgePractice(AFOGADO, "draw", side).kind, "passed");
  }
});

test("cada tipo de empate ensina uma coisa diferente", () => {
  // O conselho vem do motivo do empate. Um texto só para "empatou" jogaria fora
  // a informação mais útil que a partida produziu: como a vitória escapou.
  const textos = [CINQUENTA, REPETICAO, AFOGADO, MATERIAL].map((o) => {
    const v = judgePractice(o, "win", "white");
    return v.kind === "failed" ? v.text : "(não reprovou)";
  });
  assert.equal(new Set(textos).size, 4, `conselho repetido:\n${textos.join("\n")}`);
  assert.equal(textos.some((t) => t.includes("(não reprovou)")), false);
});

test("todo texto de fracasso é distinto de todo outro", () => {
  // A invariante de `refusal.test.ts`: dois fracassos diferentes não podem
  // produzir a mesma frase, ou o aluno não sabe o que corrigir.
  const fracassos = [
    judgePractice(CINQUENTA, "win", "white"),
    judgePractice(REPETICAO, "win", "white"),
    judgePractice(AFOGADO, "win", "white"),
    judgePractice(MATERIAL, "win", "white"),
    judgePractice(mate("win-black"), "win", "white"),
  ].map((v) => (v.kind === "failed" ? v.text : "(?)"));

  assert.equal(new Set(fracassos).size, 5, `texto repetido:\n${fracassos.join("\n")}`);
});

test("o texto sempre começa pelo que aconteceu no tabuleiro", () => {
  // O aluno precisa ler primeiro o fato, depois o conselho — e o `readOutcome`
  // é a única classificação de desfecho do projeto.
  const v = judgePractice(REPETICAO, "win", "white");
  assert.equal(v.kind === "failed" && v.text.startsWith("A posição repetiu três vezes"), true);
});
