import { z } from "zod";

/**
 * Schema das duas camadas de dados do curso (plano da F1, §2).
 *
 * - Camada 1, posição: `content/positions/<nível>/<id>.json` — um fato
 *   registrado uma vez, com proveniência completa.
 * - Camada 2, aula: `content/lessons/<ID-DA-COMPETÊNCIA>.json` — configuração
 *   das etapas, apontando posições por id.
 *
 * Este arquivo é a única fonte de verdade do formato: o motor (F1/B3) deriva
 * os tipos daqui com `z.infer`, e o gate (`scripts/validate-content.ts`) roda
 * exatamente este schema sobre os arquivos.
 *
 * Os objetos são *estritos*: campo desconhecido é erro, não campo ignorado.
 * Isso custa uma divergência mínima em relação ao exemplo da §2.3 do plano,
 * que traz os marcadores `stepsNote` e `nodesNote` para sinalizar as partes
 * abreviadas ali — o arquivo real não é abreviado e não os tem.
 */

/** Lance em UCI: casa de origem + casa de destino (+ peça da promoção). */
export const uciSchema = z
  .string()
  .regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/, "lance UCI inválido (ex.: h1h4, e7e8q)");

/** Casa do tabuleiro, para destaques e setas. */
export const squareSchema = z.string().regex(/^[a-h][1-8]$/, "casa inválida (ex.: h4)");

/**
 * FEN com os 6 campos. É só a forma; a legalidade de verdade (reis não
 * adjacentes, xeque impossível) é conferida pelo gate com a chess.js.
 */
export const fenSchema = z
  .string()
  .regex(
    /^([1-8pnbrqkPNBRQK]+\/){7}[1-8pnbrqkPNBRQK]+ [wb] (-|K?Q?k?q?) (-|[a-h][36]) \d+ \d+$/,
    "FEN malformada (esperados os 6 campos)",
  );

const positionIdSchema = z
  .string()
  .regex(/^pos-[a-z0-9-]+$/, "id de posição deve ser minúsculo, no formato pos-...");

const nodeIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*$/, "id de nó deve ser minúsculo e sem espaços (ex.: n1)");

const errorIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, "id de erro deve ser minúsculo com hífens (ex.: cheque-inutil)");

const texto = z.string().min(1, "texto não pode ser vazio");

/* ------------------------------------------------------------------ *
 * Camada 1 — posição
 * ------------------------------------------------------------------ */

/**
 * Os 9 campos de proveniência da §12.3 do currículo, nome a nome.
 * `null` significa "não se aplica" e só é aceito em posição `fixture`
 * (o gate confere isso, não o schema).
 */
export const PROVENANCE_FIELDS = [
  "externalHumanSource",
  "bibliographicSource",
  "originalGame",
  "authorComposer",
  "license",
  "editionFile",
  "fenMethod",
  "qaApplied",
  "pendingRisk",
] as const;

export const provenanceSchema = z.strictObject({
  /** Quem, fora do projeto, é a origem humana da posição. */
  externalHumanSource: texto.nullable(),
  /** Obra, edição, página e número do diagrama. */
  bibliographicSource: texto.nullable(),
  /** Partida original, quando a posição vem de uma. */
  originalGame: texto.nullable(),
  /** Autor/compositor, quando é estudo composto. */
  authorComposer: texto.nullable(),
  /** Licença sob a qual a posição pode ser usada. */
  license: texto.nullable(),
  /** Arquivo da biblioteca de onde saiu (nome do PDF em `biblioteca/`). */
  editionFile: texto.nullable(),
  /** Como a FEN foi obtida (transcrição do diagrama, PGN, fixture técnica…). */
  fenMethod: texto.nullable(),
  /** QA aplicado — quem conferiu e quando. */
  qaApplied: texto.nullable(),
  /** Risco pendente conhecido. */
  pendingRisk: texto.nullable(),
});

/**
 * `fixture` nunca publica (§12.5 do currículo: posição sintética não é
 * promovível a conteúdo); `candidate` aguarda QA; `approved` é o único
 * status que chega ao aluno.
 */
export const positionStatusSchema = z.enum(["fixture", "candidate", "approved"]);

export const positionSchema = z.strictObject({
  id: positionIdSchema,
  fen: fenSchema,
  expectedResult: z.enum(["win-white", "win-black", "draw"]),
  tags: z.array(texto).min(1),
  status: positionStatusSchema,
  provenance: provenanceSchema,
});

/* ------------------------------------------------------------------ *
 * Camada 2 — aula
 * ------------------------------------------------------------------ */

/**
 * Um lance esperado do *método*. Só ele avança a aula.
 * `moves` aceita mais de um UCI quando lances diferentes são a mesma ideia.
 * Nó terminal: sem `reply` e sem `next` — o lance dá mate ali (o gate confere).
 */
export const expectSchema = z
  .strictObject({
    moves: z.array(uciSchema).min(1).max(4),
    /** Resposta do defensor, determinística, escrita pela autoria. */
    reply: uciSchema.optional(),
    next: nodeIdSchema.optional(),
    feedback: texto,
    /**
     * Escrito pelo gerador de ramos equivalentes, **nunca à mão**: marca o que
     * o `validate:content --write` derivou e vai regravar na próxima rodada.
     */
    generated: z.literal(true).optional(),
  })
  .refine((e) => (e.reply === undefined) === (e.next === undefined), {
    message: "`reply` e `next` andam juntos: ou os dois, ou nenhum (nó terminal)",
  });

/** Erro nomeado, vindo da coluna "erros típicos" do currículo. */
export const mistakeSchema = z.strictObject({
  moves: z.array(uciSchema).min(1),
  errorId: errorIdSchema,
});

export const treeNodeSchema = z.strictObject({
  fen: fenSchema,
  hint: texto.optional(),
  highlights: z.array(squareSchema).min(1).optional(),
  /**
   * O teto de 8 é o do arquivo inteiro, autorais + gerados. O teto da autoria
   * é 4, e quem cobra isso é o gate (`EXPECTS_AUTORAIS_DEMAIS`): schema não
   * sabe distinguir quem escreveu o quê antes de olhar o campo `generated`.
   */
  expects: z.array(expectSchema).min(1).max(8),
  mistakes: z.array(mistakeSchema).optional(),
  /**
   * Lances que aplicam a **mesma técnica** do roteiro sem serem o lance do
   * roteiro. Só a etapa 3 os tem: lá o aluno é elogiado e a peça volta. Na
   * etapa 4 o mesmo lance vira ramo de verdade, e o campo é proibido.
   * **Gerado pelo validador — nunca escrito à mão.**
   */
  methodAlternatives: z.array(uciSchema).min(1).optional(),
  /**
   * Todos os lances legais do nó que preservam a vitória.
   * **Gerado pelo validador a partir da tablebase — nunca escrito à mão.**
   */
  winningMoves: z.array(uciSchema),
  /** Nó inteiro derivado pelo gerador de ramos. Nunca escrito à mão. */
  generated: z.literal(true).optional(),
});

const treeBaseSchema = z.strictObject({
  positionId: positionIdSchema,
  root: nodeIdSchema,
  nodes: z.record(nodeIdSchema, treeNodeSchema),
});

/** Etapa 1 — objetivo: diagrama parado, texto e o critério de domínio. */
export const objectiveStageSchema = z.strictObject({
  positionId: positionIdSchema,
  text: texto,
  mastery: texto,
});

/** Etapa 2 — exemplo: lances dos dois lados roteirizados. */
export const exampleStepSchema = z.strictObject({
  move: uciSchema,
  text: texto,
  arrows: z.array(z.tuple([squareSchema, squareSchema])).min(1).optional(),
  highlights: z.array(squareSchema).min(1).optional(),
});

export const exampleStageSchema = z.strictObject({
  positionId: positionIdSchema,
  steps: z.array(exampleStepSchema).min(1),
});

/** Etapa 3 — com ajuda: destaques, dica e retentativa ilimitada. */
export const guidedStageSchema = treeBaseSchema.extend({
  intro: texto.optional(),
});

/** Etapa 4 — sem ajuda: outra posição, sem dica nem destaque, com teto. */
export const soloStageSchema = treeBaseSchema.extend({
  /** Teto de lances *do aluno*. O gate exige DTM ≤ teto ≤ 50. */
  moveLimit: z.int().min(1).max(50),
});

/** Etapa 5 — prática real contra o Stockfish (F1/B4). */
export const practiceStageSchema = z.strictObject({
  positionId: positionIdSchema,
  goal: z.enum(["win", "draw"]),
  engine: z.strictObject({
    /**
     * Skill Level do Stockfish: 0 (fraquíssimo) a 20 (força total).
     *
     * **Em final de mate forçado, use 20.** Medido em 2026-08-17 na posição de
     * prática desta aula (KRK, defesa perfeita da tablebase = 23 meios-lances),
     * três partidas por nível contra o mesmo atacante:
     *
     * | skill | meios-lances até o mate | % da defesa perfeita |
     * |---|---|---|
     * | 0  | 9, 15, 17  | 59% |
     * | 3  | 7, 11, 11  | 42% |
     * | 6  | 7, 7, 15   | 42% |
     * | 10 | 17, 11, 9  | 54% |
     * | 20 | 21, 23, 21 | **94%** |
     *
     * A lição não é "3 é pouco": é que **abaixo de 20 o Skill Level não dá um
     * defensor mais fraco, dá um defensor aleatório** — 0, 3, 6 e 10 são
     * indistinguíveis dentro do ruído. O mecanismo do Stockfish é escolher às
     * vezes um lance que não é o melhor, e num mate forçado o defensor não tem
     * plano a executar: a única tarefa dele é adiar o mate. Aleatorizar essa
     * única tarefa apaga a resistência inteira e a gradação some junto.
     *
     * O critério é o mesmo que a §3.4 do plano já impõe ao defensor escrito na
     * autoria das etapas 3 e 4 — "não encurtar o mate em mais de 2 lances em
     * relação à defesa perfeita, para o aluno não treinar contra um defensor
     * bobo". Skill 20 cabe nele; skill 3 deixava a etapa 5, que deveria ser o
     * teste mais duro, com o defensor mais fraco da aula.
     *
     * Enfraquecer continua fazendo sentido onde o computador tem plano próprio
     * — uma aula em que o aluno precise *empatar*, por exemplo. Por isso o
     * campo é por aula.
     */
    skill: z.int().min(0).max(20),
    /**
     * Teto de busca por lance. É ele, e não a força, que governa o tempo na
     * tela: a 300 ms o skill 20 responde em 300 ms como o skill 3 respondia.
     */
    moveTimeMs: z.int().min(50).max(5000),
  }),
});

/** Etapa 6 — revisão v0 (§0.2): posições distintas das de ensino. */
export const reviewStageSchema = z.strictObject({
  reviewPositionIds: z.array(positionIdSchema).min(1),
});

export const lessonErrorSchema = z.strictObject({
  /**
   * `off-method` — o lance ganha, mas não é o método da aula.
   * `loses-win` — o lance joga a vitória fora.
   * O gate confere o veredito contra a tablebase.
   */
  verdict: z.enum(["off-method", "loses-win"]),
  text: texto,
});

/**
 * Os textos que o gerador de ramos copia para cada nó derivado, um por classe
 * de lance da técnica (`lib/chess/technique.ts`). São **escritos pelo autor**:
 * o gerador escolhe o lance, nunca a redação.
 *
 * Divergência declarada em relação ao plano da Parte D, que listava a chave
 * `shrink`: a classe que existe de verdade é `other`, e ela cobre o lance de
 * rei que **não** encurta a distância — tomar a oposição, que é metade da
 * técnica. Sem essa chave, o `c6c7` do mate ficaria sem texto.
 */
export const generatedTemplatesSchema = z.strictObject({
  /** Peça maior que encolhe a caixa. */
  cut: texto,
  /** Rei que se aproxima do rei inimigo. */
  approach: texto,
  /** Peça maior que mantém a caixa e o corte — o lance de espera. */
  tempo: texto,
  /** O lance que dá mate. */
  mate: texto,
  /** O resto: tipicamente o rei tomando a oposição. */
  other: texto,
});

export const lessonSchema = z.strictObject({
  /** ID editorial oficial do currículo (ex.: N0-R-MATE). Nunca renumerar. */
  id: z.string().regex(/^N[0-9]+-[A-Z0-9-]+$/, "id de aula fora do padrão (ex.: N0-R-MATE)"),
  title: texto,
  orientation: z.enum(["white", "black"]),
  domainCriterion: z.enum(["D1", "D2", "D3", "D4"]),
  /**
   * `draft` é o padrão: aula em construção, pode referenciar `fixture`.
   * `published` é a aula que chega ao aluno — o gate recusa qualquer
   * referência a posição não `approved`.
   */
  status: z.enum(["draft", "published"]).default("draft"),
  errors: z.record(errorIdSchema, lessonErrorSchema),
  fallbacks: z.strictObject({
    winningOffMethod: texto,
    losesWin: texto,
    /** O elogio da etapa 3 quando o lance é a mesma técnica por outro caminho. */
    methodAlternative: texto,
  }),
  /**
   * Textos dos ramos gerados. Opcional aqui porque nem toda aula gera ramo;
   * o gate exige (`TEMPLATE_FALTANDO`) assim que algum ramo é gerado.
   */
  generatedTemplates: generatedTemplatesSchema.optional(),
  /** Nem toda aula tem todas as etapas — cada bloco é opcional. */
  stages: z.strictObject({
    objective: objectiveStageSchema.optional(),
    example: exampleStageSchema.optional(),
    guided: guidedStageSchema.optional(),
    solo: soloStageSchema.optional(),
    practice: practiceStageSchema.optional(),
    review: reviewStageSchema.optional(),
  }),
});

/* ------------------------------------------------------------------ *
 * Tipos do motor — derivados do schema, nunca escritos duas vezes
 * ------------------------------------------------------------------ */

export type Provenance = z.infer<typeof provenanceSchema>;
export type PositionStatus = z.infer<typeof positionStatusSchema>;
export type Position = z.infer<typeof positionSchema>;

export type Expect = z.infer<typeof expectSchema>;
export type Mistake = z.infer<typeof mistakeSchema>;
export type TreeNode = z.infer<typeof treeNodeSchema>;
export type ObjectiveStage = z.infer<typeof objectiveStageSchema>;
export type ExampleStep = z.infer<typeof exampleStepSchema>;
export type ExampleStage = z.infer<typeof exampleStageSchema>;
export type GuidedStage = z.infer<typeof guidedStageSchema>;
export type SoloStage = z.infer<typeof soloStageSchema>;
export type PracticeStage = z.infer<typeof practiceStageSchema>;
export type ReviewStage = z.infer<typeof reviewStageSchema>;
export type LessonError = z.infer<typeof lessonErrorSchema>;
export type GeneratedTemplates = z.infer<typeof generatedTemplatesSchema>;
export type Lesson = z.infer<typeof lessonSchema>;

/** Uma árvore de lances, na forma comum à etapa 3 e à etapa 4. */
export type MoveTree = z.infer<typeof treeBaseSchema>;
