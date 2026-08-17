import assert from "node:assert/strict";
import test from "node:test";
import { envelopeOf, spectrumAt } from "./spectrum.ts";

/**
 * O medidor tem de estar certo antes de qualquer conclusão sobre som sair dele.
 * Cada teste aqui usa um sinal cuja resposta é conhecida de antemão — seno puro,
 * ruído branco, dois tons, um decaimento exponencial —, então uma FFT com bug ou
 * uma janela mal aplicada fica vermelha em vez de gerar um número plausível e
 * errado.
 */

const RATE = 44100;

function sine(hz: number, seconds: number, amplitude = 1): Float32Array {
  const x = new Float32Array(Math.round(RATE * seconds));
  for (let i = 0; i < x.length; i += 1) x[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / RATE);
  return x;
}

test("seno de 1000 Hz: o pico e o centroide caem em 1000 Hz", () => {
  const s = spectrumAt(sine(1000, 0.1), 0, RATE);
  // A resolução da FFT é ~21,5 Hz, então o bin mais próximo de 1000 é 990.
  assert.ok(Math.abs(s.peaksHz[0] - 1000) <= 22, `pico em ${s.peaksHz[0]} Hz`);
  assert.ok(Math.abs(s.centroidHz - 1000) <= 40, `centroide em ${s.centroidHz} Hz`);
});

test("seno puro é tonal, ruído branco é achatado", () => {
  const puro = spectrumAt(sine(440, 0.1), 0, RATE);

  const ruido = new Float32Array(4096);
  // Gerador determinístico: o teste não pode depender de sorte.
  let semente = 12345;
  for (let i = 0; i < ruido.length; i += 1) {
    semente = (semente * 1103515245 + 12345) & 0x7fffffff;
    ruido[i] = (semente / 0x3fffffff) - 1;
  }
  const branco = spectrumAt(ruido, 0, RATE);

  assert.ok(puro.flatness < 0.02, `seno deu achatamento ${puro.flatness}`);
  assert.ok(branco.flatness > 0.2, `ruído deu achatamento ${branco.flatness}`);
  assert.ok(
    branco.flatness > puro.flatness * 10,
    `ruído (${branco.flatness}) não ficou muito acima do seno (${puro.flatness})`,
  );
});

test("dois tons somados aparecem como duas parciais, na ordem da força", () => {
  const forte = sine(500, 0.1, 1);
  const fraco = sine(2000, 0.1, 0.25);
  const soma = new Float32Array(forte.length);
  for (let i = 0; i < soma.length; i += 1) soma[i] = forte[i] + fraco[i];

  const s = spectrumAt(soma, 0, RATE, 2);
  assert.ok(Math.abs(s.peaksHz[0] - 500) <= 22, `primeira parcial em ${s.peaksHz[0]}`);
  assert.ok(Math.abs(s.peaksHz[1] - 2000) <= 22, `segunda parcial em ${s.peaksHz[1]}`);
  // O centroide fica entre os dois, puxado para o mais forte.
  assert.ok(s.centroidHz > 500 && s.centroidHz < 2000, `centroide em ${s.centroidHz}`);
});

test("tom mais agudo tem centroide mais alto — é o número que diz brilho", () => {
  const grave = spectrumAt(sine(300, 0.1), 0, RATE).centroidHz;
  const agudo = spectrumAt(sine(3000, 0.1), 0, RATE).centroidHz;
  assert.ok(agudo > grave * 5, `grave ${grave} Hz, agudo ${agudo} Hz`);
});

test("um seno só devolve uma parcial, e não cinco de ruído numérico", () => {
  // Sem o piso de −40 dB, a busca desce ao ruído da FFT e reporta parciais de
  // 12 a 19 kHz num tom de 660 Hz. Foi um defeito medido de verdade na /sons.
  const s = spectrumAt(sine(660, 0.1), 0, RATE, 5);
  assert.equal(s.peaksHz.length, 1, `devolveu ${s.peaksHz.length} parciais: ${s.peaksHz}`);
  assert.ok(Math.abs(s.peaksHz[0] - 660) <= 22, `parcial em ${s.peaksHz[0]} Hz`);
});

test("fatia depois do fim do sinal devolve zero, em vez de inventar parcial", () => {
  const s = spectrumAt(sine(1000, 0.01), 44100, RATE);
  assert.equal(s.centroidHz, 0);
  assert.equal(s.flatness, 0);
  assert.deepEqual(s.peaksHz, []);
});

test("envelope de um decaimento exponencial: ataque zero e queda medida", () => {
  // Amplitude e^(-t/τ) com τ = 20 ms: −20 dB em τ·ln(10) ≈ 46 ms, −40 dB em ~92.
  const tau = 0.02;
  const x = new Float32Array(Math.round(RATE * 0.3));
  for (let i = 0; i < x.length; i += 1) {
    const t = i / RATE;
    x[i] = Math.exp(-t / tau) * Math.sin((2 * Math.PI * 800 * i) / RATE);
  }
  const env = envelopeOf(x, RATE);

  assert.equal(env.attackMs, 0, `ataque deu ${env.attackMs} ms`);
  assert.ok(Math.abs(env.peakDbfs) < 0.5, `pico deu ${env.peakDbfs} dBFS`);
  assert.ok(
    env.decay20Ms !== null && Math.abs(env.decay20Ms - 46) <= 10,
    `−20 dB em ${env.decay20Ms} ms, esperado ~46`,
  );
  assert.ok(
    env.decay40Ms !== null && Math.abs(env.decay40Ms - 92) <= 12,
    `−40 dB em ${env.decay40Ms} ms, esperado ~92`,
  );
  // Uma amostra, e não zero: em t=0 o seno vale exatamente 0, então a primeira
  // amostra fica abaixo do piso de −60 dBFS. 1/44100 s = 0,023 ms.
  assert.ok(env.leadingSilenceMs < 0.1, `silêncio inicial deu ${env.leadingSilenceMs} ms`);
});

test("envelope de um platô: o ataque cai no meio, e a queda é abrupta", () => {
  // 80 ms de tom cheio e um corte seco — a forma da recusa.
  const x = new Float32Array(Math.round(RATE * 0.2));
  const fim = Math.round(RATE * 0.08);
  for (let i = 0; i < fim; i += 1) x[i] = 0.5 * Math.sin((2 * Math.PI * 115 * i) / RATE);
  const env = envelopeOf(x, RATE);

  // Num platô o "pico" é qualquer janela, então o que importa é a queda: ela
  // acontece de uma janela para a outra, não ao longo de dezenas.
  assert.ok(env.decay40Ms !== null, "o platô nunca caiu 40 dB");
  assert.ok(env.attackMs < 80, `ataque deu ${env.attackMs} ms, além do platô`);
  assert.ok(Math.abs(env.peakDbfs - -6.02) < 0.3, `pico deu ${env.peakDbfs} dBFS, esperado −6`);
});

test("silêncio no começo é medido, e não confundido com ataque lento", () => {
  const x = new Float32Array(Math.round(RATE * 0.1));
  const inicio = Math.round(RATE * 0.03);
  for (let i = inicio; i < x.length; i += 1) {
    x[i] = 0.8 * Math.sin((2 * Math.PI * 600 * (i - inicio)) / RATE);
  }
  const env = envelopeOf(x, RATE);
  assert.ok(
    Math.abs(env.leadingSilenceMs - 30) <= 1,
    `silêncio inicial deu ${env.leadingSilenceMs} ms, esperado 30`,
  );
});

test("silêncio total não estoura: devolve −∞ em vez de NaN", () => {
  const env = envelopeOf(new Float32Array(4410), RATE);
  assert.equal(env.peakDbfs, -Infinity);
  assert.equal(env.rmsDbfs, -Infinity);
  assert.ok(Number.isFinite(env.leadingSilenceMs));
});
