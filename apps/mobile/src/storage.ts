import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuestionState, TopicCategory, UserProgress } from '@clearpass/core';

const KEYS = {
  USER_PROGRESS: '@clearpass/user_progress',
  QUESTION_STATES: '@clearpass/question_states',
} as const;

export async function saveUserProgress(progress: UserProgress): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER_PROGRESS, JSON.stringify(progress));
}

export async function loadUserProgress(): Promise<UserProgress | null> {
  const raw = await AsyncStorage.getItem(KEYS.USER_PROGRESS);
  if (!raw) return null;
  return JSON.parse(raw) as UserProgress;
}

export async function saveQuestionStates(
  states: Record<string, QuestionState>,
): Promise<void> {
  await AsyncStorage.setItem(KEYS.QUESTION_STATES, JSON.stringify(states));
}

export async function loadQuestionStates(): Promise<Record<string, QuestionState>> {
  const raw = await AsyncStorage.getItem(KEYS.QUESTION_STATES);
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, QuestionState>;
}

export function createFreshUserProgress(): UserProgress {
  const topicScores = Object.values(TopicCategory).reduce(
    (acc, cat) => {
      acc[cat] = 0;
      return acc;
    },
    {} as Record<TopicCategory, number>,
  );

  return {
    userId: 'local_user',
    topicScores,
    totalQuestionsAnswered: 0,
    mockTestHistory: [],
    readinessScore: 0,
    lastStudied: new Date().toISOString(),
    studyStreakDays: 0,
  };
}
