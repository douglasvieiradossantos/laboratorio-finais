import assert from "node:assert/strict";
import test from "node:test";
import { REPLY_DELAY_MS } from "./lesson/timing.ts";
import { CATALOG } from "./sound-catalog.ts";
// `lib/sound.ts` importa limpo no Node: no topo do módulo não há acesso a
// `window` nem a WebAudio — tudo isso mora dentro de função. É o que permite ao
// gate conferir as variantes de síntese sem navegador.
import { VARIANTS } from "./sound.ts";

/**
 * O gate do catálogo de sons. Confere que o dado e o código não divergem: toda
 * variante declarada tem corpo, todo corpo tem declaração, e o `chosenVariant`
 * aponta para algo que existe.
 *
 * **Por que isto morde.** O catálogo é dado e a síntese é código, em arquivos
 * separados de propósito. Sem gate, apagar uma variante do código e esquecer a
 * entrada do catálogo dá uma opção na `/sons` que não toca nada — e o contrário
 * dá um som que a página não sabe nomear. Foi essa a disciplina que a camada de
 * amostras tinha para os arquivos, e ela sobreviveu à remoção dela.
 */

test("os seis efeitos existem, uma vez cada", () => {
  const nomes = CATALOG.map((effect) => effect.name);
  assert.deepEqual(
    [...nomes].sort(),
    ["acerto", "captura", "conclusao", "lance", "recusa", "xeque"],
    `o catálogo tem [${nomes}]`,
  );
  assert.equal(new Set(nomes).size, nomes.length, "efeito repetido no catálogo");
});

test("toda variante do catálogo tem corpo de síntese, e vice-versa", () => {
  for (const effect of CATALOG) {
    const bodies = VARIANTS[effect.name];
    assert.ok(bodies, `${effect.name}: sem entrada nenhuma em VARIANTS`);
    const declared = effect.variants.map((v) => v.id).sort();
    const implemented = Object.keys(bodies).sort();
    assert.deepEqual(
      declared,
      implemented,
      `${effect.name}: catálogo declara [${declared}], VARIANTS implementa [${implemented}]`,
    );
  }
});

test("nenhum efeito em VARIANTS fora do catálogo", () => {
  const noCatalogo = new Set(CATALOG.map((effect) => effect.name));
  const sobrando = Object.keys(VARIANTS).filter((nome) => !noCatalogo.has(nome as never));
  assert.deepEqual(sobrando, [], `efeito em VARIANTS sem entrada no catálogo: ${sobrando}`);
});

test("o chosenVariant de cada efeito existe de verdade", () => {
  for (const effect of CATALOG) {
    assert.ok(
      VARIANTS[effect.name][effect.chosenVariant] !== undefined,
      `${effect.name}: chosenVariant "${effect.chosenVariant}" não existe em VARIANTS`,
    );
  }
});

test("toda variante tem id no padrão v<n>, título e nota", () => {
  // Não se exige que a `v1` exista: o `xeque` foi resolvido na `v2`, e os ids são
  // rótulos históricos da decisão — não índices.
  for (const effect of CATALOG) {
    const ids = effect.variants.map((v) => v.id);
    assert.ok(ids.length >= 1, `${effect.name}: sem variante nenhuma`);
    assert.equal(new Set(ids).size, ids.length, `${effect.name}: id de variante repetido`);
    for (const variant of effect.variants) {
      assert.ok(
        /^v\d+$/.test(variant.id),
        `${effect.name}: id "${variant.id}" fora do padrão v<n>`,
      );
      assert.ok(variant.title.trim().length > 3, `${effect.name}/${variant.id}: sem título`);
      assert.ok(
        variant.note.trim().length > 20,
        `${effect.name}/${variant.id}: nota curta demais para explicar a escolha`,
      );
    }
  }
});

test("cada efeito tem título e texto de quando toca", () => {
  for (const effect of CATALOG) {
    assert.ok(effect.title.trim().length > 0, `${effect.name}: sem título`);
    assert.ok(effect.when.trim().length > 20, `${effect.name}: "quando toca" muito curto`);
  }
});

test("lance, captura e xeque cabem no intervalo da resposta do defensor", () => {
  // O teto é medível, não gosto: som mais longo que o intervalo entre o lance do
  // aluno e a resposta do defensor transforma os dois lances em lama. A duração
  // real de cada síntese é medida na `/sons`, que renderiza fora do tempo real;
  // aqui o gate cobra o teto **declarado**, que é o contrato do desenho.
  for (const nome of ["lance", "captura", "xeque"] as const) {
    const effect = CATALOG.find((item) => item.name === nome);
    assert.ok(effect, `${nome} não está no catálogo`);
    assert.ok(
      effect.maxDurationMs < REPLY_DELAY_MS,
      `${nome}: teto de ${effect.maxDurationMs} ms passa dos ${REPLY_DELAY_MS} ms da resposta`,
    );
  }
});

test("a medição de referência, quando existe, está completa e é coerente", () => {
  for (const effect of CATALOG) {
    const ref = effect.reference;
    if (!ref) continue;
    assert.ok(ref.source.trim().length > 10, `${effect.name}: referência sem fonte rastreável`);
    assert.ok(ref.lesson.trim().length > 40, `${effect.name}: referência sem lição escrita`);
    assert.ok(ref.attackMs >= 0, `${effect.name}: ataque negativo`);
    assert.ok(ref.decay40Ms > 0, `${effect.name}: queda de 40 dB não positiva`);
    assert.ok(
      ref.centroidAttackHz > 0 && ref.centroidAttackHz < 22050,
      `${effect.name}: centroide de ataque em ${ref.centroidAttackHz} Hz, fora do audível`,
    );
    assert.ok(
      ref.flatness > 0 && ref.flatness <= 1,
      `${effect.name}: achatamento ${ref.flatness} fora de (0, 1]`,
    );
    assert.ok(ref.peaksHz.length >= 3, `${effect.name}: menos de três parciais medidas`);
    assert.deepEqual(
      ref.peaksHz,
      [...ref.peaksHz].sort((a, b) => a - b),
      `${effect.name}: as parciais não estão em ordem crescente de frequência`,
    );
  }
});
