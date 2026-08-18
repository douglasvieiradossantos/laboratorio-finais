import { ImageResponse } from "next/og";
import { MARCA } from "@/lib/tema/marca";

/**
 * O ícone do iOS. Ele existe separado do `icon.svg` por duas exigências da
 * Apple: PNG (o Safari ignora SVG aqui) e **sem cantos arredondados nem
 * transparência** — o sistema recorta o canto sozinho, e um SVG já arredondado
 * apareceria com uma moldura branca em volta do arredondamento dele.
 *
 * Sem texto de propósito: o `ImageResponse` precisaria de uma fonte embarcada
 * para desenhar letra, e quatro casas dizem "xadrez" melhor que uma palavra em
 * 180 pixels.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const casa = { width: "50%", height: "50%", background: MARCA.papel };
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexWrap: "wrap", width: "100%", height: "100%", background: MARCA.verde }}>
        <div style={{ ...casa }} />
        <div style={{ width: "50%", height: "50%" }} />
        <div style={{ width: "50%", height: "50%" }} />
        <div style={{ ...casa }} />
      </div>
    ),
    size,
  );
}
