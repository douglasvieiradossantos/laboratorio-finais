/**
 * O som da aula — **sintetizado por WebAudio, sem nenhum arquivo de áudio.**
 *
 * A busca por um pacote gravado foi feita e não sobreviveu à audição: 13 amostras
 * CC0 do kenney.nl foram convertidas, medidas e ouvidas, e nenhuma foi aprovada.
 * A camada que as carregava — cache, decodificação, fallback, gate de arquivo —
 * saiu junto com elas. O que restou é o que se provou útil: a **medição**, em
 * `lib/spectrum.ts`, que é o que permite conferir um som sem ter ouvido.
 *
 * **A API pública é síncrona, de propósito.** `playMove()`, `playCheck()` e
 * companhia não devolvem promessa e não pedem `await`: quem chama é o `TreeStage`
 * no meio de um `useCallback`, e transformar um efeito colateral de som em algo
 * que se espera contaminaria o motor de aula inteiro. Sem arquivo para baixar,
 * isso agora sai de graça.
 *
 * **Restrição dos navegadores.** Nenhum áudio toca antes de um gesto do usuário.
 * `armAudioOnFirstGesture()` cria e destrava o `AudioContext` no primeiro toque
 * ou tecla da página; depois disso o autoplay da etapa 2 pode soar sozinho,
 * porque o clique que abriu a etapa já foi o gesto.
 *
 * A preferência liga/desliga mora no `localStorage` — só ela. Progresso
 * persistente é F2.
 */

import {
  findEffect,
  type EffectName,
  // Extensão `.ts` explícita nos dois: é o que permite ao `npm test` importar
  // este módulo no Node, que exige o especificador completo. O mesmo padrão de
  // `lib/chess/annotations.ts`, e o build aceita.
} from "./sound-catalog.ts";
import { envelopeOf, spectrumAt, type Envelope, type Spectrum } from "./spectrum.ts";

const STORAGE_KEY = "laboratorio-finais:som";

let context: AudioContext | null = null;
let enabled = true;
let loaded = false;
const listeners = new Set<() => void>();

/* ------------------------------------------------------------------ *
 * Preferência
 * ------------------------------------------------------------------ */

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    // Navegador com armazenamento bloqueado: fica ligado, sem quebrar a aula.
  }
}

export function isSoundOn(): boolean {
  load();
  return enabled;
}

export function setSoundOn(on: boolean): void {
  load();
  enabled = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Sem armazenamento a preferência vale só para esta sessão.
  }
  if (on) resume();
  for (const listener of listeners) listener();
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ------------------------------------------------------------------ *
 * O contexto de áudio
 * ------------------------------------------------------------------ */

type AudioContextConstructor = typeof AudioContext;

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

function resume(): void {
  context ??= createContext();
  if (context?.state === "suspended") void context.resume();
}

/**
 * Cria e destrava o contexto, esperando o `resume()`. Só a `/sons` usa: a aula
 * não pode esperar por som nenhum. Devolve se o contexto ficou tocando.
 */
export async function unlockAudio(): Promise<boolean> {
  context ??= createContext();
  if (!context) return false;
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }
  return context.state === "running";
}

/**
 * Destrava o áudio no primeiro gesto da página. Devolve a função que remove os
 * ouvintes — é o que o `useEffect` do componente precisa devolver.
 *
 * Sem arquivo para baixar, isto voltou a ser uma linha. A versão com amostras
 * fazia `fetch` na montagem e `decodeAudioData` no gesto, em duas fases; a
 * camada inteira saiu quando nenhuma amostra foi aprovada.
 */
export function armAudioOnFirstGesture(): () => void {
  if (typeof window === "undefined") return () => {};
  const unlock = () => resume();
  const options = { once: true, passive: true } as const;
  window.addEventListener("pointerdown", unlock, options);
  window.addEventListener("keydown", unlock, options);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

/* ------------------------------------------------------------------ *
 * Síntese
 * ------------------------------------------------------------------ */

/**
 * **`BaseAudioContext`, e não `AudioContext`.** É o que permite renderizar a
 * síntese num `OfflineAudioContext` e medi-la com a mesma FFT usada nas
 * referências — a única maneira de conferir um som sem ter ouvido.
 */
type ToneSpec = {
  /** Frequência inicial, em hertz. */
  freq: number;
  /** Frequência final, quando o som desliza. */
  to?: number;
  type?: OscillatorType;
  /** Duração em segundos, incluindo o `hold`. */
  duration: number;
  /** Volume de pico, de 0 a 1. */
  gain: number;
  /** Atraso em relação ao início, em segundos. */
  delay?: number;
  /**
   * Segundos em volume cheio antes da queda começar. Ausente = percussivo, que
   * é o caso de quase tudo aqui. Existe para o zumbido da recusa, que é um
   * **platô** e não um decaimento — ver o corpo de `recusa` em `SYNTHESIS`.
   */
  hold?: number;
};

function tone(ctx: BaseAudioContext, spec: ToneSpec): void {
  const start = ctx.currentTime + (spec.delay ?? 0);
  const end = start + spec.duration;

  const oscillator = ctx.createOscillator();
  oscillator.type = spec.type ?? "sine";
  oscillator.frequency.setValueAtTime(spec.freq, start);
  if (spec.to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(spec.to, end);

  // Ataque de 8 ms e queda exponencial: sem o ataque o alto-falante estala.
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(spec.gain, start + 0.008);
  if (spec.hold) {
    // Segura no pico até 12 ms do fim, no máximo: o `exponentialRampToValueAtTime`
    // precisa de tempo para descer, senão o corte estala.
    envelope.gain.setValueAtTime(spec.gain, Math.min(start + 0.008 + spec.hold, end - 0.012));
  }
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(envelope).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

type NoiseSpec = {
  duration: number;
  gain: number;
  type: BiquadFilterType;
  /** Frequência de corte do filtro, em hertz. Num `bandpass`, o centro da banda. */
  cutoff: number;
  /**
   * Largura da banda, para `bandpass`: quanto maior, mais estreita. Existe porque
   * um `highpass` abre uma prateleira plana até Nyquist, e com ~900 bins acima de
   * 2 kHz ela domina qualquer média espectral — foi o erro medido que levou o
   * achatamento da captura de 0,023 para 0,498.
   */
  q?: number;
  delay?: number;
  /**
   * Expoente da queda do ruído: 2 apaga rápido (um "toc"), 1 sustenta o dobro do
   * tempo (um chiado que fica). É a alavanca que decide se o ruído aparece só no
   * ataque ou também na cauda.
   */
  shape?: number;
};

/**
 * Um chiado curto e filtrado.
 *
 * **Por que ruído importa aqui, e não é só tempero.** O centro espectral é média
 * ponderada sobre *todos* os bins, e existem ~900 bins acima de 2 kHz contra ~90
 * abaixo. Um som gravado tem um piso de banda larga no agudo que puxa o centroide
 * para cima mesmo quando a parcial dominante é grave — a referência da captura
 * mede 2209 Hz com a parcial mais forte em 215 Hz, o que só é possível assim.
 * Osciladores puros não têm esse piso: a primeira versão de `captura` mediu
 * centroide 957 Hz contra 2209 do alvo justamente por ser limpa demais no alto.
 * É também o que faz um som sintetizado parecer objeto em vez de apito.
 */
function noise(ctx: BaseAudioContext, spec: NoiseSpec): void {
  const start = ctx.currentTime + (spec.delay ?? 0);
  const frames = Math.max(1, Math.floor(ctx.sampleRate * spec.duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const shape = spec.shape ?? 2;
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** shape;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = spec.type;
  filter.frequency.value = spec.cutoff;
  if (spec.q !== undefined) filter.Q.value = spec.q;

  const envelope = ctx.createGain();
  envelope.gain.value = spec.gain;

  source.connect(filter).connect(envelope).connect(ctx.destination);
  source.start(start);
}

/** O "toc" da peça na madeira: ruído passa-baixa que apaga rápido. */
function thud(
  ctx: BaseAudioContext,
  duration: number,
  gain: number,
  cutoff: number,
  delay = 0,
): void {
  noise(ctx, { duration, gain, type: "lowpass", cutoff, delay });
}

/**
 * O portão único de todo som da aula, em três guardas:
 *
 * 1. preferência desligada → nada;
 * 2. sem contexto, ou contexto travado → nada (é o navegador, não nós);
 * 3. senão, toca a variante escolhida do efeito.
 *
 * O caso 2 inclui o som que dispara no mesmo tique do primeiro gesto: `resume()`
 * é assíncrono, então aquele som sai mudo. É uma perda de um efeito na vida da
 * página, e o preço de não ter API assíncrona no motor de aula.
 */
function play(name: EffectName): void {
  if (!isSoundOn()) return;
  resume();
  if (!context || context.state !== "running") return;
  synthesisFor(name)(context);
}

/* ------------------------------------------------------------------ *
 * Os seis efeitos
 * ------------------------------------------------------------------ */

/**
 * As seis sínteses, num mapa em vez de closures soltas — é o que permite
 * renderizar cada uma num `OfflineAudioContext` e medi-la.
 *
 * **De onde saíram os números de `captura`, `xeque` e `recusa`.** O Doug testou
 * e reprovou os três, e pediu "algo bem parecido, mas não igual" aos sons do
 * Chess.com, apontando os arquivos de referência. Os sons deles são
 * proprietários e **nada deles entra aqui** — o que entra é síntese nossa, com
 * os parâmetros derivados de uma medição: FFT de 2048 pontos com janela de Hann
 * em três fatias (ataque, corpo, cauda), mais envelope RMS em janelas de 5 ms.
 * As medidas estão citadas em cada corpo. Os três diagnósticos que mudaram o
 * desenho:
 *
 * 1. **A captura deles é tonal, não ruído.** Achatamento espectral 0,017 — um
 *    cacho inarmônico ressonante. A versão anterior era estouro de ruído
 *    filtrado, que é outra família de som.
 * 2. **O xeque deles não é melodia, e é curto.** Dois transientes (15 e 25 ms) e
 *    tudo abaixo de −40 dB em 50 ms, com o brilho no ataque. A versão original
 *    eram duas notas 880→1175 Hz, e melodia soa de brinquedo.
 * 3. **A recusa deles é platô, não decaimento.** Fica dentro de 6 dB do pico de
 *    10 a 95 ms e depois cai um penhasco. A versão anterior deslizava 220→120 Hz
 *    decaindo o tempo todo.
 *
 * `lance`, `acerto` e `conclusao` **não mudaram uma linha**: foram aprovados.
 *
 * **Ao medir, confie no RMS e não no pico.** Toda camada de ruído usa
 * `Math.random()`, então cada renderização é uma realização diferente: medindo o
 * `lance` cinco vezes seguidas na `/sons`, o pico deu −16,96 · −16,80 · −15,48 ·
 * −15,70 · −16,15 dBFS — 1,5 dB de espalhamento só por sorteio. O RMS das mesmas
 * cinco variou 0,65 dB. Perseguir uma diferença de 1 dB no pico é perseguir
 * ruído; o equilíbrio entre os efeitos foi ajustado pelo RMS.
 *
 * O equilíbrio de hoje, por RMS, do mais alto para o mais baixo: conclusão −33,4
 * · captura −36,4 · acerto −38,8 · xeque −39,4 · lance −43,0 · recusa −44,8. A
 * captura fica 6,5 dB acima do lance e o xeque 3,6 dB, que é a ordem pedida; a
 * recusa é a mais baixa das seis, porque errar tem de ser barato.
 *
 * **Cada efeito tem uma ou mais variantes**, com id `v1`, `v2`, … A variante que
 * toca na aula é a do `chosenVariant` do catálogo, e a `/sons` renderiza e mede
 * todas para comparação. Variante é como uma opção de som existe antes de ser
 * escolhida — o inverso de sobrescrever a anterior e perder o ponto de
 * comparação. Cinco dos seis efeitos têm uma só; o `xeque` tem quatro, porque é
 * o que ainda não fechou.
 */
export const VARIANTS: Record<EffectName, Record<string, (ctx: BaseAudioContext) => void>> = {
  lance: {
    /** Peça pousando: um toc seco e grave. Aprovado — não mexer. */
    v1: (ctx) => {
      thud(ctx, 0.05, 0.22, 1100);
      tone(ctx, { freq: 190, to: 130, type: "triangle", duration: 0.07, gain: 0.16 });
    },
  },

  /**
   * Captura: o mesmo impacto do lance, mais alto e com corpo ressonante.
   *
   * Medido na referência: ataque 10 ms, −20 dB em 30 ms, −40 dB em 95 ms;
   * achatamento 0,017 (tonal); parciais 215 · 624 · 926 · 1141 · 1249 · 1464 Hz
   * no ataque, migrando para 474 · 732 · 883 na cauda — ou seja, as parciais
   * altas morrem primeiro, e é isso que faz o centro espectral cair de 2200 para
   * 2100 Hz. Daí cada parcial ter duração própria, decrescente com a altura.
   */
  captura: {
    v1: (ctx) => {
      // A borda do impacto. O ganho do ruído é baixo de propósito: a primeira
      // versão usava 0,15 e mediu achatamento 0,063 contra 0,017 da referência —
      // ruidosa demais. Menos ruído é o que traz o achatamento para baixo.
      thud(ctx, 0.022, 0.1, 3000);
      // O corpo, na região dos 215 Hz medidos.
      tone(ctx, { freq: 215, to: 165, type: "triangle", duration: 0.16, gain: 0.2 });
      // O cacho inarmônico. Não é série harmônica de propósito: madeira não é
      // corda. A parcial mais alta é a que dura menos — é o que faz o centro
      // espectral **descer** da fatia de ataque para a de cauda, como na
      // referência (2209 → 2100 Hz). A primeira versão errou o sinal disso: as
      // parciais eram curtas demais e a 100 ms não sobrava nada, então a medição
      // pegava resíduo numérico e a cauda saiu em 3194 Hz, mais clara que o ataque.
      tone(ctx, { freq: 624, type: "sine", duration: 0.15, gain: 0.09 });
      tone(ctx, { freq: 926, type: "sine", duration: 0.13, gain: 0.075 });
      tone(ctx, { freq: 1141, type: "sine", duration: 0.115, gain: 0.055 });
      tone(ctx, { freq: 1464, type: "sine", duration: 0.095, gain: 0.04 });
      // A camada de ar no agudo: `bandpass` estreito, não `highpass`. `shape: 3`
      // apaga rápido, então ela sobe o centroide do ataque sem clarear a cauda —
      // que é a direção da referência (2209 → 2100 Hz).
      noise(ctx, {
        duration: 0.055,
        gain: 0.022,
        type: "bandpass",
        cutoff: 3400,
        q: 1.2,
        shape: 3,
      });
    },
  },

  /**
   * Xeque: um toque **curto** e brilhante, com dois transientes.
   *
   * **A leitura errada que me custou uma reprovação.** A versão anterior durava
   * 170 ms e ficava ressoando. Eu tinha tomado o centroide de 3576 Hz medido a
   * **100 ms** como prova de uma "cauda brilhante" e construído uma cauda longa.
   * Mas a referência decai 40 dB em 35 ms: a 100 ms ela já está 40 dB abaixo, e
   * aquele 3576 Hz é o espectro de um resíduo quase inaudível. Medir no lugar
   * errado é pior do que não medir.
   *
   * O que a curva de envelope da referência diz, em janelas de 5 ms e dB
   * relativos ao pico:
   *
   * ```
   *   -32 -27  -3   0  -19 -14 -25 -26 -37 -39 -40
   *     0   5  10  15   20  25  30  35  40  45  50 ms
   * ```
   *
   * Dois picos — 15 ms e 25 ms — e **tudo abaixo de −40 dB em 50 ms**. E na fatia
   * de corpo, a 30 ms, o centroide mede 2637 Hz contra 3613 Hz do ataque: o som
   * **escurece** enquanto morre, como qualquer impacto. O brilho está no ataque,
   * não no que sobra. Parciais medidas no ataque: 668 · 883 · 1055 · 1335 · 1464,
   * mais 2304 no segundo transiente.
   */
  xeque: {
    /**
     * **v2 — mais brilhante. Aprovada como definitiva.**
     *
     * O Doug ouviu quatro hipóteses na `/sons` e escolheu esta. A ideia: o que
     * faltava às tentativas anteriores era brilho — a referência mede centro
     * espectral de 3613 Hz no ataque, e esta variante mede 3683. O balanço é o
     * inverso do óbvio: cacho grave enxuto, grupo agudo dominante, e o corte do
     * ruído de impacto em 5000 Hz em vez de 3200.
     *
     * Medida: 30 ms audíveis, −40 dB em 25, RMS −39,4 dBFS, centroide 3683 Hz,
     * achatamento 0,082, parciais 4414 · 2950 · 2304 · 1055 · 3919 Hz.
     *
     * **O id continua `v2` de propósito**, e não foi renumerado para `v1`: é o
     * nome pelo qual a decisão foi tomada, e renomear faria a conversa não bater
     * mais com o código.
     *
     * **As três hipóteses descartadas**, com as medidas, para ninguém repetir o
     * experimento:
     *
     * | | hipótese | audível | centroide | achatamento |
     * |---|---|---|---|---|
     * | v1 | impacto grave + cacho 668–1464 Hz + agudos discretos | 35 ms | 2553 Hz | 0,061 |
     * | v3 | tinido de barra metálica (520 · 1435 · 2808 · 4643 Hz) | 55 ms | 1799 Hz | 0,009 |
     * | v4 | o som de lance mais um marcador agudo (a proposta do Lichess, issue 8365) | 50 ms | 2053 Hz | 0,029 |
     *
     * A v4 acertava o achatamento do alvo (0,029 contra 0,028) e a v3 era a mais
     * tonal das quatro; nenhuma das duas tinha o brilho. Vale registrar que
     * centroide e achatamento **não** se acertam juntos quando o brilho vem de
     * ruído — ver a nota de `noise()`.
     */
    v2: (ctx) => {
      // Os ganhos estão 1,27× acima do primeiro desenho (+2,1 dB), de quando as
      // quatro variantes foram igualadas em RMS para a comparação ser de timbre e
      // não de volume. O nível resultante — −39,4 dBFS — é o que fica: 3,5 dB
      // acima do lance e 3 dB abaixo da captura, que é a ordem pedida.
      thud(ctx, 0.01, 0.127, 5000, 0.005);
      tone(ctx, { freq: 245, to: 205, type: "triangle", duration: 0.024, gain: 0.114 });
      // O cacho grave fica em segundo plano.
      tone(ctx, { freq: 883, type: "sine", duration: 0.03, gain: 0.076 });
      tone(ctx, { freq: 1055, type: "sine", duration: 0.028, gain: 0.108 });
      tone(ctx, { freq: 1464, type: "sine", duration: 0.026, gain: 0.095 });
      // E o grupo agudo manda. São parciais **discretas**, não ruído: é o que põe
      // massa em 2–6 kHz sem espalhar energia por centenas de bins.
      tone(ctx, { freq: 2304, type: "sine", duration: 0.026, gain: 0.165 });
      tone(ctx, { freq: 2950, type: "sine", duration: 0.024, gain: 0.19 });
      tone(ctx, { freq: 3900, type: "sine", duration: 0.02, gain: 0.152 });
      tone(ctx, { freq: 5100, type: "sine", duration: 0.016, gain: 0.108 });
      tone(ctx, { freq: 6400, type: "sine", duration: 0.013, gain: 0.07 });
      // Segundo transiente, a 15 ms: o segundo pico da curva de envelope da
      // referência, curto e mais agudo que o primeiro.
      thud(ctx, 0.008, 0.064, 7000, 0.015);
      tone(ctx, { freq: 4400, type: "sine", duration: 0.018, gain: 0.089, delay: 0.015 });
    },
  },
  recusa: {
    v1: (ctx) => {
      // Os ganhos são baixos por medida, não por gosto: a primeira versão usava
      // 0,085 / 0,026 / 0,020 e mediu **RMS −37,35 dBFS — o segundo mais alto dos
      // seis**, quando a recusa tem de ser o mais baixo. Pico enganava (era o mais
      // baixo), mas um platô de 90 ms sustenta energia que um "toc" de 45 ms não
      // sustenta, e é o RMS que acompanha o que se percebe como volume. Estes
      // valores são os de então multiplicados por 0,45, ou seja −7 dB.
      tone(ctx, { freq: 115, type: "sawtooth", duration: 0.095, gain: 0.038, hold: 0.068 });
      tone(ctx, { freq: 575, type: "sine", duration: 0.09, gain: 0.012, hold: 0.064 });
      tone(ctx, { freq: 690, type: "sine", duration: 0.09, gain: 0.009, hold: 0.064 });
    },
  },

  acerto: {
    /** Lance certo: dois graus subindo. Aprovado — não mexer. */
    v1: (ctx) => {
      tone(ctx, { freq: 660, type: "sine", duration: 0.09, gain: 0.14 });
      tone(ctx, { freq: 880, type: "sine", duration: 0.12, gain: 0.13, delay: 0.08 });
    },
  },

  conclusao: {
    /** Etapa concluída: o acorde de dó maior, quebrado. Aprovado — não mexer. */
    v1: (ctx) => {
      tone(ctx, { freq: 523.25, type: "sine", duration: 0.16, gain: 0.15 });
      tone(ctx, { freq: 659.25, type: "sine", duration: 0.16, gain: 0.14, delay: 0.11 });
      tone(ctx, { freq: 783.99, type: "sine", duration: 0.34, gain: 0.14, delay: 0.22 });
    },
  },
};

/** Variante da sessão, escolhida na `/sons`. **Não** persiste. */
const variantOverrides = new Map<EffectName, string>();

/**
 * Troca a variante de um efeito só nesta sessão. A escolha de verdade é uma linha
 * de `chosenVariant` no catálogo, escrita à mão depois da audição.
 */
export function overrideVariant(effect: EffectName, id: string): void {
  variantOverrides.set(effect, id);
}

/** Qual variante toca hoje neste efeito — override da sessão, ou o catálogo. */
export function chosenVariantFor(effect: EffectName): string {
  return variantOverrides.get(effect) ?? findEffect(effect).chosenVariant;
}

/**
 * O corpo de síntese que toca. Cai na **primeira variante declarada** se o id não
 * existir, em vez de explodir: um catálogo com id errado tem de soar, não de
 * emudecer a aula.
 *
 * A reserva não pode ser `bodies.v1`: o `xeque` foi resolvido na `v2` e não tem
 * `v1` — os ids são rótulos históricos da decisão, não índices.
 */
function synthesisFor(effect: EffectName, id = chosenVariantFor(effect)) {
  const bodies = VARIANTS[effect];
  return bodies[id] ?? Object.values(bodies)[0];
}

/** Peça pousando: um toc seco e grave. */
export function playMove(): void {
  play("lance");
}

/** Captura: mais áspera e mais longa que um lance comum. */
export function playCapture(): void {
  play("captura");
}

/** Xeque: o lance com brilho, para acordar. */
export function playCheck(): void {
  play("xeque");
}

/** Recusa: um zumbido baixo. Nunca estridente — errar aqui é barato. */
export function playRefusal(): void {
  play("recusa");
}

/** Lance certo: dois graus subindo. */
export function playSuccess(): void {
  play("acerto");
}

/** Etapa concluída: o acorde de dó maior, quebrado. */
export function playComplete(): void {
  play("conclusao");
}

/** O nome do efeito → a função que o toca. É por aqui que a `/sons` dispara. */
const EFFECTS: Record<EffectName, () => void> = {
  lance: playMove,
  captura: playCapture,
  xeque: playCheck,
  recusa: playRefusal,
  acerto: playSuccess,
  conclusao: playComplete,
};

/**
 * Toca um efeito pelo nome, pelo **caminho real da aula** — mesma preferência,
 * mesmo cache, mesmo fallback. É o botão que prova que o que a `/sons` mostra é
 * o que o aluno ouve.
 */
export function playEffect(name: EffectName): void {
  EFFECTS[name]();
}

/**
 * Toca uma variante específica, **ignorando a preferência de som de propósito**:
 * na `/sons` quem clica pediu para ouvir aquela variante, e não ouvir nada
 * pareceria a página quebrada. Devolve se saiu som.
 */
export async function playVariant(name: EffectName, id: string): Promise<boolean> {
  if (!(await unlockAudio())) return false;
  if (!context) return false;
  synthesisFor(name, id)(context);
  return true;
}

/** O que a `/sons` mede num `AudioBuffer`, seja ele decodificado ou renderizado. */
export type BufferMeasure = Envelope & {
  sampleRate: number;
  channels: number;
  /** Espectro na fatia do ataque. */
  attack: Spectrum;
  /** Espectro 100 ms depois do início — a cauda. Onde o som já acabou, fica zero. */
  tail: Spectrum;
};

/**
 * Mede um buffer: envelope e espectro em duas fatias. É o que substitui a
 * audição para quem escreve o código — dá para comparar em número, e um
 * subagente com Playwright lê a tabela como texto.
 */
export function measureBuffer(buffer: AudioBuffer): BufferMeasure {
  const data = buffer.getChannelData(0);
  return {
    ...envelopeOf(data, buffer.sampleRate),
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    attack: spectrumAt(data, 0, buffer.sampleRate),
    tail: spectrumAt(data, Math.round(buffer.sampleRate * 0.1), buffer.sampleRate),
  };
}

/**
 * Renderiza uma síntese fora do tempo real e devolve o buffer, para medir.
 *
 * É o que torna som verificável sem ouvido: a mesma função que toca na aula é
 * renderizada aqui e passa pela mesma FFT que mediu as referências. Sem isto,
 * "o xeque ficou mais brilhante" seria opinião de quem não escutou.
 *
 * `OfflineAudioContext` **não** precisa de gesto do usuário — ele não toca nada,
 * só calcula amostras.
 */
export async function renderSynthesis(
  name: EffectName,
  variantId?: string,
  seconds = 1,
  sampleRate = 44100,
): Promise<AudioBuffer | null> {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!Ctor) return null;
  try {
    const offline = new Ctor(1, Math.round(sampleRate * seconds), sampleRate);
    synthesisFor(name, variantId)(offline);
    return await offline.startRendering();
  } catch {
    return null;
  }
}

/** O som certo para um lance, pelo que o lance foi. */
export function playForMove({
  capture = false,
  check = false,
}: {
  capture?: boolean;
  check?: boolean;
}): void {
  if (check) playCheck();
  else if (capture) playCapture();
  else playMove();
}
