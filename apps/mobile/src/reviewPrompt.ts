import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import type { CelebrationEvent } from '@/src/celebrations';

// Native in-app review prompt. The call goes straight to the OS API — no
// "are you enjoying ClearPass?" pre-prompt and no filtering of who is asked
// (both stores prohibit review gating). All the gating below is about *when*
// it is polite to ask, never *who* gets asked.

export type ReviewTrigger = 'mock_passed' | 'streak_milestone';

const PROMPT_KEY = '@clearpass/review_prompt';
const SESSION_KEY = '@clearpass/app_session_count';

export const REVIEW_PROMPT_INTERVAL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
// Let the celebration modal's fade-out finish before the native sheet appears.
const SETTLE_MS = 800;

type PromptRecord = { lastPromptedAt: number; count: number; lastTrigger: ReviewTrigger };

export function shouldPrompt(opts: {
  dev: boolean;
  sessionCount: number;
  lastPromptedAt: number | null;
  now: number;
}): boolean {
  if (opts.dev) return false;
  if (opts.sessionCount < 2) return false; // never on the first app session
  if (opts.lastPromptedAt !== null && opts.now - opts.lastPromptedAt < REVIEW_PROMPT_INTERVAL_MS) {
    return false;
  }
  return true;
}

export function hasStreakMilestone(events: CelebrationEvent[]): boolean {
  return events.includes('streak_7_days') || events.includes('streak_30_days');
}

// Counts app launches. Called once from the root layout.
let sessionRegistered: Promise<void> | null = null;

export function registerAppSession(): Promise<void> {
  if (!sessionRegistered) {
    sessionRegistered = (async () => {
      try {
        const next = (await readSessionCount()) + 1;
        await AsyncStorage.setItem(SESSION_KEY, String(next));
      } catch {}
    })();
  }
  return sessionRegistered;
}

async function readSessionCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

async function readRecord(): Promise<PromptRecord | null> {
  const raw = await AsyncStorage.getItem(PROMPT_KEY);
  return raw ? (JSON.parse(raw) as PromptRecord) : null;
}

// Callers must only invoke this from a results/celebration screen after a
// non-failed session, and only once any celebration modal has been dismissed.
export async function maybeRequestReview(trigger: ReviewTrigger): Promise<void> {
  try {
    if (__DEV__) return;
    if (sessionRegistered) await sessionRegistered;

    const record = await readRecord();
    const ok = shouldPrompt({
      dev: false,
      sessionCount: await readSessionCount(),
      lastPromptedAt: record?.lastPromptedAt ?? null,
      now: Date.now(),
    });
    if (!ok) return;

    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    await new Promise<void>(resolve => setTimeout(resolve, SETTLE_MS));

    // Record before asking: the OS decides whether the sheet actually shows
    // and never reports back, and a crash mid-call must not cause a re-ask.
    const next: PromptRecord = {
      lastPromptedAt: Date.now(),
      count: (record?.count ?? 0) + 1,
      lastTrigger: trigger,
    };
    await AsyncStorage.setItem(PROMPT_KEY, JSON.stringify(next));
    await StoreReview.requestReview();
  } catch {}
}
