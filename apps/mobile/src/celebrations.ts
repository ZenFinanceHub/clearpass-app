import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProgress, getXpLevel } from '@clearpass/core';

const STORAGE_KEY = '@clearpass/celebrated_events';

export type CelebrationEvent =
  | 'first_practice_complete'
  | 'streak_7_days'
  | 'streak_30_days'
  | '100_questions'
  | '500_questions'
  | 'first_mock_pass'
  | 'three_mocks_pass'
  | 'hazard_pass'
  | 'milestone_reached'
  | 'level_up'
  | 'test_ready';

export type CelebrationConfig = {
  event: CelebrationEvent;
  title: string;
  subtitle: string;
  emoji: string;
  xpBonus: number;
  confettiColours: string[];
};

export const CELEBRATION_CONFIGS: Record<CelebrationEvent, CelebrationConfig> = {
  first_practice_complete: {
    event: 'first_practice_complete',
    title: 'First Session Done!',
    subtitle: "You've started your theory test journey!",
    emoji: '🎉',
    xpBonus: 20,
    confettiColours: ['#0D9488', '#14B8A6', '#2DD4BF', '#99F6E4', '#5EEAD4'],
  },
  streak_7_days: {
    event: 'streak_7_days',
    title: '7 Day Streak!',
    subtitle: "You're on fire! Keep it going!",
    emoji: '🔥',
    xpBonus: 50,
    confettiColours: ['#F97316', '#EF4444', '#FB923C', '#FCA5A5', '#FDBA74'],
  },
  streak_30_days: {
    event: 'streak_30_days',
    title: '30 Day Streak!',
    subtitle: 'Incredible dedication — you are unstoppable!',
    emoji: '🏆',
    xpBonus: 200,
    confettiColours: ['#EA580C', '#FB923C', '#FCD34D', '#F97316', '#EF4444'],
  },
  '100_questions': {
    event: '100_questions',
    title: '100 Questions!',
    subtitle: 'A century of practice — keep it up!',
    emoji: '💯',
    xpBonus: 50,
    confettiColours: ['#8B5CF6', '#6366F1', '#A78BFA', '#C4B5FD', '#818CF8'],
  },
  '500_questions': {
    event: '500_questions',
    title: '500 Questions!',
    subtitle: "You're a theory test machine!",
    emoji: '🚀',
    xpBonus: 150,
    confettiColours: ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899'],
  },
  first_mock_pass: {
    event: 'first_mock_pass',
    title: 'Mock Test Passed!',
    subtitle: "You're on track to pass for real!",
    emoji: '✅',
    xpBonus: 100,
    confettiColours: ['#10B981', '#34D399', '#6EE7B7', '#0D9488', '#A7F3D0'],
  },
  three_mocks_pass: {
    event: 'three_mocks_pass',
    title: 'Hat Trick!',
    subtitle: '3 mocks passed — you are test ready!',
    emoji: '🎯',
    xpBonus: 250,
    confettiColours: ['#EA580C', '#FB923C', '#FCD34D', '#F97316', '#EAB308'],
  },
  hazard_pass: {
    event: 'hazard_pass',
    title: 'Hazard Hero!',
    subtitle: 'Great hazard awareness out there!',
    emoji: '⚠️',
    xpBonus: 50,
    confettiColours: ['#0D9488', '#14B8A6', '#2DD4BF', '#0891B2', '#38BDF8'],
  },
  milestone_reached: {
    event: 'milestone_reached',
    title: 'Milestone Reached!',
    subtitle: 'Your journey continues — onwards!',
    emoji: '🗺️',
    xpBonus: 30,
    confettiColours: ['#6366F1', '#8B5CF6', '#A78BFA', '#4F46E5', '#818CF8'],
  },
  level_up: {
    event: 'level_up',
    title: 'Level Up!',
    subtitle: "You're improving fast — great work!",
    emoji: '⬆️',
    xpBonus: 0,
    confettiColours: ['#3B82F6', '#60A5FA', '#93C5FD', '#6366F1', '#818CF8'],
  },
  test_ready: {
    event: 'test_ready',
    title: 'TEST READY!',
    subtitle: "You're ready to pass your theory test!",
    emoji: '🏆',
    xpBonus: 500,
    confettiColours: ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899'],
  },
};

// ── Internal storage helpers ───────────────────────────────────────────────────

async function getCelebratedSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveCelebratedSet(set: Set<string>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

// ── Milestone helper (mirrors home.tsx logic) ─────────────────────────────────

function computeMilestone(p: UserProgress): number {
  if (p.totalQuestionsAnswered < 1) return 0;
  const totalTopics = Object.keys(p.topicScores).length || 14;
  const attempted = Object.values(p.topicScores).filter(s => s > 0).length;
  if (attempted < Math.ceil(totalTopics * 0.5)) return 1;
  if (!p.hazardPerceptionHistory.some(h => h.passed)) return 2;
  if (p.totalQuestionsAnswered < 200) return 3;
  if (!p.mockTestHistory.some(h => h.passed)) return 4;
  const mh = p.mockTestHistory;
  const twoConsec = mh.some((_, i) => i > 0 && mh[i].passed && mh[i - 1].passed);
  if (!twoConsec) return 5;
  const threeConsec = mh.some(
    (_, i) =>
      i >= 2 &&
      mh[i].passed     && mh[i].score     >= 43 &&
      mh[i - 1].passed && mh[i - 1].score >= 43 &&
      mh[i - 2].passed && mh[i - 2].score >= 43,
  );
  return threeConsec ? 7 : 6;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkAndTriggerCelebrations(
  progress: UserProgress,
): Promise<CelebrationEvent[]> {
  const set = await getCelebratedSet();
  const toMark: string[] = [];
  const events: CelebrationEvent[] = [];

  function consider(storageKey: string, event: CelebrationEvent) {
    if (!set.has(storageKey)) {
      events.push(event);
      toMark.push(storageKey);
    }
  }

  // Simple one-time milestones
  if (progress.totalQuestionsAnswered >= 10)
    consider('first_practice_complete', 'first_practice_complete');

  if (progress.studyStreakDays >= 30)
    consider('streak_30_days', 'streak_30_days');
  else if (progress.studyStreakDays >= 7)
    consider('streak_7_days', 'streak_7_days');

  if (progress.totalQuestionsAnswered >= 500)
    consider('500_questions', '500_questions');
  else if (progress.totalQuestionsAnswered >= 100)
    consider('100_questions', '100_questions');

  if (progress.mockTestHistory.filter(m => m.passed).length >= 3)
    consider('three_mocks_pass', 'three_mocks_pass');
  else if (progress.mockTestHistory.some(m => m.passed))
    consider('first_mock_pass', 'first_mock_pass');

  if (progress.hazardPerceptionHistory.some(h => h.passed))
    consider('hazard_pass', 'hazard_pass');

  // Milestone-specific (stored per-milestone so each fires once)
  const milestone = computeMilestone(progress);
  if (milestone >= 7) {
    consider('test_ready', 'test_ready');
  } else if (milestone >= 1) {
    consider(`milestone_reached_${milestone}`, 'milestone_reached');
  }

  // Level-specific (stored per-level so each level fires once)
  const level = getXpLevel(progress.xp).level;
  if (level >= 2) {
    consider(`level_up_${level}`, 'level_up');
  }

  if (toMark.length > 0) {
    for (const k of toMark) set.add(k);
    await saveCelebratedSet(set);
  }

  return events;
}

export async function markCelebrated(event: CelebrationEvent): Promise<void> {
  const set = await getCelebratedSet();
  set.add(event);
  await saveCelebratedSet(set);
}

export async function hasBeenCelebrated(event: CelebrationEvent): Promise<boolean> {
  const set = await getCelebratedSet();
  return set.has(event);
}
