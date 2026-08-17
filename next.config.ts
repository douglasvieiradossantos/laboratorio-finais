import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * O motor da etapa 5 são 7,3 MB servidos de `public/engine/`. O padrão do
   * Next para `public/` é `max-age=0, must-revalidate`: correto para conteúdo
   * que muda, caro para um binário que nunca muda — cada aluno que reabre a
   * etapa paga um round-trip antes do primeiro lance.
   *
   * `immutable` só é honesto porque **o nome carrega a versão**
   * (`stockfish-18.0.8-lite-single.wasm`). A regra que sustenta isso: trocar os
   * bytes exige trocar o nome. Um dia atualizar o motor é mexer no
   * `lib/engine/build.ts` e trazer arquivos novos — nunca sobrescrever estes.
   *
   * Isto é otimização, não requisito: se a hospedagem não honrar o cabeçalho
   * sobre `public/`, o padrão ainda devolve 304 com os bytes já em disco.
   */
  async headers() {
    return [
      {
        source: "/engine/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
