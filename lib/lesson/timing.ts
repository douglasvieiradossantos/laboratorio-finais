/**
 * Os tempos da aula, num lugar só.
 *
 * Este arquivo nasceu no F1/B4 porque o `REPLY_DELAY_MS` estava copiado em três
 * arquivos e a etapa 5 criaria o quarto — justamente no invariante que o
 * `CLAUDE.md` trata como teto medível e que o `lib/sound-catalog.test.ts`
 * cobra. Número copiado é número que um dia diverge.
 */

/**
 * O intervalo entre o lance do aluno e a resposta do defensor.
 *
 * É o compasso da aula: sem ele os dois lances viram um borrão e o aluno não vê
 * o que a própria peça fez. É também um **teto duro para o som** — nenhum
 * efeito de lance, captura ou xeque pode passar disto, ou os dois lances viram
 * lama sonora. O `lib/sound-catalog.test.ts` reprova a síntese que estourar.
 *
 * Vale para os dois defensores, que chegam por caminhos bem diferentes:
 *
 * - etapas 3 e 4 — a resposta é escrita na autoria e sai instantânea, então o
 *   atraso é integral (`setTimeout` de 620 ms no `TreeStage`);
 * - etapa 5 — a resposta vem do Stockfish e demora o que demorar. Ali o atraso
 *   é o que **falta** para completar 620 ms desde o lance do aluno: motor que
 *   responde em 80 ms ainda espera 540; motor que leva 900 não espera nada.
 *   Ver `restingDelay` abaixo.
 */
export const REPLY_DELAY_MS = 620;

/**
 * Quanto ainda falta esperar para a resposta não atropelar o lance do aluno.
 *
 * `elapsedMs` é medido do commit do lance do aluno até a resposta ficar pronta.
 * O resultado nunca é negativo: a conta é "complete o compasso", não "some um
 * atraso".
 */
export function restingDelay(elapsedMs: number, floorMs: number = REPLY_DELAY_MS): number {
  return Math.max(0, floorMs - elapsedMs);
}
