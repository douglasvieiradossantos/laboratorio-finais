import type { Chess, Color as ChessColor } from "chess.js";
import type { Color, Dests, Key } from "@lichess-org/chessground/types";

/**
 * Traduz os lances legais que a chess.js conhece para o formato de "destinos"
 * que o chessground usa para pintar os pontinhos verdes no tabuleiro.
 */
export function legalDests(game: Chess): Dests {
  const dests: Dests = new Map();
  for (const move of game.moves({ verbose: true })) {
    const from = move.from as Key;
    const to = move.to as Key;
    const existing = dests.get(from);
    if (existing) existing.push(to);
    else dests.set(from, [to]);
  }
  return dests;
}

/** 'w' | 'b' da chess.js para 'white' | 'black' do chessground. */
export function toBoardColor(color: ChessColor): Color {
  return color === "w" ? "white" : "black";
}
