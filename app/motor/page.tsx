import Link from "next/link";
import { EngineLab } from "@/components/engine/EngineLab";

/**
 * A bancada do motor. Não é para o aluno: é o instrumento que mede a carga do
 * WebAssembly e o tempo por lance, porque `npm test` roda sem navegador e não
 * alcança nem Worker nem WebAssembly.
 *
 * Fora do índice dos buscadores e sem link da home, pelo mesmo motivo da
 * `/sons` e da `/tabuleiro`: é ferramenta de quem constrói.
 */
export const metadata = {
  title: "Motor — Laboratório de Finais",
  robots: { index: false, follow: false },
};

export default function PaginaDoMotor() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-xs font-medium text-slate-500 transition hover:text-slate-300"
        >
          ← todas as aulas
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Motor da etapa 5</h1>
        <p className="max-w-prose text-sm leading-relaxed text-slate-400">
          O Stockfish carregado como a aula o carrega, com a mesma força e o mesmo
          tempo de busca do arquivo da aula. O número que importa é o pior tempo
          por lance — o alvo do plano é sair em ≤ 2&nbsp;s no celular, e o
          veredito é no aparelho, não aqui.
        </p>
      </header>

      <EngineLab />
    </main>
  );
}
