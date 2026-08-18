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

## Inventário medido em 2026-08-18

Os PDFs não são versionados, então esta tabela é o único registro de **quais
deles um subagente consegue de fato ler**. O teste é `pdftotext -f N -l N+4
arquivo.pdf -` em cinco páginas do meio: zero caractere significa que a página é
foto e precisa de OCR antes de servir para qualquer coisa.

| Arquivo | Pág. | Estado |
|---|---|---|
| `capablanca-chess-fundamentals-1921.pdf` | 270 | legível |
| `kling-horwitz-chess-studies-1851-mott.pdf` | 260 | legível |
| `nunn-understanding-chess-endgames.pdf` | 234 | legível |
| `rabinovich-russian-endgame-handbook.pdf` | 525 | legível |
| `de-la-villa-100-endgames-workbook.pdf` | 286 | legível |
| `de-la-villa-100-basic-endgames-amostra.pdf` | 31 | legível (é excerto, não o livro) |
| `silman-complete-endgame-course.pdf` | 543 | **só imagem** |
| `muller-lamprecht-fundamental-chess-endings.pdf` | 418 | **só imagem** |
| `de-la-villa-100-endgames.pdf` | 249 | **só imagem** |
| `pandolfini-endgame-course.pdf` | 162 | **só imagem** |
| `muller-chess-endgames-for-kids.pdf` | 130 | **só imagem** |
| `averbakh-essential-knowledge.pdf` | 59 | **só imagem** |

Os seis que precisam de OCR são **todos referência didática**, e nenhum deles
autoriza tirar posição — não travam o garimpo. As duas fontes de posição estão
legíveis.

Nunn, Müller (×2) e Pandolfini **não estão no corpus do currículo (§12)**. Ficam
aqui porque o autor os tem; o `docs/SOURCE-CORPUS.md`, quando nascer, decide se
entram como referência didática ou saem.

## De onde vieram as duas fontes de posição

Ambas em domínio público, conferidas página a página antes de entrar:

- **Capablanca, _Chess Fundamentals_, 1921, Harcourt Brace, Nova York** —
  <https://archive.org/details/cu31924014756724>. OCR ABBYY, 270 páginas com
  numeração de página real. **Não usar a versão do Project Gutenberg**
  (ebook 33870): não tem PDF e não tem número de página, e a proveniência exige
  página.
- **Kling & Horwitz, _Chess Studies; or, Endings of Games_, edição de Henry C.
  Mott** — <https://archive.org/details/bub_gb_5ZACAAAAQAAJ>. A outra cópia que
  aparece primeiro nas buscas (`chessstudiesore00horwgoog`) é o mesmo livro
  **sem camada de texto**; foi baixada, testada com zero caractere e descartada.

**Divergência aberta com o currículo:** a §12 pede Kling & Horwitz na 2ª edição
de 1889 revista por William Wayte. O que existe com camada de texto é a 1ª
edição, de Mott. As duas são domínio público e citáveis, mas a proveniência tem
de dizer a verdade — ou o currículo aceita a de Mott, ou a de 1889 precisa ser
caçada. Decisão do autor, ainda não tomada.

O OCR das duas é bom para localizar posição e página, e **ruim para ler lance**:
Capablanca sai com `Q-- Kt2` onde está `Q-Kt2`, e `i8` onde está `18`. As duas
usam notação descritiva (`P-K4`), não algébrica. É exatamente para isso que o
campo `fenMethod` da proveniência existe — nenhuma FEN sai do OCR sem
verificação.

## Regras de arquivo

- **Um PDF por obra**, nome em minúsculas com hífens, como na tabela.
- **Com camada de texto pesquisável.** Teste de dez segundos: abra o PDF e
  busque uma palavra comum (`king`, `pawn`). Se não achar nada, é imagem
  escaneada e precisa passar por OCR antes de entrar aqui — um subagente não
  consegue ler página que é foto.
- Nada além de PDF nesta pasta.

Quem lê os arquivos são subagentes, página a página e sob demanda. Eles nunca
entram no contexto principal nem no repositório.
