"use client";

import { useState } from "react";
import Link from "next/link";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import type { LessonBundle } from "@/lib/lesson/content";
import { DIRECOES, PADRAO } from "./direcoes";
import { FolhaDeContato } from "./FolhaDeContato";

/** O que o servidor mediu para cada direção, na build. */
export type Aferido = {
  chave: string;
  /** Quantas combinações entraram na conta (as isentas ficam de fora). */
  pares: number;
  /** A menor razão entre todas — o pior caso da direção. */
  minimo: number;
  /** Os pares de menor folga contra o piso deles. */
  apertados: { onde: string; piso: number; razao: number }[];
  amostras: { grupo: string; token: string; classe: string; hex: string }[];
};

/**
 * O interruptor. TEMPORÁRIO, sai no B6.5.
 *
 * `key={direcao}` remonta a aula inteira a cada troca, e isso é necessário e
 * não zelo: o `ChessBoard` lê os quatro pincéis pedagógicos por
 * `getComputedStyle` **na montagem**, porque o chessground grava a cor do
 * desenho como atributo de apresentação e `var()` não vale ali. Sem remontar, o
 * tabuleiro continuaria desenhando com os pincéis da direção anterior.
 *
 * O `data-direcao` fica numa `<div>` que cobre a tela, e não no `<html>`, para
 * esta rota não precisar tocar o layout da raiz. No B6.5 a direção vencedora
 * sobe para o `:root` e nada disto sobrevive.
 */
export function Comparador({
  bundle,
  aferidos,
}: {
  bundle: LessonBundle;
  aferidos: Record<string, Aferido>;
}) {
  const [direcao, setDirecao] = useState(PADRAO);
  const atual = DIRECOES.find((d) => d.chave === direcao) ?? DIRECOES[0];

  return (
    <div data-direcao={direcao} className="flex min-h-dvh flex-1 flex-col bg-papel text-tinta">
      {/* O interruptor gruda no topo: alternar sem perder de vista o que muda
          é a comparação inteira. */}
      <div className="sticky top-0 z-30 border-b border-borda bg-carta/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="radiogroup"
              aria-label="Direção visual"
              className="flex flex-wrap gap-2"
            >
              {DIRECOES.map((d) => {
                const ativa = d.chave === direcao;
                return (
                  <button
                    key={d.chave}
                    type="button"
                    role="radio"
                    aria-checked={ativa}
                    onClick={() => setDirecao(d.chave)}
                    className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium ring-1 transition foco ${
                      ativa
                        ? "bg-metodo-cheio text-tinta-inversa ring-metodo/30"
                        : "bg-carta text-tinta-fraca ring-borda hover:bg-carta-alta"
                    }`}
                  >
                    {d.rotulo}
                  </button>
                );
              })}
            </div>
            <Link href="/" className="rotulo text-tinta-apagada transition hover:text-tinta-fraca">
              ← sair
            </Link>
          </div>
          <p className="max-w-prose text-sm leading-relaxed text-tinta-tenue">
            <strong className="font-semibold text-tinta">{atual.nome}</strong> — {atual.registro}
          </p>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-8 sm:py-12">
        <section aria-label="A aula na direção escolhida">
          <LessonPlayer key={direcao} bundle={bundle} />
        </section>

        <FolhaDeContato direcao={atual} aferido={aferidos[direcao]} />
      </main>
    </div>
  );
}
