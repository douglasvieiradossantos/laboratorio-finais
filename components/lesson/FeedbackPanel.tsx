"use client";

import type { MessageTone, PanelMessage } from "@/lib/lesson/store";

const TONE: Record<MessageTone, string> = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-100",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  neutral: "border-white/10 bg-slate-900 text-slate-300",
};

/**
 * O painel que fala com o aluno. É a única voz da aula: feedback do método,
 * texto do erro nomeado e os dois fallbacks honestos saem todos daqui.
 *
 * A região é `aria-live` e existe sempre — mesmo vazia —, porque um leitor de
 * tela só anuncia mudanças dentro de uma região que já estava lá. O `key={seq}`
 * troca o nó de dentro a cada mensagem: sem isso, repetir o mesmo erro duas
 * vezes seguidas não geraria mutação nenhuma e o anúncio ficaria mudo.
 */
export function FeedbackPanel({
  message,
  placeholder,
}: {
  message: PanelMessage | null;
  placeholder?: string;
}) {
  return (
    <div
      aria-live="polite"
      role="status"
      className={`min-h-16 rounded-lg border px-4 py-3 text-sm leading-relaxed transition-colors ${
        message ? TONE[message.tone] : TONE.neutral
      }`}
    >
      {message ? (
        <span key={message.seq}>{message.text}</span>
      ) : (
        <span className="text-slate-400">{placeholder ?? ""}</span>
      )}
    </div>
  );
}
