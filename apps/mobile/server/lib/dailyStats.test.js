'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  MAX_STATS_ROWS,
  isActivePro,
  computeDailyStats,
  formatDailyStatsMessage,
} = require('./dailyStats');

const NOW = '2026-08-25T12:00:00.000Z';
const FUTURE = '2026-12-01T00:00:00.000Z';
const PAST = '2026-01-01T00:00:00.000Z';

function profile(id, accountType, extra = {}) {
  return { id, account_type: accountType, created_at: PAST, signup_ref: null, ...extra };
}
function progress(id, p) {
  return { id, progress: p };
}

test('MAX_STATS_ROWS is 20000', () => {
  assert.equal(MAX_STATS_ROWS, 20000);
});

// ── isActivePro ───────────────────────────────────────────────────────────────

test('isActivePro: false when isPro is not true', () => {
  assert.equal(isActivePro({ isPro: false, proSource: 'stripe' }, NOW), false);
  assert.equal(isActivePro({}, NOW), false);
  assert.equal(isActivePro(null, NOW), false);
});

test('isActivePro: paying grant with a future expiry is active', () => {
  assert.equal(isActivePro({ isPro: true, proSource: 'stripe', proExpiresAt: FUTURE }, NOW), true);
});

test('isActivePro: paying grant with a past expiry is NOT active', () => {
  assert.equal(isActivePro({ isPro: true, proSource: 'stripe', proExpiresAt: PAST }, NOW), false);
});

test('isActivePro: instructor grant is active despite a null expiry (exempt)', () => {
  assert.equal(isActivePro({ isPro: true, proSource: 'instructor', proExpiresAt: null }, NOW), true);
});

test('isActivePro: instructor grant is active even with a PAST expiry — exempt from expiry entirely', () => {
  assert.equal(isActivePro({ isPro: true, proSource: 'instructor', proExpiresAt: PAST }, NOW), true);
});

test('isActivePro: comp grant is exempt the same way', () => {
  assert.equal(isActivePro({ isPro: true, proSource: 'comp', proExpiresAt: PAST }, NOW), true);
});

test('isActivePro: paying grant with NULL expiry counts as active — mirrors the !!proExpiresAt guard in isEligibleForProExpiry', () => {
  assert.equal(isActivePro({ isPro: true, proSource: 'seat', proExpiresAt: null }, NOW), true);
});

// ── computeDailyStats ─────────────────────────────────────────────────────────

test('empty database produces zeroes, not NaN', () => {
  const s = computeDailyStats({ profiles: [], progressRows: [], nowIso: NOW, refCode: 'adinjc26' });
  assert.equal(s.totalAccounts, 0);
  assert.equal(s.conversionPct, 0);
  assert.ok(!Number.isNaN(s.conversionPct));
});

test('conversion is 0 (not NaN) when there are no paying and no free learners', () => {
  const s = computeDailyStats({
    profiles: [profile('i1', 'instructor')],
    progressRows: [progress('i1', { isPro: true, proSource: 'instructor' })],
    nowIso: NOW,
  });
  assert.equal(s.conversionPct, 0);
});

test('a profile with NO user_progress row counts as a free learner', () => {
  const s = computeDailyStats({
    profiles: [profile('a', 'learner')],
    progressRows: [],
    nowIso: NOW,
  });
  assert.equal(s.freeLearners, 1);
  assert.equal(s.totalAccounts, 1);
});

test('three-way paying split is counted separately', () => {
  const s = computeDailyStats({
    profiles: [profile('a', 'learner'), profile('b', 'learner'), profile('c', 'learner')],
    progressRows: [
      progress('a', { isPro: true, proSource: 'stripe', proExpiresAt: FUTURE }),
      progress('b', { isPro: true, proSource: 'seat', proExpiresAt: FUTURE }),
      progress('c', { isPro: true, proSource: 'iap', proExpiresAt: FUTURE }),
    ],
    nowIso: NOW,
  });
  assert.equal(s.payingDirect, 1);
  assert.equal(s.payingSeat, 1);
  assert.equal(s.payingIap, 1);
  assert.equal(s.payingTotal, 3);
  assert.equal(s.freeLearners, 0);
  assert.equal(s.conversionPct, 100);
});

test('expired paying grant becomes a free learner, not a paying one', () => {
  const s = computeDailyStats({
    profiles: [profile('a', 'learner')],
    progressRows: [progress('a', { isPro: true, proSource: 'stripe', proExpiresAt: PAST })],
    nowIso: NOW,
  });
  assert.equal(s.payingTotal, 0);
  assert.equal(s.freeLearners, 1);
  assert.equal(s.conversionPct, 0);
});

test('comps are excluded from BOTH sides of conversion', () => {
  // 1 paying + 1 free => 50%. Adding 8 comps must not move it.
  const profiles = [profile('p', 'learner'), profile('f', 'learner')];
  const progressRows = [progress('p', { isPro: true, proSource: 'stripe', proExpiresAt: FUTURE })];
  for (let i = 0; i < 8; i++) {
    profiles.push(profile('c' + i, 'learner'));
    progressRows.push(progress('c' + i, { isPro: true, proSource: 'comp' }));
  }
  const s = computeDailyStats({ profiles, progressRows, nowIso: NOW });
  assert.equal(s.grantedComp, 8);
  assert.equal(s.conversionPct, 50);
});

test('instructors are excluded from BOTH sides of conversion', () => {
  const profiles = [profile('p', 'learner'), profile('f', 'learner'), profile('i', 'instructor')];
  const progressRows = [
    progress('p', { isPro: true, proSource: 'stripe', proExpiresAt: FUTURE }),
    progress('i', { isPro: true, proSource: 'instructor' }),
  ];
  const s = computeDailyStats({ profiles, progressRows, nowIso: NOW });
  assert.equal(s.instructors, 1);
  assert.equal(s.freeLearners, 1);
  assert.equal(s.conversionPct, 50);
});

test('an instructor account without Pro is still not counted as a free learner', () => {
  const s = computeDailyStats({
    profiles: [profile('i', 'instructor')],
    progressRows: [],
    nowIso: NOW,
  });
  assert.equal(s.instructors, 1);
  assert.equal(s.freeLearners, 0);
});

test('indefinite counts paying accounts with no expiry, and they still count as paying', () => {
  const s = computeDailyStats({
    profiles: [profile('a', 'learner')],
    progressRows: [progress('a', { isPro: true, proSource: 'seat', proExpiresAt: null })],
    nowIso: NOW,
  });
  assert.equal(s.indefinite, 1);
  assert.equal(s.payingSeat, 1);
});

test('instructor/comp grants are NOT counted as indefinite — never having an expiry is correct for them', () => {
  const s = computeDailyStats({
    profiles: [profile('i', 'instructor'), profile('c', 'learner')],
    progressRows: [
      progress('i', { isPro: true, proSource: 'instructor', proExpiresAt: null }),
      progress('c', { isPro: true, proSource: 'comp', proExpiresAt: null }),
    ],
    nowIso: NOW,
  });
  assert.equal(s.indefinite, 0);
});

test('newLast24h uses a 24h window against created_at', () => {
  const recent = new Date(Date.parse(NOW) - 60 * 60 * 1000).toISOString();
  const old = new Date(Date.parse(NOW) - 48 * 60 * 60 * 1000).toISOString();
  const s = computeDailyStats({
    profiles: [
      profile('a', 'learner', { created_at: recent }),
      profile('b', 'learner', { created_at: old }),
    ],
    progressRows: [],
    nowIso: NOW,
  });
  assert.equal(s.newLast24h, 1);
});

test('refCount matches only the requested code', () => {
  const s = computeDailyStats({
    profiles: [
      profile('a', 'learner', { signup_ref: 'adinjc26' }),
      profile('b', 'learner', { signup_ref: 'other' }),
      profile('c', 'learner', { signup_ref: null }),
    ],
    progressRows: [],
    nowIso: NOW,
    refCode: 'adinjc26',
  });
  assert.equal(s.refCount, 1);
});

test('conversion rounds to one decimal place', () => {
  // 1 paying, 2 free => 33.333% => 33.3
  const s = computeDailyStats({
    profiles: [profile('p', 'learner'), profile('f1', 'learner'), profile('f2', 'learner')],
    progressRows: [progress('p', { isPro: true, proSource: 'stripe', proExpiresAt: FUTURE })],
    nowIso: NOW,
  });
  assert.equal(s.conversionPct, 33.3);
});

// ── exclude_from_stats ────────────────────────────────────────────────────────

test('excluded accounts still count in totalAccounts and the learner/instructor split', () => {
  const s = computeDailyStats({
    profiles: [
      profile('a', 'learner', { exclude_from_stats: true }),
      profile('b', 'instructor', { exclude_from_stats: true }),
    ],
    progressRows: [],
    nowIso: NOW,
  });
  assert.equal(s.totalAccounts, 2);
  assert.equal(s.learners, 1);
  assert.equal(s.instructors, 1);
  assert.equal(s.excluded, 2);
});

test('excluded accounts are removed from the free-learner tally', () => {
  const s = computeDailyStats({
    profiles: [profile('a', 'learner', { exclude_from_stats: true }), profile('b', 'learner')],
    progressRows: [],
    nowIso: NOW,
  });
  assert.equal(s.freeLearners, 1);
  assert.equal(s.excluded, 1);
});

test('excluded accounts are removed from BOTH sides of conversion', () => {
  // 1 paying + 1 free => 50%. Ten excluded free learners must not move it.
  const profiles = [profile('p', 'learner'), profile('f', 'learner')];
  const progressRows = [progress('p', { isPro: true, proSource: 'stripe', proExpiresAt: FUTURE })];
  for (let i = 0; i < 10; i++) profiles.push(profile('x' + i, 'learner', { exclude_from_stats: true }));
  const s = computeDailyStats({ profiles, progressRows, nowIso: NOW });
  assert.equal(s.conversionPct, 50);
  assert.equal(s.excluded, 10);
  assert.equal(s.totalAccounts, 12);
});

test('an excluded PAYING account is kept out of the numerator too', () => {
  // Otherwise a test purchase would inflate the rate.
  const s = computeDailyStats({
    profiles: [
      profile('p', 'learner', { exclude_from_stats: true }),
      profile('f', 'learner'),
    ],
    progressRows: [progress('p', { isPro: true, proSource: 'stripe', proExpiresAt: FUTURE })],
    nowIso: NOW,
  });
  assert.equal(s.payingTotal, 0);
  assert.equal(s.conversionPct, 0);
});

test('excluded accounts do not appear in newLast24h — a re-seed is not eight signups', () => {
  const recent = new Date(Date.parse(NOW) - 60 * 60 * 1000).toISOString();
  const profiles = [profile('real', 'learner', { created_at: recent })];
  for (let i = 0; i < 8; i++) {
    profiles.push(profile('seed' + i, 'learner', { created_at: recent, exclude_from_stats: true }));
  }
  const s = computeDailyStats({ profiles, progressRows: [], nowIso: NOW });
  assert.equal(s.newLast24h, 1);
});

test('excluded accounts DO still count towards the campaign ref total', () => {
  // A stand demo is still a scan.
  const s = computeDailyStats({
    profiles: [
      profile('a', 'learner', { signup_ref: 'adinjc26', exclude_from_stats: true }),
      profile('b', 'learner', { signup_ref: 'adinjc26' }),
    ],
    progressRows: [],
    nowIso: NOW,
    refCode: 'adinjc26',
  });
  assert.equal(s.refCount, 2);
  assert.equal(s.excluded, 1);
});

test('excluded Pro accounts are kept out of the granted buckets as well', () => {
  const s = computeDailyStats({
    profiles: [profile('c', 'learner', { exclude_from_stats: true })],
    progressRows: [progress('c', { isPro: true, proSource: 'comp' })],
    nowIso: NOW,
  });
  assert.equal(s.grantedTotal, 0);
  assert.equal(s.grantedComp, 0);
});

test('a missing or false exclude_from_stats is treated as not excluded', () => {
  const s = computeDailyStats({
    profiles: [
      profile('a', 'learner'), // field absent entirely
      profile('b', 'learner', { exclude_from_stats: false }),
    ],
    progressRows: [],
    nowIso: NOW,
  });
  assert.equal(s.excluded, 0);
  assert.equal(s.freeLearners, 2);
});

// ── formatDailyStatsMessage ───────────────────────────────────────────────────

test('message omits the indefinite warning when the count is zero', () => {
  const s = computeDailyStats({ profiles: [], progressRows: [], nowIso: NOW });
  const msg = formatDailyStatsMessage(s, 'adinjc26');
  assert.ok(!msg.includes('never lapse'));
});

test('message includes the indefinite warning when non-zero', () => {
  const s = computeDailyStats({
    profiles: [profile('a', 'learner')],
    progressRows: [progress('a', { isPro: true, proSource: 'seat', proExpiresAt: null })],
    nowIso: NOW,
  });
  const msg = formatDailyStatsMessage(s, 'adinjc26');
  assert.ok(msg.includes('never lapse'));
});

test('message includes the ref line only when a refCode is given', () => {
  const s = computeDailyStats({ profiles: [], progressRows: [], nowIso: NOW });
  assert.ok(formatDailyStatsMessage(s, 'adinjc26').includes('adinjc26'));
  assert.ok(!formatDailyStatsMessage(s, null).includes('Signups from'));
});
