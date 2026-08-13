import type { Chess } from "chess.js";

export type GameOutcome =
  | { over: false }
  | { over: true; result: "win-white" | "win-black" | "draw"; reason: string };

/**
 * Lê o fim de partida da chess.js e devolve o motivo já em português.
 * Ordem importa: mate antes de afogamento, material insuficiente antes de
 * "empate" genérico — é o que o aluno precisa ver num final de rei e peão.
 */
export function readOutcome(game: Chess): GameOutcome {
  if (!game.isGameOver()) return { over: false };

  if (game.isCheckmate()) {
    // Quem levou o mate é quem está na vez de jogar.
    const loser = game.turn();
    return {
      over: true,
      result: loser === "w" ? "win-black" : "win-white",
      reason: "Xeque-mate.",
    };
  }
  if (game.isStalemate()) {
    return { over: true, result: "draw", reason: "Rei afogado — empate." };
  }
  if (game.isInsufficientMaterial()) {
    return {
      over: true,
      result: "draw",
      reason: "Material insuficiente para dar mate — empate.",
    };
  }
  return { over: true, result: "draw", reason: "Empate." };
}
