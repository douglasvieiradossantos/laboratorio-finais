import assert from "node:assert/strict";
import test from "node:test";
import {
  boxAfter,
  boxArea,
  classify,
  cutSquares,
  cuts,
  isEquivalent,
  OutOfScopeError,
  techniqueScope,
} from "./technique.ts";

/**
 * O predicado da técnica, medido nas posições da própria aula N0-R-MATE.
 *
 * Os números aqui não são invenção: são a caixa que sobra para o rei preto em
 * cada caso, e é sobre eles que o gerador decide o que é "a mesma técnica".
 */

/** Etapa 4, nó raiz: rei preto em a8, rei branco em e2, torre em h1. */
const S1 = "k7/8/8/8/8/8/4K3/7R w - - 0 1";
/** Etapa 4, nó s4: rei preto em a5, rei branco em c4, torre em b1. */
const S4 = "8/8/8/k7/2K5/8/8/1R6 w - - 6 4";
/** Etapa 3, nó n7: torre em d5 cortando os dois eixos. */
const N7 = "8/8/2k5/3R4/3K4/8/8/8 w - - 12 7";

test("torre em h1 com o rei branco em e2 não corta nada: a caixa é o tabuleiro", () => {
  assert.equal(boxArea(S1), 64);
  // A 1ª fileira não é corte: o rei branco está do mesmo lado que o preto.
  assert.deepEqual(
    cuts(S1).map((cut) => cut.axis),
    [],
  );
});

test("a caixa que cada corte deixa é a que o plano mediu", () => {
  assert.equal(boxAfter(S1, "h1b1"), 8); // coluna a inteira
  assert.equal(boxAfter(S1, "h1h7"), 8); // 8ª fileira inteira
  assert.equal(boxAfter(S1, "h1c1"), 16); // duas colunas
  assert.equal(boxAfter(S1, "h1h3"), 40); // cinco fileiras
});

test("h1h7 é a mesma técnica que h1b1; h1c1 e h1h3 não são", () => {
  assert.equal(isEquivalent(S1, ["h1b1"], "h1h7"), true);
  assert.equal(isEquivalent(S1, ["h1b1"], "h1c1"), false);
  assert.equal(isEquivalent(S1, ["h1b1"], "h1h3"), false);
});

test("nó cujo roteiro não é corte não tem equivalente nenhum", () => {
  // Em s4 o lance do roteiro é um tempo de torre; nada ali é "a mesma técnica".
  assert.equal(classify(S4, "b1b2"), "tempo");
  assert.equal(isEquivalent(S4, ["b1b2"], "b1b3"), false);
});

test("as quatro classes de lance da técnica", () => {
  assert.equal(classify(S1, "h1b1"), "cut");
  assert.equal(classify(S1, "e2d3"), "approach");
  assert.equal(classify(S4, "b1b2"), "tempo");
  assert.equal(classify("8/k1K5/8/8/8/8/1R6/8 w - - 14 8", "b2a2"), "mate");
  // Xeque que só faz o rei andar e devolve a caixa inteira não é técnica.
  assert.equal(classify(S1, "h1a1"), "other");
});

test("o rei que fecha uma coluna se aproxima, mesmo sem encurtar a caminhada", () => {
  // Primeiro nó do ramo gerado: rei branco em e2, rei preto em b8, torre h7.
  // De e2 e de d2 são 6 lances até b8 — mas d2 fechou uma coluna, e é isso
  // que separa "o rei se aproxima" de um lance qualquer.
  assert.equal(classify("1k6/7R/8/8/8/8/4K3/8 w - - 2 2", "e2d2"), "approach");
  assert.equal(classify("1k6/7R/8/8/8/8/4K3/8 w - - 2 2", "e2f2"), "other");
});

test("corte nos dois eixos compõe: 3 colunas × 3 fileiras", () => {
  const found = cuts(N7);
  assert.equal(found.length, 2);
  assert.deepEqual(
    found.map((cut) => cut.axis).sort(),
    ["file", "rank"],
  );
  assert.equal(boxArea(N7), 9);
});

test("a linha do corte sai inteira, menos a casa da própria peça", () => {
  const file = cuts(N7).find((cut) => cut.axis === "file");
  assert.ok(file);
  assert.deepEqual(cutSquares(file), ["d1", "d2", "d3", "d4", "d6", "d7", "d8"]);
});

test("fora do escopo v0 o predicado recusa em vez de chutar", () => {
  // Duas torres (a aula da escada) não são modeladas pela caixa de uma peça só.
  assert.throws(() => techniqueScope("k7/8/8/8/8/8/R7/1R5K w - - 0 1"), OutOfScopeError);
  // Nem posição em que o atacante não está na vez.
  assert.throws(() => classify("k7/8/8/8/8/8/4K3/7R b - - 0 1", "a8a7"), OutOfScopeError);
});
