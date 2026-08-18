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
 * **A lista é por combinação, não por sítio.** `text-tinta-apagada` sobre a página
 * aparece em nove lugares e é uma linha só, com os lugares no campo `onde`:
 * medir a mesma dupla nove vezes dá nove vezes o mesmo número e uma tabela
 * ilegível. O que importa é que nenhuma *combinação* escape.
 *
 * **Isenção é escrita, nunca omitida.** Um par que não precisa bater o piso
 * continua na lista, continua medido e continua impresso — só não reprova. Par
 * omitido é par esquecido; par isento é decisão registrada, com o motivo do
 * lado. Hoje são três, todas de coisa que não carrega informação.
 *
 * **Dívida também é escrita.** Oito combinações do tema atual reprovam AA de
 * verdade — de 4,23:1 até 1,39:1. Elas não saem da lista nem viram isenção:
 * ganham o campo `divida` com o número medido e o bloco que as paga, e o teste
 * exige que continuem reprovando. Consertar a cor sem apagar a linha daqui fica
 * vermelho, e o campo esvazia no B6.5 — o delta entre oito e zero *é* a entrega
 * deste bloco.
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
    onde: "parágrafo de abertura — app/page.tsx:26, motor:28, sons:28, tabuleiro:21, EngineLab:226 e :268",
    texto: "tinta-tenue",
    fundo: PAGINA,
    piso: AA_TEXTO,
  },
  {
    onde: "corpo da etapa — PracticeStage:365, TreeStage:323, ReviewStage:58, PositionPlayer:209; e o hover dos links de volta",
    texto: "tinta-fraca",
    fundo: PAGINA,
    piso: AA_TEXTO,
  },
  {
    onde: "rótulo em caixa-alta e link de volta — ExampleStage:163, PracticeStage:368, TreeStage:327, ReviewStage:88, LessonPlayer:80, motor:23, sons:23, tabuleiro:17, rodapé da home",
    texto: "tinta-apagada",
    fundo: PAGINA,
    piso: AA_TEXTO,
    divida:
      "mede 4,23:1 — a reprovação nomeada no plano, e a de mais sítios: nove. Pago no B6.5.",
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
    onde: "corpo dentro do cartão — EngineLab:142, ExampleStage:169, MasterySeal:37 sem domínio",
    texto: "tinta-media",
    fundo: CARTA,
    piso: AA_TEXTO,
  },
  {
    onde: "painel neutro e aba inativa — FeedbackPanel:15, LessonPlayer:102, ReviewStage:78, EngineLab:208 e :247, MasterySeal:46",
    texto: "tinta-fraca",
    fundo: CARTA,
    piso: AA_TEXTO,
  },
  {
    onde: "texto secundário no cartão — app/page.tsx:56, FeedbackPanel:61, LessonPlayer:105, ReviewStage:48, PromotionPicker:51, SoundLab:125",
    texto: "tinta-tenue",
    fundo: CARTA,
    piso: AA_TEXTO,
  },
  {
    onde: "cabeçalho de tabela e rótulo dentro do cartão — EngineLab:197 e :246, SoundLab:153",
    texto: "tinta-apagada",
    fundo: CARTA,
    piso: AA_TEXTO,
    divida:
      "mede 3,74:1 — a reprovação nomeada no plano. `tinta-apagada` é o nível de cinza que não sobrevive: some contra o cartão. Pago no B6.5, na fusão dos cinco níveis de tinta em três.",
  },
  {
    onde: "erro na tabela do motor (EngineLab:208)",
    texto: "erro-texto",
    fundo: CARTA,
    piso: AA_TEXTO,
  },
  {
    onde: "campo de número do laboratório do motor (EngineLab:277)",
    texto: "tinta-media",
    fundo: PAGINA,
    piso: AA_TEXTO,
  },
  {
    onde: "travessão do que falta no selo (MasterySeal:47)",
    texto: "tinta-muda",
    fundo: CARTA,
    piso: AA_TEXTO,
    isencao:
      "é `aria-hidden`, é um travessão de marcador de lista, e o texto que ele antecede está em `tinta-fraca` ao lado. Nenhuma informação passa por ele.",
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
    onde: "botão neutro sob o ponteiro — LessonButton:23, PositionPlayer:246, SoundLab:119",
    texto: "tinta",
    fundo: CARTA_TOQUE,
    piso: AA_TEXTO,
  },
  {
    onde: "aba inativa das variações sob o ponteiro (ExampleStage:227)",
    texto: "tinta-tenue",
    fundo: CARTA_ALTA,
    piso: AA_TEXTO,
  },
  {
    onde: "aba ativa das variações (ExampleStage:226)",
    texto: "tinta-inversa",
    fundo: CARTA_TOQUE,
    piso: AA_TEXTO,
  },
  {
    onde: "botão primário em repouso — LessonButton:22, LessonPlayer:101 e :246, ReviewStage:77",
    texto: "tinta-inversa",
    fundo: ["metodo-cheio"],
    piso: AA_TEXTO,
    divida:
      "mede 3,67:1 — a reprovação nomeada no plano. Branco sobre `metodo-cheio` não bate AA em nenhuma composição; o botão primário precisa de um verde bem mais escuro. Pago no B6.5.",
  },
  {
    onde: "botão primário sob o ponteiro — LessonButton:22, LessonPlayer:246",
    texto: "tinta-inversa",
    fundo: ["metodo-cheio-toque"],
    piso: AA_TEXTO,
    divida:
      "mede 2,46:1. O hover clareia o fundo (`metodo-cheio-toque`) sem clarear a tinta, então piora um estado de repouso que já reprovava. Pago no B6.5 junto com o botão primário.",
  },
  {
    onde: "numeral da etapa dentro da aba ativa (LessonPlayer:105 sobre LessonPlayer:101)",
    texto: "tinta-tenue",
    fundo: ["metodo-cheio"],
    piso: AA_TEXTO,
    divida:
      "mede 1,39:1 contra os 4,5 do piso — a pior reprovação do tema atual, e a que o plano do B6 não tinha visto. O numeral é `tinta-tenue`, um cinza escolhido para fundo escuro, e a aba ativa é `metodo-cheio`, claro: a tinta ficou onde estava quando o fundo mudou. Pago no B6.5, quando a aba ativa passa a ter tinta própria em vez de herdar a do estado inativo.",
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
    texto: "tinta-fraca",
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
    texto: "tinta-apagada",
    fundo: ["carta/40", ...PAGINA],
    piso: AA_TEXTO,
    divida:
      "mede 4,06:1. Mesmo `tinta-apagada`, agora sobre o cartão a 40% da home. Pago no B6.5.",
  },
  {
    onde: "caixa de medida da variante inativa — SoundLab:163, :237, :239, :268, :297",
    texto: "tinta-apagada",
    fundo: ["papel/40", ...CARTA],
    piso: AA_TEXTO,
    divida:
      "mede 3,96:1. Mesmo `tinta-apagada`, agora sobre a caixa rebaixada de `/sons`. Pago no B6.5.",
  },
  {
    onde: "nome da variante inativa — SoundLab:164, :200, :201, :252",
    texto: "tinta-tenue",
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
    onde: "nota da variante ativa (SoundLab:268 sobre :248)",
    texto: "tinta-apagada",
    fundo: ["metodo-superficie/5", ...CARTA],
    piso: AA_TEXTO,
    divida:
      "mede 3,50:1. É `tinta-apagada` sobre o cartão da variante ativa de `/sons`, já tingido de verde. Pago no B6.5, quando o quinto nível de cinza deixar de existir.",
  },
  {
    onde: "nome da variante ativa (SoundLab:252 sobre :248)",
    texto: "tinta-tenue",
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
];
