"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chess } from "chess.js";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Color, Key } from "@lichess-org/chessground/types";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PromotionPicker, type PromotionChoice } from "@/components/board/PromotionPicker";
import { legalDests, toBoardColor } from "@/lib/chess/dests";
import { applyUci } from "@/lib/chess/fen";
import { refusalReason } from "@/lib/chess/refusal";
import { fiftyMoveProgress, readOutcome } from "@/lib/chess/status";
import { engineTotalBytes, formatBytes } from "@/lib/engine/build";
import { useEngine } from "@/lib/engine/useEngine";
import { judgePractice, type PracticeGoal } from "@/lib/lesson/practice";
import type { Position } from "@/lib/lesson/schema";
import {
  restingPracticeMessage,
  useLessonStore,
  type PanelMessage,
  type PracticeKey,
} from "@/lib/lesson/store";
import { restingDelay } from "@/lib/lesson/timing";
import { playCheck, playComplete, playForMove, playRefusal } from "@/lib/sound";
import { Confetti } from "./Confetti";
import { FeedbackPanel } from "./FeedbackPanel";
import { LessonButton } from "./LessonButton";
import { PulseRing } from "./PulseRing";

/**
 * Etapa 5 — a partida contra o Stockfish (plano da F1, §5). Serve também à
 * etapa 6, que é a mesma partida em posições de revisão.
 *
 * **É a única etapa em que lance nenhum é julgado.** Não há árvore, não há
 * `expects`, não há `winningMoves`: o aluno joga a partida inteira e o juiz é o
 * resultado. Um lance ruim não é corrigido — ele é *sofrido*, que é justamente
 * a diferença entre saber a técnica e conseguir executá-la contra resistência.
 *
 * ## A partida é derivada, não espelhada
 *
 * O componente não guarda posição nenhuma: `(fen inicial, lances)` vem da store
 * e um `useMemo` reconstrói a partida a cada renderização. Sessenta meios-lances
 * de final custam microssegundos, e o desenho elimina de saída a classe de bug
 * "instância local divergiu da store". Mais importante: só o replay completo
 * mantém o contador de repetição vivo — `isThreefoldRepetition` conta o
 * histórico da instância, e uma FEN não carrega histórico.
 */
export function PracticeStage({
  practiceKey,
  position,
  orientation,
  goal,
  engine,
  intro,
  seal,
  onFinish,
  finishLabel,
}: {
  practiceKey: PracticeKey;
  position: Position;
  /** O lado do aluno. */
  orientation: Color;
  goal: PracticeGoal;
  engine: { skill: number; moveTimeMs: number };
  intro?: string;
  /** O selo de domínio. Só a etapa 5 o passa; a revisão não afere domínio. */
  seal?: ReactNode;
  onFinish?: () => void;
  finishLabel?: string;
}) {
  const state = useLessonStore((s) => s.practices[practiceKey]);
  const message = useLessonStore((s) => s.message);
  const say = useLessonStore((s) => s.say);
  const fadeFlash = useLessonStore((s) => s.fadeFlash);
  const practiceMove = useLessonStore((s) => s.practiceMove);
  const practiceFinish = useLessonStore((s) => s.practiceFinish);
  const practiceRestart = useLessonStore((s) => s.practiceRestart);

  const [revision, setRevision] = useState(0);
  const [celebration, setCelebration] = useState(0);
  /*
   * Os dois estados abaixo são **carimbados com a partida a que pertencem**, e
   * lidos pelos derivados logo adiante.
   *
   * É o mesmo idioma do `drawn.attempt` do `TreeStage`, e existe porque a etapa
   * 6 troca de posição sem remontar este componente (remontar desmontaria o
   * `FeedbackPanel`, o que é proibido). Sem o carimbo, um pedido de promoção ou
   * um erro do motor de uma posição apareceriam sobre a seguinte — e limpá-los
   * por efeito significaria `setState` dentro de efeito, que é renderização em
   * cascata.
   */
  const [promotionState, setPromotion] = useState<{
    orig: Key;
    dest: Key;
    key: PracticeKey;
  } | null>(null);
  /**
   * Falha da busca (não da carga). Sem isto, um motor que erra no meio da
   * partida deixaria o turno preso nele para sempre e a tela diria "pensando…"
   * até o aluno desistir.
   */
  const [searchErrorState, setSearchError] = useState<{ text: string; key: PracticeKey } | null>(
    null,
  );

  const promotion = promotionState?.key === practiceKey ? promotionState : null;
  const searchError = searchErrorState?.key === practiceKey ? searchErrorState.text : null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardColumn = useRef<HTMLDivElement>(null);

  const { status: engineStatus, think, abort, retry, newGame } = useEngine(true);

  const startFen = state?.startFen ?? position.fen;
  const moves = state?.moves;
  const attempt = state?.attempt ?? 1;

  /** O replay. É a única construção de `Chess` desta etapa — ver o cabeçalho. */
  const game = useMemo(() => {
    const replay = new Chess(startFen);
    for (const uci of moves ?? []) {
      replay.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci.slice(4) : undefined,
      });
    }
    return replay;
  }, [startFen, moves]);

  const boardFen = game.fen();
  const outcome = readOutcome(game);
  const verdict = judgePractice(outcome, goal, orientation === "white" ? "white" : "black");
  const turn = toBoardColor(game.turn());
  const progress = fiftyMoveProgress(game);

  const lastMove = useMemo(() => {
    const last = game.history({ verbose: true }).at(-1);
    return last ? ([last.from, last.to] as [Key, Key]) : null;
  }, [game]);

  /**
   * Os dois estados são derivados, sem `useState` nenhum: quem joga é quem está
   * na vez, e o motor pensa exatamente quando não é a vez do aluno. Guardar isso
   * em estado criaria uma segunda verdade que um cancelamento pode dessincronizar
   * — foi o defeito que a bancada `/motor` revelou no B4.2.
   */
  const emJogo = verdict.kind === "playing" && engineStatus === "ready" && !searchError;
  const interactive = emJogo && turn === orientation;
  const thinking = emJogo && turn !== orientation;

  const dests = useMemo(() => legalDests(game), [game]);
  const panel: PanelMessage | null = message ?? restingPracticeMessage(state);

  const shapes: DrawShape[] = useMemo(
    // Etapa sem ajuda nenhuma: nem corte, nem peça pendurada. O único desenho é
    // o reforço breve na casa recusada.
    () => (message?.square ? [{ orig: message.square as Key, brush: "red" }] : []),
    [message],
  );

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  useEffect(() => {
    if (!message?.square) return;
    const handle = setTimeout(fadeFlash, 1400);
    return () => clearTimeout(handle);
  }, [message?.seq, message?.square, fadeFlash]);

  /**
   * Registra um lance — do aluno ou do motor, os dois passam por aqui — e
   * decide se a partida acabou.
   *
   * O julgamento é feito no lance, e não num efeito sobre o estado, porque som,
   * confete e `practiceFinish` são **eventos**: um efeito os repetiria a cada
   * remontagem da etapa.
   */
  const registrar = useCallback(
    (uci: string, antes: Chess) => {
      const depois = new Chess(antes.fen());
      // O histórico do replay é reconstruído a partir da store no próximo
      // render; aqui basta a posição para classificar o lance e o desfecho.
      const jogada = depois.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci.slice(4) : undefined,
      });

      practiceMove(practiceKey, uci);

      // Para o desfecho, o replay completo — é o que enxerga a repetição.
      const completo = new Chess(startFen);
      for (const feito of [...(moves ?? []), uci]) {
        completo.move({
          from: feito.slice(0, 2),
          to: feito.slice(2, 4),
          promotion: feito.length > 4 ? feito.slice(4) : undefined,
        });
      }
      const fim = readOutcome(completo);
      const julgado = judgePractice(fim, goal, orientation === "white" ? "white" : "black");

      if (julgado.kind === "playing") {
        playForMove({ capture: Boolean(jogada.captured), check: completo.isCheck() });
        return;
      }

      if (julgado.kind === "passed") {
        playComplete();
        setCelebration((c) => c + 1);
        practiceFinish(practiceKey, { result: fim.over ? fim.result : "draw", text: julgado.text, passed: true });
        say("good", julgado.text);
        useLessonStore.getState().celebrate(julgado.text);
        return;
      }

      // Reprovado. Não há som de "você perdeu" no catálogo, e inventar um seria
      // reabrir uma busca que o README já fechou: o mate contra o aluno toca
      // xeque, que é o que de fato aconteceu no tabuleiro.
      if (completo.isCheckmate()) playCheck();
      else playForMove({ capture: Boolean(jogada.captured), check: completo.isCheck() });
      practiceFinish(practiceKey, {
        result: fim.over ? fim.result : "draw",
        text: julgado.text,
        passed: false,
      });
      say(julgado.tone, julgado.text);
    },
    [practiceKey, practiceMove, practiceFinish, say, startFen, moves, goal, orientation],
  );

  /**
   * O lance do motor, como **efeito derivado** do estado da partida.
   *
   * Escrito assim — e não como chamada dentro do lance do aluno — quatro casos
   * saem de graça: o aluno jogando de pretas (o motor abre a partida),
   * recomeçar, trocar de posição na revisão, e o motor ficar pronto *depois* de
   * a etapa abrir.
   */
  useEffect(() => {
    if (!thinking) return;
    const daTentativa = attempt;
    const começou = performance.now();

    think(
      { fen: boardFen, skill: engine.skill, moveTimeMs: engine.moveTimeMs },
      (uci) => {
        // Carimbo da tentativa: o análogo do `drawn.attempt` do TreeStage.
        if (useLessonStore.getState().practices[practiceKey]?.attempt !== daTentativa) return;
        // O piso de atraso é medido desde o pedido, não a partir de agora: motor
        // que responde em 80 ms ainda espera; motor que leva 900 não espera nada.
        const espera = restingDelay(performance.now() - começou);
        timer.current = setTimeout(() => {
          timer.current = null;
          const atual = useLessonStore.getState().practices[practiceKey];
          if (!atual || atual.attempt !== daTentativa || atual.status !== "playing") return;
          // Último guarda-corpo, e o que torna o lance fantasma impossível em vez
          // de improvável: um lance ilegal na posição de agora não entra, venha
          // de onde vier.
          if (!applyUci(boardFen, uci)) {
            setSearchError({
              text: "O computador devolveu um lance impossível nesta posição.",
              key: practiceKey,
            });
            return;
          }
          registrar(uci, new Chess(boardFen));
        }, espera);
      },
      (mensagem) => setSearchError({ text: mensagem, key: practiceKey }),
    );

    return () => {
      abort();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [thinking, boardFen, attempt, practiceKey, engine.skill, engine.moveTimeMs, think, abort, registrar]);

  const play = useCallback(
    (orig: Key, dest: Key, promoted?: PromotionChoice) => {
      if (!interactive) return;
      registrar(`${orig}${dest}${promoted ?? ""}`, game);
    },
    [interactive, registrar, game],
  );

  const handleMove = useCallback(
    (orig: Key, dest: Key) => {
      if (!interactive) {
        setRevision((r) => r + 1);
        return;
      }
      const candidates = game.moves({ verbose: true }).filter((m) => m.from === orig && m.to === dest);
      if (candidates.length === 0) {
        setRevision((r) => r + 1);
        playRefusal();
        // A voz da F0: a recusa é explicada pela regra, não pela pedagogia —
        // aqui não há método a cobrar, só legalidade.
        say("bad", refusalReason(game, orig, dest), dest);
        return;
      }
      if (candidates.some((m) => m.promotion)) {
        setPromotion({ orig, dest, key: practiceKey });
        return;
      }
      play(orig, dest);
    },
    [game, interactive, play, say, practiceKey],
  );

  /** Recomeça a partida. Cancela o que o motor estava pensando. */
  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    abort();
    setPromotion(null);
    setSearchError(null);
    newGame();
    practiceRestart(practiceKey);
  }, [abort, newGame, practiceRestart, practiceKey]);

  if (!state) return null;

  const mate = game.isCheckmate();

  return (
    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start">
      <div
        ref={boardColumn}
        className="relative mx-auto w-full max-w-[min(88vw,26rem)] lg:mx-0 lg:w-104 lg:shrink-0"
        aria-busy={thinking}
      >
        <ChessBoard
          fen={boardFen}
          orientation={orientation}
          turnColor={turn}
          dests={interactive ? dests : new Map()}
          lastMove={lastMove}
          check={game.isCheck()}
          viewOnly={!interactive}
          revision={revision}
          shapes={shapes}
          matedKing={mate ? turn : null}
          onMove={handleMove}
        />
        <PulseRing tone={message && !message.done ? message.tone : null} seq={message?.seq ?? 0} />
        {promotion && (
          <PromotionPicker
            color={turn}
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
        {intro && verdict.kind === "playing" && (
          <p className="text-sm leading-relaxed text-tinta-media">{intro}</p>
        )}

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rotulo text-tinta-fraca">
          {/* O empate por falta de progresso deixa de cair do céu no lance 100. */}
          <span>
            Sem progresso: {progress.used} de {progress.limit}
          </span>
          {attempt > 1 && <span>· tentativa {attempt}</span>}
          {thinking && <span className="text-metodo/80">· pensando…</span>}
        </p>

        <FeedbackPanel
          message={panel}
          placeholder="Partida de verdade: o computador defende com tudo o que sabe. Quem decide é o resultado, não o lance."
        />

        {engineStatus === "loading" && (
          <p className="rounded-lg border border-dica-superficie/30 bg-dica-superficie/5 px-4 py-3 text-sm leading-relaxed text-dica-tinta">
            Carregando o computador — {formatBytes(engineTotalBytes())}, só na primeira vez.
          </p>
        )}

        {(engineStatus === "failed" || searchError) && (
          <div className="flex flex-col gap-3 rounded-lg border border-aviso-superficie/30 bg-aviso-superficie/5 px-4 py-3">
            {/* Âmbar, não rubro: não foi o aluno que errou. */}
            <p className="text-sm leading-relaxed text-aviso-tinta">
              {searchError ?? "Não consegui carregar o computador."} Confira a conexão e tente de
              novo. As etapas com ajuda e sem ajuda continuam disponíveis.
            </p>
            <div>
              <LessonButton
                variant="primary"
                onClick={() => {
                  setSearchError(null);
                  retry();
                }}
              >
                Tentar de novo
              </LessonButton>
            </div>
          </div>
        )}

        {verdict.kind !== "playing" && seal}

        <div className="flex flex-wrap gap-2">
          {verdict.kind === "passed" && onFinish && (
            <LessonButton variant="primary" onClick={onFinish}>
              {finishLabel ?? "Continuar"}
            </LessonButton>
          )}
          {verdict.kind === "failed" && (
            <LessonButton variant="primary" onClick={restart}>
              Recomeçar a partida
            </LessonButton>
          )}
          {(verdict.kind === "passed" || (verdict.kind === "playing" && (moves?.length ?? 0) > 0)) && (
            <LessonButton onClick={restart}>Recomeçar a partida</LessonButton>
          )}
        </div>
      </div>

      <Confetti seq={celebration} originRef={boardColumn} />
    </div>
  );
}
