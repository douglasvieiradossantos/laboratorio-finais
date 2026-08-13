"use client";

import { useMemo } from "react";
import { Chess } from "chess.js";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Color, Key } from "@lichess-org/chessground/types";
import { ChessBoard } from "@/components/board/ChessBoard";
import { LessonButton } from "./LessonButton";
import type { ExampleStage as ExampleStageData, Position } from "@/lib/lesson/schema";
import { useLessonStore } from "@/lib/lesson/store";

/**
 * Etapa 2 — exemplo: a linha roteirizada dos dois lados, com avançar, voltar e
 * repetir. Nada é calculado sobre xadrez aqui: os lances vêm do arquivo (e o
 * gate já provou que a linha inteira é jogável). A chess.js só aplica o que
 * está escrito, para saber desenhar cada posição.
 */
export function ExampleStage({
  stage,
  position,
  orientation,
}: {
  stage: ExampleStageData;
  position: Position;
  orientation: Color;
}) {
  const step = useLessonStore((s) => s.step);
  const setStep = useLessonStore((s) => s.setStep);

  const frames = useMemo(() => {
    const game = new Chess(position.fen);
    const built: Array<{ fen: string; lastMove: [Key, Key] | null; check: boolean }> = [
      { fen: game.fen(), lastMove: null, check: false },
    ];
    for (const item of stage.steps) {
      game.move({
        from: item.move.slice(0, 2),
        to: item.move.slice(2, 4),
        promotion: item.move.length > 4 ? item.move.slice(4) : undefined,
      });
      built.push({
        fen: game.fen(),
        lastMove: [item.move.slice(0, 2) as Key, item.move.slice(2, 4) as Key],
        check: game.isCheck(),
      });
    }
    return built;
  }, [position.fen, stage.steps]);

  const index = Math.min(step, stage.steps.length);
  const frame = frames[index];
  const current = index > 0 ? stage.steps[index - 1] : null;

  const shapes: DrawShape[] = useMemo(() => {
    if (!current) return [];
    return [
      ...(current.arrows ?? []).map(([from, to]) => ({
        orig: from as Key,
        dest: to as Key,
        brush: "blue",
      })),
      ...(current.highlights ?? []).map((square) => ({ orig: square as Key, brush: "green" })),
    ];
  }, [current]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="mx-auto w-full max-w-[min(88vw,26rem)] lg:mx-0 lg:w-[26rem] lg:shrink-0">
        <ChessBoard
          fen={frame.fen}
          orientation={orientation}
          lastMove={frame.lastMove}
          check={frame.check}
          shapes={shapes}
          viewOnly
        />
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Lance {index} de {stage.steps.length}
        </p>

        <div
          aria-live="polite"
          className="min-h-20 rounded-lg border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-relaxed text-slate-200"
        >
          <span key={index}>
            {current
              ? current.text
              : "A posição de partida. Avance para ver a técnica lance a lance."}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <LessonButton onClick={() => setStep(index - 1)} disabled={index === 0}>
            Voltar
          </LessonButton>
          <LessonButton
            onClick={() => setStep(index + 1)}
            disabled={index === stage.steps.length}
            variant="primary"
          >
            Avançar
          </LessonButton>
          <LessonButton onClick={() => setStep(0)} disabled={index === 0}>
            Repetir do início
          </LessonButton>
        </div>
      </div>
    </div>
  );
}
