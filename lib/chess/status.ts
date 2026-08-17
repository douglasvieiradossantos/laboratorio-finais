import type { Chess } from "chess.js";

export type GameOutcome =
  | { over: false }
  | { over: true; result: "win-white" | "win-black" | "draw"; reason: string };

/**
 * Lê o fim de partida da chess.js e devolve o motivo já em português.
 * Ordem importa: mate antes de afogamento, material insuficiente antes de
 * "empate" genérico — é o que o aluno precisa ver num final de rei e peão.
 *
 * ## Uma armadilha que decide o desenho de quem chama
 *
 * As duas razões de empate por regra **não são simétricas**:
 *
 * - `isDrawByFiftyMoves()` lê o relógio de meio-lance, que é o quinto campo da
 *   FEN. Sobrevive a `new Chess(fen)`.
 * - `isThreefoldRepetition()` **não**. Ela conta posições no histórico da
 *   instância, e uma FEN não carrega histórico nenhum.
 *
 * Consequência prática: quem reconstrói a partida a cada lance com
 * `new Chess(fenAtual)` **nunca** detecta repetição, e toda partida arrasta até
 * os 50 lances. É por isso que a etapa 5 guarda `(fen inicial, lances)` e
 * reconstrói a partida inteira, em vez de guardar a posição corrente.
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
  // Antes das regras de contagem, de propósito: num final de torre, entregar a
  // peça acaba em material insuficiente, e é isso que o aluno precisa ouvir —
  // não "50 lances sem progresso", que seria verdade e não explicaria nada.
  if (game.isInsufficientMaterial()) {
    return {
      over: true,
      result: "draw",
      reason: "Material insuficiente para dar mate — empate.",
    };
  }
  // Os dois modos de fracasso mais comuns em final elementar: o aluno sabe dar
  // o mate mas demora, ou anda em círculos. Sem razão própria os dois caíam no
  // "Empate." genérico, e a aula não dizia o que houve.
  if (game.isDrawByFiftyMoves()) {
    return { over: true, result: "draw", reason: "50 lances sem progresso — empate." };
  }
  if (game.isThreefoldRepetition()) {
    return { over: true, result: "draw", reason: "A posição repetiu três vezes — empate." };
  }
  return { over: true, result: "draw", reason: "Empate." };
}

/**
 * Quantos lances ainda restam antes do empate por falta de progresso.
 *
 * O quinto campo da FEN conta **meios-lances** (um de cada cor); a regra fecha
 * em 100 deles, que é o que se chama de "50 lances". A etapa 5 mostra isso na
 * tela para o empate não cair do céu no lance 100.
 */
export function fiftyMoveProgress(game: Chess): { used: number; limit: number } {
  const halfmoves = Number(game.fen().split(" ")[4] ?? 0);
  return { used: Math.floor(halfmoves / 2), limit: 50 };
}
