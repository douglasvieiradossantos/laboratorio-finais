/**
 * A build do motor de xadrez — a constante que isola o Stockfish do resto do
 * projeto (plano da F1, §5).
 *
 * **Trocar de motor é trocar este objeto e os dois arquivos de
 * `public/engine/`.** Nenhum componente, nenhuma store e nenhuma outra lib
 * conhece nome de arquivo, versão ou variante: quem precisa do motor pede a
 * `lib/engine/stockfish.ts`, que lê daqui.
 *
 * Por que os arquivos estão versionados no repositório em vez de virem do npm:
 * o pacote `stockfish@18.0.8` ocupa 251.054.382 bytes descompactados para
 * entregar os 7.316.840 que usamos — 2,9%. Tomá-lo como dependência faria todo
 * `npm ci` (CI a cada push, hospedagem a cada deploy) pagar 251 MB, e o
 * `postinstall` dele ainda copia uma variante de 107 MB que nunca serviríamos.
 * É a mesma disciplina de `content/tablebase-cache/`: o artefato determinístico
 * entra no repositório para o CI não depender de rede nem de peso.
 *
 * Como reproduzir os arquivos (autoria, não CI):
 *
 * ```sh
 * curl -L -o public/engine/stockfish-18.0.8-lite-single.js \
 *   https://unpkg.com/stockfish@18.0.8/bin/stockfish-18-lite-single.js
 * curl -L -o public/engine/stockfish-18.0.8-lite-single.wasm \
 *   https://unpkg.com/stockfish@18.0.8/bin/stockfish-18-lite-single.wasm
 * ```
 *
 * O `lib/engine/manifest.test.ts` confere tamanho e sha256 contra o que está
 * aqui — é o que pega um `.gitattributes` mal configurado ou um checkout
 * corrompido no CI, e não no celular do aluno.
 */

export type EngineBuild = {
  /** Identidade legível, usada em log e na bancada `/motor`. */
  id: string;
  /** Caminho servido do script-cola (o "worker" propriamente dito). */
  scriptUrl: string;
  /** Caminho servido do WebAssembly que a cola instancia. */
  wasmUrl: string;
  scriptBytes: number;
  wasmBytes: number;
  scriptSha256: string;
  wasmSha256: string;
  /**
   * Esta build exige isolamento de origem (os cabeçalhos COOP/COEP que
   * `SharedArrayBuffer` pede)? A variante `lite-single` roda numa thread só e
   * **não** exige — conferido por varredura: a cola não menciona
   * `SharedArrayBuffer` nem `Atomics`. É o que nos poupa de mexer em cabeçalho
   * de resposta e o que mantém a etapa 5 funcionando em navegador de celular.
   */
  needsCrossOriginIsolation: boolean;
};

export const ENGINE_BUILD: EngineBuild = {
  id: "stockfish-18.0.8-lite-single",
  scriptUrl: "/engine/stockfish-18.0.8-lite-single.js",
  wasmUrl: "/engine/stockfish-18.0.8-lite-single.wasm",
  scriptBytes: 21_429,
  wasmBytes: 7_295_411,
  scriptSha256: "5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391",
  wasmSha256: "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
  needsCrossOriginIsolation: false,
};

/** O peso total do motor, para a tela poder dizer ao aluno o que está baixando. */
export function engineTotalBytes(build: EngineBuild = ENGINE_BUILD): number {
  return build.scriptBytes + build.wasmBytes;
}

/** "7,3 MB" — o número como o aluno lê, não como o disco conta. */
export function formatBytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`;
}

/**
 * A URL do worker, com o `.wasm` declarado no fragmento.
 *
 * A cola do stockfish.js resolve o WebAssembly assim (lido no arquivo real):
 *
 * ```js
 * e = self.location.hash.substr(1).split(",")
 * u = decodeURIComponent(e[0] || location.origin + location.pathname.replace(/\.js$/i, ".wasm"))
 * ```
 *
 * Ou seja: sem o fragmento ela **deriva** o nome do `.wasm` do nome do `.js`.
 * Isso funcionaria — os dois arquivos têm o mesmo nome base de propósito — mas
 * seria uma dependência invisível entre dois campos deste arquivo e o
 * empacotador. Passar a URL absoluta explícita custa uma linha e tira a
 * adivinhação do caminho.
 *
 * `encodeURIComponent` é obrigatório e não decorativo: a cola separa o
 * fragmento por vírgula (`split(",")`), e um caminho com vírgula crua truncaria
 * a URL.
 */
export function engineWorkerUrl(
  build: EngineBuild = ENGINE_BUILD,
  origin: string = typeof location === "undefined" ? "" : location.origin,
): string {
  const absoluteWasm = `${origin}${build.wasmUrl}`;
  return `${build.scriptUrl}#${encodeURIComponent(absoluteWasm)}`;
}
