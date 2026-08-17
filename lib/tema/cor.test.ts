import assert from "node:assert/strict";
import test from "node:test";
import { contraste, hex, luminancia, parseCor, sobrepor } from "./cor.ts";

/**
 * A régua se afere antes de medir qualquer coisa.
 *
 * Sem este arquivo, `contraste.test.ts` mediria o próprio bug: uma matriz de
 * Oklab trocada, um gamma esquecido ou uma composição de alfa em espaço errado
 * produzem números *plausíveis* — 4,1 em vez de 4,6 —, e um número plausível e
 * errado é pior que nenhum, porque passa no CI e reprova no olho.
 *
 * Cada caso aqui tem resposta conhecida **de fora do projeto**: as primárias do
 * sRGB em Oklab (CSS Color 4), duas razões publicadas da WCAG, e as identidades
 * que qualquer implementação correta tem de satisfazer (ida e volta, eixo dos
 * cinzas, alfa 0 e alfa 1).
 */

/** Tolerância de canal: 1/255 é o passo do hexadecimal; ficamos bem abaixo. */
const CANAL = 0.002;
/** Tolerância de razão, exigida pelo B6.1. */
const RAZAO = 0.01;

const perto = (a: number, b: number, tol: number, o: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${o}: ${a} vs ${b} (tolerância ${tol})`);

// ---------------------------------------------------------------------------
// Leitura das formas de CSS
// ---------------------------------------------------------------------------

test("hexadecimal nas quatro larguras", () => {
  assert.deepEqual(parseCor("#000"), { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseCor("#ffffff"), { r: 1, g: 1, b: 1, a: 1 });
  // #f00 e #ff0000 têm de dar exatamente a mesma cor: o dígito duplica.
  assert.deepEqual(parseCor("#f00"), parseCor("#ff0000"));
  perto(parseCor("#00000080").a, 128 / 255, 1e-12, "alfa de 8 dígitos");
  assert.deepEqual(parseCor("#f00f"), parseCor("#ff0000"));
});

test("rgb() nas duas sintaxes, com e sem alfa", () => {
  assert.deepEqual(parseCor("rgb(255, 0, 0)"), parseCor("#f00"));
  assert.deepEqual(parseCor("rgb(255 0 0)"), parseCor("#f00"));
  assert.deepEqual(parseCor("rgba(255, 0, 0, 0.5)"), { r: 1, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(parseCor("rgb(255 0 0 / 50%)"), { r: 1, g: 0, b: 0, a: 0.5 });
});

test("var() resolve, inclusive encadeada e com alternativa", () => {
  const vars = { "--a": "var(--b)", "--b": "#ff0000" };
  assert.deepEqual(parseCor("var(--a)", vars), parseCor("#f00"));
  assert.deepEqual(parseCor("var(--nao-existe, #ff0000)", vars), parseCor("#f00"));
  assert.throws(() => parseCor("var(--nao-existe)", vars), /não existe/);
  assert.throws(() => parseCor("var(--c)", { "--c": "var(--c)" }), /circular/);
});

test("forma desconhecida é erro barulhento, nunca cinza silencioso", () => {
  assert.throws(() => parseCor("hsl(120 50% 50%)"), /não é lida/);
  assert.throws(() => parseCor("rebeccapurple"), /não sei ler/);
  assert.throws(() => parseCor("color-mix(in lab, #f00 50%, #00f)"), /não é lido/);
});

// ---------------------------------------------------------------------------
// Oklch: as três primárias do sRGB, valores da CSS Color 4
// ---------------------------------------------------------------------------

test("as primárias do sRGB em Oklch voltam às primárias do sRGB", () => {
  // Fonte: CSS Color 4, conversão de referência de sRGB para Oklab. São os
  // únicos três pontos em que a resposta certa é conhecida sem rodar código.
  const primarias: [string, string][] = [
    ["oklch(0.6279553606 0.2576832899 29.2338851923)", "#ff0000"],
    ["oklch(0.8664396115 0.2948272403 142.4953480343)", "#00ff00"],
    ["oklch(0.4520137183 0.3132143885 264.0520226163)", "#0000ff"],
  ];
  for (const [ok, esperado] of primarias) {
    const c = parseCor(ok);
    const alvo = parseCor(esperado);
    perto(c.r, alvo.r, CANAL, `${ok} canal R`);
    perto(c.g, alvo.g, CANAL, `${ok} canal G`);
    perto(c.b, alvo.b, CANAL, `${ok} canal B`);
  }
});

test("o Oklch do Tailwind v4 chega aos hexadecimais que o Tailwind publica", () => {
  // Segunda âncora, independente da primeira: o pacote só traz Oklch, mas a
  // documentação do Tailwind publica o hexadecimal equivalente de cada degrau.
  // Se a conversão errasse a matriz ou o gamma, ela ainda acertaria as
  // primárias (que são pontos especiais) e erraria estes cinco.
  const degraus: [string, string][] = [
    ["oklch(55.4% 0.046 257.417)", "#62748e"], // slate-500
    ["oklch(20.8% 0.042 265.755)", "#0f172b"], // slate-900
    ["oklch(12.9% 0.042 264.695)", "#020618"], // slate-950
    ["oklch(76.5% 0.177 163.223)", "#00d492"], // emerald-400
    ["oklch(59.6% 0.145 163.225)", "#009966"], // emerald-600
  ];
  for (const [ok, esperado] of degraus) {
    assert.equal(hex(parseCor(ok)), esperado, `${ok} tinha de dar ${esperado}`);
  }
});

test("as três razões medidas no plano do B6, ao centésimo", () => {
  // Os números que motivaram este bloco. Se a régua deixar de reproduzi-los, ou
  // ela quebrou ou a paleta do Tailwind mudou embaixo de nós — e as duas coisas
  // precisam ficar vermelhas antes de qualquer decisão de cor.
  const slate500 = parseCor("oklch(55.4% 0.046 257.417)");
  const branco = parseCor("#fff");
  perto(contraste(slate500, parseCor("oklch(12.9% 0.042 264.695)")), 4.23, RAZAO, "slate-500 sobre slate-950");
  perto(contraste(slate500, parseCor("oklch(20.8% 0.042 265.755)")), 3.74, RAZAO, "slate-500 sobre slate-900");
  perto(contraste(branco, parseCor("oklch(59.6% 0.145 163.225)")), 3.67, RAZAO, "branco sobre emerald-600");
  // E a que decide se a inversão é viável: o verde do projeto sobre papel.
  perto(contraste(parseCor("oklch(76.5% 0.177 163.223)"), branco), 1.93, RAZAO, "emerald-400 sobre branco");
});

test("croma zero é cinza puro em qualquer matiz", () => {
  for (const h of [0, 60, 137, 264, 359]) {
    const c = parseCor(`oklch(50% 0 ${h})`);
    perto(c.r, c.g, 1e-9, `matiz ${h}: R vs G`);
    perto(c.g, c.b, 1e-9, `matiz ${h}: G vs B`);
  }
  // Oklab é escalado para que L = 1 seja o branco do sRGB e L = 0, o preto.
  assert.deepEqual(hex(parseCor("oklch(100% 0 0)")), "#ffffff");
  assert.deepEqual(hex(parseCor("oklch(0% 0 0)")), "#000000");
});

test("cor fora do gamute é cortada, que é o que o navegador mostra", () => {
  // Croma alto demais para o sRGB. Sem o clamp, canais negativos entrariam na
  // luminância e a razão de contraste sairia menor que a real — errando para o
  // lado permissivo, que é o pior lado.
  const c = parseCor("oklch(70% 0.4 150)");
  for (const canal of [c.r, c.g, c.b]) {
    assert.ok(canal >= 0 && canal <= 1, `canal fora de [0,1]: ${canal}`);
  }
  assert.ok(luminancia(c) > 0, "cor cortada não pode virar preto");
});

// ---------------------------------------------------------------------------
// Luminância e contraste: razões publicadas
// ---------------------------------------------------------------------------

test("os extremos: branco 1, preto 0, e 21:1 entre eles", () => {
  perto(luminancia(parseCor("#fff")), 1, 1e-12, "luminância do branco");
  perto(luminancia(parseCor("#000")), 0, 1e-12, "luminância do preto");
  perto(contraste(parseCor("#fff"), parseCor("#000")), 21, 1e-9, "branco contra preto");
  perto(contraste(parseCor("#fff"), parseCor("#fff")), 1, 1e-12, "branco contra branco");
});

test("a razão não depende da ordem dos argumentos", () => {
  const a = parseCor("#62748e");
  const b = parseCor("#020618");
  perto(contraste(a, b), contraste(b, a), 1e-12, "simetria");
});

test("as duas razões de referência da WCAG sobre branco", () => {
  // #767676 é o cinza mais claro que passa AA sobre branco, e #777777 é o
  // primeiro que não passa. São os dois valores citados em toda a literatura de
  // acessibilidade, e a diferença entre eles é de um único degrau de canal —
  // uma régua que erre a curva de gamma não separa os dois.
  const branco = parseCor("#ffffff");
  perto(contraste(parseCor("#767676"), branco), 4.54, RAZAO, "#767676 sobre branco");
  perto(contraste(parseCor("#777777"), branco), 4.48, RAZAO, "#777777 sobre branco");
  assert.ok(contraste(parseCor("#767676"), branco) >= 4.5, "#767676 tem de passar AA");
  assert.ok(contraste(parseCor("#777777"), branco) < 4.5, "#777777 tem de reprovar AA");
});

test("contraste recusa cor semitransparente em vez de chutar o que há embaixo", () => {
  assert.throws(
    () => contraste(parseCor("rgb(255 0 0 / 50%)"), parseCor("#fff")),
    /opacas/,
    "meia transparência tinha de ser recusada",
  );
});

// ---------------------------------------------------------------------------
// Composição por alfa
// ---------------------------------------------------------------------------

test("alfa 0 e alfa 1 são os dois casos degenerados certos", () => {
  const fundo = parseCor("#123456");
  assert.deepEqual(sobrepor([parseCor("transparent"), fundo]), fundo);
  assert.deepEqual(sobrepor([parseCor("#abcdef"), fundo]), parseCor("#abcdef"));
  assert.deepEqual(sobrepor([fundo]), fundo);
});

test("preto a 50% sobre branco dá exatamente meio caminho em sRGB", () => {
  // A composição do navegador é no sRGB codificado, não no linear. Se esta conta
  // desse 0,214 (meio caminho no linear), a régua estaria medindo outro site.
  const meio = sobrepor([parseCor("rgb(0 0 0 / 50%)"), parseCor("#fff")]);
  perto(meio.r, 0.5, 1e-12, "canal R");
  assert.equal(meio.a, 1);
  assert.equal(hex(meio), "#808080");
});

test("três camadas dão o mesmo que duas composições em sequência", () => {
  // É o caso real do painel de conclusão: selo sobre painel tingido sobre página.
  const selo = parseCor("rgb(52 211 153 / 20%)");
  const painel = parseCor("rgb(16 185 129 / 20%)");
  const pagina = parseCor("#020618");
  const deUmaVez = sobrepor([selo, painel, pagina]);
  const emDois = sobrepor([selo, sobrepor([painel, pagina])]);
  for (const k of ["r", "g", "b", "a"] as const) {
    perto(deUmaVez[k], emDois[k], 1e-12, `canal ${k}`);
  }
});

// ---------------------------------------------------------------------------
// color-mix: é assim que o Tailwind v4 escreve `bg-emerald-500/10`
// ---------------------------------------------------------------------------

test("misturar com transparent preserva a cor e vira alfa", () => {
  // Esta é a identidade que justifica a pré-multiplicação. Sem ela o preto do
  // `transparent` entraria na conta e o verde sairia escurecido.
  const c = parseCor("color-mix(in oklab, #ff0000 45%, transparent)");
  perto(c.r, 1, CANAL, "canal R");
  perto(c.g, 0, CANAL, "canal G");
  perto(c.b, 0, CANAL, "canal B");
  perto(c.a, 0.45, 1e-12, "alfa");
});

test("o modificador do Tailwind equivale a declarar o alfa na mão", () => {
  const fundo = parseCor("#020618");
  const viaMix = sobrepor([
    parseCor("color-mix(in oklab, oklch(69.6% 0.17 162.48) 10%, transparent)"),
    fundo,
  ]);
  const base = parseCor("oklch(69.6% 0.17 162.48)");
  const naMao = sobrepor([{ ...base, a: 0.1 }, fundo]);
  for (const k of ["r", "g", "b"] as const) {
    perto(viaMix[k], naMao[k], CANAL, `canal ${k}`);
  }
});

test("pesos do color-mix: complemento, meio a meio e normalização", () => {
  assert.deepEqual(
    parseCor("color-mix(in srgb, #ffffff 25%, #000000)"),
    parseCor("color-mix(in srgb, #ffffff 25%, #000000 75%)"),
    "peso que falta é o complemento",
  );
  perto(parseCor("color-mix(in srgb, #ffffff, #000000)").r, 0.5, 1e-12, "meio a meio");
  // Pesos que não somam 100% são normalizados pela spec.
  perto(
    parseCor("color-mix(in srgb, #ffffff 25%, #000000 25%)").r,
    0.5,
    1e-12,
    "25/25 normaliza para 50/50",
  );
});

test("mistura em oklab não é a mesma que em srgb, e nenhuma das duas é a média", () => {
  // Guarda contra o erro silencioso de ignorar o `in oklab` e interpolar em sRGB:
  // os dois espaços dão respostas diferentes, e o teste morre se virarem um só.
  const emOklab = parseCor("color-mix(in oklab, #ff0000 50%, #0000ff)");
  const emSrgb = parseCor("color-mix(in srgb, #ff0000 50%, #0000ff)");
  assert.equal(hex(emSrgb), "#800080");
  assert.ok(
    Math.abs(emOklab.r - emSrgb.r) > 0.02 || Math.abs(emOklab.b - emSrgb.b) > 0.02,
    `oklab (${hex(emOklab)}) e srgb (${hex(emSrgb)}) não podem coincidir`,
  );
});
