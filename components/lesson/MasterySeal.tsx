"use client";

import type { MasteryReport } from "@/lib/lesson/mastery";
import { LessonButton } from "./LessonButton";

/**
 * O selo de domínio, ao fim da partida da etapa 5.
 *
 * Aparece **vencendo ou não** — de propósito. Um selo que só aparece no sucesso
 * deixa o aluno que quase chegou sem saber o que faltou, e a etapa 1 prometeu
 * uma resposta. Quando falta a etapa 4, o selo leva até ela.
 */
export function MasterySeal({
  report,
  onGoToSolo,
}: {
  report: MasteryReport;
  onGoToSolo?: () => void;
}) {
  const faltaSolo = report.missing.some((m) => m.stage === "solo");

  return (
    <section
      // Não é `aria-live`: o painel de feedback é a única região viva da etapa,
      // e duas regiões anunciando ao mesmo tempo se atropelam no leitor de tela.
      // Este bloco entra na ordem natural da leitura, logo abaixo do painel.
      aria-labelledby="selo-dominio"
      data-mastered={report.mastered}
      className={`flex flex-col gap-3 rounded-lg border px-4 py-3 ${
        report.mastered
          ? "border-metodo/40 bg-metodo-superficie/10"
          : "border-borda bg-carta"
      }`}
    >
      <h3
        id="selo-dominio"
        className={`text-sm font-semibold ${report.mastered ? "text-metodo-selo" : "text-tinta-media"}`}
      >
        {report.mastered ? "✓ " : ""}
        {report.headline}
      </h3>

      {report.missing.length > 0 && (
        <ul className="flex flex-col gap-2">
          {report.missing.map((item) => (
            <li key={item.stage} className="flex gap-2 text-sm leading-relaxed text-tinta-media">
              <span aria-hidden className="select-none text-tinta-muda">
                —
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}

      {faltaSolo && onGoToSolo && (
        <div>
          <LessonButton onClick={onGoToSolo}>Ir para a etapa sem ajuda</LessonButton>
        </div>
      )}
    </section>
  );
}
