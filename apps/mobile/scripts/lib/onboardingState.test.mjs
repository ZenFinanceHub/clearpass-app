// Run via: npm run test:scripts
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import {
  ONBOARDING_KEY,
  LEGACY_ONBOARDING_KEY,
  ONBOARDING_READ_KEYS,
  hasSeenOnboardingFrom,
  resolveWelcomeAction,
} from '../../src/onboardingState.ts';

const require = createRequire(import.meta.url);
const { resolveBootstrapDestination } = require('../../server/lib/bootstrapRouting.js');

// What AsyncStorage.multiGet(ONBOARDING_READ_KEYS) would hand back.
const stored = (current, legacy) => [[ONBOARDING_KEY, current], [LEGACY_ONBOARDING_KEY, legacy]];

test('one canonical key, the one the bootstrap has always read', () => {
  assert.equal(ONBOARDING_KEY, '@clearpass/hasSeenOnboarding');
  assert.equal(LEGACY_ONBOARDING_KEY, '@clearpass/onboarding_complete');
  assert.deepEqual(ONBOARDING_READ_KEYS, [ONBOARDING_KEY, LEGACY_ONBOARDING_KEY]);
});

test('seen when either the current or the legacy key is set', () => {
  assert.equal(hasSeenOnboardingFrom(stored(null, null)), false);
  assert.equal(hasSeenOnboardingFrom(stored('true', null)), true);
  assert.equal(hasSeenOnboardingFrom(stored(null, 'true')), true);
  assert.equal(hasSeenOnboardingFrom(stored('true', 'true')), true);
  assert.equal(hasSeenOnboardingFrom(stored('', '')), false);
  assert.equal(hasSeenOnboardingFrom([]), false);
});

test('ignores unrelated keys', () => {
  assert.equal(hasSeenOnboardingFrom([['@clearpass/other', 'true']]), false);
});

// Cold start: the bootstrap's decision, fed by the unified read.
const coldStart = (hasSession, entries) =>
  resolveBootstrapDestination({ hasSession, launchedSegment: null, hasSeenOnboarding: hasSeenOnboardingFrom(entries) }).action;

test('cold start, no session, never onboarded -> onboarding', () => {
  assert.equal(coldStart(false, stored(null, null)), 'onboarding');
});

test('cold start, no session, onboarded -> sign in', () => {
  assert.equal(coldStart(false, stored('true', null)), 'signin');
});

test('cold start, no session, only the legacy key (tapped Get started / Sign in on the old welcome screen) -> sign in, not re-onboarded', () => {
  assert.equal(coldStart(false, stored(null, 'true')), 'signin');
});

test('cold start with a session ignores onboarding state', () => {
  assert.equal(coldStart(true, stored(null, null)), 'post-auth');
  assert.equal(coldStart(true, stored(null, 'true')), 'post-auth');
});

test('welcome screen (app/index): session -> home; web without session -> landing', () => {
  assert.equal(resolveWelcomeAction({ isWeb: false, hasSession: true, hasSeenOnboarding: false }), 'home');
  assert.equal(resolveWelcomeAction({ isWeb: true, hasSession: true, hasSeenOnboarding: false }), 'home');
  assert.equal(resolveWelcomeAction({ isWeb: true, hasSession: false, hasSeenOnboarding: true }), 'landing');
  assert.equal(resolveWelcomeAction({ isWeb: true, hasSession: false, hasSeenOnboarding: false }), 'landing');
});

test('welcome screen (app/index), native, no session: seen -> sign in, unseen -> show welcome', () => {
  assert.equal(resolveWelcomeAction({ isWeb: false, hasSession: false, hasSeenOnboarding: true }), 'signin');
  assert.equal(resolveWelcomeAction({ isWeb: false, hasSession: false, hasSeenOnboarding: false }), 'show');
});
