/**
 * As três cores da marca em hexadecimal, para os lugares que **não conseguem**
 * ler CSS.
 *
 * São quatro deles, e nenhum é evitável: a barra do navegador lê `themeColor`
 * do metadata; o `manifest` é JSON servido fora do documento; o ícone do iOS e
 * a imagem de compartilhamento são PNG gerados na build, dentro de um
 * renderizador que não tem folha de estilo nenhuma.
 *
 * O ganho de existir este arquivo é que os quatro passam a ler do mesmo lugar,
 * e esse lugar é conferido contra o CSS por `guardas.test.ts`. Antes de existir
 * ele, cada um carregava o próprio literal — quatro pares para se desfazerem
 * em silêncio na próxima vez que a paleta mudar.
 *
 * O `app/icon.svg` continua de fora: é um arquivo estático, não importa nada.
 * O guarda o confere separado.
 */
export const MARCA = {
  /** `--color-papel`. O fundo da página, e a cor da barra do navegador. */
  papel: "#ebf0ec",
  /** `--color-metodo-cheio`. O verde do botão primário, e o fundo do ícone. */
  verde: "#15552e",
  /** `--color-tinta`. */
  tinta: "#1e2621",
} as const;
