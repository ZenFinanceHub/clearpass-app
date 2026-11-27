/**
 * "Has this device seen onboarding?" — one key, one reader. Pure, so it can
 * be tested with plain Node (see scripts/lib/onboardingState.test.mjs).
 *
 * The cold-start bootstrap (app/_layout.tsx) and src/storage.ts always used
 * ONBOARDING_KEY, but the welcome screen (app/index.tsx) and the taster
 * (app/taster.tsx) wrote a different key, so a learner who left the welcome
 * screen via "Create a free account" / "Sign In" was still "unseen" to the
 * bootstrap and got sent through onboarding again on the next cold start.
 * Everything now writes ONBOARDING_KEY; LEGACY_ONBOARDING_KEY is still read
 * so nobody who set only the old key is re-onboarded.
 */

export const ONBOARDING_KEY = '@clearpass/hasSeenOnboarding';
export const LEGACY_ONBOARDING_KEY = '@clearpass/onboarding_complete';
export const ONBOARDING_READ_KEYS: readonly string[] = [ONBOARDING_KEY, LEGACY_ONBOARDING_KEY];

/** Takes AsyncStorage.multiGet(ONBOARDING_READ_KEYS)-shaped entries. */
export function hasSeenOnboardingFrom(entries: ReadonlyArray<readonly [string, string | null]>): boolean {
  return entries.some(([key, value]) => ONBOARDING_READ_KEYS.includes(key) && !!value);
}

export type WelcomeAction = 'home' | 'landing' | 'signin' | 'show';

/** What the welcome screen (app/index.tsx) does once auth state is known. */
export function resolveWelcomeAction(p: { isWeb: boolean; hasSession: boolean; hasSeenOnboarding: boolean }): WelcomeAction {
  if (p.hasSession) return 'home';
  if (p.isWeb) return 'landing';
  return p.hasSeenOnboarding ? 'signin' : 'show';
}
