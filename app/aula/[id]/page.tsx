import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { lessonIds, loadLesson } from "@/lib/lesson/content";

/**
 * A rota da aula. Roda no servidor: lê o arquivo de `content/`, valida com o
 * schema e entrega ao motor já pronto. Como as aulas são conhecidas na build,
 * a página é estática — o aluno não espera leitura de disco nenhuma.
 */

export function generateStaticParams() {
  return lessonIds().map((id) => ({ id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/aula/[id]">): Promise<Metadata> {
  const { id } = await params;
  const bundle = loadLesson(id);
  return { title: bundle ? `${bundle.lesson.title} — Laboratório de Finais` : "Aula não encontrada" };
}

export default async function LessonPage({ params }: PageProps<"/aula/[id]">) {
  const { id } = await params;
  const bundle = loadLesson(id);
  if (!bundle) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
      <LessonPlayer bundle={bundle} />
    </main>
  );
}
