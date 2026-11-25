// Helpers to seed synthetic learner state before the app boots.
//
// On web, AsyncStorage is window.localStorage with the same keys the native
// app uses (src/storage.ts, app/_layout.tsx, app/screenshot-mode.tsx), and
// supabase-js keeps its session in localStorage under
// SUPABASE_AUTH_STORAGE_KEY. Everything is synthetic: no real account,
// token or user data is ever involved.
import type { Page } from '@playwright/test';
import type { FakeUser, NetworkHarness } from './harness';
import { SUPABASE_AUTH_STORAGE_KEY } from './hosts';

export const STORAGE_KEYS = {
  hasSeenOnboarding: '@clearpass/hasSeenOnboarding', // app/_layout.tsx bootstrap
  onboardingComplete: '@clearpass/onboarding_complete', // app/index.tsx, app/taster.tsx
  userProgress: '@clearpass/user_progress',
  sessionHistory: '@clearpass/session_history',
  bookmarks: '@clearpass/bookmarks',
  referralCode: 'referral_code',
} as const;

/**
 * Write localStorage entries before any app script runs, on the first
 * document load of this page only (later navigations keep whatever the app
 * wrote, as a real browser would).
 */
export async function seedLocalStorage(page: Page, entries: Record<string, string>): Promise<void> {
  seedCounter += 1;
  const flag = `__e2e_seeded_${seedCounter}__`;
  await page.addInitScript(
    ({ data, flag }: { data: Record<string, string>; flag: string }) => {
      try {
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
        if (sessionStorage.getItem(flag)) return;
        sessionStorage.setItem(flag, '1');
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      } catch {
        // about:blank and opaque origins have no storage.
      }
    },
    { data: entries, flag },
  );
}

let seedCounter = 0;

export interface LearnerSeed {
  /** Mark onboarding as seen (both keys the app reads). Default true. */
  onboarded?: boolean;
  /** Merged over a fresh synthetic UserProgress. */
  progress?: Record<string, unknown>;
  sessionHistory?: unknown[];
  bookmarks?: string[];
  extra?: Record<string, string>;
}

/** A fresh, free-tier, synthetic UserProgress (shape of @clearpass/core UserProgress). */
export function syntheticProgress(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: 'local_user',
    topicScores: {},
    totalQuestionsAnswered: 0,
    mockTestHistory: [],
    readinessScore: 0,
    lastStudied: null,
    studyStreakDays: 0,
    xp: 0,
    achievements: [],
    dailyChallenge: null,
    testDate: null,
    battleModeHistory: [],
    isPro: false,
    proExpiresAt: null,
    dailyQuestionsAnswered: 0,
    hazardPerceptionHistory: [],
    ...overrides,
  };
}

export async function seedLearner(page: Page, seed: LearnerSeed = {}): Promise<void> {
  const entries: Record<string, string> = { ...(seed.extra ?? {}) };
  if (seed.onboarded ?? true) {
    entries[STORAGE_KEYS.hasSeenOnboarding] = 'true';
    entries[STORAGE_KEYS.onboardingComplete] = 'true';
  }
  if (seed.progress) entries[STORAGE_KEYS.userProgress] = JSON.stringify(syntheticProgress(seed.progress));
  if (seed.sessionHistory) entries[STORAGE_KEYS.sessionHistory] = JSON.stringify(seed.sessionHistory);
  if (seed.bookmarks) entries[STORAGE_KEYS.bookmarks] = JSON.stringify(seed.bookmarks);
  await seedLocalStorage(page, entries);
}

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export interface SyntheticAccount {
  id?: string;
  email?: string;
  accountType?: 'learner' | 'instructor' | null;
  /** Extra columns for the synthetic `profiles` row. */
  profile?: Record<string, unknown>;
}

/**
 * Sign the page in as a synthetic user: a JWT-shaped (unsigned, never
 * accepted by any real server) session in localStorage, the same user
 * served from the stubbed /auth/v1/user, and a `profiles` row in the
 * stubbed REST API. accountType null leaves the profile without a type
 * (post-auth routing then sends the user to choose-account-type).
 */
export async function signInAs(
  page: Page,
  network: NetworkHarness,
  account: SyntheticAccount = {},
): Promise<FakeUser> {
  const id = account.id ?? '00000000-0000-4000-8000-00000000e2e0';
  const email = account.email ?? 'learner@e2e.invalid';
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 24 * 3600;

  const user: FakeUser = {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const accessToken = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: id, email, role: 'authenticated', aud: 'authenticated', iat: now, exp, iss: 'e2e-synthetic' }),
    'e2e-synthetic-signature',
  ].join('.');

  network.authUser = user;
  const accountType = account.accountType === undefined ? 'learner' : account.accountType;
  network.db.profiles = [{ id, account_type: accountType, username: 'e2e_learner', ...(account.profile ?? {}) }];

  await seedLocalStorage(page, {
    [SUPABASE_AUTH_STORAGE_KEY]: JSON.stringify({
      access_token: accessToken,
      refresh_token: 'e2e-synthetic-refresh-token',
      token_type: 'bearer',
      expires_in: 24 * 3600,
      expires_at: exp,
      user,
    }),
  });
  return user;
}
