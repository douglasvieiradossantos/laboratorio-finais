# Motor de xadrez — proveniência

Os dois arquivos binários desta pasta são o **Stockfish** compilado para
WebAssembly. São o adversário da **etapa 5** da aula (prática real), carregado
num Web Worker só quando o aluno abre aquela etapa.

Não são código deste projeto. Estão versionados aqui, e não instalados pelo
npm, pelo motivo registrado no `README.md` (§"O motor da etapa 5"): o pacote
completo ocupa 251 MB para entregar os 7,3 MB usados.

## Identidade

| | |
|---|---|
| Projeto | [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) — Stockfish compilado com Emscripten |
| Motor | Stockfish 18 |
| Versão do pacote | `stockfish@18.0.8` (publicada em 2026-06-15) |
| Variante | `lite-single` — rede NNUE reduzida, **uma thread** |
| Licença | **GPL-3.0** |
| Fonte do Stockfish | <https://github.com/official-stockfish/Stockfish> |

| Arquivo | Bytes | sha256 |
|---|---|---|
| `stockfish-18.0.8-lite-single.js` | 21.429 | `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391` |
| `stockfish-18.0.8-lite-single.wasm` | 7.295.411 | `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1` |

Os arquivos foram renomeados na entrada para carregar o número da versão. O
nome upstream (`stockfish-18-lite-single.*`) é o mesmo em 18.0.1 e em 18.0.8, e
o `next.config.ts` marca esta pasta como `immutable` no cache do navegador —
com nome reaproveitado, um aluno receberia bytes velhos para sempre.

**Regra que sustenta o `immutable`: trocar os bytes exige trocar o nome.** Nunca
sobrescreva um arquivo daqui; traga arquivos novos e atualize
`lib/engine/build.ts`.

## Como reproduzir estes arquivos

```sh
curl -L -o public/engine/stockfish-18.0.8-lite-single.js \
  https://unpkg.com/stockfish@18.0.8/bin/stockfish-18-lite-single.js
curl -L -o public/engine/stockfish-18.0.8-lite-single.wasm \
  https://unpkg.com/stockfish@18.0.8/bin/stockfish-18-lite-single.wasm

sha256sum public/engine/stockfish-18.0.8-lite-single.*
```

Os hashes precisam bater com a tabela acima. O `lib/engine/manifest.test.ts`
cobra isso a cada `npm test`, no Windows da autoria e no Linux do CI — as duas
plataformas onde a conversão de fim de linha divergiria se a isenção
`public/engine/** binary` do `.gitattributes` fosse desfeita.

## Por que a variante de uma thread

A variante multi-thread exige `SharedArrayBuffer`, que por sua vez exige os
cabeçalhos de isolamento de origem (`COOP`/`COEP`) em toda página que cria o
worker. A `lite-single` dispensa os dois — conferido por varredura, e o
`manifest.test.ts` mantém a conferência viva. Para os finais de 3 e 4 peças do
N0 ela já joga muito acima do necessário; a força que o aluno enfrenta é
limitada por aula, no campo `engine.skill` do arquivo da aula.

## Obrigação da GPL

Distribuir estes binários obriga a oferecer o código-fonte correspondente. Ele
está nos dois links acima, e a versão exata está nomeada — é o que torna a
oferta verificável.
