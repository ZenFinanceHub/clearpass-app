import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { QuestionState, TopicCategory, UserProgress } from '@clearpass/core';
import { supabase } from './supabase';

const KEYS = {
  USER_PROGRESS:    '@clearpass/user_progress',
  QUESTION_STATES:  '@clearpass/question_states',
  PENDING_USERNAME: '@clearpass/pending_username',
  SYNC_PENDING:     '@clearpass/sync_pending',
  BOOKMARKS:        '@clearpass/bookmarks',
  SESSION_HISTORY:  '@clearpass/session_history',
} as const;

export async function syncPendingUsername(): Promise<void> {
  try {
    const username = await AsyncStorage.getItem(KEYS.PENDING_USERNAME);
    if (!username) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username });
    if (!error || error.code === '23505') {
      await AsyncStorage.removeItem(KEYS.PENDING_USERNAME);
    }
  } catch {}
}

export async function syncProgressToCloud(progress: UserProgress): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_progress')
      .upsert(
        {
          id: user.id,
          progress: progress as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    if (!error) await AsyncStorage.removeItem(KEYS.SYNC_PENDING);
  } catch {}
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
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      void syncProgressToCloud(progress);
    } else {
      await AsyncStorage.setItem(KEYS.SYNC_PENDING, 'true');
    }
  } catch {
    void syncProgressToCloud(progress);
  }
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
    isPro: false,
    dailyQuestionsAnswered: 0,
    hazardPerceptionHistory: [],
  };
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export async function getBookmarkedQuestions(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.BOOKMARKS);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function toggleBookmark(questionId: string): Promise<boolean> {
  const current = await getBookmarkedQuestions();
  const exists = current.includes(questionId);
  const next = exists ? current.filter((id) => id !== questionId) : [...current, questionId];
  await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(next));
  return !exists;
}

export async function isBookmarked(questionId: string): Promise<boolean> {
  const current = await getBookmarkedQuestions();
  return current.includes(questionId);
}

// ─── Session History ──────────────────────────────────────────────────────────

export interface SessionHistoryEntry {
  date: string;
  score: number;
  total: number;
  topic: string;
  durationSeconds: number;
}

export async function saveSessionHistory(entry: SessionHistoryEntry): Promise<void> {
  const raw = await AsyncStorage.getItem(KEYS.SESSION_HISTORY);
  const history: SessionHistoryEntry[] = raw ? (JSON.parse(raw) as SessionHistoryEntry[]) : [];
  const next = [entry, ...history].slice(0, 50);
  await AsyncStorage.setItem(KEYS.SESSION_HISTORY, JSON.stringify(next));
}

export async function getSessionHistory(): Promise<SessionHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.SESSION_HISTORY);
  return raw ? (JSON.parse(raw) as SessionHistoryEntry[]) : [];
}

// ─── Tutor usage ──────────────────────────────────────────────────────────────

const TUTOR_QUESTIONS_KEY = '@clearpass/tutor_questions_used';

export async function getTutorQuestionsUsed(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TUTOR_QUESTIONS_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch { return 0; }
}

export async function incrementTutorQuestionsUsed(): Promise<number> {
  const current = await getTutorQuestionsUsed();
  const next = current + 1;
  await AsyncStorage.setItem(TUTOR_QUESTIONS_KEY, String(next));
  return next;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

const ONBOARDING_KEY = '@clearpass/hasSeenOnboarding';
const PENDING_TEST_DATE_KEY = '@clearpass/pending_test_date';

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true';
  } catch { return false; }
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
}

export async function savePendingTestDate(iso: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_TEST_DATE_KEY, iso);
}

export async function popPendingTestDate(): Promise<string | null> {
  try {
    const val = await AsyncStorage.getItem(PENDING_TEST_DATE_KEY);
    if (val) await AsyncStorage.removeItem(PENDING_TEST_DATE_KEY);
    return val;
  } catch { return null; }
}

// ─── Weak Spot Tracking ───────────────────────────────────────────────────────

const WEAK_SPOTS_KEY = '@clearpass/wrong_counts';

export async function recordWeakSpotResult(questionId: string, correct: boolean): Promise<void> {
  if (correct) return;
  try {
    const raw = await AsyncStorage.getItem(WEAK_SPOTS_KEY);
    const counts: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    counts[questionId] = (counts[questionId] ?? 0) + 1;
    await AsyncStorage.setItem(WEAK_SPOTS_KEY, JSON.stringify(counts));
  } catch {}
}

export async function getWeakSpotQuestions(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(WEAK_SPOTS_KEY);
    if (!raw) return [];
    const counts = JSON.parse(raw) as Record<string, number>;
    return Object.entries(counts)
      .filter(([, count]) => count >= 2)
      .map(([id]) => id);
  } catch { return []; }
}

export async function clearWeakSpot(questionId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(WEAK_SPOTS_KEY);
    if (!raw) return;
    const counts = JSON.parse(raw) as Record<string, number>;
    delete counts[questionId];
    await AsyncStorage.setItem(WEAK_SPOTS_KEY, JSON.stringify(counts));
  } catch {}
}

// ─── Topic Accuracy ───────────────────────────────────────────────────────────

export async function getTopicAccuracy(): Promise<Record<string, { correct: number; total: number }>> {
  const history = await getSessionHistory();
  const acc: Record<string, { correct: number; total: number }> = {};
  for (const entry of history) {
    if (entry.topic === 'Mixed' || entry.topic === 'Speed Round') continue;
    if (!acc[entry.topic]) acc[entry.topic] = { correct: 0, total: 0 };
    acc[entry.topic].correct += entry.score;
    acc[entry.topic].total += entry.total;
  }
  return acc;
}

export async function getMasteredTopics(): Promise<string[]> {
  const acc = await getTopicAccuracy();
  return Object.entries(acc)
    .filter(([, { correct, total }]) => total >= 20 && correct / total >= 0.8)
    .map(([topic]) => topic);
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
