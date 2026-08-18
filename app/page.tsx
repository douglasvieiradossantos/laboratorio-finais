import Link from "next/link";
import { lessonIndex } from "@/lib/lesson/content";

/**
 * Índice das 3 competências de N0 (§0.3 do plano da F1: navegação mínima; a
 * trilha com desbloqueio pelo grafo é da F2). Os ids são os oficiais do
 * currículo — as aulas que ainda não têm arquivo em `content/lessons/`
 * aparecem aqui como pendentes, em vez de sumirem da lista.
 */
const N0 = [
  { id: "N0-Q-MATE", title: "Mate de dama e rei" },
  { id: "N0-R-MATE", title: "Mate de torre e rei" },
  { id: "N0-LADDER", title: "Mate da escadinha" },
];

export default function Home() {
  const published = new Map(lessonIndex().map((item) => [item.id, item]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-metodo">
          Nível 0 — os mates elementares
        </p>
        <h1 className="titulo">Laboratório de Finais</h1>
        <p className="max-w-prose text-sm leading-relaxed text-tinta-fraca">
          Cada competência é uma aula em etapas: ver o objetivo, acompanhar a
          técnica, executar com ajuda e executar sozinho. Você aprende no
          tabuleiro, não no vídeo.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {N0.map((item) => {
          const lesson = published.get(item.id);
          if (!lesson) {
            return (
              <li
                key={item.id}
                className="rounded-lg border border-borda-fraca bg-carta/40 px-4 py-4 text-tinta-fraca"
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs">
                  <span className="font-mono">{item.id}</span> — ainda sem posições garimpadas.
                </p>
              </li>
            );
          }
          return (
            <li key={item.id}>
              <Link
                href={`/aula/${item.id}`}
                className="flex min-h-16 flex-col justify-center rounded-lg border border-borda bg-carta px-4 py-4 transition hover:border-metodo-superficie/40 hover:bg-carta-alta foco"
              >
                <p className="text-sm font-semibold text-tinta">{lesson.title}</p>
                <p className="mt-1 text-xs text-tinta-fraca">
                  <span className="font-mono">{lesson.id}</span> — {lesson.stages} etapas
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <footer className="mt-auto border-t border-borda-fraca pt-4 text-xs text-tinta-fraca">
        As posições desta fase ainda são fixtures técnicas, marcadas como tal e
        proibidas de publicar — o garimpo com proveniência entra no próximo
        bloco.{" "}
        <Link href="/tabuleiro" className="underline transition hover:text-tinta-media">
          Tabuleiro livre
        </Link>
        .
      </footer>
    </main>
  );
}
