import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuestionState, TopicCategory, UserProgress } from '@clearpass/core';
import { supabase } from './supabase';

const KEYS = {
  USER_PROGRESS: '@clearpass/user_progress',
  QUESTION_STATES: '@clearpass/question_states',
  PENDING_USERNAME: '@clearpass/pending_username',
} as const;

export async function syncPendingUsername(): Promise<void> {
  try {
    const username = await AsyncStorage.getItem(KEYS.PENDING_USERNAME);
    if (!username) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username });
    if (!error || error.code === '23505') {
      await AsyncStorage.removeItem(KEYS.PENDING_USERNAME);
    }
  } catch {
    // Silent fail — will retry on next app load
  }
}

export async function syncProgressToCloud(progress: UserProgress): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_progress').upsert({
      id: user.id,
      progress: progress as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Silently skip — offline mode still works
  }
}

export async function loadProgressFromCloud(): Promise<UserProgress | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('user_progress')
      .select('progress')
      .eq('id', user.id)
      .single();
    if (!data) return null;
    const loaded = data.progress as Partial<UserProgress>;
    return { ...createFreshUserProgress(), ...loaded } as UserProgress;
  } catch {
    return null;
  }
}

export async function saveUserProgress(progress: UserProgress): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER_PROGRESS, JSON.stringify(progress));
  void syncProgressToCloud(progress);
}

export async function loadUserProgress(): Promise<UserProgress | null> {
  const cloud = await loadProgressFromCloud();
  if (cloud) {
    await AsyncStorage.setItem(KEYS.USER_PROGRESS, JSON.stringify(cloud));
    return cloud;
  }
  const raw = await AsyncStorage.getItem(KEYS.USER_PROGRESS);
  if (!raw) return null;
  const loaded = JSON.parse(raw) as Partial<UserProgress>;
  const defaults = createFreshUserProgress();
  return { ...defaults, ...loaded } as UserProgress;
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
    xp: 0,
    achievements: [],
    dailyChallenge: null,
    testDate: null,
    battleModeHistory: [],
  };
}

export function updateStudyStreak(progress: UserProgress): UserProgress {
  const now = new Date();
  const last = new Date(progress.lastStudied);
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  const diffDays = Math.round((nowDay.getTime() - lastDay.getTime()) / 86400000);
  let streak = progress.studyStreakDays;
  if (diffDays === 1) {
    streak = streak + 1;
  } else if (diffDays > 1) {
    streak = 1;
  }
  return { ...progress, studyStreakDays: streak };
}
