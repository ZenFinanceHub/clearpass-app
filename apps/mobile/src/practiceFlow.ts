/**
 * Where a practice session goes after each answer. Pure, so it can be tested
 * with plain Node (see scripts/lib/practiceFlow.test.mjs).
 *
 * A free learner who answers their last free question of the day used to be
 * sent straight to the daily-limit paywall, so the summary, review and
 * celebrations for the questions they had just answered were never shown.
 * They now get the normal results, flagged `limitReached` so the results
 * screen also shows the limit message and upgrade CTA. The limit itself is
 * unchanged: once it's reached the next phase is never another question.
 */

export type AfterAnswer = { phase: 'quiz' | 'results'; limitReached: boolean };

export function afterAnswer(p: {
  /** Questions answered today, including the one just answered. */
  answeredToday: number;
  limit: number;
  isPremium: boolean;
  isLastQuestion: boolean;
}): AfterAnswer {
  if (!p.isPremium && p.answeredToday >= p.limit) return { phase: 'results', limitReached: true };
  return { phase: p.isLastQuestion ? 'results' : 'quiz', limitReached: false };
}

/** Whether a new practice session may start (otherwise: the daily-limit screen). */
export function canStartSession(p: { answeredToday: number; limit: number; isPremium: boolean }): boolean {
  return p.isPremium || p.answeredToday < p.limit;
}
