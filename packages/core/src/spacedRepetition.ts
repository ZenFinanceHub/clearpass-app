export type QuestionState = {
  questionId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  lastAnsweredCorrectly: boolean;
};

export function initQuestionState(questionId: string): QuestionState {
  return {
    questionId,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date().toISOString(),
    lastAnsweredCorrectly: false,
  };
}

/**
 * SM-2 algorithm update.
 * quality: 0–5 where ≥3 means the answer was correct.
 *   5 = perfect, 4 = correct with hesitation, 3 = correct with difficulty,
 *   2 = wrong but easy to recall, 1 = wrong, 0 = complete blackout.
 */
export function updateQuestionState(
  state: QuestionState,
  correct: boolean,
  quality: number,
): QuestionState {
  const q = Math.max(0, Math.min(5, quality));

  let { easeFactor, interval, repetitions } = state;

  if (correct) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  // EF update applies regardless of correctness so wrong answers penalise future spacing.
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  easeFactor = Math.max(1.3, Math.round((easeFactor + efDelta) * 1000) / 1000);

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    questionId: state.questionId,
    easeFactor,
    interval,
    repetitions,
    nextReviewDate: nextReview.toISOString(),
    lastAnsweredCorrectly: correct,
  };
}

/**
 * Builds a session question list of `sessionSize` IDs.
 * Priority order:
 *   1. Overdue questions (sorted by most overdue first)
 *   2. New questions (never seen before)
 */
export function getQuestionsForSession(
  allStates: QuestionState[],
  allQuestionIds: string[],
  sessionSize: number,
): string[] {
  const now = new Date();
  const stateMap = new Map(allStates.map((s) => [s.questionId, s]));

  const overdue: { id: string; daysOverdue: number }[] = [];
  const unseen: string[] = [];

  for (const id of allQuestionIds) {
    const state = stateMap.get(id);
    if (!state) {
      unseen.push(id);
      continue;
    }
    const daysOverdue =
      (now.getTime() - new Date(state.nextReviewDate).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysOverdue >= 0) {
      overdue.push({ id, daysOverdue });
    }
  }

  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const result: string[] = [];
  for (const { id } of overdue) {
    if (result.length >= sessionSize) break;
    result.push(id);
  }
  for (const id of unseen) {
    if (result.length >= sessionSize) break;
    result.push(id);
  }

  return result;
}
