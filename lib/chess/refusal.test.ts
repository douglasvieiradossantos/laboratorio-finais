import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import { refusalReason } from "./refusal.ts";

/**
 * A pendência da F0: recusa em silêncio não existe mais. Cada caso abaixo é
 * uma recusa diferente, e cada uma tem de dizer *outra coisa* — se duas
 * recusas diferentes dessem o mesmo texto, o aluno não saberia o que fez.
 */

test("peça do lado errado: a recusa diz de quem é a vez", () => {
  const game = new Chess("8/8/8/4k3/8/8/4K3/7R w - - 0 1");
  assert.equal(
    refusalReason(game, "e5", "e4"),
    "Essa peça é das pretas, e agora é a vez das brancas.",
  );
});

test("destino inalcançável: a recusa nomeia a peça e as duas casas", () => {
  const game = new Chess("8/8/8/4k3/8/8/4K3/7R w - - 0 1");
  assert.equal(refusalReason(game, "h1", "g2"), "A torre não vai de h1 para g2.");
});

test("em xeque: a recusa explica que só valem lances que tiram o rei de lá", () => {
  const game = new Chess("7k/8/8/R7/8/8/4K3/4r3 w - - 0 1");
  assert.equal(
    refusalReason(game, "a5", "a6"),
    "A torre de a5 não pode se mexer: você está em xeque, e só valem lances que tirem o rei de lá.",
  );
});

test("peça cravada: a recusa diz que sair deixaria o rei em xeque", () => {
  const game = new Chess("4r2k/8/8/8/8/8/4B3/4K3 w - - 0 1");
  assert.equal(
    refusalReason(game, "e2", "d3"),
    "O bispo de e2 não tem lance legal — sair de e2 deixaria o seu rei em xeque.",
  );
});

test("as quatro recusas dão quatro textos diferentes", () => {
  const board = new Chess("8/8/8/4k3/8/8/4K3/7R w - - 0 1");
  const check = new Chess("7k/8/8/R7/8/8/4K3/4r3 w - - 0 1");
  const pin = new Chess("4r2k/8/8/8/8/8/4B3/4K3 w - - 0 1");
  const textos = new Set([
    refusalReason(board, "e5", "e4"),
    refusalReason(board, "h1", "g2"),
    refusalReason(check, "a5", "a6"),
    refusalReason(pin, "e2", "d3"),
  ]);
  assert.equal(textos.size, 4);
});
