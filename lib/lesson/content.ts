import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { lessonSchema, positionSchema, type Lesson, type Position } from "./schema";

/**
 * Carga do conteúdo, **só no servidor** (é quem tem `node:fs`). As páginas são
 * estáticas: isto roda na build, e o que chega ao navegador é o JSON já
 * validado — nenhum arquivo de `content/` vira requisição do aluno.
 *
 * A validação aqui é a mesma do gate (`scripts/validate-content.ts`): o mesmo
 * schema zod. O gate confere a verdade xadrezística; este confere só a forma,
 * para o motor nunca receber um arquivo torto sem dizer por quê.
 */

const CONTENT_DIR = path.join(process.cwd(), "content");
const LESSONS_DIR = path.join(CONTENT_DIR, "lessons");
const POSITIONS_DIR = path.join(CONTENT_DIR, "positions");

/** A aula com as posições que ela referencia, prontas para o motor. */
export type LessonBundle = {
  lesson: Lesson;
  positions: Record<string, Position>;
};

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

function walkJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkJson(full));
    else if (entry.name.endsWith(".json")) found.push(full);
  }
  return found.sort();
}

function loadPositions(): Record<string, Position> {
  const byId: Record<string, Position> = {};
  for (const file of walkJson(POSITIONS_DIR)) {
    const position = positionSchema.parse(readJson(file));
    byId[position.id] = position;
  }
  return byId;
}

/** Os ids de aula que existem em `content/lessons/`, em ordem alfabética. */
export function lessonIds(): string[] {
  return walkJson(LESSONS_DIR).map((file) => path.basename(file, ".json"));
}

/** A aula e suas posições, ou `null` se o id não existe. */
export function loadLesson(id: string): LessonBundle | null {
  const file = path.join(LESSONS_DIR, `${id}.json`);
  // O id vem da rota: barrar caminho para fora da pasta é obrigação, não zelo.
  if (!file.startsWith(LESSONS_DIR + path.sep) || !existsSync(file)) return null;

  const lesson = lessonSchema.parse(readJson(file));
  const all = loadPositions();

  const positions: Record<string, Position> = {};
  for (const id of referencedPositionIds(lesson)) {
    const position = all[id];
    if (!position) {
      throw new Error(`aula ${lesson.id} referencia a posição inexistente "${id}"`);
    }
    positions[id] = position;
  }
  return { lesson, positions };
}

/** Só o cabeçalho de cada aula — o que o índice da home precisa. */
export function lessonIndex(): Array<Pick<Lesson, "id" | "title"> & { stages: number }> {
  return lessonIds().map((id) => {
    const lesson = lessonSchema.parse(readJson(path.join(LESSONS_DIR, `${id}.json`)));
    return {
      id: lesson.id,
      title: lesson.title,
      stages: Object.keys(lesson.stages).length,
    };
  });
}

function referencedPositionIds(lesson: Lesson): string[] {
  const s = lesson.stages;
  return [
    s.objective?.positionId,
    s.example?.positionId,
    s.guided?.positionId,
    s.solo?.positionId,
    s.practice?.positionId,
    ...(s.review?.reviewPositionIds ?? []),
  ].filter((id): id is string => typeof id === "string");
}
