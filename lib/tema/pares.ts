/**
 * O contrato de legibilidade: cada par de tinta e fundo que o site produz, com
 * o piso que ele tem de bater.
 *
 * **O que é um par.** Uma cor de texto e a pilha de fundos embaixo dela, do mais
 * próximo do olho ao mais distante. A pilha é declarada inteira porque painel
 * tingido é semitransparente: `bg-metodo-superficie/10` não tem contraste nenhum por
 * si só — tem o contraste do que sobra depois de compor com a página. O selo de
 * conclusão chega a três camadas.
 *
 * **A lista é por combinação, não por sítio.** `text-tinta-fraca` sobre a
 * página aparece em treze lugares e é uma linha só, com todos eles no campo
 * `onde`: medir a mesma dupla treze vezes dá treze vezes o mesmo número e uma
 * tabela ilegível. O que importa é que nenhuma *combinação* escape.
 *
 * **Isenção é escrita, nunca omitida.** Um par que não precisa bater o piso
 * continua na lista, continua medido e continua impresso — só não reprova. Par
 * omitido é par esquecido; par isento é decisão registrada, com o motivo do
 * lado. Hoje são três, todas de coisa que não carrega informação.
 *
 * **Dívida está escrita, e hoje está vazia.** O tema que o site tinha no B6.1
 * reprovava AA em oito combinações, de 4,23:1 a 1,39:1. Sete foram pagas pela
 * paleta clara; a oitava, e pior delas, foi paga antes, por conserto de
 * componente — era tinta encostada num fundo que mudou de claridade embaixo
 * dela, e nenhuma paleta salvaria isso.
 *
 * O campo `divida` continua existindo e continua sendo exigente: um par que o
 * declare **tem** de reprovar, senão o teste fica vermelho. Ele é o caminho
 * honesto para registrar um defeito conhecido em vez de escondê-lo — e o
 * caminho de volta, porque consertar a cor sem apagar a linha também reprova.
 * Que ele esteja vazio é a entrega do B6, não uma propriedade permanente.
 */

/** Piso da WCAG 2.2 para corpo de texto (1.4.3, AA). */
export const AA_TEXTO = 4.5;
/** Piso para texto grande — ≥ 24 px, ou ≥ 18,66 px em negrito (1.4.3, AA). */
export const AA_TEXTO_GRANDE = 3;
/** Piso para componente de interface e foco visível (1.4.11, AA). */
export const AA_COMPONENTE = 3;

export type Par = {
  /** Onde isto aparece na tela. Arquivo e linha quando é um sítio só. */
  onde: string;
  /**
   * A tinta, pelo nome do token — o mesmo que sai de `app/globals.css`, com
   * o modificador de opacidade quando houver (`metodo/80`).
   * Aceita uma pilha quando a tinta é semitransparente sobre algo que **não** é
   * o fundo contra o qual ela é medida — o caso é a borda do cartão, que compõe
   * com o cartão e é lida contra a página.
   */
  texto: string | string[];
  /** A pilha de fundo, do mais próximo do olho ao mais distante. A última é opaca. */
  fundo: string[];
  /** Razão mínima aceitável. */
  piso: number;
  /**
   * Se preenchido, o par é medido e impresso mas não reprova. O texto é o
   * motivo, e ele tem de responder "por que a WCAG não se aplica aqui".
   *
   * Isenção **não é** dívida: isenção diz que o piso não se aplica, dívida diz
   * que se aplica e estamos abaixo dele.
   */
  isencao?: string;
  /**
   * Reprovação conhecida e registrada, com o número medido e o bloco que a
   * paga. Existe para que o CI possa ficar verde sem que o defeito suma de
   * vista: o teste exige que um par com `divida` **de fato** reprove, então
   * consertar a cor sem apagar a linha daqui também fica vermelho.
   */
  divida?: string;
};

/** A página. É o `bg-papel` do `<body>`, e está embaixo de tudo. */
const PAGINA = ["papel"];
/** O cartão neutro, opaco, sobre a página. */
const CARTA = ["carta"];
/** O botão neutro em repouso e sob o ponteiro. */
const CARTA_ALTA = ["carta-alta"];
const CARTA_TOQUE = ["carta-toque"];

/**
 * As marcas do tabuleiro, cada uma medida contra **as duas casas**.
 *
 * A duplicação é gerada e não escrita à mão porque a regra é estrutural: uma
 * marca que só contrasta com a casa clara desaparece em metade do tabuleiro, e
 * qual metade depende de onde a peça está. Escrever os pares a dedo deixaria
 * cedo ou tarde alguém acrescentar uma marca e lembrar de só uma das casas.
 *
 * É esta regra que amarra o par de casas inteiro: como toda marca precisa ser
 * 3:1 **mais escura que as duas**, e acima da casa clara não sobra espaço, a
 * casa escura não pode escurecer à vontade — cada ponto que ela desce puxa para
 * baixo o teto de claridade de todas as marcas. As duas ficaram a 1,58:1 uma da
 * outra, que é exatamente a distância que o tema do pacote produzia.
 */
const MARCAS: { onde: string; token: string; piso: number }[] = [
  {
    onde: "coordenada (a–h, 1–8) — tinta única para as duas casas, e é ela que fecha o orçamento do par",
    token: "coordenada",
    piso: AA_TEXTO,
  },
  { onde: "destino de lance legal e casa selecionada", token: "destino", piso: AA_COMPONENTE },
  { onde: "realce do último lance", token: "ultimo-lance", piso: AA_COMPONENTE },
  { onde: "clarão do rei em xeque", token: "xeque", piso: AA_COMPONENTE },
  { onde: "destino de pré-lance", token: "premove", piso: AA_COMPONENTE },

  // Os quatro pincéis pedagógicos. O `/55` do corte é o mesmo alfa que a
  // tabela `PINCEIS` de `ChessBoard.tsx` passa ao chessground: ele pinta a
  // parede inteira, e opaco viraria um bloco. Os outros três são traço fino e
  // vão opacos.
  { onde: "pincel do corte — a parede que o rei não atravessa", token: "pincel-corte/55", piso: AA_COMPONENTE },
  { onde: "pincel da peça pendurada", token: "pincel-pendurada", piso: AA_COMPONENTE },
  { onde: "pincel da peça defendida", token: "pincel-defendida", piso: AA_COMPONENTE },
  { onde: "pincel da seta do exemplo", token: "pincel-seta", piso: AA_COMPONENTE },
];

const NAS_DUAS_CASAS: Par[] = MARCAS.flatMap(({ onde, token, piso }) => [
  { onde: `${onde} — na casa clara`, texto: token, fundo: ["casa-clara"], piso },
  { onde: `${onde} — na casa escura`, texto: token, fundo: ["casa-escura"], piso },
]);

export const PARES: Par[] = [
  // -------------------------------------------------------------------------
  // Esqueleto e tinta sobre a página
  // -------------------------------------------------------------------------
  {
    onde: "app/layout.tsx:26 — corpo do documento, e todo <h1> que herda dele",
    texto: "tinta",
    fundo: PAGINA,
    piso: AA_TEXTO,
  },
  {
    onde: "parágrafo de abertura e rótulo sobre a página — page:26, motor:23 e :28, sons:23 e :28, tabuleiro:17 e :21, EngineLab:226 e :268, ExampleStage:163, PracticeStage:368, TreeStage:327, ReviewStage:88, LessonPlayer:80, rodapé da home",
    texto: "tinta-fraca",
    fundo: PAGINA,
    piso: AA_TEXTO,
  },
  {
    onde: "corpo da etapa e campo de número — PracticeStage:365, TreeStage:323, ReviewStage:58, PositionPlayer:209, EngineLab:277; e o hover dos links de volta",
    texto: "tinta-media",
    fundo: PAGINA,
    piso: AA_TEXTO,
  },
  {
    onde: "rótulo do nível na home (app/page.tsx:22)",
    texto: "metodo",
    fundo: PAGINA,
    piso: AA_TEXTO,
  },
  {
    onde: "“· pensando…” do motor (PracticeStage:374)",
    texto: "metodo/80",
    fundo: PAGINA,
    piso: AA_TEXTO,
  },
  {
    onde: "recusa de lance na sala de tabuleiro (PositionPlayer:209)",
    texto: "erro-texto",
    fundo: PAGINA,
    piso: AA_TEXTO,
  },

  // -------------------------------------------------------------------------
  // Cartão neutro
  // -------------------------------------------------------------------------
  {
    onde: "título dentro do cartão — app/page.tsx:55",
    texto: "tinta",
    fundo: CARTA,
    piso: AA_TEXTO,
  },
  {
    onde: "corpo, painel neutro e aba inativa dentro do cartão — EngineLab:142, :208 e :247, ExampleStage:169, FeedbackPanel:15, LessonPlayer:102, ReviewStage:78, MasterySeal:37 e :46",
    texto: "tinta-media",
    fundo: CARTA,
    piso: AA_TEXTO,
  },
  {
    onde: "texto secundário, cabeçalho de tabela e rótulo dentro do cartão — page:56, FeedbackPanel:61, LessonPlayer:105, ReviewStage:48, PromotionPicker:51, EngineLab:197 e :246, SoundLab:125 e :153",
    texto: "tinta-fraca",
    fundo: CARTA,
    piso: AA_TEXTO,
  },
  {
    onde: "erro na tabela do motor (EngineLab:208)",
    texto: "erro-texto",
    fundo: CARTA,
    piso: AA_TEXTO,
  },
  {
    onde: "travessão do que falta no selo (MasterySeal:47)",
    texto: "tinta-muda",
    fundo: CARTA,
    piso: AA_TEXTO,
    isencao:
      "é `aria-hidden`, é um travessão de marcador de lista, e o texto que ele antecede está em `tinta-media` ao lado. Nenhuma informação passa por ele.",
  },

  // -------------------------------------------------------------------------
  // Botões: as três peles
  // -------------------------------------------------------------------------
  {
    onde: "botão neutro em repouso — LessonButton:23, PositionPlayer:246, SoundLab:119, ExampleStage:227 sob o ponteiro",
    texto: "tinta",
    fundo: CARTA_ALTA,
    piso: AA_TEXTO,
  },
  {
    onde: "botão neutro sob o ponteiro e aba ativa das variações — LessonButton:23, PositionPlayer:246, SoundLab:119, ExampleStage:226",
    texto: "tinta",
    fundo: CARTA_TOQUE,
    piso: AA_TEXTO,
  },
  {
    onde: "aba inativa das variações sob o ponteiro (ExampleStage:227)",
    texto: "tinta-fraca",
    fundo: CARTA_ALTA,
    piso: AA_TEXTO,
  },
  {
    onde: "botão primário em repouso — LessonButton:22, LessonPlayer:101 e :246, ReviewStage:77",
    texto: "tinta-inversa",
    fundo: ["metodo-cheio"],
    piso: AA_TEXTO,
  },
  {
    onde: "botão primário sob o ponteiro — LessonButton:22, LessonPlayer:246",
    texto: "tinta-inversa",
    fundo: ["metodo-cheio-toque"],
    piso: AA_TEXTO,
  },

  // -------------------------------------------------------------------------
  // Painéis tingidos — os quatro papéis semânticos
  // -------------------------------------------------------------------------
  {
    onde: "feedback do método (FeedbackPanel:12)",
    texto: "metodo-tinta",
    fundo: ["metodo-superficie/10", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "feedback de erro (FeedbackPanel:13)",
    texto: "erro-tinta",
    fundo: ["erro-superficie/10", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "feedback de aviso (FeedbackPanel:14)",
    texto: "aviso-tinta",
    fundo: ["aviso-superficie/10", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "feedback de conclusão (FeedbackPanel:16)",
    texto: "metodo-tinta-alta",
    fundo: ["metodo-superficie/20", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "selo “Etapa concluída.” — três camadas (FeedbackPanel:54 sobre :16 sobre a página)",
    texto: "metodo-selo",
    fundo: ["metodo/20", "metodo-superficie/20", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "dica do motor na prática — PracticeStage:383, TreeStage:350",
    texto: "dica-tinta",
    fundo: ["dica-superficie/5", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "aviso de fim de prática (PracticeStage:391)",
    texto: "aviso-tinta",
    fundo: ["aviso-superficie/5", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "rótulo do critério de domínio (ObjectiveStage:30)",
    texto: "metodo",
    fundo: ["metodo-superficie/5", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "texto do critério de domínio (ObjectiveStage:33)",
    texto: "tinta-media",
    fundo: ["metodo-superficie/5", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "manchete do selo com domínio (MasterySeal:37)",
    texto: "metodo-selo",
    fundo: ["metodo-superficie/10", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "lista do que falta, com domínio (MasterySeal:46)",
    texto: "tinta-media",
    fundo: ["metodo-superficie/10", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "travessão do selo, com domínio (MasterySeal:47)",
    texto: "tinta-muda",
    fundo: ["metodo-superficie/10", ...PAGINA],
    piso: AA_TEXTO,
    isencao: "mesmo travessão `aria-hidden` de MasterySeal:47, na variante tingida do selo.",
  },

  // -------------------------------------------------------------------------
  // Superfícies rebaixadas: fundo escuro sobre fundo escuro
  // -------------------------------------------------------------------------
  {
    onde: "aula ainda não publicada na home (app/page.tsx:40)",
    texto: "tinta-fraca",
    fundo: ["carta/40", ...PAGINA],
    piso: AA_TEXTO,
  },
  {
    onde: "variante inativa de /sons — SoundLab:163, :164, :200, :201, :237, :239, :252, :268, :297",
    texto: "tinta-fraca",
    fundo: ["papel/40", ...CARTA],
    piso: AA_TEXTO,
  },
  {
    onde: "número medido na variante inativa (SoundLab:238)",
    texto: "tinta-media",
    fundo: ["papel/40", ...CARTA],
    piso: AA_TEXTO,
  },
  {
    onde: "variante ativa de /sons — SoundLab:252 e :268, sobre o cartão tingido de :248",
    texto: "tinta-fraca",
    fundo: ["metodo-superficie/5", ...CARTA],
    piso: AA_TEXTO,
  },
  {
    onde: "número medido na variante ativa (SoundLab:238 sobre :248)",
    texto: "tinta-media",
    fundo: ["metodo-superficie/5", ...CARTA],
    piso: AA_TEXTO,
  },
  {
    onde: "selo “toca hoje” — três camadas (SoundLab:256 sobre :248 sobre o cartão)",
    texto: "metodo-selo",
    fundo: ["metodo/20", "metodo-superficie/5", ...CARTA],
    piso: AA_TEXTO,
  },

  // -------------------------------------------------------------------------
  // Componentes de interface: 1.4.11, piso 3:1
  // -------------------------------------------------------------------------
  {
    onde: "anel de foco sobre a página — os 10 sítios da utilitária `foco`, cujo `outline-offset` positivo joga o anel para fora do botão, sobre o fundo atrás dele",
    texto: "foco",
    fundo: PAGINA,
    piso: AA_COMPONENTE,
  },
  {
    onde: "anel de foco sobre o cartão — SoundLab:119, PromotionPicker:39",
    texto: "foco",
    fundo: CARTA,
    piso: AA_COMPONENTE,
  },
  {
    onde: "borda do cartão neutro — `border-borda` sobre o cartão, contra a página",
    // A borda compõe com o fundo do próprio cartão (o `background` vai até a
    // `border-box`) e é lida contra a página, do lado de fora. Daí a pilha.
    texto: ["borda", ...CARTA],
    fundo: PAGINA,
    piso: AA_COMPONENTE,
    isencao:
      "a borda não carrega informação: o cartão já se separa da página pelo próprio fundo, e o conteúdo dele não depende de enxergar o limite. Vira contrato de verdade só se algum dia o cartão perder o fundo.",
  },
  // -------------------------------------------------------------------------
  // O tabuleiro — ver `NAS_DUAS_CASAS` logo abaixo
  // -------------------------------------------------------------------------
  ...NAS_DUAS_CASAS,
];
