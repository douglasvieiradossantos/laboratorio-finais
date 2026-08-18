import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { contraste, hex, sobrepor, type Cor, type Vars } from "./cor.ts";
import { corDeToken, lerFolha, temasPorSeletor } from "./css.ts";
import { PARES, type Par } from "./pares.ts";

/**
 * O contrato de `pares.ts` medido pela régua de `cor.ts`, com os valores lidos
 * de `app/globals.css` — o CSS é a fonte da verdade, o TypeScript declara o
 * contrato, e não existe um terceiro lugar onde uma cor possa ficar para trás.
 *
 * É este arquivo que transforma "contraste AA" de opinião de fim de bloco em
 * gate: uma cor nova que reprove não chega à tela, e uma reprovação existente
 * não some de vista sem alguém apagar a linha que a registra.
 *
 * **Sobre o CI ficar verde com defeito na tela.** Oito pares do tema de hoje
 * reprovam AA — o achado que justificou este bloco. Eles estão marcados com
 * `divida` em `pares.ts`, e o teste é exigente nos dois sentidos: par com
 * dívida que **passar** também reprova, porque significa que a linha ficou
 * para trás. A dívida encolhe por decisão registrada, nunca por esquecimento.
 *
 * **Dívida vale só para o tema em vigor.** Cada `[data-direcao="…"]` que o
 * B6.3 acrescentar é medido pela mesma bateria e **sem** direito a dívida:
 * nenhuma direção que reprove AA chega aos olhos de quem vai escolher.
 */

const FOLHA = fileURLToPath(new URL("../../app/globals.css", import.meta.url));
const TEMAS = Object.entries(temasPorSeletor(lerFolha(FOLHA)));

type Medida = { par: Par; tinta: Cor; fundo: Cor; razao: number };

/**
 * A tinta compõe sobre o fundo dela antes de ser medida: `metodo/80` não tem
 * contraste próprio, tem o do que sobra sobre a página. Depois disso a cor é
 * opaca, e `contraste()` aceita.
 */
function medir(vars: Vars): Medida[] {
  const cor = (nome: string): Cor => corDeToken(nome, vars);
  return PARES.map((par) => {
    const pilhaTexto = (Array.isArray(par.texto) ? par.texto : [par.texto]).map(cor);
    const pilhaFundo = par.fundo.map(cor);
    const fundo = sobrepor(pilhaFundo);
    const tinta = sobrepor([...pilhaTexto, ...pilhaFundo]);
    return { par, tinta, fundo, razao: contraste(tinta, fundo) };
  });
}

/** O tema sem seletor de direção é o que está em vigor; o resto é candidato. */
const emVigor = (nome: string): boolean => nome === "";
const nomeLegivel = (nome: string): string => (emVigor(nome) ? ":root" : `direção "${nome}"`);

test("a pilha de fundo termina numa cor opaca", () => {
  // Sem isto, um par com o `<body>` esquecido no fim mediria contra
  // transparente, e `contraste()` explodiria com uma mensagem obscura no lugar
  // desta.
  for (const [nome, vars] of TEMAS) {
    for (const { par, fundo } of medir(vars)) {
      assert.equal(fundo.a, 1, `${nomeLegivel(nome)}: a pilha de "${par.onde}" não fica opaca`);
    }
  }
});

test("nenhuma combinação aparece duas vezes na lista", () => {
  // A lista é por combinação, não por sítio: duplicata é sinal de que alguém
  // acrescentou um par sem procurar o que já existia, e a tabela passa a mentir
  // sobre quantas combinações distintas o site tem.
  const vistos = new Map<string, string>();
  for (const par of PARES) {
    const chave = `${[par.texto].flat().join("+")} sobre ${par.fundo.join("+")} @ ${par.piso}`;
    const antes = vistos.get(chave);
    assert.equal(antes, undefined, `"${par.onde}" repete a combinação de "${antes}"`);
    vistos.set(chave, par.onde);
  }
});

test("toda isenção e toda dívida vem com motivo escrito", () => {
  for (const par of PARES) {
    if (par.isencao !== undefined) {
      assert.ok(par.isencao.length > 20, `isenção sem motivo em "${par.onde}"`);
    }
    if (par.divida !== undefined) {
      assert.ok(par.divida.length > 20, `dívida sem motivo em "${par.onde}"`);
    }
    assert.ok(
      !(par.isencao !== undefined && par.divida !== undefined),
      `"${par.onde}" está isento e endividado ao mesmo tempo — decida qual dos dois`,
    );
  }
});

test("dívida registrada é dívida real: par com `divida` tem de reprovar mesmo", () => {
  const vars = TEMAS.find(([nome]) => emVigor(nome))?.[1];
  assert.ok(vars, "a folha não declarou tema de raiz");
  for (const { par, razao } of medir(vars)) {
    if (par.divida === undefined) continue;
    assert.ok(
      razao < par.piso,
      `"${par.onde}" está marcado como dívida mas já mede ${razao.toFixed(2)}:1 ` +
        `(piso ${par.piso}). Apague o campo \`divida\` de pares.ts — a dívida foi paga.`,
    );
  }
});

test("todo par sem isenção e sem dívida bate o piso da WCAG", () => {
  for (const [nome, vars] of TEMAS) {
    const linhas = medir(vars).sort((a, b) => a.razao - b.razao);
    const largura = Math.max(...linhas.map((l) => l.par.onde.length));
    // Direção candidata não tem direito a dívida: o B6.3 só oferece o que já é
    // legal, e a escolha de quem olha fica sendo estética, não de acessibilidade.
    const perdoa = (l: Medida): boolean => emVigor(nome) && l.par.divida !== undefined;

    console.log(`\n  Contraste — ${linhas.length} combinações, ${nomeLegivel(nome)}\n`);
    for (const l of linhas) {
      const marca = l.par.isencao
        ? "isento"
        : perdoa(l)
          ? "DÍVIDA"
          : l.razao >= l.par.piso
            ? "ok"
            : "FALHA";
      console.log(
        `  ${marca.padEnd(6)} ${l.razao.toFixed(2).padStart(5)}:1 (piso ${l.par.piso})  ` +
          `${hex(l.tinta)} sobre ${hex(l.fundo)}  ${l.par.onde.padEnd(largura)}`,
      );
    }

    const reprovados = linhas.filter(
      (l) => l.par.isencao === undefined && !perdoa(l) && l.razao < l.par.piso,
    );
    console.log(
      `\n  ${linhas.length} combinações · ${linhas.filter(perdoa).length} dívidas registradas · ` +
        `${linhas.filter((l) => l.par.isencao !== undefined).length} isenções · ` +
        `${reprovados.length} reprovações novas\n`,
    );

    assert.deepEqual(
      reprovados.map((l) => `${l.razao.toFixed(2)}:1 — ${l.par.onde}`),
      [],
      `${nomeLegivel(nome)}: par abaixo do piso sem isenção nem dívida registrada`,
    );
  }
});
