import AsyncStorage from '@react-native-async-storage/async-storage';
import { Question } from '@clearpass/core';

export type QuestionReview = {
  questionId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  lastScore: 0 | 1 | 2 | 3;
  totalReviews: number;
  correctReviews: number;
};

export type SpacedRepetitionState = {
  reviews: Record<string, QuestionReview>;
  lastUpdated: string;
  dailyReviewCounts: Record<string, number>;
};

const SR_KEY = '@clearpass/spaced_repetition_state';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function dateAfterDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const EMPTY: SpacedRepetitionState = { reviews: {}, lastUpdated: '', dailyReviewCounts: {} };

export async function loadSRState(): Promise<SpacedRepetitionState> {
  try {
    const raw = await AsyncStorage.getItem(SR_KEY);
    if (!raw) return { ...EMPTY };
    return JSON.parse(raw) as SpacedRepetitionState;
  } catch {
    return { ...EMPTY };
  }
}

export async function saveSRState(state: SpacedRepetitionState): Promise<void> {
  await AsyncStorage.setItem(SR_KEY, JSON.stringify(state));
}

function freshReview(questionId: string): QuestionReview {
  return {
    questionId,
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReviewDate: todayStr(),
    lastScore: 0,
    totalReviews: 0,
    correctReviews: 0,
  };
}

function applyScore(r: QuestionReview, score: 0 | 1 | 2 | 3): QuestionReview {
  let { easeFactor, interval, repetitions } = r;

  switch (score) {
    case 0:
      repetitions = 0;
      interval    = 1;
      easeFactor  = Math.max(1.3, Math.round((easeFactor - 0.2) * 100) / 100);
      break;
    case 1:
      repetitions = 0;
      interval    = 1;
      break;
    case 2:
      easeFactor = Math.max(1.3, Math.round((easeFactor - 0.15) * 100) / 100);
      break;
    case 3:
      repetitions += 1;
      interval    = Math.min(30, Math.round(interval * easeFactor));
      easeFactor  = Math.round((easeFactor + 0.1) * 100) / 100;
      break;
  }

  return {
    ...r,
    easeFactor,
    interval,
    repetitions,
    nextReviewDate: dateAfterDays(interval),
    lastScore:      score,
    totalReviews:   r.totalReviews + 1,
    correctReviews: r.correctReviews + (score >= 2 ? 1 : 0),
  };
}

export async function recordAnswer(
  questionId: string,
  correct: boolean,
  wasHard: boolean,
): Promise<void> {
  const score: 0 | 2 | 3 = correct ? (wasHard ? 2 : 3) : 0;
  const state   = await loadSRState();
  const existing = state.reviews[questionId] ?? freshReview(questionId);
  const updated  = applyScore(existing, score);
  const today    = todayStr();

  await saveSRState({
    reviews:           { ...state.reviews, [questionId]: updated },
    lastUpdated:       new Date().toISOString(),
    dailyReviewCounts: {
      ...state.dailyReviewCounts,
      [today]: (state.dailyReviewCounts[today] ?? 0) + 1,
    },
  });
}

export async function getDueQuestions(
  allQuestionIds: string[],
  limit: number,
): Promise<string[]> {
  const state  = await loadSRState();
  const idSet  = new Set(allQuestionIds);
  const today  = todayStr();

  return Object.values(state.reviews)
    .filter(r => idSet.has(r.questionId) && r.nextReviewDate <= today)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
    .slice(0, limit)
    .map(r => r.questionId);
}

export function getNewQuestions(
  allQuestionIds: string[],
  reviewedIds: Set<string>,
  limit: number,
): string[] {
  return allQuestionIds.filter(id => !reviewedIds.has(id)).slice(0, limit);
}

export async function selectPracticeQuestions(
  allQuestions: Question[],
  count: number,
): Promise<Question[]> {
  const state      = await loadSRState();
  const allIds     = allQuestions.map(q => q.id);
  const reviewedIds = new Set(Object.keys(state.reviews));
  const today      = todayStr();

  const dueTarget  = Math.round(count * 0.4);
  const weakTarget = Math.round(count * 0.4);

  // 40% — due for review (most overdue first)
  const dueIds = Object.values(state.reviews)
    .filter(r => r.nextReviewDate <= today)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
    .slice(0, dueTarget)
    .map(r => r.questionId);

  const usedSet = new Set(dueIds);

  // 40% — weak questions (lowest accuracy, last answer wrong, not already picked)
  const weakIds = Object.values(state.reviews)
    .filter(r => (r.lastScore === 0 || r.lastScore === 1) && !usedSet.has(r.questionId))
    .sort((a, b) => {
      const aRate = a.totalReviews > 0 ? a.correctReviews / a.totalReviews : 1;
      const bRate = b.totalReviews > 0 ? b.correctReviews / b.totalReviews : 1;
      return aRate - bRate;
    })
    .slice(0, weakTarget)
    .map(r => r.questionId);

  weakIds.forEach(id => usedSet.add(id));

  // 20% + backfill shortfalls — new questions never seen
  const newTarget = count - dueIds.length - weakIds.length;
  const newIds = allIds
    .filter(id => !reviewedIds.has(id) && !usedSet.has(id))
    .slice(0, newTarget);

  newIds.forEach(id => usedSet.add(id));

  // Fill remainder with random questions if still short
  let combined = [...dueIds, ...weakIds, ...newIds];
  if (combined.length < count) {
    const backfill = allIds
      .filter(id => !usedSet.has(id))
      .sort(() => Math.random() - 0.5)
      .slice(0, count - combined.length);
    combined = [...combined, ...backfill];
  }

  return combined
    .map(id => allQuestions.find(q => q.id === id))
    .filter((q): q is Question => q !== undefined)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}
