import type { Lesson, TreeNode } from "./schema";

/**
 * O julgamento de um lance do aluno nas etapas 3 e 4 (plano da F1, §3.2).
 *
 * **Zero xadrez calculado aqui.** A comparação é com três listas escritas e
 * certificadas na autoria: `expects` (o método), `mistakes` (os erros nomeados
 * do currículo) e `winningMoves` (gerada pela tablebase). O que a chess.js faz
 * em runtime é só o que sempre fez — dizer quais lances são legais e mover a
 * peça —, nunca dizer se um lance é bom.
 */

/** Lance em UCI a partir do que o tabuleiro devolve. */
export function toUci(orig: string, dest: string, promotion?: string): string {
  return `${orig}${dest}${promotion ?? ""}`;
}

export type MoveVerdict =
  /** Está em `expects`: é o método, a aula avança. */
  | {
      kind: "method";
      uci: string;
      feedback: string;
      /** Resposta do defensor, escrita na autoria. Ausente = o lance deu mate. */
      reply?: string;
      next?: string;
    }
  /** Erro nomeado do currículo: texto próprio, veredito próprio. */
  | {
      kind: "named-error";
      uci: string;
      errorId: string;
      verdict: "off-method" | "loses-win";
      text: string;
      /** O lance ainda ganha? Vem de `winningMoves`, não do veredito. */
      preservesWin: boolean;
    }
  /**
   * A mesma técnica por outro caminho — só na etapa 3. O lance não é o do
   * roteiro, mas aplica a ideia da aula (o gerador provou isso na autoria, com
   * a caixa que ele deixa). O aluno é elogiado e a peça volta, para que a
   * linha escrita continue valendo. Na etapa 4 este mesmo lance é aceito e a
   * aula segue por um ramo gerado — lá ele nem chega aqui.
   */
  | { kind: "method-alternative"; uci: string; text: string; preservesWin: true }
  /** Fora das listas de autoria, mas a tablebase diz que ainda ganha. */
  | { kind: "off-method"; uci: string; text: string; preservesWin: true }
  /** Fora das listas e fora de `winningMoves`: joga a vitória fora. */
  | { kind: "loses-win"; uci: string; text: string; preservesWin: false };

/** `true` quando o lance não avança a aula — a peça volta e o painel fala. */
export function isRejection(verdict: MoveVerdict): boolean {
  return verdict.kind !== "method";
}

/**
 * Classifica o lance do aluno no nó. A ordem é a da tabela da §3.2: método,
 * erro nomeado, e só então os dois fallbacks honestos.
 */
export function judgeMove(lesson: Lesson, node: TreeNode, uci: string): MoveVerdict {
  for (const expect of node.expects) {
    if (expect.moves.includes(uci)) {
      return {
        kind: "method",
        uci,
        feedback: expect.feedback,
        reply: expect.reply,
        next: expect.next,
      };
    }
  }

  const preservesWin = node.winningMoves.includes(uci);

  for (const mistake of node.mistakes ?? []) {
    if (!mistake.moves.includes(uci)) continue;
    const declared = lesson.errors[mistake.errorId];
    // Erro nomeado sem texto declarado é arquivo torto — o gate recusa isso
    // (ERRO_NAO_DECLARADO). Em runtime, cai no fallback honesto em vez de
    // travar a aula do aluno.
    if (!declared) break;
    return {
      kind: "named-error",
      uci,
      errorId: mistake.errorId,
      verdict: declared.verdict,
      text: declared.text,
      preservesWin,
    };
  }

  // Depois do erro nomeado, de propósito: se a autoria marcou o lance como
  // erro, o autor manda — mesmo que a geometria o aprove.
  if (node.methodAlternatives?.includes(uci)) {
    return {
      kind: "method-alternative",
      uci,
      text: lesson.fallbacks.methodAlternative,
      preservesWin: true,
    };
  }

  return preservesWin
    ? { kind: "off-method", uci, text: lesson.fallbacks.winningOffMethod, preservesWin: true }
    : { kind: "loses-win", uci, text: lesson.fallbacks.losesWin, preservesWin: false };
}

/**
 * O lance recusado joga a vitória fora? É este — e não o veredito escrito —
 * que encerra a tentativa na etapa 4 (§3.3): a fonte é a tablebase.
 */
export function throwsWinAway(verdict: MoveVerdict): boolean {
  return verdict.kind !== "method" && !verdict.preservesWin;
}
