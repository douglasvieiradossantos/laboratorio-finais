import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import { fiftyMoveProgress, readOutcome } from "./status.ts";

/**
 * As razões de fim de partida (plano da F1, §5 / bloco B4.3).
 *
 * Até o B4 este arquivo era o único de `lib/chess/` sem teste, e devolvia
 * `"Empate."` genérico para os **dois** modos de fracasso mais comuns em final
 * elementar: o aluno que sabe dar o mate mas demora, e o que anda em círculos.
 * A etapa 5 mostra essa frase ao aluno; sem razão própria, ela não ensinava
 * nada.
 */

const outcomeDe = (fen: string) => readOutcome(new Chess(fen));

test("xeque-mate nomeia o vencedor pelo lado que está na vez", () => {
  // Rei preto em a8, torre branca em h8 dando xeque na oitava, rei branco em a6
  // cobrindo a7 e b7. Sem casa de fuga.
  const o = outcomeDe("k6R/8/K7/8/8/8/8/8 b - - 0 1");
  assert.equal(o.over, true);
  assert.equal(o.over && o.result, "win-white");
  assert.equal(o.over && o.reason, "Xeque-mate.");
});

test("rei afogado é empate, e é dito pelo nome", () => {
  // Rei preto em h8 sem lance legal e **sem** estar em xeque.
  const o = outcomeDe("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(o.over && o.result, "draw");
  assert.equal(o.over && o.reason, "Rei afogado — empate.");
});

test("material insuficiente vence as regras de contagem", () => {
  // A ordem importa: num final de torre, entregar a peça acaba aqui. Dizer
  // "50 lances sem progresso" seria verdade e não explicaria nada ao aluno.
  const o = outcomeDe("8/8/8/4k3/8/8/4K3/8 w - - 100 60");
  assert.equal(o.over && o.result, "draw");
  assert.equal(o.over && o.reason, "Material insuficiente para dar mate — empate.");
});

test("50 lances sem progresso tem razão própria", () => {
  // O quinto campo da FEN conta meios-lances; 100 deles são os "50 lances".
  const o = outcomeDe("8/8/8/4k3/8/8/4K3/7R w - - 100 60");
  assert.equal(o.over && o.result, "draw");
  assert.equal(o.over && o.reason, "50 lances sem progresso — empate.");
});

test("repetição tripla tem razão própria — e depende do histórico da instância", () => {
  // **A armadilha que decide o desenho da etapa 5.** `isThreefoldRepetition`
  // conta posições no histórico da instância; uma FEN não carrega histórico.
  // Quem reconstruir a partida com `new Chess(fenAtual)` a cada lance nunca
  // detecta repetição — e toda partida arrastaria até os 50 lances.
  const jogo = new Chess("8/8/8/4k3/8/8/4K3/7R w - - 0 1");
  for (const lance of ["Rh2", "Kd5", "Rh1", "Ke5", "Rh2", "Kd5", "Rh1", "Ke5"]) {
    jogo.move(lance);
  }

  const comHistorico = readOutcome(jogo);
  assert.equal(comHistorico.over, true, "a mesma posição voltou três vezes");
  assert.equal(comHistorico.over && comHistorico.reason, "A posição repetiu três vezes — empate.");

  // A mesma posição, sem histórico: a partida continua.
  const semHistorico = readOutcome(new Chess(jogo.fen()));
  assert.equal(semHistorico.over, false, "sem histórico a repetição é invisível");
});

test("partida em andamento não inventa desfecho", () => {
  assert.deepEqual(outcomeDe("8/8/8/4k3/8/8/4K3/7R w - - 0 1"), { over: false });
});

test("as cinco razões de fim de partida são distintas entre si", () => {
  // A invariante no molde de `refusal.test.ts`: dois desfechos diferentes não
  // podem produzir o mesmo texto, ou o aluno não consegue distingui-los.
  const repetida = new Chess("8/8/8/4k3/8/8/4K3/7R w - - 0 1");
  for (const lance of ["Rh2", "Kd5", "Rh1", "Ke5", "Rh2", "Kd5", "Rh1", "Ke5"]) repetida.move(lance);

  const razões = [
    outcomeDe("k6R/8/K7/8/8/8/8/8 b - - 0 1"),
    outcomeDe("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"),
    outcomeDe("8/8/8/4k3/8/8/4K3/8 w - - 100 60"),
    outcomeDe("8/8/8/4k3/8/8/4K3/7R w - - 100 60"),
    readOutcome(repetida),
  ].map((o) => (o.over ? o.reason : "(em andamento)"));

  assert.equal(new Set(razões).size, 5, `razões repetidas: ${razões.join(" | ")}`);
  assert.equal(razões.includes("Empate."), false, "algum desfecho ainda cai no genérico");
});

test("o contador de progresso lê meios-lances e devolve lances", () => {
  // É o que a etapa 5 mostra na tela para o empate por 50 lances não cair do céu.
  assert.deepEqual(fiftyMoveProgress(new Chess("8/8/8/4k3/8/8/4K3/7R w - - 0 1")), {
    used: 0,
    limit: 50,
  });
  assert.deepEqual(fiftyMoveProgress(new Chess("8/8/8/4k3/8/8/4K3/7R w - - 69 40")), {
    used: 34,
    limit: 50,
  });
});
