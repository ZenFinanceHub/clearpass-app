import { TopicCategory } from './types/TopicCategory';
import { UserProgress } from './types/UserProgress';

export interface ReadinessResult {
  score: number;
  readyToBook: boolean;
  weakTopics: TopicCategory[];
  estimatedDaysToReady: number;
}

const ALL_CATEGORIES = Object.values(TopicCategory) as TopicCategory[];

// A topic is "weak" when the user's accuracy on it is below this threshold.
const WEAK_TOPIC_THRESHOLD = 70;

// The test pass rate is 43/50 = 86%. We set the booking threshold slightly
// below that so users have a comfortable buffer.
const READY_TO_BOOK_THRESHOLD = 80;

/**
 * Derives a 0–100 readiness score from a user's study history.
 *
 * Weights:
 *   50% — average per-topic accuracy (covers breadth)
 *   35% — average mock-test score over the last 5 attempts (covers exam stamina)
 *   15% — question volume factor (rewards consistent practice, caps at 500 Qs)
 */
export function calculateReadiness(progress: UserProgress): ReadinessResult {
  const { topicScores, totalQuestionsAnswered, mockTestHistory } = progress;

  // --- topic accuracy component (0–100) ---
  const topicValues = ALL_CATEGORIES.map((cat) => topicScores[cat] ?? 0);
  const avgTopicScore =
    topicValues.reduce((sum, v) => sum + v, 0) / topicValues.length;

  // --- mock test component (0–100) ---
  const recentMocks = mockTestHistory.slice(-5);
  const avgMockScore =
    recentMocks.length > 0
      ? recentMocks.reduce((sum, t) => sum + (t.score / 50) * 100, 0) /
        recentMocks.length
      : 0;

  // --- volume component (0–100, saturates at 500 questions) ---
  const volumeScore = Math.min(totalQuestionsAnswered / 500, 1) * 100;

  const raw =
    avgTopicScore * 0.5 + avgMockScore * 0.35 + volumeScore * 0.15;

  const score = Math.min(100, Math.max(0, Math.round(raw)));

  // --- weak topics ---
  const weakTopics = ALL_CATEGORIES.filter(
    (cat) => (topicScores[cat] ?? 0) < WEAK_TOPIC_THRESHOLD,
  );

  // --- estimated days to ready ---
  // Assumes ~2 score points of improvement per day of consistent practice.
  const estimatedDaysToReady =
    score >= READY_TO_BOOK_THRESHOLD
      ? 0
      : Math.ceil((READY_TO_BOOK_THRESHOLD - score) / 2);

  return {
    score,
    readyToBook: score >= READY_TO_BOOK_THRESHOLD,
    weakTopics,
    estimatedDaysToReady,
  };
}
