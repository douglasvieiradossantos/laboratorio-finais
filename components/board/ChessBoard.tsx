"use client";

import { useEffect, useRef } from "react";
import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { DrawBrush, DrawBrushes, DrawShape } from "@lichess-org/chessground/draw";
import type { Color, Dests, Key } from "@lichess-org/chessground/types";

/**
 * Os quatro pincéis pedagógicos, lidos dos tokens de `app/globals.css`.
 *
 * **Por que uma ponte em JavaScript e não em CSS.** A tabela de pincéis do
 * chessground é um objeto literal (`state.js`), e o `svg.js` grava a cor como
 * **atributo de apresentação** — `stroke="#882020"` —, onde `var()` não é
 * sintaxe válida. Não existe seletor que alcance aquilo. A única porta é
 * `drawable.brushes`, e é por ela que a identidade visual chega ao desenho.
 *
 * A leitura é uma só, na montagem: `getComputedStyle` força o cálculo de
 * estilo, e chamá-lo a cada desenho custaria caro à toa — os tokens não mudam
 * durante a vida de um tabuleiro. Quem trocar de direção no B6.3 remonta o
 * componente por `key`, e a leitura acontece de novo.
 *
 * **O alfa mora aqui, e não mais num multiplicador escondido.** O
 * `.cg-shapes { opacity: .6 }` do pacote multiplicava todos os pincéis de uma
 * vez: dois com o mesmo número nesta tabela saíam com transparências
 * diferentes do que ela dizia, e não havia como ajustar um sem mexer no outro.
 * Ele foi a 1 em `globals.css`, e os números abaixo passaram a ser os de
 * verdade.
 *
 * Três são opacos porque são traço fino — um aro em volta de uma casa. O corte
 * é o único translúcido: ele pinta a parede inteira, seis a oito casas de uma
 * vez, e opaco viraria um bloco. A 0,55 ele mede 3,67:1 contra a casa clara e
 * 3,11:1 contra a escura, acima do piso de 3:1 de componente de interface.
 */
const PINCEIS = [
  // A espessura é o segundo canal do par que se confunde: `pendurada` e
  // `defendida` são o mesmo aro com sentidos opostos, e 14 contra 9 os separa
  // mesmo em escala de cinza, onde a cor não separa.
  { nome: "green", token: "--color-pincel-defendida", opacity: 1, lineWidth: 9 },
  { nome: "red", token: "--color-pincel-pendurada", opacity: 1, lineWidth: 14 },
  { nome: "blue", token: "--color-pincel-seta", opacity: 1, lineWidth: 10 },
  { nome: "paleRed", token: "--color-pincel-corte", opacity: 0.55, lineWidth: 15 },
] as const;

function pinceis(host: HTMLElement): Partial<DrawBrushes> {
  const estilo = getComputedStyle(host);
  const tabela: Record<string, DrawBrush> = {};
  for (const { nome, token, opacity, lineWidth } of PINCEIS) {
    const cor = estilo.getPropertyValue(token).trim();
    // Token ausente daria um pincel invisível e um bug mudo. Melhor gritar no
    // console e deixar o padrão do pacote de pé.
    if (!cor) {
      console.error(`ChessBoard: o token ${token} não existe na folha de estilo`);
      continue;
    }
    tabela[nome] = { key: nome, color: cor, opacity, lineWidth };
  }
  return tabela;
}


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
  /**
   * Lado que acabou de ser matado — o rei dele pulsa três vezes. Sai como
   * `data-mate` no host, e **não** como classe: o chessground escreve `cg-wrap`,
   * `orientation-*` e `manipulable` no mesmo elemento cujo `className` o React
   * controla, e só as reescreve na criação e no giro do tabuleiro. Se o React
   * reatribuísse `class`, elas sumiriam. Atributo `data-*` é escrito isolado.
   *
   * Qual rei vem explícito, e não derivado da orientação: assim continua certo
   * se uma aula futura ensinar o lado da defesa.
   */
  matedKing?: Color | null;
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
  matedKing = null,
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
      drawable: {
        enabled: false,
        visible: true,
        // O tipo do pacote exige a tabela inteira — os doze pincéis —, mas o
        // `configure()` dele faz `deepMerge`: o que não vier aqui continua
        // valendo o padrão. Trocamos os quatro que a aula usa e mais nada.
        brushes: pinceis(host) as DrawBrushes,
      },
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
      data-mate={matedKing ?? undefined}
      className="cg-wrap aspect-square w-full touch-none select-none"
    />
  );
}
