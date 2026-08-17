"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { ENGINE_BUILD, type EngineBuild } from "./build.ts";
import {
  acquireEngine,
  getEngineStatus,
  isAborted,
  releaseEngine,
  subscribeEngineStatus,
  type BestMoveRequest,
  type EngineHandle,
  type EngineStatus,
} from "./stockfish.ts";

/**
 * A fronteira assíncrona do projeto.
 *
 * Do lado de dentro há `Promise`; do lado de fora, **callback** — que é a forma
 * que o resto do código já usa (o `setTimeout` da resposta do defensor, no
 * `TreeStage`). Nenhum componente escreve `await`, nenhum componente vê uma
 * promessa, e a store nunca guarda o worker.
 *
 * `enabled` liga o motor. Passar `false` não toma referência nenhuma — é o que
 * mantém a promessa do plano de que o motor só carrega quando a etapa 5 abre, e
 * o que permite montar a etapa sem motor enquanto ela ainda nem apareceu.
 */
export function useEngine(
  enabled: boolean,
  build: EngineBuild = ENGINE_BUILD,
): {
  status: EngineStatus;
  /** Pede um lance. A resposta chega por `onMove` — nunca por retorno. */
  think: (
    req: BestMoveRequest,
    onMove: (uci: string) => void,
    onError?: (message: string) => void,
  ) => void;
  /** Desiste da busca em voo. Seguro chamar a qualquer momento. */
  abort: () => void;
  retry: () => void;
  newGame: () => void;
} {
  // O estado do motor vive fora do React, como a preferência de som: o worker
  // é um só na página e não pertence a componente nenhum. `useSyncExternalStore`
  // é a leitura correta disso — e evita o `setState` dentro de efeito, que
  // dispara renderização em cascata.
  const status = useSyncExternalStore<EngineStatus>(
    subscribeEngineStatus,
    getEngineStatus,
    () => "loading",
  );
  const engine = useRef<EngineHandle | null>(null);

  useEffect(() => {
    if (!enabled) return;
    engine.current = acquireEngine(build);
    return () => {
      engine.current = null;
      releaseEngine();
    };
  }, [enabled, build]);

  const think = useCallback(
    (req: BestMoveRequest, onMove: (uci: string) => void, onError?: (message: string) => void) => {
      const handle = engine.current;
      if (!handle) return;
      handle
        .bestMove(req)
        .then(onMove)
        .catch((error: unknown) => {
          // Busca abandonada é o caminho normal — o aluno recomeçou, trocou de
          // etapa ou saiu. Só o que não é abandono vira erro para a tela.
          if (isAborted(error)) return;
          onError?.(error instanceof Error ? error.message : "o motor falhou");
        });
    },
    [],
  );

  const abort = useCallback(() => engine.current?.cancel(), []);
  const retry = useCallback(() => engine.current?.retry(), []);
  const newGame = useCallback(() => engine.current?.newGame(), []);

  return { status, think, abort, retry, newGame };
}
