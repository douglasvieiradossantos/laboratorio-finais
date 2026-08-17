"use client";

import type { MessageTone } from "@/lib/lesson/store";

/**
 * O pulso de anel em volta do tabuleiro: verde quando o lance é o método,
 * âmbar quando ganha mas não é a aula, vermelho quando joga a vitória fora.
 *
 * **O `key` é o mecanismo, e ele já é idioma do projeto.** `say()` incrementa o
 * `seq` incondicionalmente, então errar o *mesmo* lance duas vezes gera `seq`
 * novo mesmo com texto idêntico; trocar o `key` desmonta e remonta esta `div`,
 * e a animação CSS reinicia do zero. É exatamente o que o `FeedbackPanel` já faz
 * com `<span key={message.seq}>`, pelo mesmo motivo — e evita o efeito com
 * `setState` que o lint do projeto proíbe.
 *
 * Fica **fora** do host do chessground, como irmão dele: o pacote toma conta do
 * próprio DOM e nada nosso entra lá.
 *
 * A cor e a animação moram em `app/globals.css`, na seção "Animações da aula" —
 * inclusive a guarda de `prefers-reduced-motion`.
 */
export function PulseRing({ tone, seq }: { tone: MessageTone | null; seq: number }) {
  // `neutral` é o tom dos avisos que não são veredito de lance: não pulsa nada.
  if (tone === null || tone === "neutral") return null;
  return (
    <div
      key={seq}
      aria-hidden
      data-tom={tone}
      className="anel-pulso pointer-events-none absolute inset-0"
    />
  );
}
