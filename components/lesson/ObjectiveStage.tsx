"use client";

import type { Color } from "@lichess-org/chessground/types";
import { ChessBoard } from "@/components/board/ChessBoard";
import type { ObjectiveStage as ObjectiveStageData, Position } from "@/lib/lesson/schema";

/**
 * Etapa 1 — objetivo: diagrama parado, o que se vai aprender, e o critério de
 * domínio por extenso (§6 do plano: o aluno precisa saber de antemão o que
 * conta como "dominado").
 */
export function ObjectiveStage({
  stage,
  position,
  orientation,
}: {
  stage: ObjectiveStageData;
  position: Position;
  orientation: Color;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="mx-auto w-full max-w-[min(88vw,26rem)] lg:mx-0 lg:w-[26rem] lg:shrink-0">
        <ChessBoard fen={position.fen} orientation={orientation} viewOnly />
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-tinta-media">{stage.text}</p>
        <div className="rounded-lg border border-metodo-superficie/30 bg-metodo-superficie/5 px-4 py-3">
          <h3 className="rotulo text-metodo">
            O que conta como dominado
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-tinta-media">{stage.mastery}</p>
        </div>
      </div>
    </div>
  );
}
