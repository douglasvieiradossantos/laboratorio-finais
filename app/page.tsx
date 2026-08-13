import { PositionPlayer } from "@/components/board/PositionPlayer";

/**
 * F0 não tem conteúdo de curso: esta é a posição de prova de vida — rei e peão
 * contra rei, brancas na vez, com as pretas segurando a oposição.
 */
const KP_VS_K = "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Fase 0 — fundação
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Laboratório de Finais
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-slate-400">
          Prova de vida do tabuleiro: rei e peão contra rei, com as regras
          validadas de verdade. Ainda não há aula, trilha nem progresso — só a
          peça de software que todas as aulas vão usar.
        </p>
      </header>

      <PositionPlayer startFen={KP_VS_K} />

      <footer className="mt-auto border-t border-white/5 pt-4 text-xs text-slate-500">
        Você move os dois lados. Lances ilegais são recusados; mate, afogamento
        e material insuficiente aparecem no estado abaixo do tabuleiro.
      </footer>
    </main>
  );
}
