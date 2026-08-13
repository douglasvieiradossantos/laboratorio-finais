"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { LessonBundle } from "@/lib/lesson/content";
import { STAGE_LABEL, STAGE_ORDER, useLessonStore, type StageKey } from "@/lib/lesson/store";
import { ExampleStage } from "./ExampleStage";
import { ObjectiveStage } from "./ObjectiveStage";
import { TreeStage } from "./TreeStage";

/** Etapas que a F1 ainda não entregou na tela — chegam no bloco B4. */
const COMING_IN_B4: Record<"practice" | "review", string> = {
  practice: "A partida contra o computador entra no próximo bloco (Stockfish em Web Worker).",
  review: "A revisão das posições novas entra junto com a prática real, no próximo bloco.",
};

/**
 * Orquestra a aula: qual etapa está aberta, o avanço entre elas e a montagem
 * do componente de cada uma. Toda a leitura de xadrez vem do arquivo da aula —
 * este componente não sabe as regras do jogo, só a ordem das etapas.
 */
export function LessonPlayer({ bundle }: { bundle: LessonBundle }) {
  const { lesson, positions } = bundle;
  const stage = useLessonStore((s) => s.stage);
  const lessonId = useLessonStore((s) => s.lessonId);
  const open = useLessonStore((s) => s.open);
  const goToStage = useLessonStore((s) => s.goToStage);

  const available = STAGE_ORDER.filter((key) => lesson.stages[key] !== undefined);

  useEffect(() => {
    open(lesson.id, available[0] ?? "objective", {
      guided: lesson.stages.guided?.root,
      solo: lesson.stages.solo?.root,
    });
    // Reabrir a aula é o que zera o estado; o resto vem da store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // Enquanto o efeito acima não rodou, a store ainda fala da aula anterior.
  if (lessonId !== lesson.id) return null;

  const nextStage = (from: StageKey): StageKey | null =>
    available[available.indexOf(from) + 1] ?? null;

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-xs font-medium text-slate-500 transition hover:text-slate-300"
        >
          ← todas as aulas
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{lesson.title}</h1>
      </header>

      <nav aria-label="Etapas da aula" className="flex flex-wrap gap-2">
        {available.map((key, index) => {
          const active = key === stage;
          return (
            <button
              key={key}
              type="button"
              onClick={() => goToStage(key)}
              aria-current={active ? "step" : undefined}
              className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                active
                  ? "bg-emerald-600 text-white ring-emerald-400/30"
                  : "bg-slate-900 text-slate-300 ring-white/10 hover:bg-slate-800"
              }`}
            >
              <span className="tabular-nums text-slate-400">{index + 1}.</span>{" "}
              {STAGE_LABEL[key]}
            </button>
          );
        })}
      </nav>

      <section>
        {stage === "objective" && lesson.stages.objective && (
          <div className="flex flex-col gap-6">
            <ObjectiveStage
              stage={lesson.stages.objective}
              position={positions[lesson.stages.objective.positionId]}
              orientation={lesson.orientation}
            />
            <StageFooter
              next={nextStage("objective")}
              onGo={goToStage}
              label="Ver a técnica lance a lance"
            />
          </div>
        )}

        {stage === "example" && lesson.stages.example && (
          <div className="flex flex-col gap-6">
            <ExampleStage
              stage={lesson.stages.example}
              position={positions[lesson.stages.example.positionId]}
              orientation={lesson.orientation}
            />
            <StageFooter next={nextStage("example")} onGo={goToStage} label="Agora é a sua vez" />
          </div>
        )}

        {stage === "guided" && lesson.stages.guided && (
          <TreeStage
            lesson={lesson}
            tree={lesson.stages.guided}
            treeKey="guided"
            position={positions[lesson.stages.guided.positionId]}
            orientation={lesson.orientation}
            allowHelp
            intro={lesson.stages.guided.intro}
            onFinish={() => {
              const next = nextStage("guided");
              if (next) goToStage(next);
            }}
            finishLabel="Ir para a etapa sem ajuda"
          />
        )}

        {stage === "solo" && lesson.stages.solo && (
          <TreeStage
            lesson={lesson}
            tree={lesson.stages.solo}
            treeKey="solo"
            position={positions[lesson.stages.solo.positionId]}
            orientation={lesson.orientation}
            allowHelp={false}
            moveLimit={lesson.stages.solo.moveLimit}
            intro="Posição nova, sem dica e sem destaque. É aqui que o domínio é aferido."
            onFinish={() => {
              const next = nextStage("solo");
              if (next) goToStage(next);
            }}
            finishLabel="Continuar"
          />
        )}

        {(stage === "practice" || stage === "review") && (
          <p className="rounded-lg border border-white/10 bg-slate-900 px-4 py-6 text-sm leading-relaxed text-slate-400">
            {COMING_IN_B4[stage]}
          </p>
        )}
      </section>
    </div>
  );
}

function StageFooter({
  next,
  onGo,
  label,
}: {
  next: StageKey | null;
  onGo: (stage: StageKey) => void;
  label: string;
}) {
  if (!next) return null;
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => onGo(next)}
        className="min-h-11 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white ring-1 ring-emerald-400/30 transition hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        {label} →
      </button>
    </div>
  );
}
