import type { HTMLAttributes } from "react";

/**
 * O chessground desenha as peças com uma tag própria, <piece>. Para reusar
 * esses mesmos desenhos fora do tabuleiro (o seletor de promoção, por exemplo)
 * o TypeScript precisa saber que essa tag existe no JSX.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      piece: HTMLAttributes<HTMLElement>;
    }
  }
}
