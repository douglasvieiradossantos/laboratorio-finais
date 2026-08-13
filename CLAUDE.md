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
npm run typecheck   # next typegen && tsc --noEmit
npm run lint
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

## Verificação visual

Conferir tabuleiro é conferir imagem — mande um subagente com o Playwright
olhar e devolver medidas em texto, em vez de puxar screenshot para o thread
principal.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
