import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { ENGINE_BUILD, engineTotalBytes, engineWorkerUrl, formatBytes } from "./build.ts";

/**
 * O gate de bytes do motor (plano da F1, §5 / bloco B4.1).
 *
 * **Por que isto morde.** O `.gitattributes` do projeto abre com
 * `* text=auto eol=lf`, e um binário sem isenção tem os fins de linha
 * reescritos no checkout — em silêncio. O repositório fica verde, os testes
 * passam, e o motor só quebra no navegador do aluno, com uma mensagem que não
 * aponta para lugar nenhum. É o mesmo bug que o comentário do `*.wav binary`
 * documenta, mudando só a extensão.
 *
 * Conferir sha256 aqui transforma essa classe inteira de falha — checkout
 * corrompido, cópia parcial, arquivo trocado por engano, `.gitattributes`
 * desfeito num merge — em CI vermelho. O teste roda no Windows da autoria e no
 * Linux do CI, que são justamente as duas plataformas onde a conversão diverge.
 */

const ENGINE_DIR = path.join(process.cwd(), "public", "engine");

function ler(url: string): Buffer {
  // A URL servida é `/engine/x`; no disco é `public/engine/x`.
  return readFileSync(path.join(ENGINE_DIR, path.basename(url)));
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

const cola = ler(ENGINE_BUILD.scriptUrl);
const wasm = ler(ENGINE_BUILD.wasmUrl);

test("os dois arquivos do motor têm exatamente o tamanho declarado", () => {
  assert.equal(cola.byteLength, ENGINE_BUILD.scriptBytes, "a cola .js mudou de tamanho");
  assert.equal(wasm.byteLength, ENGINE_BUILD.wasmBytes, "o .wasm mudou de tamanho");
});

test("os dois arquivos do motor têm exatamente o sha256 declarado", () => {
  assert.equal(sha256(cola), ENGINE_BUILD.scriptSha256, "sha256 da cola .js não bate");
  assert.equal(sha256(wasm), ENGINE_BUILD.wasmSha256, "sha256 do .wasm não bate");
});

test("o .wasm começa com os bytes mágicos do WebAssembly", () => {
  // Se a conversão de fim de linha tiver passado por cima, é aqui que o
  // diagnóstico fica legível — antes de o navegador dizer só "falha ao compilar".
  assert.deepEqual([...wasm.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d], "não é um .wasm");
});

test("a cola não usa SharedArrayBuffer nem Atomics — é a build de uma thread", () => {
  // O que sustenta `needsCrossOriginIsolation: false`, e portanto a decisão de
  // não emitir COOP/COEP. Se um dia alguém trocar os arquivos pela variante
  // multi-thread sem perceber, a etapa 5 morreria no celular; este teste avisa.
  const fonte = cola.toString("utf8");
  assert.equal(fonte.includes("SharedArrayBuffer"), false, "a build exige isolamento de origem");
  assert.equal(fonte.includes("Atomics"), false, "a build exige isolamento de origem");
  assert.equal(ENGINE_BUILD.needsCrossOriginIsolation, false);
});

test("a URL do worker declara o .wasm no fragmento, percent-encoded", () => {
  const url = engineWorkerUrl(ENGINE_BUILD, "https://exemplo.test");
  const [script, fragmento] = url.split("#");
  assert.equal(script, ENGINE_BUILD.scriptUrl);
  assert.equal(decodeURIComponent(fragmento), `https://exemplo.test${ENGINE_BUILD.wasmUrl}`);
  // A cola faz `hash.substr(1).split(",")` — vírgula crua truncaria a URL.
  assert.equal(fragmento.includes(","), false, "vírgula não escapada no fragmento");
});

test("o peso total é o que a tela promete ao aluno", () => {
  assert.equal(engineTotalBytes(), cola.byteLength + wasm.byteLength);
  assert.equal(formatBytes(engineTotalBytes()), "7,3 MB");
});
