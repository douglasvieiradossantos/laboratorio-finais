import assert from "node:assert/strict";
import test from "node:test";
import { masteryReport } from "./mastery.ts";

/**
 * O critério de domínio, D1 (plano da F1, §6 / bloco B4.5).
 *
 * As quatro combinações, porque a etapa 1 promete ao aluno, por extenso, o que
 * conta como dominado — e o selo é a única resposta a essa promessa. Um selo
 * que erra a contabilidade é pior que selo nenhum: diz "dominado" a quem não
 * dominou, ou esconde de quem dominou o que já conquistou.
 */

const casos = [
  { soloCleared: false, practiceWon: false },
  { soloCleared: true, practiceWon: false },
  { soloCleared: false, practiceWon: true },
  { soloCleared: true, practiceWon: true },
];

test("só os dois juntos dão domínio", () => {
  for (const caso of casos) {
    const esperado = caso.soloCleared && caso.practiceWon;
    assert.equal(masteryReport(caso).mastered, esperado, JSON.stringify(caso));
  }
});

test("o que falta é exatamente o que não foi feito", () => {
  assert.deepEqual(
    masteryReport({ soloCleared: false, practiceWon: false }).missing.map((m) => m.stage),
    ["solo", "practice"],
  );
  assert.deepEqual(
    masteryReport({ soloCleared: true, practiceWon: false }).missing.map((m) => m.stage),
    ["practice"],
  );
  assert.deepEqual(
    masteryReport({ soloCleared: false, practiceWon: true }).missing.map((m) => m.stage),
    ["solo"],
  );
  assert.deepEqual(masteryReport({ soloCleared: true, practiceWon: true }).missing, []);
});

test("`missing` vazio se e somente se dominado", () => {
  // A invariante que impede o selo de dizer "dominado" e listar pendências, ou
  // de dizer "falta" sem dizer o quê.
  for (const caso of casos) {
    const r = masteryReport(caso);
    assert.equal(r.mastered, r.missing.length === 0, JSON.stringify(caso));
  }
});

test("cada combinação tem um título próprio", () => {
  const titulos = casos.map((c) => masteryReport(c).headline);
  // Três títulos para quatro casos: "falta uma" é o mesmo texto para as duas
  // metades que faltam, porque o *que* falta vem na lista logo abaixo.
  assert.equal(new Set(titulos).size, 3, titulos.join(" | "));
  assert.equal(titulos[3].startsWith("Dominado"), true);
  assert.equal(titulos[0].startsWith("Ainda não dominado"), true);
});

test("os dois textos de pendência são distintos e nomeiam a etapa certa", () => {
  const r = masteryReport({ soloCleared: false, practiceWon: false });
  const [solo, practice] = r.missing;
  assert.notEqual(solo.text, practice.text);
  assert.equal(solo.text.includes("sem ajuda"), true);
  assert.equal(practice.text.includes("computador"), true);
});
