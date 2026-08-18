import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { blocosDe, lerFolha, temaRaiz } from "./css.ts";

/**
 * Os cinco guardas da camada de tokens. Cada um existe porque a falha que ele
 * pega é **silenciosa** — nada quebra, nada avisa, e a tela fica errada.
 *
 * Não são testes de contraste: nenhum deles mede cor. São testes de que a
 * estrutura que sustenta a medição continua de pé.
 */

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const FOLHA = join(RAIZ, "app/globals.css");

/** Arquivos de código onde uma classe pode aparecer. */
function fontes(): { caminho: string; texto: string }[] {
  const achados: { caminho: string; texto: string }[] = [];
  const andar = (dir: string): void => {
    for (const entrada of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      const relativo = `${dir}/${entrada.name}`;
      if (entrada.isDirectory()) andar(relativo);
      else if (/\.(tsx?|css|svg)$/.test(entrada.name)) {
        achados.push({ caminho: relativo, texto: readFileSync(join(RAIZ, relativo), "utf8") });
      }
    }
  };
  andar("app");
  andar("components");
  return achados;
}

const FAMILIAS =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const UTILITARIAS = "bg|text|border|ring|outline|divide|fill|stroke|from|to|via|shadow|accent|caret|decoration|placeholder";

test("nenhum `--color-` mora dentro de `@theme inline`", () => {
  // A armadilha: `@theme inline` assa o valor literal na utilitária em vez de
  // emitir `var()`. Um token de cor ali dentro deixa de responder a redefinição
  // por subárvore — e some a rota de comparação do B6.3 e o tema escuro depois.
  // O bloco precisa ser `inline` por causa das fontes; cor é que não entra.
  const inline = blocosDe(readFileSync(FOLHA, "utf8")).filter((b) => b.seletor === "@theme inline");
  assert.equal(inline.length, 1, "esperava exatamente um bloco `@theme inline`");
  const cores = Object.keys(inline[0].vars).filter((nome) => nome.startsWith("--color-"));
  assert.deepEqual(cores, [], "mova estes tokens para o `@theme` não-inline logo abaixo");
});

test("zero classes de cor crua em `app/` e `components/`", () => {
  // O par obrigatório de `--color-*: initial`. Depois daquela linha,
  // `bg-slate-900` não gera CSS nenhum: a classe some, o elemento fica sem
  // fundo, nada quebra e nada avisa. Este grep é o que torna o silêncio
  // vermelho.
  // `\\b` e não `\b`: dentro de uma template literal, `\b` é o caractere de
  // backspace, e a expressão passaria a nunca casar — verde por acidente, que
  // é exatamente o tipo de falha que este arquivo existe para pegar.
  const cruas = new RegExp(
    `\\b(?:${UTILITARIAS})-(?:${FAMILIAS})(?:-[0-9]{2,3})?(?:/[0-9.]{1,4})?\\b`,
    "g",
  );
  // E o escape pela porta dos fundos: valor arbitrário entre colchetes.
  const arbitrarias = /\b(?:bg|text|border|ring|outline|fill|stroke)-\[(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch|oklab|lab|lch)\()/g;

  const achados: string[] = [];
  for (const { caminho, texto } of fontes()) {
    for (const linha of texto.split("\n").entries()) {
      const [i, conteudo] = linha;
      for (const m of [...conteudo.matchAll(cruas), ...conteudo.matchAll(arbitrarias)]) {
        achados.push(`${caminho}:${i + 1} — ${m[0]}`);
      }
    }
  }
  assert.deepEqual(achados, [], "cor tem de entrar por token; ver a paleta em app/globals.css");
});

test("nenhum token nasce órfão", () => {
  // Token declarado e nunca usado é peso morto que ninguém ousa apagar, porque
  // ninguém sabe se alguém usa. Melhor não deixar nascer.
  const declarados = Object.keys(temaRaiz(blocosDe(readFileSync(FOLHA, "utf8"))))
    // `--color-*: initial` não é token, é a linha que apaga a paleta de fábrica.
    .filter((nome) => nome !== "--color-*")
    .filter((nome) => nome.startsWith("--color-") || nome.startsWith("--pincel-"))
    .map((nome) => nome.replace(/^--(?:color-)?/, ""));

  const corpo = fontes()
    .map((f) => f.texto)
    .join("\n");

  const orfaos = declarados.filter((token) => {
    // Como classe (`bg-papel`, `hover:text-tinta-tenue/80`), como variável
    // (`var(--color-metodo)`) ou como nome lido pelo JavaScript (`--pincel-seta`).
    //
    // O `(?![-\\w])` é o que separa `metodo` de `metodo-cheio`: sem ele, um
    // token órfão passaria de carona no nome de outro que começa igual, e o
    // guarda ficaria verde por acaso. O `(?!\\s*:)` descarta a própria linha
    // que declara o token — declarar não é usar.
    const fim = "(?![-\\w])";
    const comoClasse = new RegExp(`\\b(?:${UTILITARIAS})-${token}${fim}(?:/[0-9.]+)?`);
    const comoVariavel = new RegExp(`--(?:color-)?${token}${fim}(?!\\s*:)`);
    return !comoClasse.test(corpo) && !comoVariavel.test(corpo);
  });

  assert.deepEqual(orfaos, [], "apague o token ou use-o");
});

test("toda classe de token aponta para um token que existe", () => {
  // O contrário do guarda anterior, e a outra metade da falha silenciosa: um
  // `bg-papeI` com i maiúsculo não gera regra nenhuma, o elemento fica sem
  // fundo e nada avisa. O grep de cor crua não pega — não há cor crua ali.
  //
  // O truque para não afogar em falso positivo: só é suspeita a classe cujo
  // nome **começa** por uma raiz de token nossa. `text-sm`, `border-b` e
  // `bg-cover` passam batido — nenhuma utilitária do Tailwind começa por
  // `papel`, `tinta`, `carta`, `metodo` e companhia. `bg-papelx` e
  // `bg-tinta-medai` não passam.
  const declarados = new Set(
    Object.keys(temaRaiz(blocosDe(readFileSync(FOLHA, "utf8"))))
      .filter((nome) => nome.startsWith("--color-") && nome !== "--color-*")
      .map((nome) => nome.slice("--color-".length)),
  );
  const raizes = new Set([...declarados].map((token) => token.split("-")[0]));

  const uso = new RegExp(`\\b(?:${UTILITARIAS})-([a-z][a-z0-9-]*)(?:/[0-9.]+)?\\b`, "g");
  const suspeitas: string[] = [];
  for (const { caminho, texto } of fontes()) {
    if (caminho.endsWith(".css")) continue; // a folha declara, não consome
    texto.split("\n").forEach((conteudo, i) => {
      for (const m of conteudo.matchAll(uso)) {
        const nome = m[1];
        const nossa = [...raizes].some((raiz) => nome.startsWith(raiz));
        if (nossa && !declarados.has(nome)) {
          suspeitas.push(`${caminho}:${i + 1} — ${m[0]}`);
        }
      }
    });
  }
  assert.deepEqual(suspeitas, [], "classe de cor sem token correspondente em app/globals.css");
});

test("cada direção candidata redefine a paleta inteira", () => {
  // O guarda contra o pior verde que existe: o teste passar medindo o tema
  // errado. Uma direção que esqueça um token o herda da raiz — no B6.3 isso
  // significa um valor do tema escuro sobrando no meio de uma paleta clara, e
  // a régua aprovaria a mistura sem reclamar de nada.
  const blocos = lerFolha(FOLHA);
  const daRaiz = Object.keys(temaRaiz(blocos)).filter(
    (nome) => nome.startsWith("--color-") && nome !== "--color-*",
  );

  const porDirecao = new Map<string, Set<string>>();
  for (const bloco of blocos) {
    const nome = /^\[data-direcao=["']?([\w-]+)["']?\]$/.exec(bloco.seletor)?.[1];
    if (!nome) continue;
    const conjunto = porDirecao.get(nome) ?? new Set<string>();
    for (const token of Object.keys(bloco.vars)) conjunto.add(token);
    porDirecao.set(nome, conjunto);
  }

  for (const [direcao, declarados] of porDirecao) {
    const faltando = daRaiz.filter((token) => !declarados.has(token));
    assert.deepEqual(faltando, [], `a direção "${direcao}" não redefine estes tokens`);
  }
});
