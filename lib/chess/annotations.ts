import { Chess } from "chess.js";
import type { Color, Square } from "chess.js";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Key } from "@lichess-org/chessground/types";
import { cutSquares, cuts } from "./technique.ts";

/**
 * Destaques pedagógicos derivados da posição — o que o Doug pediu depois do
 * primeiro teste da aula: "eu não vejo o corte acontecer".
 *
 * **Isto não avalia lance.** São dois fatos de regra, da mesma classe do
 * `legalDests` que já roda em runtime: que casas a peça maior tranca (o corte)
 * e se a peça que acabou de mexer está atacada e sem defesa. Quem diz se um
 * lance é bom continua sendo a lista certificada do arquivo (§3 do plano).
 *
 * Só as etapas 2 e 3 recebem estes destaques. A etapa 4 fica limpa de
 * propósito: é onde o domínio é aferido, e ajuda automática ali seria cola.
 */

/** A cor do rei em xeque já vem do chessground; aqui não se mexe nisso. */
const CUT_BRUSH = "paleRed";
const HANGING_BRUSH = "red";
const DEFENDED_BRUSH = "green";

export function teachingShapes(
  fen: string,
  lastMove?: readonly [string, string] | null,
): DrawShape[] {
  const shapes: DrawShape[] = [];

  // A parede: a linha inteira que o rei inimigo não atravessa.
  for (const cut of cuts(fen)) {
    for (const square of cutSquares(cut)) {
      shapes.push({ orig: square as Key, brush: CUT_BRUSH });
    }
  }

  const safety = movedPieceSafety(fen, lastMove);
  if (safety) shapes.push(safety);

  return shapes;
}

/**
 * A peça que acabou de mexer está pendurada?
 *
 * É a pergunta que o aluno da N0 mais erra: a torre chega perto do rei preto e
 * ninguém avisa. Vermelho = atacada e sem defesa. Verde = atacada, mas
 * defendida — a diferença entre "perdi a torre" e "isso é a técnica".
 */
function movedPieceSafety(
  fen: string,
  lastMove?: readonly [string, string] | null,
): DrawShape | null {
  if (!lastMove) return null;
  const destination = lastMove[1] as Square;

  const game = new Chess(fen);
  const piece = game.get(destination);
  if (!piece) return null;

  const enemy: Color = piece.color === "w" ? "b" : "w";
  if (!game.isAttacked(destination, enemy)) return null;

  return {
    orig: destination as Key,
    brush: game.isAttacked(destination, piece.color) ? DEFENDED_BRUSH : HANGING_BRUSH,
  };
}
