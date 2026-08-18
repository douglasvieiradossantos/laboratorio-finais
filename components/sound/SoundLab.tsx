"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { LessonButton } from "@/components/lesson/LessonButton";
import { REPLY_DELAY_MS } from "@/lib/lesson/timing";
import {
  CATALOG,
  type EffectName,
  type Reference,
  type Variant,
} from "@/lib/sound-catalog";
import {
  chosenVariantFor,
  isSoundOn,
  measureBuffer,
  overrideVariant,
  playEffect,
  playVariant,
  renderSynthesis,
  setSoundOn,
  subscribeSound,
  unlockAudio,
  type BufferMeasure,
} from "@/lib/sound";

/**
 * O banco de testes dos sons.
 *
 * **Por que ele existe.** Quem escreve este código não ouve o resultado. Cada
 * síntese é renderizada num `OfflineAudioContext` e medida — ataque, queda de
 * 40 dB, pico, RMS, centro espectral no ataque e na cauda, achatamento, parciais
 * — ao lado do alvo medido na referência. É o que permite dizer "o xeque ficou
 * mais brilhante" com um número em vez de opinião de quem não escutou, e o que um
 * subagente com Playwright lê como texto.
 *
 * O veredito final continua sendo humano, no alto-falante de um celular. A página
 * existe para essa passada ser de vinte segundos, e não de uma aula inteira
 * jogada até o mate por rodada.
 *
 * **Nada aqui persiste.** Trocar a variante vale para a sessão; a escolha de
 * verdade é uma linha de `chosenVariant` em `lib/sound-catalog.ts`.
 */

/** A sequência da aula, com o mesmo compasso das etapas jogáveis. */
const SEQUENCIA: EffectName[] = ["lance", "lance", "captura", "xeque", "conclusao"];

const TOTAL_VARIANTES = CATALOG.reduce((total, effect) => total + effect.variants.length, 0);

const db = (valor: number) => (Number.isFinite(valor) ? valor.toFixed(2) : "−∞");
const ms = (valor: number | null) => (valor === null ? "não cai" : `${valor.toFixed(0)} ms`);

export function SoundLab() {
  const somLigado = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  const [contexto, setContexto] = useState<"desconhecido" | "rodando" | "travado">("desconhecido");
  const [medidas, setMedidas] = useState<Record<string, BufferMeasure | null>>({});
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [tocando, setTocando] = useState(false);

  /**
   * Renderiza todas as sínteses fora do tempo real e mede. **Não precisa de
   * gesto**: o `OfflineAudioContext` não toca nada, só calcula amostras — então
   * este botão funciona mesmo com o áudio travado pelo navegador.
   */
  const medirTudo = useCallback(async () => {
    for (const effect of CATALOG) {
      for (const variante of effect.variants) {
        const buffer = await renderSynthesis(effect.name, variante.id, 1);
        setMedidas((atual) => ({
          ...atual,
          [`${effect.name}/${variante.id}`]: buffer ? measureBuffer(buffer) : null,
        }));
      }
    }
  }, []);

  const ouvir = useCallback(async (effect: EffectName, id: string) => {
    const saiu = await playVariant(effect, id);
    setContexto(saiu ? "rodando" : "travado");
  }, []);

  const escolher = useCallback((effect: EffectName, id: string) => {
    overrideVariant(effect, id);
    setEscolhas((atual) => ({ ...atual, [effect]: id }));
  }, []);

  const tocarSequencia = useCallback(async () => {
    if (!(await unlockAudio())) {
      setContexto("travado");
      return;
    }
    setContexto("rodando");
    setTocando(true);
    for (const [indice, nome] of SEQUENCIA.entries()) {
      playEffect(nome);
      if (indice < SEQUENCIA.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, REPLY_DELAY_MS));
      }
    }
    setTocando(false);
  }, []);

  const medidos = Object.keys(medidas).length;

  return (
    <div className="flex flex-col gap-8">
      {/* ---------------- a barra de controles ---------------- */}
      <section className="flex flex-col gap-3 rounded-lg border border-borda bg-carta px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <LessonButton variant="primary" onClick={() => void medirTudo()}>
            Medir as {TOTAL_VARIANTES} sínteses
          </LessonButton>
          <LessonButton onClick={() => void tocarSequencia()} disabled={tocando}>
            {tocando ? "Tocando a sequência…" : "Tocar a sequência da aula"}
          </LessonButton>
          <button
            type="button"
            aria-pressed={somLigado}
            onClick={() => setSoundOn(!somLigado)}
            className="min-h-11 rounded-md bg-carta-alta px-4 py-2 text-sm font-medium text-tinta ring-1 ring-borda transition hover:bg-carta-toque foco"
          >
            Som: {somLigado ? "ligado 🔊" : "desligado 🔇"}
          </button>
        </div>

        <p aria-live="polite" className="text-xs leading-relaxed text-tinta-fraca">
          <span data-teste="estado-contexto">
            {contexto === "rodando"
              ? "Contexto de áudio: rodando."
              : contexto === "travado"
                ? "Contexto de áudio: TRAVADO — o navegador recusou. Clique em qualquer botão de novo."
                : "Contexto de áudio: ainda não destravado (nenhum gesto)."}
          </span>{" "}
          <span data-teste="contagem-medidas">
            {medidos} de {TOTAL_VARIANTES} medidos.
          </span>{" "}
          Medir não precisa de gesto; ouvir precisa.{" "}
          {!somLigado &&
            "Com o som desligado, “Ouvir” ainda soa — a página é do operador, não do aluno."}
        </p>
      </section>

      {/* ---------------- um bloco por efeito ---------------- */}
      {CATALOG.map((effect) => {
        const ativa = escolhas[effect.name] ?? chosenVariantFor(effect.name);
        return (
          <section
            key={effect.name}
            data-efeito={effect.name}
            className="flex flex-col gap-3 rounded-lg border border-borda bg-carta px-4 py-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{effect.title}</h2>
              <p className="rotulo text-tinta-fraca">
                teto {effect.maxDurationMs} ms ·{" "}
                <span data-teste={`escolhido-${effect.name}`}>toca hoje: {ativa}</span>
                {effect.variants.length > 1 && ` · ${effect.variants.length} variantes`}
              </p>
            </div>

            <p className="max-w-prose text-sm leading-relaxed text-tinta-fraca">{effect.when}</p>

            {effect.reference && (
              <p className="max-w-prose rounded-md border border-borda-fraca bg-papel/40 px-3 py-2 text-xs leading-relaxed text-tinta-fraca">
                <strong className="font-semibold text-tinta-fraca">
                  Alvo, medido em {effect.reference.source}:
                </strong>{" "}
                {effect.reference.lesson}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {effect.variants.map((variante) => (
                <SinteseMedida
                  key={variante.id}
                  nome={effect.name}
                  variante={variante}
                  medida={medidas[`${effect.name}/${variante.id}`] ?? null}
                  referencia={effect.reference}
                  ativa={ativa === variante.id}
                  // O botão de escolher só aparece se houver o que escolher. Hoje
                  // cada efeito tem uma variante só, e um botão permanentemente
                  // desabilitado seria ruído.
                  podeEscolher={effect.variants.length > 1}
                  onOuvir={() => void ouvir(effect.name, variante.id)}
                  onEscolher={() => escolher(effect.name, variante.id)}
                />
              ))}
            </div>

            <div>
              <LessonButton onClick={() => playEffect(effect.name)}>
                Tocar pelo caminho da aula
              </LessonButton>
            </div>
          </section>
        );
      })}

      <p className="max-w-prose text-xs leading-relaxed text-tinta-fraca">
        <strong className="font-semibold text-tinta-fraca">Confie no RMS, não no pico.</strong> As
        camadas de ruído usam <code className="text-tinta-fraca">Math.random()</code>, então cada
        renderização é uma realização diferente: medindo o mesmo som cinco vezes, o pico variou
        1,5 dB e o RMS 0,65 dB. O equilíbrio entre os efeitos foi ajustado pelo RMS.
      </p>
    </div>
  );
}

/**
 * Uma variante, renderizada e medida contra o alvo da referência.
 *
 * Isto é o que torna "ficou mais brilhante" uma afirmação conferível em vez de
 * opinião de quem não escutou. A referência é uma **medição** de um som
 * proprietário — sete números e uma lição —, nunca o som em si.
 */
function SinteseMedida({
  nome,
  variante,
  medida,
  referencia,
  ativa,
  podeEscolher,
  onOuvir,
  onEscolher,
}: {
  nome: EffectName;
  variante: Variant;
  medida: BufferMeasure | null;
  referencia?: Reference;
  ativa: boolean;
  podeEscolher: boolean;
  onOuvir: () => void;
  onEscolher: () => void;
}) {
  const linha = (rotulo: string, sintetizado: string, alvo?: string) => (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      <span className="w-40 shrink-0 text-tinta-fraca">{rotulo}</span>
      <span className="tabular-nums text-tinta-media">{sintetizado}</span>
      {alvo && <span className="tabular-nums text-tinta-fraca">alvo {alvo}</span>}
    </div>
  );

  return (
    <div
      data-teste={`sintese-${nome}-${variante.id}`}
      data-ativa={ativa ? "sim" : undefined}
      className={`rounded-md border px-3 py-3 text-xs leading-relaxed ${
        ativa ? "border-metodo/40 bg-metodo-superficie/5" : "border-borda-fraca bg-papel/40"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-semibold uppercase tracking-[0.14em] text-tinta-fraca">
          {variante.id} · {variante.title}
        </span>
        {ativa && (
          <span className="rounded bg-metodo/20 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-metodo-selo">
            toca hoje
          </span>
        )}
        <LessonButton onClick={onOuvir}>Ouvir</LessonButton>
        {podeEscolher && (
          <LessonButton onClick={onEscolher} disabled={ativa}>
            Usar esta
          </LessonButton>
        )}
      </div>

      <p className="mb-2 max-w-prose text-tinta-fraca">{variante.note}</p>

      {medida ? (
        <div className="flex flex-col gap-0.5">
          {linha("ataque", ms(medida.attackMs), referencia && `${referencia.attackMs} ms`)}
          {linha("−40 dB em", ms(medida.decay40Ms), referencia && `${referencia.decay40Ms} ms`)}
          {linha("pico / RMS", `${db(medida.peakDbfs)} / ${db(medida.rmsDbfs)} dBFS`)}
          {linha(
            "centroide ataque",
            `${medida.attack.centroidHz} Hz`,
            referencia && `${referencia.centroidAttackHz} Hz`,
          )}
          {linha(
            "centroide cauda",
            medida.tail.centroidHz === 0 ? "som já acabou" : `${medida.tail.centroidHz} Hz`,
            referencia && `${referencia.centroidTailHz} Hz`,
          )}
          {linha(
            "achatamento",
            String(medida.attack.flatness),
            referencia && String(referencia.flatness),
          )}
          {linha(
            "parciais",
            medida.attack.peaksHz.join(" · ") || "—",
            referencia && referencia.peaksHz.join(" · "),
          )}
        </div>
      ) : (
        <p className="text-tinta-fraca">
          Clique em “Medir as sínteses”. Não precisa de gesto de áudio: a
          renderização é fora do tempo real.
        </p>
      )}
    </div>
  );
}
