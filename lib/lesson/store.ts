"use client";

import { create } from "zustand";

/**
 * O estado da aula (plano da F1, §4). Uma store só, porque só existe uma aula
 * aberta por vez: a rota `app/aula/[id]` a inicializa em `open()` e todo o
 * resto — etapa atual, passo da etapa 2, nó da árvore, mensagem do painel —
 * mora aqui, fora dos componentes.
 *
 * O que **não** mora aqui: a posição desenhada no tabuleiro durante a animação
 * de um lance. Essa é efêmera e vive no componente da etapa.
 */

export type StageKey = "objective" | "example" | "guided" | "solo" | "practice" | "review";
export type TreeKey = "guided" | "solo";

export const STAGE_ORDER: StageKey[] = [
  "objective",
  "example",
  "guided",
  "solo",
  "practice",
  "review",
];

export const STAGE_LABEL: Record<StageKey, string> = {
  objective: "Objetivo",
  example: "Exemplo",
  guided: "Com ajuda",
  solo: "Sem ajuda",
  practice: "Prática real",
  review: "Revisão",
};

export type MessageTone = "good" | "bad" | "warn" | "neutral";

export type PanelMessage = {
  tone: MessageTone;
  text: string;
  /**
   * Sobe a cada mensagem. Serve a duas coisas: o `aria-live` reanuncia mesmo
   * quando o texto se repete (o aluno insistiu no mesmo erro), e o reforço
   * visual na casa sabe que é um evento novo.
   */
  seq: number;
  /** Casa envolvida, para o reforço visual breve no tabuleiro. */
  square?: string;
  /**
   * Esta mensagem é a conclusão da etapa. O painel só consegue enfatizar o que
   * é nó separado — enquanto "Etapa concluída." era concatenada no fim do texto
   * do autor, não havia o que destacar, e o leitor de tela recebia a conclusão
   * como rabo de frase em vez de começar por ela.
   */
  done?: boolean;
};

export type TreeStatus = "playing" | "done" | "failed";

/**
 * A foto do fim da etapa. Existe porque o lance que dá mate é terminal: ele não
 * tem nó de destino, então `nodeId` fica parado no nó **anterior** ao mate e a
 * posição final não está em lugar nenhum da árvore. Enquanto ela vivia só no
 * estado local do componente, sair da etapa e voltar ressuscitava a posição
 * pré-mate com a etapa já fechada para lances — parecia travada.
 */
export type TreeEnd = {
  fen: string;
  lastMove: [string, string];
  /** O feedback do nó terminal, para o painel reencontrar a conclusão. */
  text: string;
};

/**
 * Por que a tentativa acabou. A posição não precisa ser guardada como no `end`
 * — o nó parado já é a certa —, mas o texto sim: sem ele o aluno volta à etapa
 * e encontra o botão de recomeçar sem saber o que errou.
 */
export type TreeFailure = {
  tone: MessageTone;
  text: string;
};

export type TreeState = {
  nodeId: string;
  rootId: string;
  /** Lances do aluno aceitos nesta tentativa — é o que o `moveLimit` conta. */
  studentMoves: number;
  /** Quantas vezes a etapa 4 recomeçou do zero. */
  attempt: number;
  status: TreeStatus;
  hintOpen: boolean;
  /** Preenchido só quando `status` é `done`. */
  end: TreeEnd | null;
  /** Preenchido só quando `status` é `failed`. */
  failure: TreeFailure | null;
};

function freshTree(rootId: string, attempt = 1): TreeState {
  return {
    nodeId: rootId,
    rootId,
    studentMoves: 0,
    attempt,
    status: "playing",
    hintOpen: false,
    end: null,
    failure: null,
  };
}

/**
 * A mensagem que a etapa reencontra ao ser remontada. `goToStage` apaga a
 * mensagem viva — é uma só para a aula inteira —, e sair de uma etapa desmonta
 * o componente dela. O que sobrevive é o desfecho guardado na árvore: a
 * conclusão do mate ou a explicação da tentativa encerrada.
 *
 * `seq` 0 porque não é evento novo: é o estado em que a etapa ficou. Quem
 * anuncia mudança é a mensagem viva, que tem precedência sobre esta.
 */
export function restingMessage(tree: TreeState | undefined): PanelMessage | null {
  if (!tree) return null;
  if (tree.end) return { tone: "good", text: tree.end.text, done: true, seq: 0 };
  if (tree.failure) return { tone: tree.failure.tone, text: tree.failure.text, seq: 0 };
  return null;
}

type LessonStore = {
  lessonId: string | null;
  stage: StageKey;
  /** Quantos lances da etapa 2 já foram reproduzidos (0 = posição inicial). */
  step: number;
  trees: Partial<Record<TreeKey, TreeState>>;
  message: PanelMessage | null;

  open: (lessonId: string, stage: StageKey, roots: Partial<Record<TreeKey, string>>) => void;
  goToStage: (stage: StageKey) => void;
  setStep: (step: number) => void;
  say: (tone: MessageTone, text: string, square?: string) => void;
  /**
   * A mensagem de fim de etapa. Ação nomeada em vez de um quarto parâmetro
   * posicional no `say` — que tem ~20 chamadas e ficaria ilegível com um
   * booleano solto no fim.
   */
  celebrate: (text: string) => void;
  clearMessage: () => void;
  /** Apaga só o reforço visual; o texto do painel continua na tela. */
  fadeFlash: () => void;
  /**
   * Um lance do aluno aceito. `nextNodeId` `null` é o lance terminal — e aí o
   * `end` é obrigatório na prática, porque é a única cópia da posição do mate.
   */
  treeAdvance: (key: TreeKey, nextNodeId: string | null, end?: TreeEnd) => void;
  /** Encerra a tentativa. `reason` é o texto que o painel reencontra depois. */
  treeFail: (key: TreeKey, reason?: TreeFailure) => void;
  treeRestart: (key: TreeKey) => void;
  toggleHint: (key: TreeKey) => void;
};

export const useLessonStore = create<LessonStore>((set) => ({
  lessonId: null,
  stage: "objective",
  step: 0,
  trees: {},
  message: null,

  open: (lessonId, stage, roots) =>
    set({
      lessonId,
      stage,
      step: 0,
      message: null,
      trees: {
        ...(roots.guided ? { guided: freshTree(roots.guided) } : {}),
        ...(roots.solo ? { solo: freshTree(roots.solo) } : {}),
      },
    }),

  goToStage: (stage) => set({ stage, message: null }),
  setStep: (step) => set({ step }),

  say: (tone, text, square) =>
    set((state) => ({
      message: { tone, text, square, seq: (state.message?.seq ?? 0) + 1 },
    })),

  celebrate: (text) =>
    set((state) => ({
      message: { tone: "good", text, done: true, seq: (state.message?.seq ?? 0) + 1 },
    })),

  clearMessage: () => set({ message: null }),
  fadeFlash: () =>
    set((state) => (state.message ? { message: { ...state.message, square: undefined } } : state)),

  treeAdvance: (key, nextNodeId, end) =>
    set((state) => {
      const tree = state.trees[key];
      if (!tree) return state;
      const finished = nextNodeId === null;
      return {
        trees: {
          ...state.trees,
          [key]: {
            ...tree,
            nodeId: nextNodeId ?? tree.nodeId,
            studentMoves: tree.studentMoves + 1,
            status: finished ? "done" : tree.status,
            hintOpen: false,
            // Só o lance terminal fecha a etapa; num avanço comum um `end`
            // solto seria ruído, então nem é lido.
            end: finished ? (end ?? null) : tree.end,
          },
        },
      };
    }),

  treeFail: (key, reason) =>
    set((state) => {
      const tree = state.trees[key];
      if (!tree) return state;
      return {
        trees: {
          ...state.trees,
          [key]: { ...tree, status: "failed", failure: reason ?? null },
        },
      };
    }),

  treeRestart: (key) =>
    set((state) => {
      const tree = state.trees[key];
      if (!tree) return state;
      return {
        message: null,
        trees: { ...state.trees, [key]: freshTree(tree.rootId, tree.attempt + 1) },
      };
    }),

  toggleHint: (key) =>
    set((state) => {
      const tree = state.trees[key];
      if (!tree) return state;
      return { trees: { ...state.trees, [key]: { ...tree, hintOpen: !tree.hintOpen } } };
    }),
}));
