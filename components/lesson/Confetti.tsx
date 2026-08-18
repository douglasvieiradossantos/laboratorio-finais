"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Confete de fim de etapa, em canvas puro — nenhuma dependência nova para uma
 * animação de três segundos.
 *
 * `seq` é um contador: cada vez que ele sobe, o confete dispara. Quem conclui
 * a etapa incrementa; remontar o componente zera, então voltar a uma etapa já
 * concluída não festeja de novo.
 *
 * O canvas cobre **a etapa inteira** (tabuleiro e painel), mas as partículas
 * nascem do tabuleiro: `originRef` é medido contra o rect do canvas, o que
 * resolve os dois layouts sem farejar breakpoint. No celular a coluna está no
 * topo, a explosão sai do tabuleiro e a chuva cai sobre o painel; no desktop a
 * coluna está à esquerda e o confete se espalha para a direita, por cima do
 * painel.
 *
 * **Respeita `prefers-reduced-motion`**: para quem pediu menos movimento nada é
 * desenhado — a mensagem de conclusão no painel já diz o que precisava dizer.
 */

const PARTICLES = 150;
/** ≈3,3s a 60fps. O pedido era "mais devagar": eram 110 quadros (1,8s). */
const FRAMES = 200;
/** Gravidade por quadro. Leve, para o papel flutuar. */
const GRAVITY = 0.15;
/**
 * Velocidade terminal, em pixels por quadro. É a alavanca principal do "mais
 * devagar": sem ela a queda acelera indefinidamente e o confete vira cascalho.
 */
const TERMINAL_VY = 6;
/** Arrasto horizontal por quadro. */
const DRAG = 0.985;
/** Cor cheia até aqui; o fade mora nos 30% finais. */
const FADE_FROM = 0.7;
/** A segunda onda sai 0,2s depois — ênfase sem dobrar a densidade. */
const WAVE_DELAY_FRAMES = 12;
/**
 * As cores saem dos tokens, não de uma lista de hexadecimais.
 *
 * Antes eram seis literais herdados da F0, e dois deles já estavam errados: um
 * `#f8fafc` quase branco, que some sobre papel claro, e um `#f472b6` que não
 * pertencia a paleta nenhuma. Agora são os quatro papéis semânticos, com o
 * verde do método entrando duas vezes para o confete ficar amarrado ao painel
 * que o disparou.
 *
 * A leitura é **uma por explosão**, não uma por quadro: `getComputedStyle`
 * força o cálculo de estilo, e são 200 partículas a 60 quadros por segundo.
 */
const TOKENS = [
  "--color-metodo",
  "--color-metodo",
  "--color-metodo-cheio",
  "--color-dica-superficie",
  "--color-aviso",
  "--color-erro",
];

function paleta(elemento: Element): string[] {
  const estilo = getComputedStyle(elemento);
  return TOKENS.map((token) => estilo.getPropertyValue(token).trim() || "currentColor");
}

export function Confetti({
  seq,
  originRef,
}: {
  seq: number;
  /** De onde as partículas saem; ausente = o centro do canvas. */
  originRef?: RefObject<HTMLElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (seq === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COLORS = paleta(canvas);

    const rect = canvas.getBoundingClientRect();
    const { width, height } = rect;
    if (width === 0 || height === 0) return;
    // Teto de 2 no dpr: num celular 3× a etapa inteira daria um bitmap de
    // ~2,9 Mpx para limpar e repintar 200 vezes.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Mexer em width/height zera a transformação do contexto — daí o scale vir
    // depois, e não antes.
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.scale(dpr, dpr);

    // A origem, medida contra o canvas. Ausente ou fora da tela cai no centro.
    const origin = originRef?.current?.getBoundingClientRect();
    const originX = origin ? origin.left - rect.left + origin.width / 2 : width / 2;
    const originY = origin ? origin.top - rect.top + origin.height * 0.45 : height * 0.45;
    const spreadX = (origin?.width ?? width) * 0.4;

    const pieces = Array.from({ length: PARTICLES }, (_, index) => {
      // O ápice sai da altura, não de um número fixo: `v0 = √(2·g·h)` põe o
      // topo do arco entre 28% e 62% da altura do canvas em qualquer layout.
      const apex = height * (0.28 + Math.random() * 0.34);
      return {
        x: originX + (Math.random() - 0.5) * spreadX,
        y: originY,
        // Escala com o layout, em vez de ser um ±3,5 fixo.
        vx: (Math.random() - 0.5) * width * 0.026,
        vy: -Math.sqrt(2 * GRAVITY * apex),
        size: 5 + Math.random() * 6,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.16,
        /** O flutter achata a fita: compra a ilusão de papel virando no ar. */
        flutter: Math.random() * Math.PI * 2,
        flutterSpeed: 0.08 + Math.random() * 0.09,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: index % 2 === 0 ? 0 : WAVE_DELAY_FRAMES,
      };
    });

    let frame = 0;
    let handle = 0;

    const clear = () => ctx.clearRect(0, 0, width, height);

    const draw = () => {
      frame += 1;
      clear();
      const fade =
        frame < FRAMES * FADE_FROM
          ? 1
          : Math.max(0, 1 - (frame - FRAMES * FADE_FROM) / (FRAMES * (1 - FADE_FROM)));

      for (const piece of pieces) {
        if (frame <= piece.delay) continue;
        piece.vy = Math.min(piece.vy + GRAVITY, TERMINAL_VY);
        piece.vx *= DRAG;
        piece.flutter += piece.flutterSpeed;
        piece.x += piece.vx + Math.cos(piece.flutter) * 0.6;
        piece.y += piece.vy;
        piece.angle += piece.spin;

        // A fita vista de lado: a largura desenhada encolhe com o flutter.
        const squash = 0.25 + 0.75 * Math.abs(Math.cos(piece.flutter));
        const w = piece.size * squash;
        const h = piece.size * 0.42;

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.angle);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }

      if (frame < FRAMES) handle = requestAnimationFrame(draw);
      else clear();
    };

    // Girar a tela no meio dos 3,3s esticaria o bitmap; abortar é mais honesto
    // (e muito mais barato) do que re-medir tudo a cada quadro.
    const abort = () => {
      cancelAnimationFrame(handle);
      clear();
    };
    window.addEventListener("resize", abort);

    handle = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", abort);
      abort();
    };
  }, [seq, originRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    />
  );
}
