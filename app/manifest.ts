import type { MetadataRoute } from "next";
import { MARCA } from "@/lib/tema/marca";

/**
 * O manifesto — o que faz o curso virar atalho na tela do celular, abrindo sem
 * a barra do navegador. Para uma aula de xadrez isso não é enfeite: cada pixel
 * que a barra ocupa sai da altura do tabuleiro.
 *
 * `display: "standalone"` e não `"fullscreen"`: o relógio e a bateria continuam
 * visíveis, e quem estuda no ônibus precisa deles.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Laboratório de Finais",
    short_name: "Finais",
    description: "Curso interativo de finais de xadrez: aprenda no tabuleiro, não no vídeo.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: MARCA.papel,
    theme_color: MARCA.papel,
    icons: [{ src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" }],
  };
}
