"use client";

import { useState } from "react";
import type { Color } from "@lichess-org/chessground/types";
import type { Position, PracticeStage as PracticeStageData, ReviewStage as ReviewStageData } from "@/lib/lesson/schema";
import { reviewKey, useLessonStore } from "@/lib/lesson/store";
import { PracticeStage } from "./PracticeStage";

/**
 * Etapa 6 — revisão v0 (plano da F1, §0.2).
 *
 * Posições **distintas das de ensino**, jogadas de novo para provar que a
 * técnica não evaporou. Cada uma é a mesma partida da etapa 5 contra o mesmo
 * motor — por isso esta etapa é uma lista e um `PracticeStage`, e não um
 * componente jogável novo.
 *
 * A revisão **não afere domínio**: o critério D1 é a etapa 4 mais a etapa 5, e
 * vencer uma posição de revisão não substitui nenhuma das duas. Por isso o
 * `seal` não é passado adiante.
 *
 * A fila espaçada com datas e intervalos crescentes é a F3. O que a F1 entrega
 * é o formato que a F3 vai precisar, para nenhuma aula ser refeita depois.
 */
export function ReviewStage({
  stage,
  practice,
  positions,
  orientation,
}: {
  stage: ReviewStageData;
  /**
   * A configuração do motor vem da etapa 5. O schema da revisão só traz ids de
   * posição, e herdar aqui evita um campo novo no formato para dizer duas vezes
   * a mesma coisa — a revisão é a prática, noutra posição.
   */
  practice: PracticeStageData | undefined;
  positions: Record<string, Position>;
  orientation: Color;
}) {
  const ids = stage.reviewPositionIds;
  const [selecionada, setSelecionada] = useState(ids[0]);
  const practices = useLessonStore((s) => s.practices);

  const vencidas = ids.filter((id) => practices[reviewKey(id)]?.status === "passed").length;

  if (!practice) {
    return (
      <p className="rounded-lg border border-white/10 bg-slate-900 px-4 py-6 text-sm leading-relaxed text-slate-400">
        Esta aula não tem prática real configurada, então a revisão não sabe contra que
        computador jogar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-slate-300">
          Posições novas, para provar que a técnica ficou. Mesmo computador da prática
          real — o que muda é que você nunca viu estas posições.
        </p>

        {ids.length > 1 && (
          <>
            <nav aria-label="Posições de revisão" className="flex flex-wrap gap-2">
              {ids.map((id, i) => {
                const estado = practices[reviewKey(id)]?.status ?? "playing";
                const ativa = id === selecionada;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelecionada(id)}
                    aria-current={ativa ? "true" : undefined}
                    className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                      ativa
                        ? "bg-emerald-600 text-white ring-emerald-400/30"
                        : "bg-slate-900 text-slate-300 ring-white/10 hover:bg-slate-800"
                    }`}
                  >
                    Posição {i + 1}
                    {estado === "passed" && <span aria-label=", vencida"> ✓</span>}
                    {estado === "failed" && <span aria-label=", não venceu"> ✗</span>}
                  </button>
                );
              })}
            </nav>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {vencidas} de {ids.length} revisada(s)
            </p>
          </>
        )}
      </div>

      {/*
        Sem `key` no PracticeStage, de propósito: remontá-lo desmontaria o
        FeedbackPanel, que é a única regra inviolável do painel (ele nunca pode
        sair do DOM, ou o `aria-live` deixa de anunciar). Trocar de posição é
        seguro porque a partida é derivada de (fen inicial, lances) lidos da
        store pela chave — não sobra estado local para vazar entre posições.
      */}
      <PracticeStage
        practiceKey={reviewKey(selecionada)}
        position={positions[selecionada]}
        orientation={orientation}
        goal={practice.goal}
        engine={practice.engine}
      />
    </div>
  );
}
