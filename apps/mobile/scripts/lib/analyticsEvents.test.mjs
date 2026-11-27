// Run: node --experimental-strip-types --test scripts/lib/analyticsEvents.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import {
  sanitiseProps,
  EVENT_PROPS,
  FEATURES,
  MAX_STRING_LENGTH,
  markOnce,
  localDayKey,
  shouldLogAppOpened,
  practicePhaseEvents,
} from '../../src/analyticsEvents.ts';

// ── Sanitiser ──────────────────────────────────────────────────────────────

test('allow-listed enum, boolean and number props pass through', () => {
  assert.deepEqual(sanitiseProps('feature_used', { feature: 'hazard' }), { feature: 'hazard' });
  assert.deepEqual(
    sanitiseProps('practice_results_viewed', { mode: 'battle', limit_reached: false }),
    { mode: 'battle', limit_reached: false },
  );
  assert.deepEqual(sanitiseProps('taster_completed', { correct: 4 }), { correct: 4 });
});

test('unknown keys are dropped', () => {
  assert.deepEqual(
    sanitiseProps('feature_used', { feature: 'practice', email: 'a@b.com', questionText: 'What does...' }),
    { feature: 'practice' },
  );
  assert.deepEqual(sanitiseProps('signup_started', { name: 'Craig' }), {});
});

test('strings outside the enum, over-long strings and free text are dropped', () => {
  assert.deepEqual(sanitiseProps('feature_used', { feature: 'not_a_feature' }), {});
  assert.deepEqual(sanitiseProps('feature_used', { feature: 'practice'.padEnd(MAX_STRING_LENGTH + 1, 'x') }), {});
  assert.deepEqual(sanitiseProps('signup_completed', { method: 'I typed something here' }), {});
});

test('wrong types are dropped: no objects, arrays, null, NaN or string-for-boolean', () => {
  assert.deepEqual(sanitiseProps('practice_results_viewed', { mode: { x: 1 }, limit_reached: 'true' }), {});
  assert.deepEqual(sanitiseProps('feature_used', { feature: ['practice'] }), {});
  assert.deepEqual(sanitiseProps('purchase_started', { plan: 'monthly', rail: 'iap', trialDays: null }), { plan: 'monthly', rail: 'iap' });
  assert.deepEqual(sanitiseProps('taster_completed', { correct: Number.NaN }), {});
  assert.deepEqual(sanitiseProps('taster_completed', { correct: 1e9 }), {});
  assert.deepEqual(sanitiseProps('taster_completed', { correct: 2.5 }), {});
});

test('unknown event or missing props gives an empty object', () => {
  assert.deepEqual(sanitiseProps('made_up_event', { feature: 'practice' }), {});
  assert.deepEqual(sanitiseProps('feature_used', undefined), {});
  assert.deepEqual(sanitiseProps('feature_used', null), {});
});

test('existing call sites keep their props', () => {
  const cases = [
    ['taster_completed', { correct: 3 }],
    ['onboarding_completed', { testDate: true }],
    ['daily_limit_hit', { at: 'mid_session' }],
    ['paywall_prompt_viewed', { reason: 'daily_limit', route: 'iap' }],
    ['paywall_prompt_tapped', { reason: 'mock_result', passed: false }],
    ['paywall_prompt_tapped', { reason: 'mock_standard_locked' }],
    ['paywall_viewed', { route: 'stripe_checkout' }],
    ['plan_selected', { plan: 'quarterly' }],
    ['purchase_started', { plan: 'monthly', rail: 'stripe' }],
    ['purchase_succeeded', { plan: 'monthly', rail: 'iap', trialDays: 7 }],
    ['purchase_cancelled', { plan: 'quarterly', rail: 'iap', trialDays: 3 }],
    ['purchase_failed', { plan: 'monthly', rail: 'iap', reason: 'no_package' }],
    ['free_mock_started', { mode: 'standard' }],
    ['free_mock_completed', { passed: true, correct: 45, total: 50 }],
    ['iap_unavailable', { mode: 'missing_api_key', source: 'boot' }],
    ['reminder_offer_viewed', { context: 'onboarding' }],
    ['reminder_enabled', { context: 'home' }],
    ['reminder_declined', { context: 'daily_limit' }],
    ['reminder_os_denied', { context: 'onboarding' }],
  ];
  for (const [event, props] of cases) assert.deepEqual(sanitiseProps(event, props), props, event);
});

test('every schema string value is short and every event has a schema', () => {
  for (const [event, schema] of Object.entries(EVENT_PROPS)) {
    for (const [key, spec] of Object.entries(schema)) {
      if (spec.type === 'enum') {
        for (const v of spec.values) assert.ok(v.length <= MAX_STRING_LENGTH, `${event}.${key}=${v}`);
      }
    }
  }
  assert.ok(FEATURES.includes('ask_pip'));
  assert.ok('daily_plan_viewed' in EVENT_PROPS);
  assert.ok('daily_plan_item_started' in EVENT_PROPS);
});

// ── Once-only flags ────────────────────────────────────────────────────────

test('markOnce fires the first time only and remembers each key', () => {
  const a = markOnce(null, 'first_question_answered');
  assert.equal(a.fire, true);
  const b = markOnce(a.next, 'first_question_answered');
  assert.equal(b.fire, false);
  assert.equal(b.next, a.next);
  const c = markOnce(b.next, 'first_session_completed');
  assert.equal(c.fire, true);
  assert.equal(markOnce(c.next, 'first_question_answered').fire, false);
  assert.equal(markOnce(c.next, 'first_session_completed').fire, false);
});

test('markOnce treats corrupt storage as empty rather than throwing', () => {
  assert.equal(markOnce('{not json', 'x').fire, true);
  assert.equal(markOnce('"a string"', 'x').fire, true);
  assert.equal(markOnce('[1,2]', 'x').fire, true);
});

// ── app_opened daily dedupe ────────────────────────────────────────────────

test('localDayKey uses the local calendar date', () => {
  assert.equal(localDayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
  assert.equal(localDayKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('app_opened logs once per local day', () => {
  const morning = new Date(2026, 10, 25, 8, 0);
  const evening = new Date(2026, 10, 25, 22, 0);
  const tomorrow = new Date(2026, 10, 26, 0, 5);
  const first = shouldLogAppOpened(null, morning);
  assert.deepEqual(first, { fire: true, day: '2026-11-25' });
  assert.deepEqual(shouldLogAppOpened(first.day, evening), { fire: false, day: '2026-11-25' });
  assert.deepEqual(shouldLogAppOpened(first.day, tomorrow), { fire: true, day: '2026-11-26' });
  // Clock moved backwards: still a different day, log it.
  assert.equal(shouldLogAppOpened('2026-11-26', morning).fire, true);
  assert.equal(shouldLogAppOpened('garbage', morning).fire, true);
});

// ── Practice phase transitions ─────────────────────────────────────────────

const ctx = over => ({ modeParam: undefined, isPro: false, dailyCount: 5, freeLimit: 10, ...over });

test('entering a practice mode logs feature_used once for that mode', () => {
  assert.deepEqual(practicePhaseEvents('loading', 'quiz', ctx()).featureUsed, 'practice');
  assert.deepEqual(practicePhaseEvents('loading', 'quiz', ctx({ modeParam: 'bookmarked' })).featureUsed, 'bookmarked');
  assert.deepEqual(practicePhaseEvents('loading', 'quiz', ctx({ modeParam: 'review' })).featureUsed, 'spaced_repetition');
  assert.equal(practicePhaseEvents('start', 'battle', ctx()).featureUsed, 'battle');
  assert.equal(practicePhaseEvents('start', 'speedRound', ctx()).featureUsed, 'speed_round');
  assert.equal(practicePhaseEvents('start', 'weakSpot', ctx()).featureUsed, 'weak_spots');
  assert.equal(practicePhaseEvents('quiz', 'quiz', ctx()).featureUsed, undefined);
  assert.equal(practicePhaseEvents('start', 'loading', ctx()).featureUsed, undefined);
});

test('finishing a session shows results with the limit flag', () => {
  assert.deepEqual(practicePhaseEvents('quiz', 'results', ctx()), {
    resultsViewed: { mode: 'practice', limit_reached: false },
    sessionCompleted: { mode: 'practice', limit_reached: false },
  });
  assert.deepEqual(practicePhaseEvents('quiz', 'results', ctx({ dailyCount: 10 })).resultsViewed, { mode: 'practice', limit_reached: true });
  assert.deepEqual(practicePhaseEvents('quiz', 'results', ctx({ dailyCount: 30, isPro: true })).resultsViewed, { mode: 'practice', limit_reached: false });
  assert.deepEqual(practicePhaseEvents('quiz', 'results', ctx({ modeParam: 'review' })).resultsViewed, { mode: 'spaced_repetition', limit_reached: false });
  assert.deepEqual(practicePhaseEvents('battle', 'battleResults', ctx({ dailyCount: 10 })).resultsViewed, { mode: 'battle', limit_reached: false });
  assert.deepEqual(practicePhaseEvents('speedRound', 'speedRoundResults', ctx()).resultsViewed, { mode: 'speed_round', limit_reached: false });
  assert.deepEqual(practicePhaseEvents('weakSpot', 'weakSpotResults', ctx()).resultsViewed, { mode: 'weak_spots', limit_reached: false });
});

test('hitting the limit mid-session completes the session without a results view', () => {
  assert.deepEqual(practicePhaseEvents('quiz', 'dailyLimit', ctx({ dailyCount: 10 })), {
    sessionCompleted: { mode: 'practice', limit_reached: true },
  });
  // Blocked at the start of a session: nothing was completed.
  assert.deepEqual(practicePhaseEvents('loading', 'dailyLimit', ctx({ dailyCount: 10 })), {});
  // An empty session jumps loading -> results: not a completed session.
  assert.deepEqual(practicePhaseEvents('loading', 'results', ctx()), {});
});
