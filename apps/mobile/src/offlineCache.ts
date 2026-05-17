import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { allQuestions, highwayCodeChapters, roadSigns } from '@clearpass/content';
import { syncProgressToCloud } from './storage';
import type { UserProgress } from '@clearpass/core';

// ─── Keys ─────────────────────────────────────────────────────────────────────

const QUESTIONS_KEY    = 'offline_questions';
const HIGHWAY_CODE_KEY = 'offline_highway_code';
const ROAD_SIGNS_KEY   = 'offline_road_signs';
const STATUS_KEY       = '@clearpass/cache_status';
export const SYNC_PENDING_KEY = '@clearpass/sync_pending';
const USER_PROGRESS_KEY = '@clearpass/user_progress';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheStatus = {
  questions:   boolean;
  highwayCode: boolean;
  roadSigns:   boolean;
  lastCached:  string;
};

// ─── Connectivity ─────────────────────────────────────────────────────────────

export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

// ─── Cache writers ────────────────────────────────────────────────────────────

export async function cacheQuestions(): Promise<void> {
  await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(allQuestions));
  await patchStatus({ questions: true });
}

export async function cacheHighwayCode(): Promise<void> {
  await AsyncStorage.setItem(HIGHWAY_CODE_KEY, JSON.stringify(highwayCodeChapters));
  await patchStatus({ highwayCode: true });
}

export async function cacheRoadSigns(): Promise<void> {
  await AsyncStorage.setItem(ROAD_SIGNS_KEY, JSON.stringify(roadSigns));
  await patchStatus({ roadSigns: true });
}

// ─── Cache readers ─────────────────────────────────────────────────────────────

export async function getOfflineQuestions(): Promise<typeof allQuestions> {
  try {
    const raw = await AsyncStorage.getItem(QUESTIONS_KEY);
    if (raw) return JSON.parse(raw) as typeof allQuestions;
  } catch {}
  return allQuestions;
}

export async function getOfflineHighwayCode(): Promise<typeof highwayCodeChapters> {
  try {
    const raw = await AsyncStorage.getItem(HIGHWAY_CODE_KEY);
    if (raw) return JSON.parse(raw) as typeof highwayCodeChapters;
  } catch {}
  return highwayCodeChapters;
}

export async function getOfflineRoadSigns(): Promise<typeof roadSigns> {
  try {
    const raw = await AsyncStorage.getItem(ROAD_SIGNS_KEY);
    if (raw) return JSON.parse(raw) as typeof roadSigns;
  } catch {}
  return roadSigns;
}

// ─── Status ───────────────────────────────────────────────────────────────────

export async function getCacheStatus(): Promise<CacheStatus> {
  try {
    const raw = await AsyncStorage.getItem(STATUS_KEY);
    if (raw) return JSON.parse(raw) as CacheStatus;
  } catch {}
  return { questions: false, highwayCode: false, roadSigns: false, lastCached: '' };
}

async function patchStatus(partial: Partial<CacheStatus>): Promise<void> {
  const current = await getCacheStatus();
  await AsyncStorage.setItem(
    STATUS_KEY,
    JSON.stringify({ ...current, ...partial, lastCached: new Date().toISOString() }),
  );
}

// ─── Offline sync ─────────────────────────────────────────────────────────────

export async function syncWhenOnline(): Promise<void> {
  try {
    const pending = await AsyncStorage.getItem(SYNC_PENDING_KEY);
    if (pending !== 'true') return;
    const raw = await AsyncStorage.getItem(USER_PROGRESS_KEY);
    if (!raw) return;
    const progress = JSON.parse(raw) as UserProgress;
    await syncProgressToCloud(progress);
    await AsyncStorage.removeItem(SYNC_PENDING_KEY);
  } catch {}
}
