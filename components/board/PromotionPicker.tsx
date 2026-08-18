"use client";

import type { Color } from "@lichess-org/chessground/types";

const CHOICES = [
  { role: "queen", letter: "q", label: "Dama" },
  { role: "rook", letter: "r", label: "Torre" },
  { role: "bishop", letter: "b", label: "Bispo" },
  { role: "knight", letter: "n", label: "Cavalo" },
] as const;

export type PromotionChoice = (typeof CHOICES)[number]["letter"];

export function PromotionPicker({
  color,
  onChoose,
  onCancel,
}: {
  color: Color;
  onChoose: (piece: PromotionChoice) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-veu backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Escolha a peça da promoção"
    >
      {/* A classe cg-wrap é o que faz os desenhos de peça do chessground valerem aqui dentro. */}
      <div className="cg-wrap flex gap-2 rounded-lg bg-carta p-3 shadow-xl ring-1 ring-borda">
        {CHOICES.map((choice) => (
          <button
            key={choice.letter}
            type="button"
            onClick={() => onChoose(choice.letter)}
            title={choice.label}
            aria-label={choice.label}
            className="relative size-14 rounded-md bg-carta-alta transition hover:bg-carta-toque foco sm:size-16"
          >
            {/* piece do chessground é absolute com 12.5% — aqui precisa ocupar o botão inteiro. */}
            <piece
              className={`${choice.role} ${color}`}
              style={{ width: "100%", height: "100%", position: "absolute" }}
            />
          </button>
        ))}
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 text-sm text-tinta-tenue transition hover:text-tinta"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
