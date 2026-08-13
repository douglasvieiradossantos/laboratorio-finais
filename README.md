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
npm run validate:mutations     # testa o gate contra si mesmo (8 estragos plantados)
```

A verdade xadrezística de cada posição vem da **tablebase Syzygy** (API do
Lichess), nunca do palpite de quem escreve a aula: o validador gera a lista de
lances que preservam a vitória, confere o resultado esperado e mede a
resistência da defesa. A rede só é usada na autoria; as respostas ficam
versionadas em `content/tablebase-cache/` e o gate roda offline a partir delas.

```bash
# autoria (única situação em que a rede é usada):
npm run validate:content -- --refresh-cache --write   # busca o que falta e grava os winningMoves
npm run validate:content -- --prune-cache             # remove cache que nenhuma posição usa
```

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

## Estrutura

```
app/                    rotas e layout (App Router)
components/board/       tabuleiro: casca do chessground, promoção, jogo livre
lib/chess/              ponte entre chess.js e chessground (lances legais, estado da partida)
lib/lesson/             schema zod das aulas e posições — os tipos do motor saem daqui
content/                as aulas e as posições, em JSON, mais o cache da tablebase
scripts/                gate de conteúdo e teste do gate
docs/                   plano mestre, currículo e planos de fase
```
