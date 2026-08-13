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
};

export type TreeStatus = "playing" | "done" | "failed";

export type TreeState = {
  nodeId: string;
  rootId: string;
  /** Lances do aluno aceitos nesta tentativa — é o que o `moveLimit` conta. */
  studentMoves: number;
  /** Quantas vezes a etapa 4 recomeçou do zero. */
  attempt: number;
  status: TreeStatus;
  hintOpen: boolean;
};

function freshTree(rootId: string, attempt = 1): TreeState {
  return { nodeId: rootId, rootId, studentMoves: 0, attempt, status: "playing", hintOpen: false };
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
  clearMessage: () => void;
  /** Apaga só o reforço visual; o texto do painel continua na tela. */
  fadeFlash: () => void;
  treeAdvance: (key: TreeKey, nextNodeId: string | null) => void;
  treeFail: (key: TreeKey) => void;
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

  clearMessage: () => set({ message: null }),
  fadeFlash: () =>
    set((state) => (state.message ? { message: { ...state.message, square: undefined } } : state)),

  treeAdvance: (key, nextNodeId) =>
    set((state) => {
      const tree = state.trees[key];
      if (!tree) return state;
      return {
        trees: {
          ...state.trees,
          [key]: {
            ...tree,
            nodeId: nextNodeId ?? tree.nodeId,
            studentMoves: tree.studentMoves + 1,
            status: nextNodeId === null ? "done" : tree.status,
            hintOpen: false,
          },
        },
      };
    }),

  treeFail: (key) =>
    set((state) => {
      const tree = state.trees[key];
      if (!tree) return state;
      return { trees: { ...state.trees, [key]: { ...tree, status: "failed" } } };
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
