import AsyncStorage from '@react-native-async-storage/async-storage';
import { Question, UserProgress, TopicCategory } from '@clearpass/core';
import { SpacedRepetitionState } from './spacedRepetition';

const PP_KEY = '@clearpass/pass_probability';

export type PassProbabilityResult = {
  probability: number;
  trend: 'up' | 'down' | 'stable';
  breakdown: {
    mockScore: number;
    accuracyScore: number;
    coverageScore: number;
    consistencyScore: number;
  };
  weakestArea: string;
  recommendation: string;
};

type StoredPP = {
  probability: number;
  calculatedAt: string;
};

export async function getStoredPassProbability(): Promise<StoredPP | null> {
  try {
    const raw = await AsyncStorage.getItem(PP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPP;
  } catch {
    return null;
  }
}

async function storePassProbability(probability: number): Promise<void> {
  await AsyncStorage.setItem(PP_KEY, JSON.stringify({ probability, calculatedAt: new Date().toISOString() }));
}

export function calculatePassProbability(
  progress: UserProgress,
  srState: SpacedRepetitionState,
  allQuestions: Question[],
): Omit<PassProbabilityResult, 'trend'> {
  // --- Mock score (weight 0.4) ---
  // Weighted avg of last 3 mocks, most recent gets double weight. Pass mark = 43/50 = 86%.
  const recent = [...progress.mockTestHistory]
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())
    .slice(0, 3);

  let mockScore = 0;
  if (recent.length > 0) {
    let weightedSum = 0;
    let totalWeight = 0;
    recent.forEach((r, i) => {
      const w = i === 0 ? 2 : 1;
      weightedSum += (r.score / 50) * w;
      totalWeight += w;
    });
    mockScore = Math.min(100, Math.round(((weightedSum / totalWeight) * 100) / 86 * 100));
  }

  // --- Accuracy score (weight 0.3) ---
  // SR overall accuracy; target 75%. Scale down if fewer than 50 questions reviewed.
  const reviews = Object.values(srState.reviews);
  let accuracyScore = 0;
  if (reviews.length > 0) {
    const totalAnswered = reviews.reduce((s, r) => s + r.totalReviews, 0);
    const totalCorrect  = reviews.reduce((s, r) => s + r.correctReviews, 0);
    const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;
    const scaled = Math.min(100, Math.round((accuracy / 0.75) * 100));
    const volumeFactor = Math.min(1, reviews.length / 50);
    accuracyScore = Math.round(scaled * volumeFactor);
  }

  // --- Coverage score (weight 0.2) ---
  // Topics with 10+ distinct questions reviewed out of 14 total.
  const topicMap = new Map<string, TopicCategory>();
  for (const q of allQuestions) topicMap.set(q.id, q.topicCategory);

  const topicCounts = new Map<TopicCategory, number>();
  for (const r of reviews) {
    const t = topicMap.get(r.questionId);
    if (t) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
  }
  const covered = (Object.values(TopicCategory) as TopicCategory[])
    .filter(t => (topicCounts.get(t) ?? 0) >= 10).length;
  const coverageScore = Math.round((covered / 14) * 100);

  // --- Consistency score (weight 0.1) ---
  const streak = progress.studyStreakDays ?? 0;
  const consistencyScore = streak >= 7 ? 100 : streak >= 3 ? 50 : 0;

  // --- Weighted total, capped at 95 ---
  const probability = Math.min(
    95,
    Math.round(0.4 * mockScore + 0.3 * accuracyScore + 0.2 * coverageScore + 0.1 * consistencyScore),
  );

  const breakdown = { mockScore, accuracyScore, coverageScore, consistencyScore };

  const keys = Object.keys(breakdown) as (keyof typeof breakdown)[];
  const weakestKey = keys.reduce((a, b) => breakdown[a] <= breakdown[b] ? a : b);

  const areaLabels: Record<keyof typeof breakdown, string> = {
    mockScore:        'Mock Tests',
    accuracyScore:    'Practice Accuracy',
    coverageScore:    'Topic Coverage',
    consistencyScore: 'Study Streak',
  };
  const recommendations: Record<keyof typeof breakdown, string> = {
    mockScore:        'Take a full mock test to improve your score prediction',
    accuracyScore:    'Review weak questions with spaced repetition sessions',
    coverageScore:    'Practice questions from untouched topic areas',
    consistencyScore: 'Study daily to build your streak and retention',
  };

  return {
    probability,
    breakdown,
    weakestArea:    areaLabels[weakestKey],
    recommendation: recommendations[weakestKey],
  };
}

export async function computeAndSavePassProbability(
  progress: UserProgress,
  srState: SpacedRepetitionState,
  allQuestions: Question[],
): Promise<PassProbabilityResult> {
  const prev   = await getStoredPassProbability();
  const result = calculatePassProbability(progress, srState, allQuestions);

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (prev) {
    if (result.probability > prev.probability + 1) trend = 'up';
    else if (result.probability < prev.probability - 1) trend = 'down';
  }

  await storePassProbability(result.probability);
  return { ...result, trend };
}
