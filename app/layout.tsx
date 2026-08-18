import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { MARCA } from "@/lib/tema/marca";
import "@lichess-org/chessground/assets/chessground.base.css";
import "@lichess-org/chessground/assets/chessground.cburnett.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

/**
 * A serifa do título. Só o título: um Newsreader de 14 px lê pior que a Inter
 * de 14 px, e o corpo da aula tem exatamente 14 px. A serifa entra onde o
 * tamanho a sustenta — ver a utilitária `titulo` em `app/globals.css`.
 *
 * O português cabe no subconjunto latino (á à â ã ç é ê í ó ô õ ú estão todos
 * no Latin-1), então `latin-ext` seria arquivo em disco sem download. São
 * 56,8 KB, medidos na build.
 */
const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Laboratório de Finais",
  description:
    "Curso interativo de finais de xadrez: aprenda no tabuleiro, não no vídeo.",
};

export const viewport: Viewport = {
  // A barra do navegador não lê var(). O hexadecimal vem de
  // lib/tema/marca.ts, que é o único lugar onde a cor existe fora do CSS e
  // que lib/tema/guardas.test.ts confere contra os tokens.
  themeColor: MARCA.papel,
  // Sem isto o Android escurece por conta própria os controles nativos — barra
  // de rolagem, campo de número do laboratório do motor — dentro de uma página
  // clara. Faltava desde a F0, e só agora tem resposta certa para dar.
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-papel text-tinta">
        {children}
      </body>
    </html>
  );
}
