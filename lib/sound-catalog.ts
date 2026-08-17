/**
 * O catálogo dos sons: qual variante de síntese toca em cada efeito, quando ela
 * toca, e a medição da referência que guiou o desenho. **Dado puro — nenhum
 * `window`, nenhum WebAudio.**
 *
 * Dois motivos para ser um arquivo separado de `lib/sound.ts`: o gate
 * (`lib/sound-catalog.test.ts`) importa dado sem precisar de navegador, e
 * `sound.ts` continua sendo mecânica — contexto, preferência, síntese.
 *
 * **Os seis sons são sintetizados, e isso é decisão fechada.** A busca por um
 * pacote gravado foi feita: 13 amostras CC0 do kenney.nl foram baixadas,
 * convertidas, normalizadas, medidas e ouvidas, e **nenhuma foi aprovada**. Os
 * arquivos e toda a camada que os carregava saíram do projeto; a história está no
 * README. O que restou é o que se provou útil — a **medição**, em
 * `lib/spectrum.ts`, e as variantes de síntese, em `VARIANTS`.
 *
 * **O que a pesquisa de licença descartou**, para ninguém refazer a busca:
 * - `standard/Check.mp3` do Lichess é um link simbólico para `Silence.mp3`, de
 *   14 bytes: **não existe** som de xeque padrão do Lichess. A equipe fechou o
 *   pedido como *not planned* e propôs que xeque seja o som de lance (issue 8365).
 * - Nenhum som de erro do Lichess tem licença livre: os quatro conjuntos abertos
 *   (`sfx`, `piano`, `futuristic`, `nes`) fazem link para `standard/Error.mp3`,
 *   que o `COPYING.md` deles lista como não-livre. A AGPL deles também traria a
 *   obrigação do §13, que a GPL-3.0 do chessground não traz.
 * - Chess.com é proprietário: o User Agreement veta uso, cópia e redistribuição
 *   de "sounds" nominalmente.
 */

export type EffectName = "lance" | "captura" | "xeque" | "recusa" | "acerto" | "conclusao";

/**
 * A medição de um som de referência que a síntese imita.
 *
 * **Nada do arquivo de referência entra no projeto** — o que entra é este punhado
 * de números, e a síntese escrita a partir deles. Os sons do Chess.com são
 * proprietários. Medir o espectro de um som para escrever outro parecido é o que
 * se faz ao ouvir uma referência e compor: o que se distribui é obra nossa.
 * Copiar o arquivo não seria.
 *
 * Como foi medido: FFT de 2048 pontos com janela de Hann em duas fatias (ataque
 * e cauda, esta a 100 ms), mais envelope RMS em janelas de 5 ms — exatamente o
 * que `lib/spectrum.ts` faz, e o que a `/sons` roda contra a síntese.
 */
export type Reference = {
  /** O arquivo medido, para o número ser rastreável. */
  source: string;
  attackMs: number;
  decay40Ms: number;
  centroidAttackHz: number;
  /**
   * Centro espectral na fatia de 100 ms. **Cuidado com este número:** quando a
   * referência já decaiu 40 dB antes dos 100 ms, ele descreve um resíduo
   * inaudível e não uma cauda. Ler o 3576 Hz do xeque como "cauda brilhante"
   * produziu uma síntese de 170 ms que ficava ressoando, e foi reprovada.
   */
  centroidTailHz: number;
  /** Achatamento espectral no ataque: perto de 0 é tonal, perto de 1 é ruído. */
  flatness: number;
  peaksHz: number[];
  /** O que a medição ensinou, em uma linha. */
  lesson: string;
};

/** Uma opção de som, com id, nome e o que ela tenta ser. */
export type Variant = { id: string; title: string; note: string };

export type Effect = {
  name: EffectName;
  title: string;
  /** Quando este som toca, em uma linha. Aparece na página de audição. */
  when: string;
  /**
   * Duração máxima aceita. Para `lance`, `captura` e `xeque` o teto real é o
   * `REPLY_DELAY_MS = 620` do `TreeStage`: som mais longo que o intervalo entre o
   * lance do aluno e a resposta do defensor transforma os dois lances em lama. É
   * teto medível, não gosto.
   */
  maxDurationMs: number;
  /**
   * A variante que toca. Os corpos vivem em `VARIANTS`, em `lib/sound.ts`.
   *
   * **Os ids são rótulos históricos da decisão, não índices.** O `xeque` é `v2` e
   * não tem `v1`: `v2` é o nome pelo qual a escolha foi feita, e renomear faria a
   * conversa não bater mais com o código.
   */
  chosenVariant: string;
  /**
   * As variantes deste efeito. Hoje **uma por efeito**: o Doug ouviu e decidiu, e
   * as descartadas saíram do código com as medidas registradas em comentário.
   *
   * A lista continua sendo lista de propósito. Variante é como uma opção de som
   * existe *antes* de ser escolhida — sobrescrever a anterior a cada ajuste perde
   * o ponto de comparação, que foi exatamente o que travou a primeira rodada do
   * xeque. Quando um som voltar a ser questionado, as tentativas entram aqui e
   * ficam clicáveis na `/sons`, lado a lado e com as medidas.
   */
  variants: Variant[];
  /** A medição que guiou a síntese, quando houve uma. */
  reference?: Reference;
};

export const CATALOG: Effect[] = [
  {
    name: "lance",
    title: "Lance",
    when: "Cada peça que pousa — o som que toca mais vezes na aula, dos dois lados.",
    maxDurationMs: 120,
    chosenVariant: "v1",
    variants: [
      {
        id: "v1",
        title: "Toc na madeira",
        note: "Impacto grave e seco: ruído passa-baixa em 1100 Hz mais um corpo que desliza de 190 para 130 Hz. Aprovado sem alteração.",
      },
    ],
  },
  {
    name: "captura",
    title: "Captura",
    when: "Lance que come uma peça. Tem de ser mais áspero e mais longo que o lance.",
    maxDurationMs: 200,
    chosenVariant: "v1",
    variants: [
      {
        id: "v1",
        title: "Impacto com corpo",
        note: "O toc do lance, mais alto e com cacho inarmônico ressonante (215 · 624 · 926 · 1141 · 1464 Hz). As parciais altas morrem primeiro, então o som escurece enquanto some — a direção da referência.",
      },
    ],
    reference: {
      source: "capture.mp3 (Chess.com, tema padrão)",
      attackMs: 10,
      decay40Ms: 85,
      centroidAttackHz: 2209,
      centroidTailHz: 2100,
      flatness: 0.017,
      peaksHz: [215, 624, 926, 1141, 1249, 1464],
      lesson:
        "É tonal, não ruído: achatamento 0,017 é cacho inarmônico ressonante. As parciais altas morrem primeiro, e é isso que faz o centro espectral descer.",
    },
  },
  {
    name: "xeque",
    title: "Xeque",
    when: "Lance que põe um rei em xeque. Precisa acordar sem assustar.",
    maxDurationMs: 300,
    chosenVariant: "v2",
    variants: [
      {
        id: "v2",
        title: "Mais brilhante",
        note: "Escolhida entre quatro hipóteses medidas e niveladas em RMS. Cacho grave enxuto, grupo agudo dominante em parciais discretas (2304 · 2950 · 3900 · 5100 · 6400 Hz), corte do impacto em 5000 Hz. Mede centroide 3683 Hz contra 3613 do alvo — é a que tem o brilho. As descartadas foram v1, v3 e v4; as medidas delas ficaram no comentário de VARIANTS.xeque.",
      },
    ],
    reference: {
      source: "move-check.mp3 (Chess.com, tema padrão)",
      attackMs: 15,
      decay40Ms: 35,
      centroidAttackHz: 3613,
      centroidTailHz: 3576,
      flatness: 0.028,
      peaksHz: [668, 883, 1055, 1335, 1464, 2304],
      lesson:
        "Não é melodia, e é curto: dois transientes (15 e 25 ms) e tudo abaixo de −40 dB em 50 ms. O brilho está no ataque (3613 Hz) e escurece no corpo (2637 Hz a 30 ms) — não numa cauda longa.",
    },
  },
  {
    name: "recusa",
    title: "Recusa",
    when: "Lance ilegal, erro nomeado, ou lance que joga a vitória fora. Errar aqui é barato: fica mais baixo que os outros de propósito.",
    maxDurationMs: 300,
    chosenVariant: "v1",
    variants: [
      {
        id: "v1",
        title: "Zumbido plano",
        note: "Serra de 115 Hz em platô de 90 ms, cortada no fim, com a 5ª e a 6ª harmônica reforçadas à mão. É o mais baixo dos seis em RMS.",
      },
    ],
    reference: {
      source: "illegal.mp3 (Chess.com, tema padrão)",
      attackMs: 50,
      decay40Ms: 80,
      centroidAttackHz: 3786,
      centroidTailHz: 2273,
      flatness: 0.013,
      peaksHz: [115, 345, 474, 581, 689],
      lesson:
        "É platô, não decaimento: fica dentro de 6 dB do pico de 10 a 95 ms e então cai um penhasco. Fundamental ~115 Hz com a 5ª e a 6ª harmônica a só −3 e −5 dB — uma serra pura cairia −14 dB ali.",
    },
  },
  {
    name: "acerto",
    title: "Acerto",
    when: "A mesma técnica por outro caminho, na etapa 3 — elogio sem avançar a linha.",
    maxDurationMs: 400,
    chosenVariant: "v1",
    variants: [
      {
        id: "v1",
        title: "Dois graus subindo",
        note: "660 e 880 Hz em sequência, senos puros. Aprovado sem alteração.",
      },
    ],
  },
  {
    name: "conclusao",
    title: "Etapa concluída",
    when: "O mate que fecha a etapa. Toca junto com o confete e o pulso do rei — tem de soar como prêmio.",
    maxDurationMs: 900,
    chosenVariant: "v1",
    variants: [
      {
        id: "v1",
        title: "Dó maior quebrado",
        note: "O acorde em arpejo — 523 · 659 · 784 Hz —, 445 ms. O mais longo e o mais alto dos seis. Aprovado sem alteração.",
      },
    ],
  },
];

export function findEffect(name: EffectName): Effect {
  const effect = CATALOG.find((item) => item.name === name);
  if (!effect) throw new Error(`efeito fora do catálogo: ${name}`);
  return effect;
}
