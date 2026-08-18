"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Color, Key } from "@lichess-org/chessground/types";
import { ChessBoard } from "@/components/board/ChessBoard";
import { teachingShapes } from "@/lib/chess/annotations";
import { toBoardColor } from "@/lib/chess/dests";
import { playComplete, playForMove } from "@/lib/sound";
import { LessonButton } from "./LessonButton";
import type { ExampleStage as ExampleStageData, Position } from "@/lib/lesson/schema";
import { useLessonStore } from "@/lib/lesson/store";

/**
 * Etapa 2 — exemplo: a linha roteirizada dos dois lados, que **começa sozinha**
 * quando o aluno entra na etapa. Foi o pedido do primeiro teste: assistir a
 * técnica, não clicar 27 vezes para vê-la.
 *
 * Nada é calculado sobre xadrez aqui: os lances vêm do arquivo (e o gate já
 * provou que a linha inteira é jogável). A chess.js só aplica o que está
 * escrito, para saber desenhar cada posição, e os destaques automáticos são
 * geometria da posição, não avaliação de lance (ver `lib/chess/annotations`).
 */

/** As três velocidades, em milissegundos por lance. */
const SPEEDS = [
  { key: "slow", label: "Lento", ms: 4000 },
  { key: "normal", label: "Normal", ms: 2500 },
  { key: "fast", label: "Rápido", ms: 1500 },
] as const;

type SpeedKey = (typeof SPEEDS)[number]["key"];

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

  /**
   * O autoplay é efêmero: vive aqui, não na store. Sair da etapa e voltar
   * recomeça a reprodução; o passo em si continua sendo estado da aula.
   */
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<SpeedKey>("normal");
  const speedMs = SPEEDS.find((s) => s.key === speed)?.ms ?? 2500;

  const frames = useMemo(() => {
    const game = new Chess(position.fen);
    const built: Array<{
      fen: string;
      lastMove: [Key, Key] | null;
      check: boolean;
      capture: boolean;
      mate: boolean;
      /** Lado matado, para o pulso do rei. `null` fora do mate. */
      matedColor: Color | null;
    }> = [
      {
        fen: game.fen(),
        lastMove: null,
        check: false,
        capture: false,
        mate: false,
        matedColor: null,
      },
    ];
    for (const item of stage.steps) {
      const played = game.move({
        from: item.move.slice(0, 2),
        to: item.move.slice(2, 4),
        promotion: item.move.length > 4 ? item.move.slice(4) : undefined,
      });
      const mate = game.isCheckmate();
      built.push({
        fen: game.fen(),
        lastMove: [item.move.slice(0, 2) as Key, item.move.slice(2, 4) as Key],
        check: game.isCheck(),
        capture: Boolean(played.captured),
        mate,
        // Quem está para jogar num mate é o lado matado.
        matedColor: mate ? toBoardColor(game.turn()) : null,
      });
    }
    return built;
  }, [position.fen, stage.steps]);

  const total = stage.steps.length;
  const index = Math.min(step, total);
  const frame = frames[index];
  const current = index > 0 ? stage.steps[index - 1] : null;
  const finished = index === total;

  /** Chegar ao último lance pára a reprodução sem precisar mexer no estado. */
  const running = playing && !finished;

  // O som acompanha o lance que apareceu na tela — venha ele do relógio do
  // autoplay ou do botão. A ref evita tocar de novo quando o componente
  // re-renderiza sem mudar de passo (trocar a velocidade, por exemplo).
  const sounded = useRef<number | null>(null);
  useEffect(() => {
    if (sounded.current === index) return;
    sounded.current = index;
    const shown = frames[index];
    if (!shown.lastMove) return;
    if (shown.mate) playComplete();
    else playForMove({ capture: shown.capture, check: shown.check });
  }, [index, frames]);

  // O relógio do autoplay. Um `setTimeout` por lance, refeito a cada passo:
  // trocar a velocidade no meio vale já no lance seguinte, sem gambiarra.
  useEffect(() => {
    if (!running) return;
    const handle = setTimeout(() => setStep(index + 1), speedMs);
    return () => clearTimeout(handle);
  }, [running, index, speedMs, setStep]);

  /** Avançar e voltar na mão pausam: quem assumiu o controle não quer briga. */
  const goTo = (next: number) => {
    setPlaying(false);
    setStep(next);
  };

  const shapes: DrawShape[] = useMemo(() => {
    const authored: DrawShape[] = current
      ? [
          ...(current.arrows ?? []).map(([from, to]) => ({
            orig: from as Key,
            dest: to as Key,
            brush: "blue",
          })),
          ...(current.highlights ?? []).map((square) => ({ orig: square as Key, brush: "green" })),
        ]
      : [];
    // A geometria vai por baixo; o que a autoria escreveu fica por cima.
    return [...teachingShapes(frame.fen, frame.lastMove), ...authored];
  }, [current, frame]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="mx-auto w-full max-w-[min(88vw,26rem)] lg:mx-0 lg:w-[26rem] lg:shrink-0">
        <ChessBoard
          fen={frame.fen}
          orientation={orientation}
          lastMove={frame.lastMove}
          check={frame.check}
          shapes={shapes}
          // A etapa 2 recebe o pulso também: é onde o aluno vê a técnica pela
          // primeira vez, e ela termina em mate na tela.
          matedKing={frame.matedColor}
          viewOnly
        />
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <p className="rotulo text-tinta-fraca">
          Lance {index} de {total}
        </p>

        <div
          aria-live="polite"
          className="min-h-20 rounded-lg border border-borda bg-carta px-4 py-3 text-sm leading-relaxed text-tinta-media"
        >
          <span key={index}>
            {current
              ? current.text
              : "A posição de partida. A técnica começa a rodar sozinha — pause quando quiser."}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <LessonButton
            variant="primary"
            onClick={() => {
              // Assistir com a linha no fim recomeça: não há o que assistir ali.
              if (finished) {
                setStep(0);
                setPlaying(true);
                return;
              }
              setPlaying((p) => !p);
            }}
          >
            {running ? "Pausar" : finished ? "Assistir de novo" : "Assistir"}
          </LessonButton>
          <LessonButton onClick={() => goTo(index - 1)} disabled={index === 0}>
            Voltar
          </LessonButton>
          <LessonButton onClick={() => goTo(index + 1)} disabled={finished}>
            Avançar
          </LessonButton>
          <LessonButton
            onClick={() => {
              setStep(0);
              setPlaying(false);
            }}
            disabled={index === 0}
          >
            Repetir do início
          </LessonButton>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            id="rotulo-velocidade"
            className="rotulo text-tinta-fraca"
          >
            Velocidade
          </span>
          <div role="group" aria-labelledby="rotulo-velocidade" className="flex gap-1">
            {SPEEDS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={speed === option.key}
                onClick={() => setSpeed(option.key)}
                className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium ring-1 transition foco ${
                  speed === option.key
                    ? // `tinta` e não `tinta-inversa`: a aba ativa aqui é uma
                      // superfície neutra, não uma cor cheia. Tinta invertida
                      // sobre superfície neutra só funciona por acaso no tema
                      // escuro, e some no claro.
                      "bg-carta-toque text-tinta ring-borda-forte"
                    : "bg-carta text-tinta-fraca ring-borda hover:bg-carta-alta"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
