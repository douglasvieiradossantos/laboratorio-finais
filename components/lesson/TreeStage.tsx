"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Color, Key } from "@lichess-org/chessground/types";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PromotionPicker, type PromotionChoice } from "@/components/board/PromotionPicker";
import { teachingShapes } from "@/lib/chess/annotations";
import { legalDests, toBoardColor } from "@/lib/chess/dests";
import type { Lesson, MoveTree, Position } from "@/lib/lesson/schema";
import { judgeMove, throwsWinAway, toUci } from "@/lib/lesson/tree";
import { restingMessage, useLessonStore, type PanelMessage, type TreeKey } from "@/lib/lesson/store";
import { REPLY_DELAY_MS } from "@/lib/lesson/timing";
import { playComplete, playForMove, playRefusal, playSuccess } from "@/lib/sound";
import { Confetti } from "./Confetti";
import { FeedbackPanel } from "./FeedbackPanel";
import { LessonButton } from "./LessonButton";
import { PulseRing } from "./PulseRing";

/**
 * Etapas 3 e 4 — a árvore de lances (plano da F1, §3). A mesma mecânica serve
 * às duas; o que muda é a configuração: a etapa 3 tem dica, destaques e
 * retentativa ilimitada, a etapa 4 tira a ajuda, conta os lances e encerra a
 * tentativa no primeiro lance que joga a vitória fora (§3.3).
 *
 * Nenhum lance é avaliado aqui: `judgeMove` compara com as listas do arquivo.
 * A chess.js entra só para dizer o que é legal e para mover as peças.
 */
export function TreeStage({
  lesson,
  tree,
  treeKey,
  position,
  orientation,
  allowHelp,
  moveLimit,
  intro,
  onFinish,
  finishLabel,
}: {
  lesson: Lesson;
  tree: MoveTree;
  treeKey: TreeKey;
  position: Position;
  orientation: Color;
  allowHelp: boolean;
  moveLimit?: number;
  intro?: string;
  onFinish?: () => void;
  finishLabel?: string;
}) {
  const state = useLessonStore((s) => s.trees[treeKey]);
  const message = useLessonStore((s) => s.message);
  const say = useLessonStore((s) => s.say);
  const celebrate = useLessonStore((s) => s.celebrate);
  const fadeFlash = useLessonStore((s) => s.fadeFlash);
  const treeAdvance = useLessonStore((s) => s.treeAdvance);
  const treeFail = useLessonStore((s) => s.treeFail);
  const treeRestart = useLessonStore((s) => s.treeRestart);
  const toggleHint = useLessonStore((s) => s.toggleHint);

  /**
   * A posição desenhada enquanto o lance acontece; `null` = a do nó atual.
   * Carrega a tentativa a que pertence: recomeçar a etapa aposenta o que
   * estava desenhado sem precisar de um efeito para limpar.
   */
  const [drawn, setDrawn] = useState<{
    fen: string;
    lastMove: [Key, Key];
    attempt: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [promotion, setPromotion] = useState<{ orig: Key; dest: Key } | null>(null);
  /** Sobe uma vez a cada mate: é o que dispara o confete. */
  const [celebration, setCelebration] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** De onde o confete explode: o tabuleiro, não o centro da etapa. */
  const boardColumn = useRef<HTMLDivElement>(null);

  const node = state ? tree.nodes[state.nodeId] : undefined;
  const status = state?.status ?? "playing";
  const attempt = state?.attempt ?? 1;
  const overlay = drawn?.attempt === attempt ? drawn : null;
  /**
   * A etapa já concluída. Sair para outra etapa desmonta este componente e leva
   * junto o `drawn`; sem esta foto guardada na store, o tabuleiro voltaria ao
   * nó parado — que é o **anterior** ao mate — com a etapa fechada para lances.
   */
  const end = state?.end ?? null;
  const boardFen = overlay?.fen ?? end?.fen ?? node?.fen ?? position.fen;
  const lastMove = (overlay?.lastMove ?? end?.lastMove ?? null) as [Key, Key] | null;
  /**
   * O desfecho sobrevive à navegação entre etapas: `goToStage` apaga a mensagem
   * viva, e o texto — conclusão ou tentativa encerrada — volta da árvore.
   * Derivado, e não reescrito na store ao montar: sem efeito, sem risco de laço.
   */
  const panel: PanelMessage | null = message ?? restingMessage(state);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  /** Volta ao nó raiz. Cancela a resposta do defensor que estava a caminho. */
  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setBusy(false);
    setPromotion(null);
    treeRestart(treeKey);
  }, [treeRestart, treeKey]);

  // O reforço visual na casa é breve de propósito: some sozinho, o texto fica.
  useEffect(() => {
    if (!message?.square) return;
    const handle = setTimeout(fadeFlash, 1400);
    return () => clearTimeout(handle);
  }, [message?.seq, message?.square, fadeFlash]);

  const board = useMemo(() => {
    const game = new Chess(boardFen);
    return {
      turn: toBoardColor(game.turn()),
      check: game.isCheck(),
      // Quem está para jogar num mate é o lado matado. Derivado da posição na
      // tela, então não precisa de estado novo nem de efeito: fica certo até se
      // uma aula futura ensinar o lado da defesa.
      mate: game.isCheckmate(),
      dests: legalDests(game),
    };
  }, [boardFen]);

  const interactive = status === "playing" && !busy && board.turn === orientation;

  const shapes: DrawShape[] = useMemo(() => {
    // Os destaques automáticos (corte e peça pendurada) saem da posição que
    // está na tela, então continuam certos mesmo durante a animação do lance.
    // A etapa 4 não recebe nenhum: é lá que o domínio é aferido.
    const list: DrawShape[] = allowHelp ? teachingShapes(boardFen, lastMove) : [];
    // Os destaques da autoria valem para o nó parado; enquanto o lance está
    // sendo desenhado eles sairiam do lugar, então somem.
    if (allowHelp && !overlay && status === "playing" && node) {
      for (const square of node.highlights ?? []) list.push({ orig: square as Key, brush: "green" });
    }
    if (message?.square) list.push({ orig: message.square as Key, brush: "red" });
    return list;
  }, [allowHelp, boardFen, lastMove, overlay, status, node, message]);

  const play = useCallback(
    (orig: Key, dest: Key, promoted?: PromotionChoice) => {
      if (!node || !state || status !== "playing" || busy) return;

      const uci = toUci(orig, dest, promoted);
      const verdict = judgeMove(lesson, node, uci);

      if (verdict.kind !== "method") {
        // A peça já foi solta na casa errada; `revision` a traz de volta.
        setRevision((r) => r + 1);

        // A mesma técnica por outro caminho (só etapa 3): elogia, sem reforço
        // vermelho na casa — a peça volta só para a linha escrita continuar.
        if (verdict.kind === "method-alternative") {
          playSuccess();
          say("good", verdict.text);
          return;
        }

        playRefusal();
        const fatal = moveLimit !== undefined && throwsWinAway(verdict);
        if (fatal) {
          const text = `${verdict.text} Sem a vitória não há o que treinar: a tentativa acabou.`;
          treeFail(treeKey, { tone: "bad", text });
          say("bad", text, dest);
        } else {
          say(verdict.preservesWin ? "warn" : "bad", verdict.text, dest);
        }
        return;
      }

      const game = new Chess(node.fen);
      const played = game.move({ from: orig, to: dest, promotion: promoted });
      const afterFen = game.fen();
      setDrawn({ fen: afterFen, lastMove: [orig, dest], attempt });

      // Nó terminal: o lance deu mate (o gate provou que dá) — a etapa acaba.
      // A posição do mate vai junto para a store: é a única cópia dela, porque
      // lance terminal não tem nó de destino.
      if (verdict.next === undefined || verdict.reply === undefined) {
        playComplete();
        setCelebration((c) => c + 1);
        treeAdvance(treeKey, null, {
          fen: afterFen,
          lastMove: [orig, dest],
          text: verdict.feedback,
        });
        celebrate(verdict.feedback);
        return;
      }

      playForMove({ capture: Boolean(played.captured), check: game.isCheck() });

      const used = state.studentMoves + 1;
      const outOfMoves = moveLimit !== undefined && used >= moveLimit;
      say("good", verdict.feedback);

      setBusy(true);
      const reply = verdict.reply;
      const next = verdict.next;
      timer.current = setTimeout(() => {
        const after = new Chess(afterFen);
        const answered = after.move({
          from: reply.slice(0, 2),
          to: reply.slice(2, 4),
          promotion: reply.length > 4 ? reply.slice(4) : undefined,
        });
        playForMove({ capture: Boolean(answered.captured), check: after.isCheck() });
        setDrawn({
          fen: after.fen(),
          lastMove: [reply.slice(0, 2) as Key, reply.slice(2, 4) as Key],
          attempt,
        });
        treeAdvance(treeKey, next);
        setBusy(false);
        if (outOfMoves) {
          const text = `O teto de ${moveLimit} lances acabou e o mate não saiu. Recomece: o método precisa caber no limite.`;
          treeFail(treeKey, { tone: "warn", text });
          say("warn", text);
        }
      }, REPLY_DELAY_MS);
    },
    [
      attempt,
      busy,
      celebrate,
      lesson,
      moveLimit,
      node,
      say,
      state,
      status,
      treeAdvance,
      treeFail,
      treeKey,
    ],
  );

  const handleMove = useCallback(
    (orig: Key, dest: Key) => {
      if (!interactive) {
        setRevision((r) => r + 1);
        return;
      }
      const candidates = new Chess(boardFen)
        .moves({ verbose: true })
        .filter((move) => move.from === orig && move.to === dest);
      if (candidates.length === 0) {
        setRevision((r) => r + 1);
        // Era a única recusa muda do arquivo. Com o anel de pulso ficaria cor
        // sem som, o que soa como bug.
        playRefusal();
        say("bad", "Esse lance não é legal nesta posição.", dest);
        return;
      }
      if (candidates.some((move) => move.promotion)) {
        setPromotion({ orig, dest });
        return;
      }
      play(orig, dest);
    },
    [boardFen, interactive, play, say],
  );

  if (!state || !node) return null;

  const hintAvailable = allowHelp && Boolean(node.hint);

  // A raiz é `relative` **sem `z-index`**, de propósito: assim não cria
  // contexto de empilhamento novo e as camadas de hoje (canvas `z-10`, promoção
  // `z-20`) continuam valendo. Também não leva `overflow-hidden` — cortaria o
  // `box-shadow` do anel de pulso.
  return (
    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start">
      <div
        ref={boardColumn}
        className="relative mx-auto w-full max-w-[min(88vw,26rem)] lg:mx-0 lg:w-[26rem] lg:shrink-0"
      >
        <ChessBoard
          fen={boardFen}
          orientation={orientation}
          turnColor={board.turn}
          dests={interactive ? board.dests : new Map()}
          lastMove={lastMove}
          check={board.check}
          viewOnly={!interactive}
          revision={revision}
          shapes={shapes}
          matedKing={board.mate ? board.turn : null}
          onMove={handleMove}
        />
        {/* Na conclusão o anel é suprimido: confete, pulso do rei, som e painel
            enfatizado já disparam juntos — o confete é o anel, mil vezes maior. */}
        <PulseRing
          tone={message && !message.done ? message.tone : null}
          seq={message?.seq ?? 0}
        />
        {promotion && (
          <PromotionPicker
            color={board.turn}
            onChoose={(piece) => {
              const move = promotion;
              setPromotion(null);
              play(move.orig, move.dest, piece);
            }}
            onCancel={() => {
              setPromotion(null);
              setRevision((r) => r + 1);
            }}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {intro && status === "playing" && (
          <p className="text-sm leading-relaxed text-slate-300">{intro}</p>
        )}

        {moveLimit !== undefined && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Lance {state.studentMoves} de {moveLimit}
            {state.attempt > 1 && ` · tentativa ${state.attempt}`}
          </p>
        )}

        <FeedbackPanel
          message={panel}
          placeholder={
            allowHelp
              ? "Faça o lance no tabuleiro. Errar aqui não custa nada — a resposta vem escrita."
              : "Sem dica e sem destaque. Um lance que jogue a vitória fora encerra a tentativa."
          }
        />

        {hintAvailable && status === "playing" && (
          <div className="flex flex-col gap-2">
            <div>
              <LessonButton onClick={() => toggleHint(treeKey)}>
                {state.hintOpen ? "Esconder a dica" : "Ver a dica"}
              </LessonButton>
            </div>
            {state.hintOpen && (
              <p className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm leading-relaxed text-sky-100">
                {node.hint}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status === "failed" && (
            <LessonButton variant="primary" onClick={restart}>
              Recomeçar do zero
            </LessonButton>
          )}
          {status === "done" && onFinish && (
            <LessonButton variant="primary" onClick={onFinish}>
              {finishLabel ?? "Continuar"}
            </LessonButton>
          )}
          {/* Também na etapa concluída: é o caminho para refazer a linha — e
              para rever a comemoração, que não se repete só por voltar aqui. */}
          {(status === "done" || (status === "playing" && state.studentMoves > 0)) && (
            <LessonButton onClick={restart}>Recomeçar a posição</LessonButton>
          )}
        </div>
      </div>

      {/* Último filho da raiz, e não da coluna do tabuleiro: o confete cobre a
          etapa inteira. As partículas continuam nascendo do tabuleiro. */}
      <Confetti seq={celebration} originRef={boardColumn} />
    </div>
  );
}
