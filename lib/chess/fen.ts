import { Chess } from "chess.js";

/**
 * Duas operações de FEN que o gate e o gerador de ramos usam nos dois lados.
 * Moram aqui porque duplicá-las já custou uma divergência sutil uma vez: se a
 * identidade de posição do gerador não for **exatamente** a do validador, uma
 * transposição funde num lugar e não funde no outro.
 */

/**
 * Identidade da posição: peças, vez, roque e en passant — sem os contadores.
 * É o critério de "mesma posição" que funde transposições no mesmo nó.
 */
export function samePosition(a: string, b: string): boolean {
  const key = (fen: string) => fen.trim().split(/\s+/).slice(0, 4).join(" ");
  return key(a) === key(b);
}

export type Applied = { fen: string; game: Chess };

/** Aplica um lance em UCI. `null` quando o lance não é legal ali. */
export function applyUci(fen: string, uci: string): Applied | null {
  const game = new Chess(fen);
  try {
    game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4) : undefined,
    });
  } catch {
    return null;
  }
  return { fen: game.fen(), game };
}
