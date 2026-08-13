# Plano da F1 — Motor de aula + piloto N0

> Escrito em 2026-08-13, com a F0 fechada, a partir do `docs/00-PLANO-MESTRE.md`
> (§7: "fase mais arriscada do projeto — vale plano de fase próprio e
> detalhado") e do `docs/CURRICULO.md`. Pela regra de precedência do plano
> mestre, **onde este plano divergir dele, este plano vence — desde que a
> divergência esteja escrita aqui**. As divergências são três, todas na §0.

---

## 0. Divergências escritas

1. **D1 é definido operacionalmente na §6 deste plano.** O `CURRICULO.md` do
   repositório está truncado: as seções 1–7 se perderam, e com elas a
   definição dos perfis de domínio D1–D4. O Doug confirmou (2026-08-13) que
   não existe versão completa. A definição da §6 vale até que a original
   apareça — se aparecer, a original vence.
2. **A etapa 6 entra na F1 como "revisão v0"**: as posições de revisão
   (distintas das de ensino, como manda o motor) existem no formato de dados e
   são jogáveis por um botão "Revisar" ao fim da aula. A fila espaçada com
   datas e intervalos crescentes fica na F3, como o próprio plano mestre já
   programa. Assim o gate da F1 ("as 6 etapas exercitadas no conjunto") é
   cumprível sem antecipar a F3 — e o formato já carrega o que a F3 precisa,
   para nenhuma aula ser refeita.
3. **Navegação mínima em vez de trilha**: a página inicial da F1 é um índice
   simples das 3 aulas. A trilha com desbloqueio pelo grafo é estreia da F2.

---

## 1. O que a F1 entrega e como sabemos que acabou

Transcrito do plano mestre §7:

> As 6 etapas do motor funcionando; formato de dados da aula fechado;
> identidade visual v1 (nome, cores, tipografia — celular e desktop);
> primeiras aulas reais: mates de dama, torre e escadinha (`N0-Q-MATE`,
> `N0-R-MATE`, `N0-LADDER`), com garimpo, proveniência e validação mecânica
> funcionando de ponta a ponta.
> **Gate:** as 3 competências de N0 completáveis no ar, cada uma exercitando
> as 6 etapas pelo menos uma vez no conjunto; pipeline de conteúdo provado
> (cada posição com fonte registrada e gate de validação verde).

A execução é em 7 blocos (§9), cada um fechando com um número medido na tela —
nunca um "pronto" sem prova.

---

## 2. O formato de dados da aula

É a decisão que trava todo o resto: o motor renderiza este formato, o gate
valida este formato, o garimpo produz este formato, e errar aqui significa
refazer aula depois. Por isso ele vem primeiro e é provado com um exemplo
executável (bloco B1) **antes** de qualquer garimpo em massa.

### 2.1 Decisão: JSON puro, em duas camadas, validado por schema

*JSON* é um formato de texto para dados estruturados — chaves e valores, sem
código. O plano mestre deixou "TypeScript/JSON" em aberto; a escolha é JSON
por dois motivos práticos:

- o **modo autor** (§7.4) precisa *escrever* o arquivo por programa, e JSON é
  serializável nos dois sentidos — um arquivo TypeScript não é;
- a **validação em lote** roda direto sobre os arquivos, sem compilar nada.

O código não perde tipagem: um *schema* (a descrição formal de quais campos
existem e o que cada um aceita) é escrito com a biblioteca `zod` em
`lib/lesson/schema.ts`, e os tipos TypeScript do motor derivam dele
(`z.infer`). O mesmo schema é o que o gate de validação executa.

As duas camadas:

| Camada | Onde | O que é |
|---|---|---|
| **Banco de posições** | `content/positions/N0/<id>.json` | 1 arquivo por posição: a FEN, o resultado esperado, o status editorial e a proveniência completa. Posição é fato registrado uma vez; aulas a referenciam por id. |
| **Aulas** | `content/lessons/<ID-DA-COMPETÊNCIA>.json` | 1 arquivo por competência (o id é o ID editorial oficial do currículo, ex. `N0-R-MATE`): configuração de quais etapas existem e o conteúdo de cada uma, apontando posições por id. |

Separar posição de aula segue o §4.2 do plano mestre ("cada posição entra num
registro") e prepara a F3: a revisão espaçada reapresenta *posições*, não
aulas.

### 2.2 O arquivo de posição

Campos: `id` estável (nunca renumerar — §16 do currículo), `fen`,
`expectedResult` (`win-white` | `win-black` | `draw`), `tags`, `status` e o
bloco `provenance` com os **9 campos da §12.3 do currículo**, nome a nome.

O campo `status` tem três valores e uma regra dura:

- `fixture` — posição técnica de teste/ilustração. **Nunca publica**: o gate
  falha se uma aula publicável referenciar uma fixture (regra da §12.5 do
  currículo: posição sintética não é promovível a conteúdo).
- `candidate` — garimpada, com proveniência, aguardando QA.
- `approved` — passou pelo QA da §17; é o único status que chega ao aluno.

### 2.3 O arquivo de aula — exemplo completo (`N0-R-MATE`)

O exemplo abaixo é o contrato do formato, com as 6 etapas presentes. As
posições dele são `fixture` — ilustram o formato e **serão substituídas pelas
garimpadas no bloco B5**; é exatamente o mecanismo que impede posição composta
por IA de virar conteúdo. A árvore da etapa 3 está abreviada depois dos
primeiros nós (o arquivo real segue até o mate e é entregue rodando no B1);
tudo o mais está integral.

Notação dos lances: **UCI** — casa de origem + casa de destino (`h1h4` = torre
de h1 para h4).

Um arquivo de posição do exemplo:

```json
{
  "id": "pos-n0-rmate-fx-a",
  "fen": "8/8/8/4k3/8/8/4K3/7R w - - 0 1",
  "expectedResult": "win-white",
  "tags": ["KRK", "ensino"],
  "status": "fixture",
  "provenance": {
    "externalHumanSource": null,
    "bibliographicSource": null,
    "originalGame": null,
    "authorComposer": null,
    "license": null,
    "editionFile": null,
    "fenMethod": "fixture-tecnica",
    "qaApplied": null,
    "pendingRisk": "fixture — proibida de publicar; substituir por posição garimpada no B5"
  }
}
```

A aula:

```json
{
  "id": "N0-R-MATE",
  "title": "Mate de torre e rei",
  "orientation": "white",
  "domainCriterion": "D1",
  "errors": {
    "cheque-inutil": {
      "verdict": "off-method",
      "text": "Xeque sem plano não progride: o rei foge e nada mudou. Primeiro corte o caminho dele com a torre."
    },
    "rei-distante": {
      "verdict": "off-method",
      "text": "A torre não dá mate sozinha. Aproxime o seu rei — é ele quem fecha a caixa."
    },
    "entrega-torre": {
      "verdict": "loses-win",
      "text": "A torre ficou ao alcance do rei preto. Sem a torre, não há mais mate: é empate."
    }
  },
  "fallbacks": {
    "winningOffMethod": "Esse lance ainda ganha, mas não é o método da aula. Volte e tente o lance da técnica.",
    "losesWin": "Esse lance joga a vitória fora. Volte e tente de novo."
  },
  "stages": {
    "objective": {
      "positionId": "pos-n0-rmate-fx-a",
      "text": "Com torre e rei contra rei sozinho, você vai encurralar o rei adversário numa borda e dar mate. A técnica: cortar o caminho com a torre, aproximar o seu rei, e encolher a caixa.",
      "mastery": "Dominado = dar o mate numa posição que você nunca viu, sem ajuda, dentro do limite de lances — e depois provar contra o computador."
    },
    "example": {
      "positionId": "pos-n0-rmate-fx-a",
      "steps": [
        { "move": "h1h4", "text": "A torre corta a 4ª fileira: o rei preto agora vive só na parte de cima do tabuleiro.", "arrows": [["h1", "h4"]], "highlights": ["a4", "h4"] },
        { "move": "e5d5", "text": "O rei preto tenta se aproximar da torre." },
        { "move": "e2e3", "text": "O rei branco sobe. É ele quem vai ajudar a torre a encolher a caixa.", "arrows": [["e2", "e3"]] }
      ],
      "stepsNote": "…arquivo real segue até o mate; abreviado neste plano."
    },
    "guided": {
      "positionId": "pos-n0-rmate-fx-a",
      "intro": "Sua vez. As casas marcadas mostram a ideia; a dica está disponível se precisar.",
      "root": "n1",
      "nodes": {
        "n1": {
          "fen": "8/8/8/4k3/8/8/4K3/7R w - - 0 1",
          "hint": "Corte o rei preto: leve a torre para a fileira logo abaixo dele.",
          "highlights": ["h4"],
          "expects": [
            { "moves": ["h1h4"], "reply": "e5d5", "next": "n2", "feedback": "Corte feito — o rei preto não desce mais da 5ª fileira." }
          ],
          "mistakes": [
            { "moves": ["h1h5"], "errorId": "cheque-inutil" }
          ],
          "winningMoves": ["…gerado pelo validador a partir da tablebase; nunca escrito à mão"]
        },
        "n2": {
          "fen": "8/8/8/3k4/7R/8/4K3/8 w - - 2 2",
          "hint": "A torre já corta. Agora é a vez do seu rei subir.",
          "highlights": ["e3"],
          "expects": [
            { "moves": ["e2e3"], "reply": "d5c5", "next": "n3", "feedback": "O rei sobe para apoiar a torre." }
          ],
          "mistakes": [
            { "moves": ["h4d4"], "errorId": "entrega-torre" }
          ],
          "winningMoves": ["…gerado pelo validador"]
        }
      },
      "nodesNote": "…nós seguintes até o mate omitidos neste plano; o arquivo real é completo e validado no B1."
    },
    "solo": {
      "positionId": "pos-n0-rmate-fx-b",
      "root": "s1",
      "nodes": { "…": "mesma estrutura da etapa 3, posição diferente, sem hint nem highlights" },
      "moveLimit": 20
    },
    "practice": {
      "positionId": "pos-n0-rmate-fx-c",
      "goal": "win",
      "engine": { "skill": 3, "moveTimeMs": 300 }
    },
    "review": {
      "reviewPositionIds": ["pos-n0-rmate-fx-d"]
    }
  }
}
```

Leitura do exemplo, etapa a etapa:

| Etapa | Campo | Como funciona |
|---|---|---|
| 1 Objetivo | `objective` | Texto + diagrama parado (`viewOnly` do tabuleiro já existente) + o critério de domínio por extenso. |
| 2 Exemplo | `example.steps` | Lances dos dois lados roteirizados, cada um com texto, setas e casas destacadas; o motor os reproduz com avançar/voltar/repetir. |
| 3 Com ajuda | `guided.nodes` | A árvore de lances (§3). Destaques, dica e retentativa ilimitada. |
| 4 Sem ajuda | `solo` | Mesma mecânica, **posição diferente** (o *fading*: a ajuda foi retirada), sem destaques, com teto de lances; erro que joga fora encerra a tentativa. |
| 5 Prática real | `practice` | Posição jogada contra o Stockfish (§5); vitória decidida por resultado, não lance a lance. |
| 6 Revisão | `review` | Posições distintas das de ensino, jogáveis pelo botão "Revisar" (revisão v0 — §0.2). |

"Nem toda aula tem todas as etapas" continua valendo: cada bloco de `stages` é
opcional no schema. Nas 3 aulas da F1, todas terão as 6 — o que satisfaz o
gate ("as 6 etapas pelo menos uma vez no conjunto") com folga.

---

## 3. A árvore de lances: validar sem engine na tela do aluno

### 3.1 O problema real

A regra é dura: etapas 2–4 **sem engine em runtime**. Mas "aceite qualquer
lance que ganha" é impossível de escrever à mão — num mate de torre, quase
todo lance preserva a vitória, e a árvore de todas as continuações explodiria
em milhares de nós. O desenho abaixo resolve com uma divisão de trabalho:
**o autor escreve o método; a máquina certifica a verdade.**

### 3.2 Como o nó funciona

Cada nó da árvore é uma posição que o aluno pode alcançar. Nele:

- **`expects`** — os lances do *método* (1 a 4 por nó). Só eles avançam a
  aula. Cada um traz a resposta do defensor (`reply`, determinística, escrita
  pelo autor) e o próximo nó. Transposições (ordens diferentes que chegam à
  mesma posição) apontam para o mesmo nó, fundidas por FEN.
- **`mistakes`** — os erros *nomeados*, vindos da coluna "erros típicos" do
  currículo (para `N0-R-MATE`: cheques inúteis, rei distante, entrega da
  torre), cada um com veredito e texto específico — a resposta pedagógica que
  o plano mestre exige no lugar do "errado, tente de novo" genérico.
- **`winningMoves`** — a lista de todos os lances legais do nó que preservam a
  vitória, **gerada mecanicamente pelo validador consultando a tablebase**
  (§3.4) e gravada no arquivo. Ninguém escreve isso à mão; o gate recusa
  arquivo em que a lista não bata com a tablebase. Gerar dado mecânico de uma
  posição fonteada é derivação permitida — o que a regra proíbe é *inventar
  posição*.

Em runtime o motor só compara o lance do aluno com essas três listas — zero
xadrez calculado na tela:

| Lance do aluno | O que acontece |
|---|---|
| Está em `expects` | Avança: feedback positivo, defensor responde, próximo nó. |
| Está em `mistakes` | Texto específico do erro; o lance é desfeito (a prop `revision` do tabuleiro, herdada da F0, já faz isso). |
| Qualquer outro, mas está em `winningMoves` | Fallback honesto: "funciona, mas não é o método — volte e tente o lance da técnica". |
| Qualquer outro, fora de `winningMoves` | Fallback honesto: "isso joga a vitória fora — volte e tente de novo". |

A árvore não explode porque **só o método avança**: os desvios recebem
resposta e voltam, sem gerar sub-árvores. E o feedback nunca mente, porque a
classificação ganha/não-ganha vem da tablebase, não do palpite do autor.

### 3.3 Etapa 3 vs etapa 4

Mesma estrutura de dados; muda a configuração: a etapa 3 tem destaques, dica e
retentativa ilimitada; a etapa 4 usa outra posição, sem ajuda nenhuma, com
teto de lances (`moveLimit`), e um lance fora de `winningMoves` encerra a
tentativa — recomeça do zero. É o fading do currículo, e é onde o D1 (§6) é
aferido.

### 3.4 A certificação com tablebase — e o gate no CI

*Tablebase* = banco de dados com o resultado perfeito de qualquer final com
poucas peças (a família usada é a **Syzygy**, que cobre até 7 peças — as
posições de N0 têm 3 ou 4). A consulta é pela API pública do Lichess
(`tablebase.lichess.ovh`), gratuita.

Regra de arquitetura: **a rede só é usada na autoria, nunca no CI.** Cada
resposta da tablebase é gravada em `content/tablebase-cache/` (arquivos
versionados no repositório, indexados por FEN). O gate no CI valida tudo
offline, a partir do cache — determinístico, sem depender de serviço externo.
Cache faltando é erro com instrução ("rode `npm run validate:content --
--refresh-cache` na sua máquina").

O gate (`scripts/validate-content.ts`, comando `npm run validate:content`,
step novo no `.github/workflows/ci.yml` entre Typecheck e Lint) confere:

**Por posição:**
- FEN legal (chess.js aceita; reis não adjacentes; sem xeque impossível);
- `expectedResult` bate com a tablebase;
- os 9 campos de proveniência presentes (nulos só permitidos em `fixture`);
- `status` publicável para tudo que uma aula publicável referencia.

**Por aula:**
- schema zod válido; toda referência de posição existe;
- cada nó da árvore é alcançável por lances legais a partir da posição raiz, e
  a FEN gravada no nó bate com a derivada;
- `expects` ⊆ `winningMoves`; `mistakes` com veredito `loses-win` ∉
  `winningMoves`; `mistakes` com veredito `off-method` ∈ `winningMoves`;
- todo nó terminal é mate de verdade;
- a linha da etapa 2 é jogável do início ao fim;
- cada `reply` do defensor é legal e **resistente**: não encurta o mate em
  mais de 2 lances em relação à defesa perfeita da tablebase (para o aluno não
  treinar contra um defensor bobo);
- o `moveLimit` da etapa 4 é cumprível: distância até o mate (DTM, *depth to
  mate* — o número de lances da vitória perfeita) ≤ teto ≤ 50.

O gate é testado contra si mesmo no B1: **8 mutações plantadas** (FEN ilegal,
resultado errado, campo de proveniência faltando, fixture referenciada por
aula publicável, lance perdedor marcado como método, nó terminal sem mate,
defensor frouxo, teto impossível) — cada uma precisa ficar vermelha.

---

## 4. O motor de aula na tela (etapas 1–4)

Componentes novos em `components/lesson/` — `LessonPlayer` (orquestra as
etapas e o avanço) e um componente por etapa — mais a rota `app/aula/[id]/` e
o estado da aula em Zustand (instalado desde a F0, enfim usado). O índice das
3 aulas entra na página inicial (§0.3).

O tabuleiro da F0 serve quase intacto: `ChessBoard` ganha **uma** prop nova,
`shapes` (setas e destaques, via `api.setShapes` do chessground — hoje o canal
de desenho está desligado em `ChessBoard.tsx`); `fen`, `dests`, `revision`,
`viewOnly` e `onMove` já cobrem todo o resto. O motor controla o que é móvel
via `dests` — na etapa 3/4, todos os lances legais são móveis (o aluno pode
*tentar* qualquer coisa; a resposta vem da árvore, §3.2).

**Pendência da F0 fechada aqui:** hoje um lance recusado devolve a peça em
silêncio (`PositionPlayer.tsx:64-68` — o branch existe e não diz nada). Na
etapa 3, cada recusa vira mensagem específica no painel da aula — o texto do
erro nomeado ou o fallback honesto — anunciada com `aria-live` (leitores de
tela ouvem) e com reforço visual breve na casa envolvida. Celular e desktop
iguais, como sempre: toque, arraste e clique-clique pelo mesmo caminho de
código.

---

## 5. Etapa 5: Stockfish em Web Worker

- Stockfish compilado para WASM, rodando num **Web Worker** (processo separado
  do navegador, para a interface nunca travar), carregado só quando a etapa 5
  abre — o resto do site não paga o peso.
- **Força ajustável por aula** (`engine.skill`, `engine.moveTimeMs` no formato):
  o defensor de um mate elementar não precisa jogar como campeão mundial.
- **Validação por resultado, não por lance**: o juiz é o `readOutcome` de
  `lib/chess/status.ts`. Para isso ele ganha o que hoje falta e que em finais
  é o mecanismo de fracasso mais comum: razões dedicadas para **regra dos 50
  lances** e **repetição tripla** ("50 lances sem progresso — empate", "a
  posição repetiu três vezes — empate"), no lugar do "Empate." genérico.
- Meta de desempenho medida no B4: lance do motor em ≤ 2 segundos no celular
  do Doug (a exigência do plano mestre §8 de "testar em aparelho modesto na
  F1").

---

## 6. D1 operacional (divergência 1)

**Dominado (D1)** em uma competência de N0 = na mesma sessão:

1. completar a **etapa 4** numa posição nunca usada nas etapas 1–3, sem dica,
   sem nenhum lance que jogue a vitória fora, sem afogamento, dentro do
   `moveLimit` da aula (teto ≥ DTM da posição, conferido pelo gate); **e**
2. vencer a **etapa 5** contra o Stockfish da aula.

A etapa 1 de cada aula exibe esse critério por extenso ("o que conta como
dominado"), como o motor exige. A definição é provisória no sentido da §0.1:
se as seções perdidas do currículo aparecerem, a definição original vence.

---

## 7. Pipeline de conteúdo: do PDF à aula

### 7.1 A biblioteca — onde os PDFs precisam estar

Resposta direta à pendência: os PDFs ainda não estão no projeto, e o garimpo
não começa sem eles.

- **Onde:** pasta `biblioteca/` na raiz do projeto, **listada no
  `.gitignore`** (o arquivo que diz ao git o que nunca versionar). O
  repositório é público; PDF de livro comprado não pode ser distribuído — ele
  fica só na sua máquina, e o que o repositório versiona é a *proveniência*,
  nunca a obra.
- **Formato:** 1 PDF por livro, nome em slug minúsculo com hífens (ex.
  `de-la-villa-100-endgames.pdf`, `capablanca-chess-fundamentals-1921.pdf`),
  **com camada de texto pesquisável** — teste simples: buscar uma palavra
  dentro do PDF encontra. Se algum for só imagem escaneada, passa por OCR
  (reconhecimento de texto) antes de entrar na pasta.
- **Quem lê:** subagentes, página a página, sob demanda — os PDFs não entram
  no contexto principal nem no repositório.

### 7.2 `docs/SOURCE-CORPUS.md` nasce na F1

O currículo (§12.1) aponta para esse arquivo, que nunca existiu. O B5 o cria
com: a lista canônica das **10 obras confirmadas pelo Doug em 2026-08-13**
(De la Villa, Silman, Rabinovich, Averbakh, Capablanca, Kling & Horwitz,
Freeborough, Philidor/edições históricas, Chess Steps, Dvoretsky), edição,
arquivo correspondente em `biblioteca/`, papel de cada uma — preservando a
distinção da §12.4 entre **fonte de posição** e **referência didática** (que
orienta seleção e ordem, mas não autoriza copiar seleção inteira nem texto) —
e o mapa de cobertura de N0.

### 7.3 Regras de garimpo (herdadas, aqui só amarradas)

- "Posição é fato": posições vêm dos livros e de fontes abertas; **misturar
  fontes** — nunca a seleção inteira de um único livro (a coleção tem direito
  autoral mesmo quando a posição não tem);
- proveniência campo a campo (§12.3, os 9 campos do formato §2.2);
- **nenhuma posição composta por IA** — o garimpo devolve candidatos com
  livro + página + diagrama, e o campo `fenMethod` registra como a FEN foi
  obtida;
- textos didáticos 100% originais, em PT-BR, na voz do curso.

**Volume da F1:** 4–6 posições por competência (ensino, fading, prática,
revisão — mais variantes se o QA pedir) → **12–18 posições aprovadas**.

### 7.4 Modo autor v0

O mínimo que o plano mestre promete ("nasce simples na F1 e cresce conforme
doer"): uma rota `/autor`, visível só em desenvolvimento (fora do site
publicado), que carrega um arquivo de aula local e o joga no motor real — para
montar e testar árvore no tabuleiro sem editar JSON às cegas. Nada além disso
na F1.

---

## 8. Identidade visual v1

Dois passos, ambos com o Doug decidindo na tela:

1. **Direções**: 2–3 propostas completas (nome do curso + paleta + tipografia),
   apresentadas lado a lado numa folha de contato única — nunca N imagens
   soltas. O nome sai daqui: `laboratorio-finais` é nome de trabalho.
2. **Aplicação**: a direção escolhida vira tokens de design no bloco `@theme`
   do `globals.css` (hoje quase vazio — a F0 usa a paleta padrão do Tailwind
   de propósito), aplicados ao site e ao tabuleiro.

Saída medida (B6): contraste **AA** (o critério de legibilidade da WCAG)
verificado em números para cada par texto/fundo; conferência em celular e
desktop feita por subagente com Playwright devolvendo medidas em texto (regra
do projeto: imagem não entra no thread principal). Zona sensível declarada: o
patch de coordenadas em `app/globals.css` — qualquer mudança ali se confere
nos dois tamanhos.

---

## 9. Pontos de parada

Sete blocos. Cada um termina com um número medido mostrado ao Doug — e o
formato é provado em código (B1) e jogado na tela (B3) **antes** do garimpo em
massa (B5), porque refazer formato com 18 posições prontas é o risco nº 1 da
fase.

| # | Bloco | Número medido no fim |
|---|---|---|
| **B1** | Schema zod + exemplo fixture de `N0-R-MATE` completo + validador rodando local | exemplo passa no validador; **8 mutações plantadas → 8 vermelhos** (lista na §3.4) |
| **B2** | Gate no CI | 2 execuções mostradas: conteúdo válido → **verde**; posição sem fonte → **vermelho** |
| **B3** | Motor etapas 1–4 rodando a aula fixture | Doug joga no celular e no desktop; **toda recusa de lance tem mensagem específica** (pendência da F0 fechada) |
| **B4** | Etapa 5 (Stockfish) + etapa 6 v0 | lance do motor **≤ 2 s** no celular do Doug; 50 lances e repetição com razão própria na tela |
| **B5** | Biblioteca + garimpo N0 — **pré-condição: PDFs em `biblioteca/`** (§7.1) | `SOURCE-CORPUS.md` com as 10 obras; **12–18 posições `approved` com 9/9 campos** e gate verde; **zero fixture** referenciada por aula publicável; **ritmo real medido (posições/hora)** — o número que o plano mestre exige antes de prometer prazo |
| **B6** | Identidade visual v1 | nome decidido; tokens aplicados; **contrastes AA em números**; 2 tamanhos conferidos por medidas |
| **B7** | QA + gate da fase | checklist §17 do currículo respondido: **11 perguntas × 3 aulas = 33 respostas** registradas em `docs/QA-F1.md`; QA jogando errado de propósito; **mapa etapa×aula** provando as 6 etapas no conjunto; Doug completa as 3 competências no celular |

Ordem e paralelismo: B1 → B2 → B3 → B4 em sequência; **B5 corre em paralelo a
B3–B4** assim que os PDFs chegarem; B6 depois de B3 (precisa de telas para
vestir); B7 fecha a fase. Cada ponto de parada é também um bom momento de
`/clear`.

---

## 10. O que NÃO entra na F1

| Fica de fora | Onde vive |
|---|---|
| Trilha com desbloqueio pelo grafo; progresso persistente (localStorage, exportar/importar) | F2 |
| Fila de revisão espaçada com datas e intervalos | F3 (a F1 entrega a revisão v0 — §0.2) |
| Posições espelhadas/variadas automáticas; prática real defendendo | F4 |
| `N0-2B-MATE` (classe R — recomendada, não requisito) | sem fase; porta aberta |
| N1 em diante | F2–F6 |
| Banco de dados, login, XP/gamificação, pagamentos, áudio | fora da v1 |
| Modo autor além do v0 da §7.4 | "cresce conforme doer" |
| Marca além da v1 (logo definitivo, domínio próprio) | fase de design futura |
| **Licença GPL-3.0 do chessground** | registrada no README desde a F0; nenhuma ação na F1 — fica aqui escrita para não cair no esquecimento: se um dia o projeto precisar fechar o código, o tabuleiro é a peça a trocar |

---

## 11. Riscos da fase

| Risco | Mitigação |
|---|---|
| O formato de dados errar (o risco-mor: refazer aula depois) | Formato provado em três degraus antes do volume: exemplo executável (B1), gate (B2), Doug jogando (B3) — só então garimpo (B5) |
| API de tablebase fora do ar ou instável | Rede só na autoria; CI valida do cache versionado (§3.4) |
| Árvore de lances explodir | Só o método avança; desvios respondem e voltam; `winningMoves` mecânico dá cobertura total; transposições fundidas por FEN (§3.2) |
| Stockfish pesado no celular | Força e tempo limitados por aula; worker carregado só na etapa 5; medido em aparelho modesto no B4 (≤ 2 s) |
| Autoria mais lenta que o previsto | Ritmo real medido no B5 (posições/hora) antes de qualquer promessa de prazo para F2+ |
| PDF sem camada de texto | Critério de entrada da biblioteca (§7.1): pesquisável ou OCR antes do garimpo |
| Currículo truncado esconder outras definições perdidas | Toda definição reconstruída entra como divergência escrita (§0), nunca silenciosa |
