import type { Chess, Square } from "chess.js";

/**
 * Por que este lance foi recusado — em português, nomeando a peça e as casas.
 *
 * Existe porque "a peça voltou sozinha" não é resposta: o aluno precisa saber
 * se errou o alvo, se mexeu a peça do outro lado ou se o rei dele está em
 * xeque. É a pendência da F0 (a recusa silenciosa do `PositionPlayer`).
 */

const PIECE: Record<string, string> = {
  p: "O peão",
  n: "O cavalo",
  b: "O bispo",
  r: "A torre",
  q: "A dama",
  k: "O rei",
};

const SIDE: Record<string, string> = { w: "brancas", b: "pretas" };

export function refusalReason(game: Chess, orig: string, dest: string): string {
  const piece = game.get(orig as Square);
  if (!piece) return `Não há peça em ${orig}.`;

  const turn = game.turn();
  if (piece.color !== turn) {
    return `Essa peça é das ${SIDE[piece.color]}, e agora é a vez das ${SIDE[turn]}.`;
  }

  const name = PIECE[piece.type] ?? "A peça";
  const fromOrig = game.moves({ verbose: true }).filter((move) => move.from === orig);

  if (fromOrig.length === 0) {
    return game.isCheck()
      ? `${name} de ${orig} não pode se mexer: você está em xeque, e só valem lances que tirem o rei de lá.`
      : `${name} de ${orig} não tem lance legal — sair de ${orig} deixaria o seu rei em xeque.`;
  }

  return game.isCheck()
    ? `${name} não vai de ${orig} para ${dest} — e você está em xeque: só valem lances que tirem o rei de lá.`
    : `${name} não vai de ${orig} para ${dest}.`;
}
