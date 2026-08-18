# Laboratório de Finais — contexto do projeto

Curso interativo de finais de xadrez em PT-BR. Leia
`docs/00-PLANO-MESTRE.md` antes de decidir qualquer coisa de arquitetura, e
`docs/CURRICULO.md` antes de mexer em conteúdo. Onde um plano de fase divergir
do plano mestre, o plano de fase vence.

## Onde estamos

**F0 — fundação**, concluída: site de pé, tabuleiro jogável, CI, publicação.
Ainda não existe motor de aula, trilha nem progresso — isso é F1 em diante.

## Gates — rode antes de commitar

```bash
npm run typecheck          # next typegen && tsc --noEmit
npm run lint
npm test                   # árvore de lances, técnica, recusas e amostras de som
npm run validate:content   # posições, aulas e ramos gerados
npm run validate:mutations # o gate de conteúdo testado contra si mesmo
npm run build
```

O `next typegen` no typecheck não é enfeite: sem ele o `tsc` não encontra os
tipos de rota gerados pelo Next (`LayoutProps`, `PageProps`) e falha.

## Regras que valem para o código

- **Aula é dado, não código.** Quando o motor de aula existir, uma aula nova
  não pode exigir componente novo — só um arquivo declarativo.
- **Sem engine de xadrez em runtime nas etapas 1–4.** A validação vem da árvore
  de lances escrita na autoria. Stockfish só na etapa 5 (prática real), em Web
  Worker.
- **Nenhuma posição inventada por IA.** Toda posição vem de fonte registrada,
  com proveniência (livro, página, diagrama). Ver §12 do currículo e §4 do
  plano mestre.
- **Celular e desktop são iguais.** Nada de tabuleiro que só funciona no mouse:
  toque, arraste e clique-clique precisam funcionar.

## Armadilhas já conhecidas

- O CSS que vem no pacote do chessground posiciona as coordenadas com
  deslocamentos fixos em pixels, calibrados para o tabuleiro de tamanho fixo do
  Lichess. Num tabuleiro fluido eles saem do lugar e o contraste dos rótulos
  quebra. `app/globals.css` refaz esse posicionamento em porcentagem — mexa lá
  com cuidado, e confira nos dois tamanhos de tela.
- O chessground é código imperativo que toma conta do próprio DOM. O React só
  cria a `<div>` vazia e nunca mexe no que está dentro; mudanças entram por
  `api.set()`. Ver `components/board/ChessBoard.tsx`.
- A prop `revision` do `ChessBoard` existe para forçar ressincronização quando
  a FEN não mudou (lance recusado, promoção cancelada). Sem ela a peça fica
  parada onde o aluno soltou.
- **Nunca animar `transform` nem `opacity` em elemento do chessground.** A
  posição de cada peça é `style.transform = translate(Xpx,Ypx)` **inline**, e um
  `@keyframes` ganha da declaração inline pela cascata: a peça salta para o canto
  do tabuleiro. `opacity` o pacote já usa em `piece.ghost` e `piece.fading`.
  **Declarar** `opacity` ali é seguro, e o projeto declara: o fantasma do
  arraste sobe de 0,3 (invisível sobre papel claro) para 0,55, e 0,55 e não 0,5
  porque 0,5 é o que o pacote usa em `piece.fading` — as duas coisas dizem
  coisas diferentes. A proibição é *animar*, não declarar. A propriedade segura é `filter`, que o pacote nunca escreve em
  `<piece>`, e `drop-shadow()` acompanha o alpha do SVG — o brilho contorna a
  silhueta da peça, não um quadrado. Ver o `pulso-rei` em `app/globals.css`.
- **Gancho no host do tabuleiro é `data-*`, nunca `className`.** O chessground
  escreve `cg-wrap`, `orientation-*` e `manipulable` no *mesmo* elemento cujo
  `className` o React controla, e só as reescreve na criação e no giro do
  tabuleiro. Se o React reatribuir `class`, elas somem e o tabuleiro para de
  funcionar. Atributo `data-*` é escrito isolado — é como a prop `matedKing`
  entra.
- **Som de lance, captura ou xeque não pode passar de 620 ms.** É o
  `REPLY_DELAY_MS` do `TreeStage`, o intervalo entre o lance do aluno e a resposta
  do defensor: som mais longo que isso transforma os dois lances em lama. É teto
  medível, e o `lib/sound-catalog.test.ts` o cobra.
- **Os seis sons são sintetizados, e não há nenhum arquivo de áudio no projeto.**
  A tentativa com amostras gravadas CC0 foi feita e reprovada na audição; a camada
  de carga saiu com elas. Antes de propor arquivos de áudio de novo, leia a seção
  "Som" do README — a busca de licença já foi feita e o resultado está registrado.

## Verificação visual e sonora

Conferir tabuleiro é conferir imagem — mande um subagente com o Playwright
olhar e devolver medidas em texto, em vez de puxar screenshot para o thread
principal.

Som é pior: robô não tem saída de áudio. A rota `/sons` existe para isso — ela
renderiza cada síntese num `OfflineAudioContext` e mede envelope e espectro por
`lib/spectrum.ts` (ataque, queda de 20 e 40 dB, pico, RMS, centro espectral no
ataque e na cauda, achatamento, parciais), tudo legível como texto. O veredito
final é humano, no alto-falante de um celular, e leva vinte segundos ali em vez de
uma aula inteira jogada até o mate.

Duas armadilhas de medição de som, aprendidas medindo:

- **Confie no RMS, não no pico.** As camadas de ruído usam `Math.random()`, então
  o pico oscila ~1,5 dB entre renderizações da *mesma* síntese. Ajustar
  equilíbrio por diferença de 1 dB no pico é ajustar por sorteio.
- **O centro espectral é média sobre todos os bins**, e existem ~900 acima de
  2 kHz contra ~90 abaixo. Uma prateleira de ruído passa-alta domina a média e
  manda o centroide para 7 kHz sem que o som fique "brilhante" no sentido útil —
  use `bandpass` com `q` quando quiser acrescentar ar. Comparar achatamento com
  uma referência em MP3 também engana: o codec corta o agudo e baixa o número.

Toda animação nova mora em `app/globals.css`, na seção "Animações da aula", e
**toda** declaração `animation:` fica dentro de
`@media (prefers-reduced-motion: no-preference)` — guarda por adesão, para
esquecer a guarda falhar para o lado seguro (nada anima).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
