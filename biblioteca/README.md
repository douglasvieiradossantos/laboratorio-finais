# A biblioteca

Os PDFs das obras que sustentam o garimpo de posições ficam **aqui, e só na
máquina do autor**. O `.gitignore` da raiz bloqueia a pasta inteira e abre
exceção só para este arquivo.

O repositório é público. Livro comprado não pode ser redistribuído, e mesmo
obra em domínio público não precisa entrar num repositório de código. O que o
projeto versiona é a **proveniência** — obra, edição, página, diagrama — nunca
a obra.

## As duas listas, que não são a mesma coisa

O currículo (§12.4) separa dois papéis, e confundi-los é o erro que gera
problema jurídico:

**Fonte de posição** — de onde uma posição pode de fato ser tirada. Só obras em
domínio público:

| Arquivo esperado | Obra |
|---|---|
| `capablanca-chess-fundamentals-1921.pdf` | Capablanca, _Chess Fundamentals_, edição de 1921 |
| `kling-horwitz-chess-studies-1889.pdf` | Kling & Horwitz, _Chess Studies and End-Games_, 2ª ed. de 1889, revista por Wayte |
| `freeborough-chess-endings-1891.pdf` | Freeborough, _Chess Endings_ (1891) — **reserva**, só para lacuna comprovada |

**Referência didática** — orienta seleção, ordem e importância, e ajuda o QA.
**Não** autoriza copiar texto, comentário, seleção de exercícios nem estrutura
editorial:

| Arquivo esperado | Obra |
|---|---|
| `de-la-villa-100-endgames.pdf` | De la Villa, _100 Endgames You Must Know_ |
| `silman-complete-endgame-course.pdf` | Silman, _Silman's Complete Endgame Course_ |
| `rabinovich-russian-endgame-handbook.pdf` | Rabinovich, _The Russian Endgame Handbook_ |
| `averbakh-essential-knowledge.pdf` | Averbakh, _Chess Endings: Essential Knowledge_ |
| `dvoretsky-endgame-manual.pdf` | Dvoretsky, _Endgame Manual_ |
| `chess-steps-3-6.pdf` | Chess Steps, cadernos 3 a 6 |
| `philidor-analyse.pdf` | Philidor e edições históricas |

## Regras de arquivo

- **Um PDF por obra**, nome em minúsculas com hífens, como na tabela.
- **Com camada de texto pesquisável.** Teste de dez segundos: abra o PDF e
  busque uma palavra comum (`king`, `pawn`). Se não achar nada, é imagem
  escaneada e precisa passar por OCR antes de entrar aqui — um subagente não
  consegue ler página que é foto.
- Nada além de PDF nesta pasta.

Quem lê os arquivos são subagentes, página a página e sob demanda. Eles nunca
entram no contexto principal nem no repositório.
