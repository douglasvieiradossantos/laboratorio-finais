/**
 * Medição de som: envelope e espectro. **Matemática pura** sobre amostras — nada
 * de WebAudio, nada de `window` —, então roda igual no navegador e no `npm test`.
 *
 * **Por que existe.** Quem escreve este código não ouve o resultado. Sem medida,
 * "o som está bom" é opinião de quem não escutou. Com envelope e espectro dá
 * para dizer coisas conferíveis: *este som tem ataque de 10 ms, morre em 95 ms, e
 * o centro espectral dele fica em 2200 Hz* — e comparar com o número de uma
 * referência. Foi assim que a síntese de `captura`, `xeque` e `recusa` foi
 * derivada; ver `SYNTHESIS` em `lib/sound.ts`.
 */

/** Janela da FFT. 2048 a 44,1 kHz dá ~21,5 Hz de resolução e ~46 ms de fatia. */
const N = 2048;

const dbfs = (ratio: number): number => (ratio <= 0 ? -Infinity : 20 * Math.log10(ratio));

/**
 * FFT radix-2 no lugar. `re` e `im` têm de ter comprimento potência de dois.
 * Implementada aqui, e não puxada de um pacote, porque são trinta linhas e o
 * projeto não precisa de dependência nova para medir seis sons.
 */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // Permutação por reversão de bits.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const step = (-2 * Math.PI) / len;
    const half = len / 2;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k += 1) {
        const wr = Math.cos(step * k);
        const wi = Math.sin(step * k);
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + half] * wr - im[i + k + half] * wi;
        const vi = re[i + k + half] * wi + im[i + k + half] * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + half] = ur - vr;
        im[i + k + half] = ui - vi;
      }
    }
  }
}

export type Spectrum = {
  /** Centro de massa do espectro, em hertz. É o número que diz "brilho". */
  centroidHz: number;
  /**
   * Achatamento espectral, de 0 a 1: perto de 0 é tom puro, perto de 1 é ruído
   * branco. É o que distingue um cacho ressonante de um estouro filtrado.
   */
  flatness: number;
  /** As parciais mais fortes, em hertz, da mais forte para a mais fraca. */
  peaksHz: number[];
};

/**
 * Espectro de uma fatia que começa em `offset` amostras. Fatia curta demais (o
 * som acabou antes) devolve tudo em zero em vez de mentir.
 */
export function spectrumAt(
  samples: Float32Array,
  offset: number,
  sampleRate: number,
  peakCount = 5,
): Spectrum {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i += 1) {
    // Janela de Hann: sem ela o vazamento espectral inventa parciais que não
    // existem, e a lista de picos fica inútil.
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    re[i] = (samples[offset + i] ?? 0) * hann;
  }
  fft(re, im);

  const bins = N / 2;
  const mag = new Float64Array(bins);
  for (let k = 0; k < bins; k += 1) mag[k] = Math.hypot(re[k], im[k]);

  // O bin 0 é o nível contínuo, não é som: fica fora de tudo.
  let sum = 0;
  let weighted = 0;
  let logSum = 0;
  let counted = 0;
  for (let k = 1; k < bins; k += 1) {
    sum += mag[k];
    weighted += ((k * sampleRate) / N) * mag[k];
    if (mag[k] > 0) {
      logSum += Math.log(mag[k]);
      counted += 1;
    }
  }
  if (sum === 0) return { centroidHz: 0, flatness: 0, peaksHz: [] };

  const arithmetic = sum / (bins - 1);
  const geometric = counted > 0 ? Math.exp(logSum / counted) : 0;

  // Picos com os vizinhos suprimidos, senão uma parcial só vira cinco entradas.
  //
  // O piso de −40 dB abaixo da parcial mais forte não é enfeite: sem ele, um som
  // com **menos** parciais que `peakCount` faz a busca descer ao ruído numérico e
  // reportar parciais de 12 a 19 kHz num seno de 660 Hz. Melhor devolver uma
  // lista curta e verdadeira do que uma lista cheia e inventada.
  const floorRatio = 10 ** (-40 / 20);
  const peaksHz: number[] = [];
  const taken = new Set<number>();
  let strongest = 0;
  for (let round = 0; round < peakCount; round += 1) {
    let best = -1;
    let value = 0;
    for (let k = 2; k < bins - 1; k += 1) {
      if (taken.has(k)) continue;
      if (mag[k] > value && mag[k] >= mag[k - 1] && mag[k] >= mag[k + 1]) {
        value = mag[k];
        best = k;
      }
    }
    if (best < 0) break;
    if (round === 0) strongest = value;
    else if (value < strongest * floorRatio) break;
    for (let d = -4; d <= 4; d += 1) taken.add(best + d);
    peaksHz.push(Math.round((best * sampleRate) / N));
  }

  return {
    centroidHz: Math.round(weighted / sum),
    flatness: Number((geometric / arithmetic).toFixed(3)),
    peaksHz,
  };
}

export type Envelope = {
  durationMs: number;
  peakDbfs: number;
  rmsDbfs: number;
  /** Do início até o pico. Um "toc" tem 0–15 ms; um som que sobe tem mais. */
  attackMs: number;
  /** Do pico até 20 dB abaixo dele. `null` se nunca chega lá. */
  decay20Ms: number | null;
  /** Do pico até 40 dB abaixo — na prática, onde o som deixa de existir. */
  decay40Ms: number | null;
  /** Quanto tempo passa antes de o som começar de verdade (limiar −60 dBFS). */
  leadingSilenceMs: number;
  /** O envelope em dB relativos ao pico, uma casa por janela de 5 ms. */
  curveDb: number[];
};

/** Janela do envelope, em segundos. 5 ms resolve um ataque percussivo. */
const WINDOW_S = 0.005;

export function envelopeOf(samples: Float32Array, sampleRate: number): Envelope {
  const step = Math.max(1, Math.round(sampleRate * WINDOW_S));
  const windows: number[] = [];
  for (let i = 0; i + step <= samples.length; i += step) {
    let sq = 0;
    for (let k = 0; k < step; k += 1) sq += samples[i + k] * samples[i + k];
    windows.push(Math.sqrt(sq / step));
  }

  let absolutePeak = 0;
  let totalSquares = 0;
  let firstSound = -1;
  const floor = 10 ** (-60 / 20);
  for (let i = 0; i < samples.length; i += 1) {
    const magnitude = Math.abs(samples[i]);
    if (magnitude > absolutePeak) absolutePeak = magnitude;
    totalSquares += samples[i] * samples[i];
    if (firstSound < 0 && magnitude > floor) firstSound = i;
  }

  const windowPeak = windows.length > 0 ? Math.max(...windows) : 0;
  const peakIndex = windows.indexOf(windowPeak);
  const relative = (v: number) => dbfs((v || 1e-12) / (windowPeak || 1e-12));

  let decay20: number | null = null;
  let decay40: number | null = null;
  for (let i = peakIndex; i >= 0 && i < windows.length; i += 1) {
    const level = relative(windows[i]);
    if (decay20 === null && level <= -20) decay20 = (i - peakIndex) * WINDOW_S * 1000;
    if (level <= -40) {
      decay40 = (i - peakIndex) * WINDOW_S * 1000;
      break;
    }
  }

  return {
    durationMs: (samples.length / sampleRate) * 1000,
    peakDbfs: dbfs(absolutePeak),
    rmsDbfs: dbfs(samples.length > 0 ? Math.sqrt(totalSquares / samples.length) : 0),
    attackMs: Math.max(0, peakIndex) * WINDOW_S * 1000,
    decay20Ms: decay20,
    decay40Ms: decay40,
    leadingSilenceMs: ((firstSound < 0 ? samples.length : firstSound) / sampleRate) * 1000,
    curveDb: windows.map((v) => Math.round(relative(v))),
  };
}
