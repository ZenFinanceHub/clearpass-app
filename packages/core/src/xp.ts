import { UserProgress } from './types/UserProgress';

export const XP_REWARDS = {
  PRACTICE_COMPLETED: 10,
  PRACTICE_PERFECT: 50,
  MOCK_COMPLETED: 30,
  MOCK_PASSED: 100,
  DAILY_CHALLENGE: 75,
  STREAK_BONUS: 20,
  BATTLE_MODE_WIN: 40,
} as const;

export function awardXp(progress: UserProgress, amount: number): UserProgress {
  return { ...progress, xp: (progress.xp ?? 0) + amount };
}

export function getXpLevel(xp: number): {
  level: number;
  label: string;
  xpForNext: number;
  pct: number;
} {
  if (xp < 100) {
    return { level: 1, label: 'Learner', xpForNext: 100, pct: xp / 100 };
  }
  if (xp < 250) {
    return { level: 2, label: 'Improving', xpForNext: 250, pct: (xp - 100) / 150 };
  }
  if (xp < 500) {
    return { level: 3, label: 'Intermediate', xpForNext: 500, pct: (xp - 250) / 250 };
  }
  if (xp < 1000) {
    return { level: 4, label: 'Advanced', xpForNext: 1000, pct: (xp - 500) / 500 };
  }
  return { level: 5, label: 'Test Ready', xpForNext: 1000, pct: 1 };
}
