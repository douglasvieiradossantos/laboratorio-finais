"use client";

import type { ReactNode } from "react";

/**
 * Botão da aula. `min-h-11` não é enfeite: é o alvo de toque mínimo
 * confortável no celular, e celular e desktop são iguais aqui.
 */
export function LessonButton({
  onClick,
  disabled,
  variant = "default",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary";
  children: ReactNode;
}) {
  const skin =
    variant === "primary"
      ? "bg-emerald-600 text-white ring-emerald-400/30 hover:bg-emerald-500"
      : "bg-slate-800 text-slate-100 ring-white/10 hover:bg-slate-700 disabled:hover:bg-slate-800";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${skin}`}
    >
      {children}
    </button>
  );
}
