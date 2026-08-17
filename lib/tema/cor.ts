/**
 * Medição de cor: leitura, composição por alfa e contraste WCAG. **Matemática
 * pura** sobre strings de CSS — nada de `window`, nada de `getComputedStyle` —,
 * então roda igual no navegador e no `npm test`.
 *
 * **Por que existe.** "Esse cinza está legível" é opinião de quem já sabe o que
 * está escrito. Com número dá para dizer coisas conferíveis: *este texto tem
 * 4,23:1 contra o fundo dele, e o piso da WCAG para corpo é 4,5* — e falhar o
 * CI por isso. É o mesmo papel que `lib/spectrum.ts` faz para o som.
 *
 * **O que este arquivo não faz.** Não decide cor, não sabe o que é "método" nem
 * "aviso", não conhece Tailwind. Ele lê valor de CSS e devolve razão. Quem
 * declara o contrato é `pares.ts`; quem guarda os valores de hoje é `paleta.ts`.
 */

/**
 * Uma cor resolvida: canais sRGB **não lineares** (o que vai no `#rrggbb`), de
 * 0 a 1, mais alfa. Sem quantizar para 8 bits — arredondar aqui muda a terceira
 * casa da razão de contraste sem necessidade nenhuma. O `hex()` quantiza, mas
 * só para imprimir.
 */
export type Cor = { r: number; g: number; b: number; a: number };

/** Mapa de `--variavel` → valor, para resolver `var()` dentro de uma cor. */
export type Vars = Record<string, string>;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** sRGB codificado → linear. A curva da spec, com o trecho reto perto do preto. */
const paraLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** Linear → sRGB codificado. Inversa exata da de cima. */
const paraSrgb = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

/**
 * Oklab → sRGB linear, matrizes da CSS Color 4. O clamp é parte do resultado, e
 * não um detalhe: `oklch()` descreve cores fora do gamute do sRGB, e o navegador
 * mostra a versão cortada. Medir a versão não cortada seria medir uma cor que
 * ninguém vê — e justamente os verdes saturados do projeto caem fora.
 */
function oklabParaSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ].map(paraSrgb) as [number, number, number];
}

/** sRGB codificado → Oklab. Só serve à interpolação do `color-mix(in oklab, …)`. */
function srgbParaOklab(r: number, g: number, b: number): [number, number, number] {
  const R = paraLinear(r);
  const G = paraLinear(g);
  const B = paraLinear(b);

  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Aceita `0.4`, `40%`, `none`. Devolve fração de 0 a 1. */
function fracao(bruto: string): number {
  const t = bruto.trim();
  if (t === "none") return 0;
  if (t.endsWith("%")) return clamp01(Number(t.slice(0, -1)) / 100);
  return clamp01(Number(t));
}

/** Aceita `128`, `50%`, `none`. Devolve canal sRGB de 0 a 1. */
function canal(bruto: string): number {
  const t = bruto.trim();
  if (t === "none") return 0;
  if (t.endsWith("%")) return clamp01(Number(t.slice(0, -1)) / 100);
  return clamp01(Number(t) / 255);
}

/**
 * Quebra a lista de argumentos de uma função CSS respeitando parênteses
 * aninhados. Sem isto, `color-mix(in oklab, rgb(1, 2, 3) 40%, transparent)`
 * quebraria nas vírgulas de dentro do `rgb()`.
 */
function argumentos(dentro: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let atual = "";
  for (const ch of dentro) {
    if (ch === "(") nivel += 1;
    if (ch === ")") nivel -= 1;
    if (ch === "," && nivel === 0) {
      partes.push(atual);
      atual = "";
    } else {
      atual += ch;
    }
  }
  partes.push(atual);
  return partes.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Separa por espaço e por `/`, do jeito da sintaxe moderna: `r g b / a`. */
function componentes(dentro: string): { valores: string[]; alfa: string | null } {
  const [cor, alfa = null] = dentro.split("/");
  return { valores: cor.trim().split(/\s+/).filter(Boolean), alfa };
}

const NOMES: Record<string, Cor> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 1, g: 1, b: 1, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
};

/**
 * Resolve `var(--x)` e `var(--x, alternativa)` até o fim, com teto de
 * profundidade para uma variável circular virar erro em vez de travar o `npm
 * test`. É o que permite o `paleta.ts` guardar exatamente o texto que o Tailwind
 * emite, em vez de uma paráfrase dele.
 */
function resolverVars(entrada: string, vars: Vars, profundidade = 0): string {
  if (profundidade > 16) throw new Error(`var() circular em "${entrada}"`);
  const i = entrada.indexOf("var(");
  if (i < 0) return entrada;

  let nivel = 0;
  let fim = -1;
  for (let j = i + 3; j < entrada.length; j += 1) {
    if (entrada[j] === "(") nivel += 1;
    else if (entrada[j] === ")") {
      nivel -= 1;
      if (nivel === 0) {
        fim = j;
        break;
      }
    }
  }
  if (fim < 0) throw new Error(`var() sem fechar em "${entrada}"`);

  const [nome, ...alternativa] = argumentos(entrada.slice(i + 4, fim));
  const valor = vars[nome] ?? vars[nome.replace(/^--/, "")];
  if (valor === undefined && alternativa.length === 0) {
    throw new Error(`variável ${nome} não existe no tema medido`);
  }
  const trocado =
    entrada.slice(0, i) + (valor ?? alternativa.join(", ")) + entrada.slice(fim + 1);
  return resolverVars(trocado, vars, profundidade + 1);
}

/**
 * Lê uma cor escrita em CSS. Cobre as formas que este projeto de fato produz:
 * `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`, `rgb()`/`rgba()` nas duas sintaxes,
 * `oklch()`, `color-mix(in oklab|srgb, …)` — que é como o Tailwind v4 escreve
 * todo modificador de opacidade, `bg-emerald-500/10` inclusive — e os três nomes
 * usados aqui (`transparent`, `white`, `black`).
 *
 * Forma não coberta é erro barulhento, nunca cinza silencioso: um par medido
 * errado é pior que um par não medido.
 */
export function parseCor(entrada: string, vars: Vars = {}): Cor {
  const texto = resolverVars(entrada, vars).trim();
  const minuscula = texto.toLowerCase();

  if (minuscula in NOMES) return { ...NOMES[minuscula] };

  if (texto.startsWith("#")) {
    const h = texto.slice(1);
    const largo = h.length > 4;
    const passo = largo ? 2 : 1;
    if (h.length !== 3 && h.length !== 4 && h.length !== 6 && h.length !== 8) {
      throw new Error(`hexadecimal com ${h.length} dígitos: "${texto}"`);
    }
    const ler = (i: number): number => {
      const p = h.slice(i * passo, i * passo + passo);
      return parseInt(largo ? p : p + p, 16) / 255;
    };
    return {
      r: ler(0),
      g: ler(1),
      b: ler(2),
      a: h.length === 4 || h.length === 8 ? ler(3) : 1,
    };
  }

  // `[\s\S]` e não `.` com a flag `s`: o alvo de compilação do projeto é
  // anterior a ES2018, e a flag nem chega a compilar.
  const chamada = /^([a-z-]+)\(([\s\S]*)\)$/i.exec(texto);
  if (!chamada) throw new Error(`não sei ler a cor "${texto}"`);
  const [, funcao, dentro] = chamada;

  switch (funcao.toLowerCase()) {
    case "rgb":
    case "rgba": {
      // A sintaxe antiga separa por vírgula e traz o alfa como quarto valor; a
      // moderna separa por espaço e traz o alfa depois de uma barra.
      const virgulas = argumentos(dentro);
      const [valores, alfa] =
        virgulas.length > 1
          ? [virgulas.slice(0, 3), virgulas[3] ?? null]
          : (({ valores, alfa }) => [valores, alfa])(componentes(dentro));
      if (valores.length < 3) throw new Error(`rgb() com ${valores.length} canais: "${texto}"`);
      return {
        r: canal(valores[0]),
        g: canal(valores[1]),
        b: canal(valores[2]),
        a: alfa === null ? 1 : fracao(alfa),
      };
    }

    case "oklch": {
      const { valores, alfa } = componentes(dentro);
      if (valores.length < 3) throw new Error(`oklch() com ${valores.length} canais: "${texto}"`);
      const L = fracao(valores[0]);
      const C = Number(valores[1]);
      const h = (Number(valores[2]) * Math.PI) / 180;
      const [r, g, b] = oklabParaSrgb(L, C * Math.cos(h), C * Math.sin(h));
      return { r, g, b, a: alfa === null ? 1 : fracao(alfa) };
    }

    case "color-mix":
      return colorMix(dentro, vars);

    default:
      throw new Error(`função de cor "${funcao}" não é lida por esta régua`);
  }
}

/**
 * `color-mix(in <espaço>, A p%, B q%)`. As porcentagens seguem a spec: se falta
 * uma, ela é o complemento da outra; se faltam as duas, é meio a meio.
 *
 * A **pré-multiplicação pelo alfa** não é firula. É ela que faz
 * `color-mix(in oklab, verde 45%, transparent)` dar *verde a 45%* em vez de
 * *verde escurecido em direção ao preto* — `transparent` é `rgb(0 0 0 / 0)`, e
 * sem pré-multiplicar o preto dele entraria na conta.
 */
function colorMix(dentro: string, vars: Vars): Cor {
  const partes = argumentos(dentro);
  const espaco = /^in\s+([a-z-]+)$/i.exec(partes[0]?.trim() ?? "")?.[1]?.toLowerCase();
  if (!espaco) throw new Error(`color-mix() sem espaço de interpolação: "${dentro}"`);
  if (espaco !== "oklab" && espaco !== "srgb") {
    throw new Error(`color-mix(in ${espaco}) não é lido por esta régua`);
  }
  if (partes.length !== 3) throw new Error(`color-mix() com ${partes.length - 1} cores`);

  const lado = (bruto: string): { cor: Cor; peso: number | null } => {
    const m = /\s([0-9.]+)%$/.exec(bruto);
    return {
      cor: parseCor(m ? bruto.slice(0, m.index) : bruto, vars),
      peso: m ? Number(m[1]) / 100 : null,
    };
  };

  const a = lado(partes[1]);
  const b = lado(partes[2]);
  let pa = a.peso ?? (b.peso === null ? 0.5 : 1 - b.peso);
  let pb = b.peso ?? 1 - pa;
  const soma = pa + pb;
  if (soma === 0) throw new Error(`color-mix() com pesos zerados: "${dentro}"`);
  pa /= soma;
  pb /= soma;

  const alfa = a.cor.a * pa + b.cor.a * pb;
  // Sem alfa nenhum dos dois lados, o resultado é invisível e a cor é arbitrária;
  // a spec manda devolver transparente, e é o que o navegador mostra.
  if (alfa === 0) return { r: 0, g: 0, b: 0, a: 0 };

  const ka = (a.cor.a * pa) / alfa;
  const kb = (b.cor.a * pb) / alfa;

  if (espaco === "srgb") {
    return {
      r: clamp01(a.cor.r * ka + b.cor.r * kb),
      g: clamp01(a.cor.g * ka + b.cor.g * kb),
      b: clamp01(a.cor.b * ka + b.cor.b * kb),
      a: alfa,
    };
  }

  const [La, aa, ba] = srgbParaOklab(a.cor.r, a.cor.g, a.cor.b);
  const [Lb, ab, bb] = srgbParaOklab(b.cor.r, b.cor.g, b.cor.b);
  const [r, g, b_] = oklabParaSrgb(La * ka + Lb * kb, aa * ka + ab * kb, ba * ka + bb * kb);
  return { r, g, b: b_, a: alfa };
}

/**
 * Achata uma pilha de camadas em uma cor só, `source-over` em sRGB codificado —
 * que é como o navegador compõe fundo sobre fundo.
 *
 * A ordem é **da mais próxima do olho para a mais distante**, igual à leitura de
 * fora para dentro de um `className`: o painel tingido primeiro, o `<body>` por
 * último. O caso real do projeto tem três camadas — o selo `emerald-400/20`
 * sobre o painel `emerald-500/20` sobre o `slate-950` da página — e é
 * exatamente onde estimar "no olho" erra.
 */
export function sobrepor(camadas: Cor[]): Cor {
  if (camadas.length === 0) throw new Error("pilha de cores vazia");
  let fundo = camadas[camadas.length - 1];
  for (let i = camadas.length - 2; i >= 0; i -= 1) {
    const topo = camadas[i];
    const a = topo.a + fundo.a * (1 - topo.a);
    if (a === 0) {
      fundo = { r: 0, g: 0, b: 0, a: 0 };
      continue;
    }
    const mistura = (t: number, f: number): number =>
      (t * topo.a + f * fundo.a * (1 - topo.a)) / a;
    fundo = {
      r: mistura(topo.r, fundo.r),
      g: mistura(topo.g, fundo.g),
      b: mistura(topo.b, fundo.b),
      a,
    };
  }
  return fundo;
}

/** Luminância relativa da WCAG 2.x. Ignora o alfa de propósito — ver `contraste`. */
export function luminancia(cor: Cor): number {
  return (
    0.2126 * paraLinear(cor.r) + 0.7152 * paraLinear(cor.g) + 0.0722 * paraLinear(cor.b)
  );
}

/**
 * Razão de contraste da WCAG 2.x, de 1:1 a 21:1.
 *
 * **Exige as duas cores opacas.** Texto semitransparente sobre fundo
 * semitransparente não tem contraste definido — tem o contraste do que sobra
 * depois de compor, e compor exige saber o que há embaixo. Em vez de chutar
 * branco, a régua recusa: quem chamar tem de declarar a pilha inteira e passar
 * por `sobrepor`. Foi assim que os painéis tingidos deixaram de ser estimativa.
 */
export function contraste(a: Cor, b: Cor): number {
  if (a.a < 1 || b.a < 1) {
    throw new Error(
      `contraste() exige cores opacas (recebi alfa ${a.a} e ${b.a}); achate a pilha com sobrepor()`,
    );
  }
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

/** `#rrggbb` (ou `#rrggbbaa`) para imprimir na tabela. Aqui, sim, 8 bits. */
export function hex(cor: Cor): string {
  const par = (c: number): string =>
    Math.round(clamp01(c) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${par(cor.r)}${par(cor.g)}${par(cor.b)}${cor.a < 1 ? par(cor.a) : ""}`;
}
