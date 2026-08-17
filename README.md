# Laboratório de Finais

Curso interativo de finais de xadrez, em português, para quem já sabe mover as
peças. O aluno aprende **no tabuleiro**: vê a técnica, executa com ajuda,
executa sozinho, e prova que sabe jogando contra um motor de verdade.

O mapa do projeto está em [`docs/00-PLANO-MESTRE.md`](docs/00-PLANO-MESTRE.md);
o conteúdo a ensinar está em [`docs/CURRICULO.md`](docs/CURRICULO.md).

## Estado: F1 — motor de aula (em execução)

A F0 entregou a base: site de pé, tabuleiro jogável, publicação e CI. A F1
([`docs/01-PLANO-F1.md`](docs/01-PLANO-F1.md)) está no bloco B1: o formato de
dados da aula e o gate de conteúdo existem; o motor na tela ainda não.

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:3000
```

## Gates

Os três comandos que o CI roda a cada push. Rode-os antes de commitar:

```bash
npm run typecheck  # next typegen + tsc --noEmit
npm run lint       # eslint
npm run build      # next build
```

`typecheck` roda `next typegen` antes do `tsc` porque o Next.js gera tipos de
rota (`LayoutProps`, `PageProps`) que só existem depois dessa geração.

## Conteúdo: posições e aulas

O conteúdo é dado, não código: `content/positions/` (uma posição por arquivo,
com proveniência) e `content/lessons/` (uma aula por competência). O formato
é o schema zod de [`lib/lesson/schema.ts`](lib/lesson/schema.ts).

```bash
npm run validate:content       # confere tudo offline, a partir do cache
npm run validate:mutations     # testa o gate contra si mesmo (9 estragos plantados)
```

A verdade xadrezística de cada posição vem da **tablebase Syzygy** (API do
Lichess), nunca do palpite de quem escreve a aula: o validador gera a lista de
lances que preservam a vitória, confere o resultado esperado e mede a
resistência da defesa. A rede só é usada na autoria; as respostas ficam
versionadas em `content/tablebase-cache/` e o gate roda offline a partir delas.

```bash
# autoria (única situação em que a rede é usada):
npm run validate:content -- --refresh-cache --write   # busca o que falta e grava o que é derivado
npm run validate:content -- --prune-cache             # remove cache que nenhuma posição usa
```

### Ramos equivalentes: derivados, não escritos

Nem toda técnica tem um lance só. Na etapa 4 do mate de torre, `Th7` corta tão
bem quanto `Tb1` — e recusar o aluno ali seria ensinar roteiro, não técnica.

O `--write` deriva esses caminhos e os grava no arquivo, do mesmo jeito que já
faz com o `winningMoves`: quem decide o que é "a mesma técnica" é o predicado
de [`lib/chess/technique.ts`](lib/chess/technique.ts) (a caixa que sobra para o
rei inimigo), e quem escolhe os lances da continuação é a tablebase, dentro do
que a técnica admite. Os textos são do autor, em `generatedTemplates`.

**Runtime não sabe de nada disso.** Um ramo gerado é um nó comum, com expects
comuns; os campos `generated: true` só marcam o que o gerador regrava. A etapa
3 não ganha ramo — lá o lance equivalente vira `methodAlternatives`, o aluno é
elogiado e a peça volta, para a linha escrita continuar valendo.

Rodando **sem** `--write`, o validador recomputa tudo e compara com o gravado:
editar o ramo à mão fica vermelho (`RAMO_DESATUALIZADO`), e é a 9ª mutação
plantada do `validate:mutations`.

## Pilha

| Peça | Para quê |
|---|---|
| Next.js (App Router) + TypeScript | O site; tudo estático ou rodando no navegador |
| Tailwind CSS v4 | Estilo |
| [`@lichess-org/chessground`](https://github.com/lichess-org/chessground) | O tabuleiro (o mesmo do Lichess) |
| [`chess.js`](https://github.com/jhlywa/chess.js) | As regras: valida lances, gera FEN, detecta mate/afogamento |
| Zustand | Estado da interface (ainda não usado na F0) |
| Vercel | Publicação |

### Licença das dependências

`@lichess-org/chessground` é **GPL-3.0-or-later**. Como ele entra no pacote
JavaScript enviado ao navegador, o site distribuído fica sujeito à GPL. Isso
está registrado aqui de propósito: se um dia o projeto precisar ser fechado ou
licenciado de outro jeito, o tabuleiro é a peça a trocar.

### Som: sintetizado, derivado de medição

**Os seis efeitos tocam sintetizados.** A busca por um pacote gravado foi feita,
13 candidatos CC0 do Kenney foram convertidos, medidos e ouvidos — e **nenhum foi
aprovado**. `lance`, `acerto` e `conclusao` ficaram na síntese original;
`captura`, `xeque` e `recusa` foram **re-sintetizados a partir da medição
espectral** de sons de referência, porque a síntese anterior deles estava na
família de som errada.

**A medição é o método, e ela está no repositório.**
[`lib/spectrum.ts`](lib/spectrum.ts) faz FFT de 2048 pontos com janela de Hann e
envelope RMS em janelas de 5 ms; [`lib/spectrum.test.ts`](lib/spectrum.test.ts) o
afere contra sinais de resposta conhecida (seno puro, ruído branco, decaimento
exponencial, platô). A rota `/sons` renderiza cada síntese num
`OfflineAudioContext` e mostra as medidas ao lado do alvo. É o que permite dizer
"o xeque ficou mais brilhante" com um número em vez de opinião de quem não
escutou.

Três diagnósticos que a medição deu, e que o ouvido sozinho não daria:

| efeito | o que estava errado | o número |
|---|---|---|
| captura | era ruído filtrado, e a referência é **tonal** | achatamento espectral 0,017 na referência |
| xeque | era melodia de duas notas; a referência é um toque **curto e brilhante** com dois transientes | −40 dB em 35 ms, picos em 15 e 25 ms, centroide 3613 Hz no ataque |
| recusa | deslizava decaindo; a referência é **platô e corte** | dentro de 6 dB do pico de 10 a 95 ms, depois penhasco |

**Sobre a referência e a licença.** Os sons medidos são proprietários (Chess.com),
e **nenhum byte deles entra no projeto**: o que entra são as medidas registradas
em `Reference`, no catálogo, e síntese nossa escrita a partir delas. Medir o
espectro de um som para escrever outro parecido é o que se faz ao ouvir uma
referência e compor; copiar o arquivo não seria.

**Duas armadilhas de método, aprendidas errando:**

- **Confie no RMS, não no pico.** A camada de ruído usa `Math.random()`, então o
  pico oscila ~1,5 dB entre renderizações da mesma síntese. O equilíbrio de hoje,
  por RMS: conclusão −33,4 · captura −36,4 · acerto −38,8 · xeque −39,4 · lance
  −42,5 · recusa −44,8 dBFS.
- **Medir no lugar errado é pior que não medir.** A primeira síntese do xeque
  durou 170 ms porque eu li o centroide da fatia de 100 ms como "cauda
  brilhante" — só que ali a referência já está 40 dB abaixo do pico, e aquele
  número descreve um resíduo inaudível. O Doug reprovou, e com razão.
- **Brilho por parcial discreta, não por ruído.** Centroide e achatamento sobem
  *juntos* quando o agudo vem de ruído, porque ruído espalha energia por centenas
  de bins: subir o centroide do xeque para 3329 Hz levava o achatamento a 0,226
  (alvo 0,028), e baixar o ruído derrubava o centroide para 2814. Parciais
  discretas em 2950 · 3450 · 3900 · 5100 Hz rompem o empate — massa no agudo sem
  espalhamento.

**Variante é como uma opção de som existe antes de ser escolhida.** Ajustar uma
síntese sobrescrevendo a anterior perde o ponto de comparação — na rodada seguinte
não há como voltar nem como ouvir as duas lado a lado. Cada efeito tem uma ou mais
variantes em `VARIANTS`, e o `chosenVariant` do catálogo diz qual toca; a `/sons`
renderiza e mede todas. **Os ids são rótulos históricos da decisão, não índices** —
o xeque é `v2`, e não existe `v1` nele.

Hoje há **uma variante por efeito**: os seis sons estão decididos e as descartadas
saíram do código. A lista continua sendo lista para quando um som voltar a ser
questionado. O gate de [`lib/sound-catalog.test.ts`](lib/sound-catalog.test.ts)
cobra que dado e código não divirjam: toda variante declarada tem corpo, todo corpo
tem declaração, e o `chosenVariant` aponta para algo que existe.

O xeque foi decidido assim: quatro hipóteses escritas, medidas, niveladas em RMS
para a comparação ser de timbre e não de volume, e ouvidas.

| variante | hipótese | audível | centroide | achatamento | veredito |
|---|---|---|---|---|---|
| v1 | impacto grave + cacho 668–1464 Hz + agudos discretos | 35 ms | 2553 | 0,061 | descartada |
| **v2** | **o que falta é brilho — grupo agudo dominante** | **30 ms** | **3683** | **0,092** | **aprovada** |
| v3 | tinido de barra metálica (520 · 1435 · 2808 · 4643 Hz) | 55 ms | 1799 | 0,009 | descartada |
| v4 | o som de lance mais um marcador (a proposta do Lichess) | 50 ms | 2053 | 0,029 | descartada |
| *alvo* | | *~50 ms* | *3613* | *0,028* | |

A v2 é a que acerta o brilho medido — 3683 Hz contra 3613 do alvo. As descartadas
saíram do código; as medidas delas ficaram no comentário de `VARIANTS.xeque`, para
ninguém repetir o experimento. Vale notar que a v4 acertava o achatamento (0,029
contra 0,028) e não tinha o brilho: os dois números não se acertam juntos quando o
brilho vem de ruído, e é por isso que a v2 usa **parciais discretas** em 2304 ·
2950 · 3900 · 5100 · 6400 Hz em vez de um filtro passa-alta.

**A tentativa das amostras gravadas, e por que ela saiu.** Treze amostras CC0 do
[kenney.nl](https://kenney.nl) (pacotes *Interface Sounds* e *Impact Sounds*, mais
*UI Audio* baixado e descartado) foram convertidas para WAV mono 44,1 kHz 16 bits,
normalizadas para o RMS alvo de cada efeito com teto de pico em −3 dBFS, medidas e
ouvidas. **Nenhuma foi aprovada.** Os arquivos, o catálogo de proveniência, o
leitor de header WAV e a camada de carga e decodificação saíram do projeto junto
com elas — dez arquivos, 210 KB, e ~200 linhas de código que nada mais usava.

Ficou o que se provou útil: a medição, e a disciplina de proveniência aplicada às
**referências** em vez dos arquivos. A página de aula não baixa nenhum byte de
áudio, e não há nenhum binário no repositório.

## Estrutura

```
app/                    rotas e layout (App Router)
components/board/       tabuleiro: casca do chessground, promoção, jogo livre
components/lesson/      o motor de aula na tela: etapas, painel, confete, anel de pulso
components/sound/       o banco de testes dos sons, da rota /sons
lib/chess/              ponte entre chess.js e chessground, mais a geometria da
                        técnica (technique.ts) e os destaques dela (annotations.ts)
lib/lesson/             schema zod das aulas e posições — os tipos do motor saem daqui
lib/sound.ts            os seis efeitos, sintetizados por WebAudio, e as variantes
lib/sound-catalog.ts    qual variante toca em cada efeito, e a medição da
                        referência que guiou o desenho
lib/spectrum.ts         FFT e envelope — é o que substitui o ouvido de quem codifica
content/                as aulas e as posições, em JSON, mais o cache da tablebase
scripts/                gate de conteúdo, gerador de ramos e teste do gate
docs/                   plano mestre, currículo e planos de fase
```
