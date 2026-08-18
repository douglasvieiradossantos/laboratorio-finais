/**
 * O catálogo das três direções — TEMPORÁRIO, sai no B6.5.
 *
 * Aqui mora só o que é texto: nome proposto, registro, papéis tipográficos e o
 * custo declarado. **Nenhum valor de cor.** As cores estão em `direcoes.css`,
 * que é o que o navegador lê e o que o teste mede; duplicá-las aqui criaria um
 * segundo lugar para elas ficarem para trás.
 */

export type Direcao = {
  /** O valor de `data-direcao`, e a chave que o teste de contraste usa. */
  chave: string;
  /** Como a direção se chama nesta comparação. */
  rotulo: string;
  /** O nome proposto para o curso. Separável da direção: dá para misturar. */
  nome: string;
  /** Uma frase sobre o registro — o que a direção está tentando ser. */
  registro: string;
  /** A serifa, e onde ela é usada. */
  serifa: string;
  /** Quem fica com título, corpo e interface. */
  papeis: string;
  /** O custo em fonte, medido na build. */
  custo: string;
};

export const DIRECOES: Direcao[] = [
  {
    chave: "papel",
    rotulo: "A · Papel",
    nome: "Caderno de Finais",
    registro:
      "Creme quente e cor econômica. É um manual de finais impresso: o aluno lê um livro que responde. O verde só aparece onde há método; o resto é tinta sobre papel.",
    serifa: "Source Serif 4",
    papeis: "Serifa no título e no corpo. Sans só em rótulo, botão e numeral.",
    custo: "1 família variável, 49,7 KB no subconjunto latino — o que o navegador de fato baixa",
  },
  {
    chave: "manual",
    rotulo: "B · Manual",
    nome: "Laboratório de Finais",
    registro:
      "Branco neutro, tinta quase preta azulada, o contraste mais alto das três. Sóbrio, denso, sem calor — um manual técnico moderno, que combina com um site que mede tudo.",
    serifa: "Literata",
    papeis: "Sans no título e na interface, apertada. Serifa só no corpo da aula.",
    custo: "1 família variável, 51,5 KB no subconjunto latino — o que o navegador de fato baixa",
  },
  {
    chave: "ardosia",
    rotulo: "C · Ardósia",
    nome: "Escola de Finais",
    registro:
      "Papel cinza-esverdeado com o cartão branco por cima. A página é a parede, o cartão é a folha, o verde é o giz. O único dos três em que a página não é quase branca.",
    serifa: "Newsreader",
    papeis: "Serifa editorial só no título, grande. Corpo e interface em sans.",
    custo: "1 família variável, 56,8 KB no subconjunto latino — o que o navegador de fato baixa",
  },
];

export const PADRAO = DIRECOES[0].chave;
