import { ImageResponse } from "next/og";
import { MARCA } from "@/lib/tema/marca";

/**
 * A imagem que aparece quando alguém cola o link do curso num aplicativo de
 * mensagem. Ela é gerada na build, uma vez, e servida como PNG estático.
 *
 * O desenho repete o do ícone em grande — as quatro casas, o mesmo verde — para
 * o atalho na tela do celular e o link compartilhado serem reconhecíveis como a
 * mesma coisa. As cores vêm de `lib/tema/marca.ts`, e um teste as confere
 * contra os tokens do CSS.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Laboratório de Finais — curso interativo de finais de xadrez";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 64,
          width: "100%",
          height: "100%",
          padding: 88,
          background: MARCA.papel,
          color: MARCA.tinta,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", width: 260, height: 260, borderRadius: 28, background: MARCA.verde }}>
          <div style={{ width: "50%", height: "50%", background: MARCA.papel }} />
          <div style={{ width: "50%", height: "50%" }} />
          <div style={{ width: "50%", height: "50%" }} />
          <div style={{ width: "50%", height: "50%", background: MARCA.papel }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -1 }}>Laboratório de Finais</div>
          <div style={{ fontSize: 34, color: MARCA.verde }}>
            Aprenda no tabuleiro, não no vídeo.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
