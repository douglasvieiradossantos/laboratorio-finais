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
      ? "bg-metodo-cheio text-tinta-inversa ring-metodo/30 hover:bg-metodo-cheio-toque"
      : "bg-carta-alta text-tinta ring-borda hover:bg-carta-toque disabled:hover:bg-carta-alta";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 foco ${skin}`}
    >
      {children}
    </button>
  );
}
