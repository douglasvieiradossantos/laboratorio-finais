/**
 * Lê os tokens direto de `app/globals.css`.
 *
 * **Por que o CSS é a fonte da verdade e não um objeto em TypeScript.** Se os
 * valores morassem aqui, haveria dois lugares para mudar uma cor e um deles ia
 * ficar para trás — e o teste passaria medindo a cópia certa de um site
 * pintado com a errada. Lendo a folha, o teste mede o que o navegador vai ler.
 * O TypeScript declara o *contrato* (`pares.ts`); o CSS guarda os *valores*.
 *
 * O leitor é deliberadamente burro: separa blocos por chaves balanceadas e
 * colhe as declarações de propriedade personalizada de cada um. Não é um parser
 * de CSS, e não precisa ser — o que ele lê é um arquivo do próprio projeto, com
 * forma conhecida. Qualquer construção que ele não entenda vira bloco ignorado,
 * e a variável que faltar explode na hora de resolver, com o nome dela na
 * mensagem.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseCor, type Cor, type Vars } from "./cor.ts";

export type Bloco = {
  /** O que vem antes da chave: `:root`, `@theme`, `@theme inline`, `[data-direcao="a"]`. */
  seletor: string;
  /** As propriedades personalizadas declaradas **direto** neste bloco. */
  vars: Vars;
};

/** Tira comentários antes de qualquer coisa: `/* --color-x: … *\/` não é declaração. */
function semComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Quebra a folha em blocos de primeiro nível. Blocos aninhados (o `&` de uma
 * `@utility`, o miolo de uma `@media`) ficam dentro do corpo do bloco pai e não
 * viram bloco próprio — nenhum token do projeto mora lá.
 */
export function blocosDe(css: string): Bloco[] {
  const texto = semComentarios(css);
  const blocos: Bloco[] = [];
  let i = 0;

  while (i < texto.length) {
    const abre = texto.indexOf("{", i);
    if (abre < 0) break;

    let nivel = 1;
    let fecha = abre + 1;
    for (; fecha < texto.length && nivel > 0; fecha += 1) {
      if (texto[fecha] === "{") nivel += 1;
      else if (texto[fecha] === "}") nivel -= 1;
    }

    // O prelúdio arrasta o que veio antes dele — o `@import` do topo da folha,
    // por exemplo. O seletor é só o que sobra depois do último `;`.
    const bruto = texto.slice(i, abre);
    const seletor = bruto
      .slice(bruto.lastIndexOf(";") + 1)
      .trim()
      .replace(/\s+/g, " ");
    const corpo = texto.slice(abre + 1, fecha - 1);
    blocos.push({ seletor, vars: declaracoesDe(corpo) });
    i = fecha;
  }

  return blocos;
}

/** As `--x: y;` de um corpo, ignorando o que estiver dentro de chaves aninhadas. */
function declaracoesDe(corpo: string): Vars {
  const vars: Vars = {};
  let nivel = 0;
  let atual = "";

  const guardar = (decl: string): void => {
    const corte = decl.indexOf(":");
    if (corte < 0) return;
    const nome = decl.slice(0, corte).trim();
    if (!nome.startsWith("--")) return;
    vars[nome] = decl.slice(corte + 1).trim();
  };

  for (const ch of corpo) {
    if (ch === "{") nivel += 1;
    else if (ch === "}") nivel -= 1;
    else if (ch === ";" && nivel === 0) {
      guardar(atual);
      atual = "";
      continue;
    }
    if (nivel === 0 && ch !== "{" && ch !== "}") atual += ch;
  }
  guardar(atual);
  return vars;
}

/** Os quatro preludios que declaram token de tema neste projeto. */
const RAIZ = new Set([":root", "@theme", "@theme inline", ":root, :host"]);

/**
 * Todos os tokens que valem na raiz do documento, na ordem em que a folha os
 * declara — bloco posterior vence, que é a cascata.
 */
export function temaRaiz(blocos: Bloco[]): Vars {
  const vars: Vars = {};
  for (const bloco of blocos) {
    if (RAIZ.has(bloco.seletor)) Object.assign(vars, bloco.vars);
  }
  return vars;
}

/**
 * Um tema por direção, para o B6.3: a raiz mais as redefinições de cada
 * `[data-direcao="…"]`. Sem nenhuma direção declarada, devolve só a raiz sob a
 * chave vazia — que é o caso de hoje, e faz o teste de contraste rodar igual
 * antes e depois de existir a rota de comparação.
 */
export function temasPorSeletor(blocos: Bloco[]): Record<string, Vars> {
  const raiz = temaRaiz(blocos);
  const temas: Record<string, Vars> = { "": raiz };
  for (const bloco of blocos) {
    const nome = /^\[data-direcao=["']?([\w-]+)["']?\]$/.exec(bloco.seletor)?.[1];
    // Acumula, e não substitui: uma direção declara a paleta num bloco e os
    // papéis tipográficos noutro, com o mesmo seletor. Substituir faria o
    // segundo bloco — o que não tem cor nenhuma — apagar a paleta inteira, e a
    // direção passaria a ser medida com os valores da raiz. O teste continuaria
    // verde, medindo o tema errado, que é a pior forma de verde que existe.
    if (nome) temas[nome] = { ...(temas[nome] ?? raiz), ...bloco.vars };
  }
  return temas;
}

/**
 * Lê e quebra uma folha do disco, seguindo os `@import` de caminho relativo.
 *
 * Seguir o import não é luxo: as direções candidatas do B6.3 moram em
 * `app/direcoes/`, que é um diretório temporário — apagar a pasta e a linha do
 * import tem de bastar para elas sumirem. Se o teste só lesse `globals.css`,
 * ou os candidatos entrariam na folha definitiva, ou não seriam medidos.
 *
 * `@import "tailwindcss"` e qualquer outro import de pacote são ignorados: o
 * que interessa é token do projeto, e o Tailwind não declara nenhum.
 */
export function lerFolha(caminho: string): Bloco[] {
  const css = readFileSync(caminho, "utf8");
  const blocos = blocosDe(css);
  const base = dirname(caminho);

  for (const [, alvo] of semComentarios(css).matchAll(/@import\s+["']([^"']+)["']/g)) {
    if (!alvo.startsWith(".")) continue;
    blocos.push(...lerFolha(resolve(base, alvo)));
  }
  return blocos;
}

/**
 * Resolve o nome de um token do jeito que o Tailwind resolveria a classe.
 * `tinta-apagada` vira `var(--color-tinta-apagada)`; `metodo-superficie/10` vira
 * o `color-mix(in oklab, …, transparent)` que o v4 emite para o modificador de
 * opacidade. Reproduzir a *forma* do que o Tailwind gera, e não só o resultado,
 * é o que mantém a medição colada no que o navegador faz.
 */
export function corDeToken(nome: string, vars: Vars): Cor {
  const [base, alfa] = nome.trim().split("/");
  const variavel = `--color-${base}`;
  if (!(variavel in vars)) {
    throw new Error(`o token "${base}" não existe na folha (falta ${variavel} em globals.css)`);
  }
  const valor =
    alfa === undefined
      ? `var(${variavel})`
      : `color-mix(in oklab, var(${variavel}) ${alfa}%, transparent)`;
  return parseCor(valor, vars);
}
