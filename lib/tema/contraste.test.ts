import assert from "node:assert/strict";
import test from "node:test";
import { contraste, hex, sobrepor, type Cor } from "./cor.ts";
import { corDeClasse } from "./paleta.ts";
import { PARES, type Par } from "./pares.ts";

/**
 * O contrato de `pares.ts` medido pela régua de `cor.ts`, com o tema de hoje.
 *
 * É este arquivo que transforma "contraste AA" de opinião de fim de bloco em
 * gate: uma cor nova que reprove não chega à tela, e uma reprovação existente
 * não some de vista sem alguém apagar a linha que a registra.
 *
 * **Sobre o CI ficar verde com defeito na tela.** Três pares do tema atual
 * reprovam AA — o achado que justificou este bloco. Eles estão marcados com
 * `divida` em `pares.ts`, e o teste é exigente nos dois sentidos: par com
 * dívida que **passar** também reprova, porque significa que a linha ficou para
 * trás. A dívida encolhe por decisão registrada, nunca por esquecimento.
 */

/**
 * A tinta compõe sobre o fundo dela antes de ser medida: `emerald-400/80` não
 * tem contraste próprio, tem o do que sobra sobre a página. Depois disso a
 * cor é opaca, e `contraste()` aceita.
 */
function resolver(par: Par): { tinta: Cor; fundo: Cor; razao: number } {
  const pilhaTexto = (Array.isArray(par.texto) ? par.texto : [par.texto]).map(corDeClasse);
  const pilhaFundo = par.fundo.map(corDeClasse);
  const fundo = sobrepor(pilhaFundo);
  const tinta = sobrepor([...pilhaTexto, ...pilhaFundo]);
  return { tinta, fundo, razao: contraste(tinta, fundo) };
}

const medidos = PARES.map((par) => ({ par, ...resolver(par) }));

test("a pilha de fundo termina numa cor opaca", () => {
  // Sem isto, um par com o `<body>` esquecido no fim mediria contra transparente
  // e `contraste()` explodiria com uma mensagem obscura em vez desta.
  for (const { par, fundo } of medidos) {
    assert.equal(fundo.a, 1, `a pilha de "${par.onde}" não chega a uma cor opaca`);
  }
});

test("nenhuma combinação aparece duas vezes na lista", () => {
  // A lista é por combinação, não por sítio: duplicata é sinal de que alguém
  // acrescentou um par sem procurar o que já existia, e a tabela mente sobre
  // quantas combinações distintas o site tem.
  const vistos = new Map<string, string>();
  for (const { par } of PARES.map((par) => ({ par }))) {
    const chave = `${[par.texto].flat().join("+")} sobre ${par.fundo.join("+")} @ ${par.piso}`;
    const antes = vistos.get(chave);
    assert.equal(antes, undefined, `"${par.onde}" repete a combinação de "${antes}"`);
    vistos.set(chave, par.onde);
  }
});

test("toda isenção e toda dívida vem com motivo escrito", () => {
  for (const { par } of medidos) {
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
  for (const { par, razao } of medidos) {
    if (par.divida === undefined) continue;
    assert.ok(
      razao < par.piso,
      `"${par.onde}" está marcado como dívida mas já mede ${razao.toFixed(2)}:1 ` +
        `(piso ${par.piso}). Apague o campo \`divida\` de pares.ts — a dívida foi paga.`,
    );
  }
});

test("todo par sem isenção e sem dívida bate o piso da WCAG", () => {
  const linhas = [...medidos].sort((a, b) => a.razao - b.razao);
  const largura = Math.max(...linhas.map((l) => l.par.onde.length));

  const marca = (l: (typeof linhas)[number]): string =>
    l.par.isencao !== undefined ? "isento" : l.par.divida !== undefined ? "DÍVIDA" : l.razao >= l.par.piso ? "ok" : "FALHA";

  console.log(`\n  Contraste — ${linhas.length} combinações, tema de hoje\n`);
  for (const l of linhas) {
    console.log(
      `  ${marca(l).padEnd(6)} ${l.razao.toFixed(2).padStart(5)}:1 ` +
        `(piso ${l.par.piso})  ${hex(l.tinta)} sobre ${hex(l.fundo)}  ` +
        `${l.par.onde.padEnd(largura)}`,
    );
  }

  const reprovados = linhas.filter(
    (l) => l.par.isencao === undefined && l.par.divida === undefined && l.razao < l.par.piso,
  );
  const dividas = linhas.filter((l) => l.par.divida !== undefined);
  console.log(
    `\n  ${linhas.length} combinações · ${dividas.length} dívidas registradas · ` +
      `${linhas.filter((l) => l.par.isencao !== undefined).length} isenções · ` +
      `${reprovados.length} reprovações novas\n`,
  );

  assert.deepEqual(
    reprovados.map((l) => `${l.razao.toFixed(2)}:1 — ${l.par.onde}`),
    [],
    "par abaixo do piso sem isenção nem dívida registrada",
  );
});
