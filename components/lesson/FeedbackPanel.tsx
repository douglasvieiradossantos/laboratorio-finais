"use client";

import type { MessageTone, PanelMessage } from "@/lib/lesson/store";

/**
 * `conclusao` é uma entrada de mapa, e não uma concatenação de utilitários por
 * cima de `good`: no Tailwind v4 duas utilities conflitantes na mesma string
 * resolvem pela ordem **na folha gerada**, não na ordem da `class` — concatenar
 * seria um erro silencioso de ordem, que às vezes acerta e às vezes não.
 */
const TONE: Record<MessageTone | "conclusao", string> = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-100",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  neutral: "border-white/10 bg-slate-900 text-slate-300",
  conclusao: "border-emerald-400/70 bg-emerald-500/20 text-emerald-50 ring-1 ring-emerald-400/30",
};

/**
 * O painel que fala com o aluno. É a única voz da aula: feedback do método,
 * texto do erro nomeado e os dois fallbacks honestos saem todos daqui.
 *
 * A região é `aria-live` e existe sempre — mesmo vazia —, porque um leitor de
 * tela só anuncia mudanças dentro de uma região que já estava lá. O `key={seq}`
 * troca o nó de dentro a cada mensagem: sem isso, repetir o mesmo erro duas
 * vezes seguidas não geraria mutação nenhuma e o anúncio ficaria mudo.
 *
 * **Regra inviolável:** este `<div>` nunca é desmontado nem recebe `key`.
 * Trocar `className` e trocar filhos é seguro; deixar de existir por um instante
 * é o que emudece o leitor de tela.
 */
export function FeedbackPanel({
  message,
  placeholder,
}: {
  message: PanelMessage | null;
  placeholder?: string;
}) {
  const done = message?.done ?? false;
  return (
    <div
      aria-live="polite"
      role="status"
      data-enfase={done ? "conclusao" : undefined}
      className={`min-h-16 rounded-lg border px-4 py-3 text-sm leading-relaxed transition-colors ${
        message ? TONE[done ? "conclusao" : message.tone] : TONE.neutral
      }`}
    >
      {message ? (
        // O selo entra *dentro* do nó com `key`, para fazer parte da mutação
        // anunciada: o leitor de tela começa pela conclusão.
        <span key={message.seq}>
          {done && (
            <strong className="mr-2 inline-block rounded bg-emerald-400/20 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
              Etapa concluída.
            </strong>
          )}
          {message.text}
        </span>
      ) : (
        <span className="text-slate-400">{placeholder ?? ""}</span>
      )}
    </div>
  );
}
