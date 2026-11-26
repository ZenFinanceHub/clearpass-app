/**
 * "Ask Pip about this" on results screens (ClearPass 2.0, ui_v2 only).
 * PURE: no imports, so plain Node tests it (scripts/lib/askPip.test.mjs).
 *
 * Opens the EXISTING tutor entry point — the same route and params the
 * in-question "Ask Pip" buttons in practice.tsx and mock.tsx already use —
 * so the tutor builds its usual opening message from the question. No new
 * AI endpoint, no prompt change.
 */

export const TUTOR_PATHNAME = '/(tabs)/tutor';
export const ASK_PIP_LABEL = 'Ask Pip about this';

export interface AskPipQuestion {
  questionText: string;
  options: ReadonlyArray<string>;
  correctIndex: number;
  explanation?: string;
}

export interface AskPipNav {
  pathname: typeof TUTOR_PATHNAME;
  params: {
    questionText: string;
    userAnswerText: string;
    correctAnswerText: string;
    explanation: string;
    /** Where the tutor's back control returns to. */
    from: string;
  };
}

export function askPipAboutQuestion(q: AskPipQuestion, selectedIndex: number | null, from: string): AskPipNav {
  const picked = selectedIndex !== null ? q.options[selectedIndex] : undefined;
  return {
    pathname: TUTOR_PATHNAME,
    params: {
      questionText: q.questionText,
      userAnswerText: picked ?? 'No answer selected',
      correctAnswerText: q.options[q.correctIndex] ?? '',
      explanation: q.explanation ?? '',
      from,
    },
  };
}
