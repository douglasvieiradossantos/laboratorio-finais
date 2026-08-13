# Laboratório de Finais

Curso interativo de finais de xadrez, em português, para quem já sabe mover as
peças. O aluno aprende **no tabuleiro**: vê a técnica, executa com ajuda,
executa sozinho, e prova que sabe jogando contra um motor de verdade.

O mapa do projeto está em [`docs/00-PLANO-MESTRE.md`](docs/00-PLANO-MESTRE.md);
o conteúdo a ensinar está em [`docs/CURRICULO.md`](docs/CURRICULO.md).

## Estado: F0 — fundação

A F0 entrega só a base: site de pé, tabuleiro jogável, publicação e CI. Não há
aula, trilha nem progresso ainda — isso começa na F1.

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
docs/                   plano mestre e currículo
```
