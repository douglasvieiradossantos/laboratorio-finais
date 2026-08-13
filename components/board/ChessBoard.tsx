"use client";

import { useEffect, useRef } from "react";
import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Color, Dests, Key } from "@lichess-org/chessground/types";

export type ChessBoardProps = {
  /** A posição, em FEN. */
  fen: string;
  /** De que lado o tabuleiro é visto. */
  orientation?: Color;
  /** De quem é a vez. */
  turnColor?: Color;
  /** Destinos legais por casa de origem; ausente = ninguém move. */
  dests?: Dests;
  /** Último lance, para destacar as duas casas. */
  lastMove?: [Key, Key] | null;
  /** Rei em xeque? */
  check?: boolean;
  /** Só olhar, sem mover. */
  viewOnly?: boolean;
  /**
   * Contador que sobe a cada atualização de estado. Existe para forçar a
   * ressincronização mesmo quando a FEN não mudou — por exemplo quando o aluno
   * arrasta uma peça, o chessground já a moveu na tela, e o lance é desfeito.
   */
  revision?: number;
  /**
   * Setas e casas destacadas desenhadas *pelo motor* (etapas 2 a 4): seta é
   * `{ orig, dest }`, destaque de casa é `{ orig }` sozinho. Vão pelo canal
   * `setAutoShapes` do chessground — a camada dos desenhos automáticos, que o
   * motor troca inteira a cada estado. O canal de desenho do usuário (`enabled`)
   * continua desligado; o que liga aqui é só a *exibição* (`visible`).
   */
  shapes?: DrawShape[];
  onMove?: (orig: Key, dest: Key) => void;
};

/**
 * Casca fina em volta do chessground. O chessground é código imperativo que
 * toma conta do próprio DOM: o React só cria a <div> vazia e nunca mexe no que
 * está dentro dela. As mudanças chegam por `api.set()`, não por re-render.
 */
export function ChessBoard({
  fen,
  orientation = "white",
  turnColor,
  dests,
  lastMove,
  check = false,
  viewOnly = false,
  revision = 0,
  shapes,
  onMove,
}: ChessBoardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  // O callback vive numa ref para que o chessground não precise ser
  // reconfigurado só porque a função mudou de identidade entre renders.
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const api = Chessground(host, {
      fen,
      orientation,
      coordinates: true,
      addDimensionsCssVarsTo: host,
      // Rolagem da página fica bloqueada durante o arraste no celular.
      blockTouchScroll: true,
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 180 },
      movable: {
        free: false,
        showDests: true,
        events: {
          after: (orig, dest) => onMoveRef.current?.(orig, dest),
        },
      },
      draggable: { showGhost: true },
      drawable: { enabled: false, visible: true },
    });
    apiRef.current = api;

    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // Roda uma vez só: o resto entra pelo efeito de sincronização abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiRef.current?.set({
      fen,
      orientation,
      turnColor,
      check,
      viewOnly,
      lastMove: lastMove ?? undefined,
      movable: {
        free: false,
        color: viewOnly ? undefined : turnColor,
        dests: viewOnly ? new Map() : dests,
      },
    });
  }, [fen, orientation, turnColor, dests, lastMove, check, viewOnly, revision]);

  // Depois do `set` acima: `setAutoShapes` redesenha a camada inteira, então
  // uma lista vazia é o jeito de apagar o que havia.
  useEffect(() => {
    apiRef.current?.setAutoShapes(shapes ?? []);
  }, [shapes, fen, revision]);

  return (
    <div
      ref={hostRef}
      className="cg-wrap aspect-square w-full touch-none select-none"
    />
  );
}
