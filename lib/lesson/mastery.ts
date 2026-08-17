/**
 * O critério de domínio, D1 (plano da F1, §6).
 *
 * > **Dominado** numa competência de N0 = na mesma sessão: completar a etapa 4
 * > numa posição nunca vista, sem dica, sem nenhum lance que jogue a vitória
 * > fora, sem afogamento e dentro do teto de lances; **e** vencer a etapa 5
 * > contra o Stockfish.
 *
 * A etapa 1 já mostra esse critério por extenso ao aluno, desde o B3. Sem esta
 * função a aula abria com uma promessa que ela mesma nunca respondia.
 *
 * ## Por que dois booleanos bastam
 *
 * "Sem dica, sem jogar a vitória fora, sem afogamento, dentro do teto" parece
 * exigir contabilidade nova, e não exige — porque a etapa 4 **já** encerra a
 * tentativa em cada um desses casos: um lance que joga a vitória fora chama
 * `treeFail`, estourar o teto também, a etapa roda com `allowHelp={false}` (não
 * existe dica para pedir), e o gate de conteúdo prova que todo nó terminal é
 * mate de verdade, o que descarta afogamento. Logo `status === "done"` na etapa
 * 4 **é** o critério inteiro, e o que falta é lê-lo.
 *
 * Puro: nem React, nem store, nem chess.js. É o que permite ao `node --test`
 * cobrir as quatro combinações.
 */

export type MasteryReport = {
  mastered: boolean;
  headline: string;
  /** O que ainda falta, na ordem em que o aluno deve atacar. Vazio se dominado. */
  missing: Array<{ stage: "solo" | "practice"; text: string }>;
};

const FALTA_SOLO =
  "Completar a etapa sem ajuda até o mate, numa posição que você não viu nas etapas anteriores. É lá que o domínio é aferido.";
const FALTA_PRACTICE =
  "Vencer o computador aqui na prática real. Saber a técnica e executá-la contra quem resiste são duas coisas.";

export function masteryReport({
  soloCleared,
  practiceWon,
}: {
  soloCleared: boolean;
  practiceWon: boolean;
}): MasteryReport {
  const missing: MasteryReport["missing"] = [];
  if (!soloCleared) missing.push({ stage: "solo", text: FALTA_SOLO });
  if (!practiceWon) missing.push({ stage: "practice", text: FALTA_PRACTICE });

  if (missing.length === 0) {
    return {
      mastered: true,
      headline:
        "Dominado. Etapa sem ajuda completada e computador vencido, na mesma sessão — é o critério inteiro.",
      missing,
    };
  }

  return {
    mastered: false,
    headline:
      missing.length === 2
        ? "Ainda não dominado. Faltam as duas metades do critério."
        : "Quase. Falta uma metade do critério.",
    missing,
  };
}
