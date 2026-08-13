"use client";

import { useCallback, useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { Color, Dests, Key } from "@lichess-org/chessground/types";
import { ChessBoard } from "./ChessBoard";
import { PromotionPicker, type PromotionChoice } from "./PromotionPicker";
import { legalDests, toBoardColor } from "@/lib/chess/dests";
import { readOutcome, type GameOutcome } from "@/lib/chess/status";

type Snapshot = {
  fen: string;
  turn: Color;
  dests: Dests;
  check: boolean;
  lastMove: [Key, Key] | null;
  outcome: GameOutcome;
  plies: number;
  revision: number;
};

function snapshot(
  game: Chess,
  lastMove: [Key, Key] | null,
  revision: number,
): Snapshot {
  return {
    fen: game.fen(),
    turn: toBoardColor(game.turn()),
    dests: legalDests(game),
    check: game.isCheck(),
    lastMove,
    outcome: readOutcome(game),
    plies: game.history().length,
    revision,
  };
}

export function PositionPlayer({
  startFen,
  orientation = "white",
}: {
  startFen: string;
  orientation?: Color;
}) {
  const [game] = useState(() => new Chess(startFen));
  const [view, setView] = useState<Snapshot>(() => snapshot(game, null, 0));
  const [flipped, setFlipped] = useState(false);
  const [pending, setPending] = useState<{ orig: Key; dest: Key } | null>(null);

  const publish = useCallback(
    (lastMove: [Key, Key] | null) => {
      setView((previous) => snapshot(game, lastMove, previous.revision + 1));
    },
    [game],
  );

  const handleMove = useCallback(
    (orig: Key, dest: Key) => {
      const candidates = game
        .moves({ verbose: true })
        .filter((move) => move.from === orig && move.to === dest);

      if (candidates.length === 0) {
        // O chessground já mexeu a peça na tela; a revisão a traz de volta.
        publish(view.lastMove);
        return;
      }
      if (candidates.some((move) => move.promotion)) {
        setPending({ orig, dest });
        return;
      }
      game.move({ from: orig, to: dest });
      publish([orig, dest]);
    },
    [game, publish, view.lastMove],
  );

  const finishPromotion = useCallback(
    (piece: PromotionChoice) => {
      if (!pending) return;
      game.move({ from: pending.orig, to: pending.dest, promotion: piece });
      setPending(null);
      publish([pending.orig, pending.dest]);
    },
    [game, pending, publish],
  );

  const cancelPromotion = useCallback(() => {
    setPending(null);
    publish(view.lastMove);
  }, [publish, view.lastMove]);

  const undo = useCallback(() => {
    if (game.history().length === 0) return;
    game.undo();
    setPending(null);
    const previous = game.history({ verbose: true }).at(-1);
    publish(previous ? [previous.from as Key, previous.to as Key] : null);
  }, [game, publish]);

  const reset = useCallback(() => {
    game.load(startFen);
    setPending(null);
    publish(null);
  }, [game, publish, startFen]);

  const boardOrientation: Color = flipped
    ? orientation === "white"
      ? "black"
      : "white"
    : orientation;

  const statusText = useMemo(() => {
    if (view.outcome.over) return view.outcome.reason;
    const side = view.turn === "white" ? "brancas" : "pretas";
    return view.check ? `Xeque — vez das ${side}.` : `Vez das ${side}.`;
  }, [view]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="relative mx-auto w-full max-w-[min(88vw,32rem)]">
        <ChessBoard
          fen={view.fen}
          orientation={boardOrientation}
          turnColor={view.turn}
          dests={view.outcome.over ? new Map() : view.dests}
          lastMove={view.lastMove}
          check={view.check}
          revision={view.revision}
          onMove={handleMove}
        />
        {pending && (
          <PromotionPicker
            color={view.turn}
            onChoose={finishPromotion}
            onCancel={cancelPromotion}
          />
        )}
      </div>

      <p
        aria-live="polite"
        className="text-center text-sm font-medium text-slate-300"
      >
        {statusText}
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <ControlButton onClick={undo} disabled={view.plies === 0}>
          Voltar lance
        </ControlButton>
        <ControlButton onClick={reset} disabled={view.plies === 0}>
          Recomeçar
        </ControlButton>
        <ControlButton onClick={() => setFlipped((f) => !f)}>
          Girar tabuleiro
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 ring-1 ring-white/10 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}
