import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@clearpass/streak_toasts_shown';

// 7 and 30 day streaks already get the full-screen CelebrationModal — these are
// the additional milestones that currently get no celebration at all.
const THRESHOLDS = [14, 100] as const;

async function getShownSet(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

async function saveShownSet(set: Set<number>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export async function checkStreakToast(streakDays: number): Promise<number | null> {
  const shown = await getShownSet();
  for (const threshold of THRESHOLDS) {
    if (streakDays >= threshold && !shown.has(threshold)) {
      shown.add(threshold);
      await saveShownSet(shown);
      return threshold;
    }
  }
  return null;
}
