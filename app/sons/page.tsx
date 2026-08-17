import Link from "next/link";
import { SoundLab } from "@/components/sound/SoundLab";

/**
 * A página de audição dos sons. Não é para o aluno: é o banco de testes que
 * torna a escolha dos efeitos uma passada de vinte segundos em vez de uma aula
 * inteira jogada até o mate para ouvir um som.
 *
 * Fora do índice dos buscadores e sem link da home, pelo mesmo motivo que a
 * `/tabuleiro` existe: é ferramenta de quem constrói.
 */
export const metadata = {
  title: "Sons — Laboratório de Finais",
  robots: { index: false, follow: false },
};

export default function PaginaDosSons() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-xs font-medium text-slate-500 transition hover:text-slate-300"
        >
          ← todas as aulas
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sons da aula</h1>
        <p className="max-w-prose text-sm leading-relaxed text-slate-400">
          Um botão por candidato, as medidas lidas do arquivo decodificado, e a
          sequência real da aula com os mesmos 620&nbsp;ms entre o seu lance e a
          resposta do defensor. Efeito isolado engana: desequilíbrio só aparece em
          sequência.
        </p>
      </header>

      <SoundLab />
    </main>
  );
}
