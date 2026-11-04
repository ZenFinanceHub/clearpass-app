// Run: node --experimental-strip-types --test scripts/lib/studyNudges.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { buildNudgePlan, shouldOfferReminder, daysUntilTest, reminderDefaultsToApply, MAX_REMINDER_ASKS } from '../../src/studyNudges.ts';
import { testDateError } from '../../src/testDateRules.ts';

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

test('includes today when not studied and time is ahead', () => {
  const plan = buildNudgePlan({ now: at(2026, 10, 22, 12), hour: 19, minute: 0 });
  assert.equal(plan[0].date.getDate(), 22);
  assert.equal(plan[0].date.getHours(), 19);
});

test('skips today once studied today', () => {
  const now = at(2026, 10, 22, 12);
  const plan = buildNudgePlan({ now, hour: 19, minute: 0, lastStudiedIso: at(2026, 10, 22, 9).toISOString() });
  assert.equal(plan[0].date.getDate(), 23);
});

test('skips today when reminder time has passed', () => {
  const plan = buildNudgePlan({ now: at(2026, 10, 22, 20), hour: 19, minute: 0 });
  assert.equal(plan[0].date.getDate(), 23);
});

test('daily for two weeks, then every other day, then weekly to day 56', () => {
  const plan = buildNudgePlan({ now: at(2026, 10, 22, 8), hour: 19, minute: 0 });
  assert.equal(plan.length, 24);
  assert.ok(plan.length < 64, 'iOS keeps at most 64 pending notifications');
  const offsets = plan.map(p => Math.round((p.date - at(2026, 10, 22, 19)) / 86400000));
  assert.deepEqual(offsets, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 21, 28, 35, 42, 49, 56]);
});

test('first two weeks use the everyday copy, later ones the gentle copy', () => {
  const plan = buildNudgePlan({ now: at(2026, 10, 22, 8), hour: 19, minute: 0 });
  for (const n of plan.slice(0, 15)) assert.doesNotMatch(n.body, /progress is saved/);
  for (const n of plan.slice(15)) assert.match(n.body, /progress is saved/);
});

test('stops after the test date and uses test-day copy', () => {
  const testDateIso = new Date(2026, 9, 25).toISOString(); // 25 Oct
  const plan = buildNudgePlan({ now: at(2026, 10, 22, 8), hour: 19, minute: 0, testDateIso });
  assert.equal(plan.length, 4); // 22, 23, 24, 25
  assert.match(plan[2].title, /tomorrow/);
  assert.match(plan[3].title, /Today's the day/);
});

test('free vs pro copy', () => {
  const free = buildNudgePlan({ now: at(2026, 10, 22, 8), hour: 19, minute: 0 });
  const pro = buildNudgePlan({ now: at(2026, 10, 22, 8), hour: 19, minute: 0, isPro: true });
  assert.match(free[0].title, /10 free questions/);
  assert.doesNotMatch(pro[0].title, /free/);
});

test('later nudges are the gentle "progress saved" message', () => {
  const plan = buildNudgePlan({ now: at(2026, 10, 22, 8), hour: 19, minute: 0 });
  assert.match(plan.at(-1).body, /progress is saved/);
});

test('daysUntilTest ignores past dates', () => {
  assert.equal(daysUntilTest(new Date(1973, 0, 24).toISOString(), at(2026, 10, 22)), null);
  assert.equal(daysUntilTest(new Date(2026, 9, 29).toISOString(), at(2026, 10, 22)), 7);
});

const base = { isWeb: false, remindersOn: false, permission: 'undetermined', canAskAgain: true, ask: { times: 0, lastIso: null }, now: at(2026, 10, 22) };

test('offers on first visit', () => assert.equal(shouldOfferReminder(base), true));
test('never on web or when already on', () => {
  assert.equal(shouldOfferReminder({ ...base, isWeb: true }), false);
  assert.equal(shouldOfferReminder({ ...base, remindersOn: true }), false);
});
test('not when OS will not prompt again', () => {
  assert.equal(shouldOfferReminder({ ...base, permission: 'denied', canAskAgain: false }), false);
});
test('waits 2 days between asks, max asks', () => {
  assert.equal(shouldOfferReminder({ ...base, ask: { times: 1, lastIso: at(2026, 10, 21).toISOString() } }), false);
  assert.equal(shouldOfferReminder({ ...base, ask: { times: 1, lastIso: at(2026, 10, 19).toISOString() } }), true);
  assert.equal(shouldOfferReminder({ ...base, ask: { times: MAX_REMINDER_ASKS, lastIso: null } }), false);
});

test('test date rules', () => {
  const now = at(2026, 10, 21);
  assert.match(testDateError(new Date(1973, 0, 24).toISOString(), now), /date of birth/);
  assert.equal(testDateError(new Date(2026, 9, 21).toISOString(), now), null);
  assert.equal(testDateError(new Date(2026, 11, 20).toISOString(), now), null);
  assert.match(testDateError(new Date(2029, 0, 1).toISOString(), now), /2 years/);
});

test('reminders switch on by default exactly once', () => {
  const now = at(2026, 11, 4);
  const off = { studyReminder: false, testCountdown: false };
  assert.deepEqual(reminderDefaultsToApply({ alreadyApplied: false, settings: off, now }), { studyReminder: true, testCountdown: false });
  // After that the Settings toggle wins, even if it was turned back off.
  assert.equal(reminderDefaultsToApply({ alreadyApplied: true, settings: off, now }), null);
});

test('default also turns on the test countdown when a future test is set', () => {
  const now = at(2026, 11, 4);
  const off = { studyReminder: false, testCountdown: false };
  const future = new Date(2026, 11, 1).toISOString();
  const past = new Date(2026, 9, 1).toISOString();
  assert.equal(reminderDefaultsToApply({ alreadyApplied: false, settings: off, testDateIso: future, now }).testCountdown, true);
  assert.equal(reminderDefaultsToApply({ alreadyApplied: false, settings: off, testDateIso: past, now }).testCountdown, false);
});
