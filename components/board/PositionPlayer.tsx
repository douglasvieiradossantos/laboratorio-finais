"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Color, Dests, Key } from "@lichess-org/chessground/types";
import { ChessBoard } from "./ChessBoard";
import { PromotionPicker, type PromotionChoice } from "./PromotionPicker";
import { legalDests, toBoardColor } from "@/lib/chess/dests";
import { refusalReason } from "@/lib/chess/refusal";
import { readOutcome, type GameOutcome } from "@/lib/chess/status";
import { armAudioOnFirstGesture, playComplete, playForMove, playRefusal } from "@/lib/sound";

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
  /**
   * Pendência da F0 fechada aqui: até agora um lance recusado devolvia a peça
   * em silêncio. Toda recusa passa a dizer por que foi recusada, no mesmo
   * `aria-live` do estado da partida, com reforço visual breve na casa.
   */
  const [refusal, setRefusal] = useState<{
    text: string;
    square?: Key;
    seq: number;
    tone: "bad" | "neutral";
  } | null>(null);

  // O reforço visual na casa é breve; o texto fica até o próximo lance.
  useEffect(() => {
    if (!refusal?.square) return;
    const handle = setTimeout(
      () => setRefusal((current) => (current ? { ...current, square: undefined } : current)),
      1400,
    );
    return () => clearTimeout(handle);
  }, [refusal?.seq, refusal?.square]);

  const shapes: DrawShape[] = useMemo(
    () => (refusal?.square ? [{ orig: refusal.square, brush: "red" }] : []),
    [refusal],
  );

  useEffect(() => armAudioOnFirstGesture(), []);

  const publish = useCallback(
    (lastMove: [Key, Key] | null) => {
      setView((previous) => snapshot(game, lastMove, previous.revision + 1));
    },
    [game],
  );

  /** O som do lance que acabou de entrar no histórico. */
  const soundLastMove = useCallback(() => {
    const last = game.history({ verbose: true }).at(-1);
    if (!last) return;
    if (game.isCheckmate()) playComplete();
    else playForMove({ capture: Boolean(last.captured), check: game.isCheck() });
  }, [game]);

  const handleMove = useCallback(
    (orig: Key, dest: Key) => {
      const candidates = game
        .moves({ verbose: true })
        .filter((move) => move.from === orig && move.to === dest);

      if (candidates.length === 0) {
        // O chessground já mexeu a peça na tela; a revisão a traz de volta —
        // e agora a recusa também diz, por escrito, o que houve.
        playRefusal();
        setRefusal((previous) => ({
          text: refusalReason(game, orig, dest),
          square: dest,
          seq: (previous?.seq ?? 0) + 1,
          tone: "bad",
        }));
        publish(view.lastMove);
        return;
      }
      setRefusal(null);
      if (candidates.some((move) => move.promotion)) {
        setPending({ orig, dest });
        return;
      }
      game.move({ from: orig, to: dest });
      soundLastMove();
      publish([orig, dest]);
    },
    [game, publish, soundLastMove, view.lastMove],
  );

  const finishPromotion = useCallback(
    (piece: PromotionChoice) => {
      if (!pending) return;
      game.move({ from: pending.orig, to: pending.dest, promotion: piece });
      soundLastMove();
      setPending(null);
      publish([pending.orig, pending.dest]);
    },
    [game, pending, publish, soundLastMove],
  );

  const cancelPromotion = useCallback(() => {
    setPending(null);
    // Cancelar também devolve a peça — e também não pode ser em silêncio.
    playRefusal();
    setRefusal((previous) => ({
      text: "Promoção cancelada: o lance não foi feito.",
      seq: (previous?.seq ?? 0) + 1,
      tone: "neutral",
    }));
    publish(view.lastMove);
  }, [publish, view.lastMove]);

  const undo = useCallback(() => {
    if (game.history().length === 0) return;
    game.undo();
    setPending(null);
    setRefusal(null);
    const previous = game.history({ verbose: true }).at(-1);
    publish(previous ? [previous.from as Key, previous.to as Key] : null);
  }, [game, publish]);

  const reset = useCallback(() => {
    game.load(startFen);
    setPending(null);
    setRefusal(null);
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
          shapes={shapes}
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

      {/* Uma região viva só: estado da partida e recusa falam pelo mesmo lugar.
          O `key` troca o nó a cada recusa — sem isso, insistir no mesmo lance
          errado não geraria mutação e o leitor de tela ficaria mudo. */}
      <p
        aria-live="polite"
        role="status"
        className={`text-center text-sm font-medium ${
          refusal?.tone === "bad" ? "text-rose-300" : "text-slate-300"
        }`}
      >
        <span key={refusal ? `refusal-${refusal.seq}` : "status"}>
          {refusal ? refusal.text : statusText}
        </span>
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
