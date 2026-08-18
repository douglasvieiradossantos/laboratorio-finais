"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { LessonButton } from "@/components/lesson/LessonButton";
import { ENGINE_BUILD, engineTotalBytes, formatBytes } from "@/lib/engine/build";
import { readEngineTimings } from "@/lib/engine/stockfish";
import { useEngine } from "@/lib/engine/useEngine";

/**
 * A bancada do motor. Não é para o aluno — é o instrumento que transforma
 * "parece rápido" em número, do mesmo jeito que a `/sons` faz com o som.
 *
 * Existe porque nenhum teste automático deste projeto alcança Worker nem
 * WebAssembly: `npm test` é `node --test` sem navegador. O alvo do plano da F1
 * (≤ 2 s por lance no celular) precisa ser lido em algum lugar, e é aqui.
 *
 * As posições são as mesmas famílias que a etapa 5 vai enfrentar: um KRK vazio,
 * um KQK e um rei e peão. A `medir tudo` roda a bateria e devolve uma tabela
 * pronta para colar.
 */

type Caso = { id: string; nome: string; fen: string };

const CASOS: Caso[] = [
  { id: "krk", nome: "Torre e rei contra rei", fen: "8/8/8/4k3/8/8/4K3/7R w - - 0 1" },
  { id: "kqk", nome: "Dama e rei contra rei", fen: "8/8/8/4k3/8/8/4K3/7Q w - - 0 1" },
  { id: "kpk", nome: "Rei e peão contra rei", fen: "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1" },
  { id: "krk-defesa", nome: "KRK, defendendo (pretas)", fen: "8/8/8/4k3/8/8/4K3/7R b - - 0 1" },
];

type Linha = {
  caso: string;
  skill: number;
  moveTimeMs: number;
  lance: string;
  thinkMs: number | null;
  erro?: string;
};

export function EngineLab() {
  const [ligado, setLigado] = useState(false);
  const { status, think, abort, retry, newGame } = useEngine(ligado);
  const [skill, setSkill] = useState(3);
  const [moveTimeMs, setMoveTimeMs] = useState(300);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [rodando, setRodando] = useState(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  // Derivado, não estado: a medida da carga já existe no `performance` do
  // navegador, e copiá-la para dentro do React só criaria uma segunda verdade
  // (e uma renderização em cascata). Quando o estado vira `ready` este
  // componente já re-renderiza, e a leitura acontece junto.
  const loadMs = status === "ready" ? readEngineTimings().loadMs : null;

  const pedir = useCallback(
    (caso: Caso, depois?: () => void) => {
      const começou = performance.now();
      setRodando(true);
      think(
        { fen: caso.fen, skill, moveTimeMs },
        (uci) => {
          if (!vivo.current) return;
          const medido = readEngineTimings().thinkMs ?? Math.round(performance.now() - começou);
          // A chess.js confirma que o lance é legal na posição — o mesmo
          // guarda-corpo que a etapa 5 usa antes de mover a peça na tela.
          const jogo = new Chess(caso.fen);
          const legal = jogo
            .moves({ verbose: true })
            .some((m) => `${m.from}${m.to}${m.promotion ?? ""}` === uci);
          setLinhas((atual) => [
            ...atual,
            {
              caso: caso.nome,
              skill,
              moveTimeMs,
              lance: uci,
              thinkMs: medido,
              erro: legal ? undefined : "LANCE ILEGAL",
            },
          ]);
          setRodando(false);
          depois?.();
        },
        (mensagem) => {
          if (!vivo.current) return;
          setLinhas((atual) => [
            ...atual,
            { caso: caso.nome, skill, moveTimeMs, lance: "—", thinkMs: null, erro: mensagem },
          ]);
          setRodando(false);
          depois?.();
        },
      );
    },
    [think, skill, moveTimeMs],
  );

  /**
   * Um caso de cada vez, encadeado pelo callback.
   *
   * Disparar os quatro em sequência **não** funcionaria, e o motivo é o próprio
   * desenho do motor: o protocolo UCI é um cano só, então cada `bestMove` novo
   * cancela o anterior. Quatro pedidos de uma vez seriam três buscas abandonadas
   * e uma linha na tabela.
   */
  const medirTudo = useCallback(() => {
    newGame();
    const proximo = (i: number) => {
      if (i >= CASOS.length) return;
      pedir(CASOS[i], () => proximo(i + 1));
    };
    proximo(0);
  }, [newGame, pedir]);

  /**
   * Cancelar é **duas** coisas, e esquecer a segunda trava a tela.
   *
   * `abort()` só fala com o motor. A busca abandonada nunca chama de volta — é
   * o comportamento certo, porque quem cancelou já sabe que cancelou —, e por
   * isso nada limparia o "pensando" daqui sozinho: o botão de medir ficaria
   * desabilitado para sempre. Quem cancela limpa o próprio estado.
   */
  const cancelar = useCallback(() => {
    abort();
    setRodando(false);
  }, [abort]);

  const rotuloStatus =
    status === "ready" ? "pronto" : status === "failed" ? "falhou" : "carregando…";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-borda bg-carta p-4">
        <h2 className="text-sm font-semibold text-tinta-media">A build</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Campo rotulo="Identificação" valor={ENGINE_BUILD.id} />
          <Campo rotulo="Peso total" valor={formatBytes(engineTotalBytes())} />
          <Campo
            rotulo="Isolamento de origem"
            valor={ENGINE_BUILD.needsCrossOriginIsolation ? "exigido" : "dispensado"}
          />
          <Campo rotulo="Estado" valor={rotuloStatus} />
          <Campo rotulo="Carga (worker → readyok)" valor={loadMs === null ? "—" : `${loadMs} ms`} />
          <Campo rotulo="Buscas medidas" valor={String(linhas.length)} />
        </dl>
      </section>

      <section className="flex flex-wrap items-end gap-3">
        {!ligado ? (
          <LessonButton variant="primary" onClick={() => setLigado(true)}>
            Carregar o motor ({formatBytes(engineTotalBytes())})
          </LessonButton>
        ) : (
          <>
            <Numero rotulo="Skill (0–20)" valor={skill} min={0} max={20} onChange={setSkill} />
            <Numero
              rotulo="movetime (ms)"
              valor={moveTimeMs}
              min={50}
              max={5000}
              passo={50}
              onChange={setMoveTimeMs}
            />
            <LessonButton
              variant="primary"
              onClick={medirTudo}
              disabled={status !== "ready" || rodando}
            >
              Medir os {CASOS.length} casos
            </LessonButton>
            <LessonButton onClick={cancelar} disabled={!rodando}>
              Cancelar a busca
            </LessonButton>
            <LessonButton onClick={() => setLinhas([])} disabled={linhas.length === 0}>
              Limpar a tabela
            </LessonButton>
            {status === "failed" && (
              <LessonButton variant="primary" onClick={retry}>
                Tentar carregar de novo
              </LessonButton>
            )}
          </>
        )}
      </section>

      {linhas.length > 0 && (
        <section className="overflow-x-auto rounded-lg border border-borda bg-carta">
          <table className="w-full min-w-136 text-left text-sm">
            <thead className="border-b border-borda text-xs uppercase tracking-wide text-tinta-fraca">
              <tr>
                <th className="px-4 py-2 font-medium">Posição</th>
                <th className="px-4 py-2 font-medium">Skill</th>
                <th className="px-4 py-2 font-medium">movetime</th>
                <th className="px-4 py-2 font-medium">Lance</th>
                <th className="px-4 py-2 font-medium">Medido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda-fraca">
              {linhas.map((linha, i) => (
                <tr key={i} className={linha.erro ? "text-erro-texto" : "text-tinta-media"}>
                  <td className="px-4 py-2">{linha.caso}</td>
                  <td className="px-4 py-2 tabular-nums">{linha.skill}</td>
                  <td className="px-4 py-2 tabular-nums">{linha.moveTimeMs} ms</td>
                  <td className="px-4 py-2 font-mono">{linha.erro ?? linha.lance}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {linha.thinkMs === null ? "—" : `${linha.thinkMs} ms`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p
        aria-live="polite"
        role="status"
        className="text-sm leading-relaxed text-tinta-fraca"
        data-engine-status={status}
        data-engine-load-ms={loadMs ?? ""}
        data-engine-rows={linhas.length}
      >
        {status === "failed"
          ? "O motor não carregou. Em desenvolvimento, confira se /engine/ está sendo servido."
          : rodando
            ? "Pensando…"
            : linhas.length > 0
              ? `${linhas.length} busca(s) medida(s). O pior tempo é o que vale contra o alvo de 2 s.`
              : "Carregue o motor e meça. O alvo do plano é o lance sair em ≤ 2 s no celular."}
      </p>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-borda-fraca py-1 sm:border-0">
      <dt className="text-tinta-fraca">{rotulo}</dt>
      <dd className="font-mono text-tinta-media">{valor}</dd>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  min,
  max,
  passo = 1,
  onChange,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo?: number;
  onChange: (valor: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-tinta-fraca">
      {rotulo}
      <input
        type="number"
        value={valor}
        min={min}
        max={max}
        step={passo}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-11 w-28 rounded-md bg-papel px-3 py-2 text-sm tabular-nums text-tinta-media ring-1 ring-borda foco"
      />
    </label>
  );
}
