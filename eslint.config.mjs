import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // O motor da etapa 5 é binário de terceiro, vendorizado e minificado
    // (Stockfish, GPL-3.0 — ver `public/engine/LEIA-ME.md`). Não é código
    // nosso, não é editável, e os bytes são conferidos por sha256 em
    // `lib/engine/manifest.test.ts` — que é a verificação que de fato importa
    // aqui. Lintá-lo só produz ruído sobre `require()` e variáveis de um
    // arquivo gerado por compilador.
    "public/engine/**",
  ]),
]);

export default eslintConfig;
