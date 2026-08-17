/**
 * As cores que o site produz **hoje**, antes de existir token nenhum.
 *
 * **Por que este arquivo é temporário.** Na F0 a cor entrou por classe crua do
 * Tailwind, de propósito: o curso não tinha identidade decidida e a paleta de
 * fábrica é uma escolha honesta enquanto isso. O B6.2 troca as classes por
 * tokens semânticos em `app/globals.css`, e a partir daí a fonte da verdade é o
 * CSS — este módulo some, e `pares.ts` passa a ler os valores de lá.
 *
 * Enquanto isso ele existe para uma coisa só: medir o tema atual, para que o
 * refactor do B6.2 tenha um "antes" com que se comparar. Um sweep de ~180
 * substituições cuja falha é silenciosa precisa de um número igual dos dois
 * lados.
 *
 * **Proveniência.** Todos os valores abaixo são cópia literal de
 * `node_modules/tailwindcss/theme.css` (Tailwind v4). Nenhum foi digitado de
 * memória nem convertido à mão — a conversão de Oklch para sRGB é feita pela
 * régua, e `cor.test.ts` a afere contra as primárias da CSS Color 4.
 */

import { parseCor, type Cor } from "./cor.ts";

/** Só os degraus que o site de fato usa. Degrau não usado aqui é degrau morto. */
export const TAILWIND: Record<string, string> = {
  "--color-white": "#fff",
  "--color-black": "#000",

  "--color-slate-100": "oklch(96.8% 0.007 247.896)",
  "--color-slate-200": "oklch(92.9% 0.013 255.508)",
  "--color-slate-300": "oklch(86.9% 0.022 252.894)",
  "--color-slate-400": "oklch(70.4% 0.04 256.788)",
  "--color-slate-500": "oklch(55.4% 0.046 257.417)",
  "--color-slate-600": "oklch(44.6% 0.043 257.281)",
  "--color-slate-700": "oklch(37.2% 0.044 257.287)",
  "--color-slate-800": "oklch(27.9% 0.041 260.031)",
  "--color-slate-900": "oklch(20.8% 0.042 265.755)",
  "--color-slate-950": "oklch(12.9% 0.042 264.695)",

  "--color-emerald-50": "oklch(97.9% 0.021 166.113)",
  "--color-emerald-100": "oklch(95% 0.052 163.051)",
  "--color-emerald-200": "oklch(90.5% 0.093 164.15)",
  "--color-emerald-400": "oklch(76.5% 0.177 163.223)",
  "--color-emerald-500": "oklch(69.6% 0.17 162.48)",
  "--color-emerald-600": "oklch(59.6% 0.145 163.225)",

  "--color-amber-100": "oklch(96.2% 0.059 95.617)",
  "--color-amber-500": "oklch(76.9% 0.188 70.08)",

  "--color-rose-100": "oklch(94.1% 0.03 12.58)",
  "--color-rose-300": "oklch(81% 0.117 11.638)",
  "--color-rose-500": "oklch(64.5% 0.246 16.439)",

  "--color-sky-100": "oklch(95.1% 0.026 236.824)",
  "--color-sky-500": "oklch(68.5% 0.169 237.323)",
};

/** Prefixos de utilitária que não mudam a cor, só onde ela é pintada. */
const PREFIXO = /^(?:bg|text|border|ring|outline|divide|fill|stroke|decoration)-/;

/**
 * Resolve o nome de uma cor como o Tailwind v4 a escreveria na folha gerada.
 * Aceita com ou sem prefixo de utilitária — `bg-emerald-500/10`,
 * `text-slate-400` e `slate-400` chegam ao mesmo lugar —, para que `pares.ts`
 * possa ser copiado do próprio `grep` no código.
 *
 * O modificador de opacidade vira `color-mix(in oklab, …, transparent)`, que é
 * literalmente o que o v4 emite. Reproduzir a forma, e não o resultado, é o que
 * mantém a medição colada no que o navegador faz.
 */
export function corDeClasse(nome: string): Cor {
  const limpo = nome.trim().replace(PREFIXO, "");
  const [base, alfa] = limpo.split("/");
  const variavel = `--color-${base}`;
  if (!(variavel in TAILWIND)) {
    throw new Error(`"${nome}" não está na paleta medida (falta ${variavel} em paleta.ts)`);
  }
  const valor = alfa === undefined ? `var(${variavel})` : `color-mix(in oklab, var(${variavel}) ${alfa}%, transparent)`;
  return parseCor(valor, TAILWIND);
}
