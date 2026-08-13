# Plano Mestre — Laboratório de Finais

> Escrito em 2026-08-13, a partir do `docs/CURRICULO.md` (a matriz curricular
> aprovada) e das decisões do Doug registradas na §1. Este documento é o mapa
> do projeto inteiro; cada fase ganhará seu próprio plano detalhado na hora de
> começar. Onde um plano de fase divergir deste, o plano de fase vence — desde
> que a divergência esteja escrita lá.

---

## 1. Decisões fundadoras (aprovadas pelo Doug em 2026-08-13)

| Decisão | Escolha |
|---|---|
| Ponto de partida | **Do zero.** Não existe código anterior; o CURRICULO.md é o único legado que vale. |
| Relação com o Recruta 64 | **Site separado e independente.** Partes poderão migrar para o Recruta 64 no futuro — por isso a pilha técnica é a mesma família, mas nada se acopla agora. |
| Login | **Sem login na v1.** Progresso salvo no navegador do aluno (localStorage), com exportar/importar como seguro contra perda. |
| Política de posições | **"Posição é fato."** As posições vêm dos 10 livros comprados (e de fontes abertas); toda explicação, texto e exercício é redigido do zero. Esta decisão **substitui a §12.2 do CURRICULO.md** (que restringia a fontes de domínio público) — o resto da §12 continua valendo: proveniência registrada por posição, e **nenhuma posição inventada por IA**. |
| Formato de aula | **Motor de aula em 6 etapas** (§3 abaixo), definido pelo Doug. Nem toda aula tem todas as etapas. |
| Dispositivos | **Celular e desktop como iguais.** O tabuleiro precisa ser confortável nos dois. |
| Publicação | **Vercel gratuito desde cedo** — site no ar num endereço `.vercel.app` já na primeira fase. |
| Idioma | Português do Brasil. |
| Nome | `laboratorio-finais` é nome de trabalho; a marca fica para a fase de design. |

---

## 2. O produto em uma página

Um curso interativo de finais de xadrez, no navegador, para quem já sabe mover
as peças. O aluno não assiste a vídeos nem lê capítulos: ele **aprende no
tabuleiro** — vê a técnica acontecer, executa com ajuda, executa sozinho, e
então prova que sabe jogando a posição contra um motor de verdade.

O conteúdo segue o `docs/CURRICULO.md`: **36 competências em 6 níveis**, dos
mates elementares (N0) até a integração avançada (N5). Competência ≠ aula ≠
posição: uma competência ("saber jogar rei e peão contra rei") se ensina com
várias aulas e se comprova com posições que o aluno nunca viu.

O que faz este curso diferente dos treinos soltos de tática:

- **progressão real** — cada competência declara pré-requisitos, e a trilha
  desbloqueia na ordem do grafo do currículo, não numa lista arbitrária;
- **domínio, não memória** — a posição de prova é sempre diferente da posição
  de ensino, para impedir que o aluno decore o desenho em vez da ideia;
- **defesa também** — o aluno aprende a segurar o empate, não só a ganhar;
- **erros típicos diagnosticados** — o currículo lista os erros clássicos de
  cada competência, e a aula responde a eles com mensagem específica, não com
  um "errado, tente de novo" genérico.

---

## 3. O motor de aula (lesson engine)

*Motor de aula* = o código genérico que sabe apresentar qualquer aula; a aula
em si é só um arquivo de dados (posições + textos + gatilhos). Escreve-se o
motor uma vez; escrevem-se aulas para sempre. É a peça de software mais
importante do projeto.

As 6 etapas, na ordem definida pelo Doug — **nem toda aula tem todas**:

| # | Etapa | O que acontece na tela |
|---|---|---|
| 1 | **Objetivo** | Texto curto + diagrama parado: o que se aprende, por que importa, o que conta como "dominado". |
| 2 | **Exemplo** | Experiência de "assistir à aula": os lances se movem sozinhos no tabuleiro, com setas, casas destacadas e texto sincronizado. Controles de avançar/voltar/repetir. |
| 3 | **Com ajuda** | O aluno move as peças. Casas-chave destacadas, dica disponível, e cada erro típico recebe a resposta específica do currículo. |
| 4 | **Sem ajuda** | Mesma competência, **posição diferente**, sem destaque nenhum. É o *fading* do currículo: a ajuda foi retirada. |
| 5 | **Prática real** | O aluno joga a posição contra o Stockfish (motor de xadrez rodando no próprio navegador). Ganhar posição ganha ou segurar o empate — resultado de verdade, sem validação lance a lance. |
| 6 | **Revisão** | A posição volta dias/semanas depois, misturada com outras, em intervalos crescentes (revisão espaçada). Posições de revisão são distintas das de ensino. |

Decisões técnicas do motor:

- **Etapas 2–4 não usam motor de xadrez em tempo real** (regra do currículo:
  "sem engine em runtime"). A validação vem de uma **árvore de lances escrita
  na autoria** — quais lances mantêm a vitória, quais jogam fora, e o texto de
  cada desvio. Essa árvore é conferida com engine/tablebase *durante a
  produção*, nunca na tela do aluno.
- **Etapa 5 é a única com Stockfish**, num Web Worker (processo separado do
  navegador, para não travar a interface). Força ajustável por aula: o
  defensor de um mate elementar não precisa jogar como campeão mundial.
- **Aula é dado, não código**: um arquivo declarativo por aula (TypeScript/JSON)
  com FEN (a fotografia da posição em texto), linhas, textos, erros típicos e
  configuração de quais etapas existem. Isso permite validar aulas em lote com
  scripts (gates), no espírito do Recruta 64.

---

## 4. Conteúdo: do PDF à aula

O gargalo do projeto **não é código, é autoria**. Estimativa honesta a partir
do currículo: 33 competências obrigatórias (mais 3 recomendadas), cada uma
pedindo ensino, prática, prova de domínio, transferência e revisão — na casa
de **200 a 280 posições** e seus textos até o fim do N5. Por isso o conteúdo é
produzido por nível, dentro das fases (§7), nunca "tudo de uma vez".

Esteira de produção de cada aula (pipeline):

1. **Garimpo** — subagentes leem os capítulos relevantes dos PDFs e devolvem
   candidatos: posição (FEN), fonte (livro + página + diagrama), a linha
   principal e a ideia. Os 10 livros da biblioteca cobrem todo o currículo.
2. **Proveniência** — cada posição entra num registro com origem, partida
   original quando houver, e método de transcrição. Regras: nenhuma posição
   composta por IA; e **não copiar a seleção inteira de um único livro** —
   misturar fontes, porque a *coleção* de um autor tem direito autoral mesmo
   que cada posição não tenha.
3. **Validação mecânica** — script confere que a FEN é legal, que a linha
   principal é jogável, e que o resultado alegado bate com engine/tablebase
   (tablebase = banco de dados com o resultado perfeito de finais com poucas
   peças). Roda como gate no CI.
4. **Redação** — textos didáticos do zero, em PT-BR, na voz do curso; os
   erros típicos vêm da coluna correspondente do currículo.
5. **QA no tabuleiro** — a aula é jogada de ponta a ponta (inclusive errando
   de propósito) antes de entrar na trilha. Checklist da §17 do currículo.

Ferramenta de apoio: um **modo autor** local (fora do site publicado) para
montar e testar aulas no tabuleiro sem editar JSON na mão. Nasce simples na
F1 e cresce conforme doer.

---

## 5. Pilha técnica

Mesma família do Recruta 64 — deliberadamente, para reaproveitar o que o Doug
já domina e facilitar a migração futura de partes do projeto:

| Peça | Para quê | Observação |
|---|---|---|
| Next.js (App Router) + TypeScript | O site em si | Sem servidor próprio: na v1 tudo é estático ou roda no navegador |
| Tailwind CSS | Estilo | Identidade visual própria, definida na F1 |
| chessground | O tabuleiro na tela | O mesmo do Lichess: leve, bonito, funciona bem no toque do celular |
| chess.js | As regras do jogo | Valida lances, gera FEN, detecta mate/afogamento |
| Stockfish WASM (Web Worker) | O adversário da etapa 5 | Roda no navegador do aluno; nada de motor no servidor |
| Zustand | Estado da interface | Mesmo padrão do Recruta 64 |
| localStorage + exportar/importar | Progresso sem login | Um arquivo de backup que o aluno baixa/restaura |
| GitHub + Vercel | Código e publicação | CI roda typecheck, lint, testes e os gates de conteúdo a cada push |

O que **não** entra na v1: banco de dados, contas, XP/gamificação, pagamentos,
áudio. Tudo isso tem porta aberta (o formato de dados de progresso já nasce
pensando em virar linha de banco um dia), mas nada disso bloqueia o curso.

---

## 6. Progresso do aluno sem login

- O site guarda no navegador: competências dominadas, etapa atual de cada
  aula, fila de revisão espaçada com datas.
- **Risco assumido:** limpar dados do navegador apaga o progresso. Mitigação:
  botão de exportar/importar backup + aviso honesto na interface.
- A trilha desbloqueia pelo grafo do currículo (§8 do CURRICULO.md): cada
  competência abre quando seus pré-requisitos reais estão dominados — sem
  bloqueio artificial por nível.
- Um "testar conhecimento prévio" (pular o que já sabe, provando no tabuleiro)
  fica para fase tardia — está previsto na §16 do currículo, mas não bloqueia
  o lançamento.

---

## 7. Fases — o plano mestre propriamente dito

Cada fase termina num **gate**: critério medível, conferido com o Doug na tela,
antes de abrir a próxima. Conteúdo e software avançam juntos: o motor de aula
ganha uma capacidade nova sempre na fase em que o conteúdo precisa dela.

### F0 — Fundação (a menor versão que existe no ar)
Repo no GitHub, Next.js + Tailwind de pé, tabuleiro chessground jogável com
chess.js, deploy na Vercel, CI mínimo (typecheck, lint, build).
**Gate:** endereço `.vercel.app` aberto no celular do Doug com uma posição de
rei e peão jogável. Nenhum conteúdo real ainda.

### F1 — Motor de aula + piloto N0
As 6 etapas do motor funcionando; formato de dados da aula fechado; identidade
visual v1 (nome, cores, tipografia — celular e desktop); primeiras aulas reais:
mates de dama, torre e escadinha (`N0-Q-MATE`, `N0-R-MATE`, `N0-LADDER`), com
garimpo, proveniência e validação mecânica funcionando de ponta a ponta.
**Gate:** as 3 competências de N0 completáveis no ar, cada uma exercitando as
6 etapas pelo menos uma vez no conjunto; pipeline de conteúdo provado (cada
posição com fonte registrada e gate de validação verde).
*Fase mais arriscada do projeto — é onde o formato de aula acerta ou erra. Vale
plano de fase próprio e detalhado.*

### F2 — N1 (rei e peão) + trilha e progresso
As 6 competências de N1 (atividade do rei, regra do quadrado, casas-chave,
oposição, K+P vs K, peão de torre). Estreiam: página de trilha com desbloqueio
pelo grafo, progresso em localStorage com exportar/importar.
**Gate:** aluno anônimo consegue ir de zero a "N1 concluído" só pelo site, e o
progresso sobrevive a fechar e reabrir o navegador.

### F3 — N2 (peões dinâmicos e zugzwang) + revisão espaçada
As 6 competências essenciais de N2 (+ Réti como recomendada, se couber).
Estreia: revisão espaçada v1 — fila local, posições de revisão distintas.
**Gate:** N2 completável; revisão reapresentando posições de N0–N1 em
intervalos crescentes, verificável mudando o relógio.

### F4 — N3 (torres fundamentais)
Lucena, Philidor, cheques laterais, torre vs peão, atividade de torre.
Estreias no motor: posições espelhadas/variadas automáticas para transferência,
e prática real com papéis dos dois lados (atacar e defender).
**Gate:** N3 completável, incluindo defender Philidor contra o Stockfish.

### F5 — N4 (peças menores e dama básica)
As 7 competências de N4. Pouca novidade de motor — fase dominada por autoria.
**Gate:** N4 completável; biblioteca de posições passa de ~70% da meta total.

### F6 — N5 (avançado) + integração + polimento
As 6 competências A, culminando em `N5-INTEGRATION` (posições sem rótulo — o
aluno diagnostica antes de jogar, a competência terminal da v1.0). Polimento
geral, acessibilidade, desempenho no celular, revisão editorial completa.
**Gate:** curso inteiro completável do zero ao "Avançado v1.0"; é o lançamento.

### Depois da v1 (fora deste plano)
Login e progresso em nuvem, integração com o Recruta 64, teste de conhecimento
prévio, trilha N6–N8 do currículo, gamificação. Documentado para não esquecer;
nada disso influencia decisões da v1 além do formato de dados de progresso.

---

## 8. Riscos declarados

| Risco | Tamanho | Mitigação |
|---|---|---|
| Volume de autoria (200–280 posições com texto) | **O maior do projeto** | Produzir por fase; pipeline com subagentes no garimpo; medir ritmo real na F1 antes de prometer prazo |
| Formato de aula errar na F1 (refazer aulas depois) | Alto | F1 pequena (3 competências), gate com o Doug jogando na tela antes de escalar |
| Validar "qualquer lance que ganha" sem engine ao vivo | Médio | Árvore autoral + conferência com tablebase na produção; etapa 5 valida por resultado, não por lance |
| Progresso perdido (localStorage) | Médio | Exportar/importar + aviso; formato pronto para migrar a banco |
| Direitos autorais das posições | Baixo (com disciplina) | Posição é fato + proveniência registrada + misturar fontes + textos 100% originais |
| Stockfish no celular fraco | Baixo | Força limitada por aula; WASM leve; testar em aparelho modesto na F1 |

---

## 9. Próximo passo

Doug aprova (ou emenda) este plano → começa a **F0**. A F0 é pequena e
mecânica: repo, site de pé, tabuleiro, deploy. O primeiro plano de fase
detalhado que vale a pena escrever é o da **F1**, na hora em que a F0 fechar.
