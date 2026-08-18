import { Literata, Newsreader, Source_Serif_4 } from "next/font/google";

/**
 * As três serifas candidatas — TEMPORÁRIO, sai no B6.5.
 *
 * Elas são carregadas **aqui** e não no layout da raiz de propósito: assim só
 * quem abre `/direcoes` paga por três famílias, e o resto do site continua com
 * a Inter sozinha. No B6.5 a vencedora sobe para `app/layout.tsx` e as outras
 * duas somem junto com esta pasta.
 *
 * `display: "swap"` para o texto aparecer na hora com a fonte de sistema e
 * trocar quando a serifa chegar: numa rota de comparação, esperar a fonte é
 * comparar tela em branco.
 */

const papel = Source_Serif_4({
  variable: "--fonte-papel",
  subsets: ["latin"],
  display: "swap",
});

const manual = Literata({
  variable: "--fonte-manual",
  subsets: ["latin"],
  display: "swap",
});

const ardosia = Newsreader({
  variable: "--fonte-ardosia",
  subsets: ["latin"],
  display: "swap",
});

export default function DirecoesLayout({ children }: LayoutProps<"/direcoes">) {
  // `display: contents` faz esta `<div>` não gerar caixa nenhuma: as três
  // variáveis de fonte cascateiam para dentro, e o `flex-1` do `<main>`
  // continua respondendo ao `<body>` como se ela não existisse.
  return (
    <div className={`contents ${papel.variable} ${manual.variable} ${ardosia.variable}`}>
      {children}
    </div>
  );
}
