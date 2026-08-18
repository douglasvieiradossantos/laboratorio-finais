import Link from "next/link";
import { PositionPlayer } from "@/components/board/PositionPlayer";

/**
 * O tabuleiro livre da F0 — prova de vida das regras, agora fora da home (que
 * virou o índice das aulas). Serve de banco de testes do tabuleiro: aqui você
 * move os dois lados e vê os fins de partida sem nenhuma aula por perto.
 */
const KP_VS_K = "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1";

export const metadata = { title: "Tabuleiro livre — Laboratório de Finais" };

export default function TabuleiroLivre() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-xs font-medium text-tinta-fraca transition hover:text-tinta-media">
          ← todas as aulas
        </Link>
        <h1 className="titulo">Tabuleiro livre</h1>
        <p className="max-w-prose text-sm leading-relaxed text-tinta-fraca">
          Rei e peão contra rei, com as regras validadas de verdade. Você move
          os dois lados; lance ilegal é recusado com o motivo escrito abaixo do
          tabuleiro.
        </p>
      </header>

      <PositionPlayer startFen={KP_VS_K} />
    </main>
  );
}
