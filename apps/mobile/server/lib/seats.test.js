const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SEAT_DURATION_DAYS,
  generateSeatToken,
  computeSeatExpiresAt,
  isSeatPurchaseSession,
  classifyExistingPro,
  resolveSeatGrant,
  resolveSeatLookupOutcome,
} = require('./seats');

const NOW = '2026-08-15T00:00:00.000Z';

test('SEAT_DURATION_DAYS is 90', () => {
  assert.equal(SEAT_DURATION_DAYS, 90);
});

test('generateSeatToken produces a long, URL-safe, unpredictable token', () => {
  const token = generateSeatToken();
  assert.equal(typeof token, 'string');
  assert.ok(token.length >= 20, `expected a long token, got length ${token.length}`);
  assert.match(token, /^[A-Za-z0-9_-]+$/, 'token must be URL-safe (base64url charset only)');
});

test('generateSeatToken produces different tokens on each call', () => {
  const tokens = new Set(Array.from({ length: 50 }, () => generateSeatToken()));
  assert.equal(tokens.size, 50, 'expected 50 distinct tokens, got a collision');
});

test('computeSeatExpiresAt adds 90 days to the given date', () => {
  const result = computeSeatExpiresAt(new Date('2026-08-15T00:00:00.000Z'));
  assert.equal(result, '2026-11-13T00:00:00.000Z');
});

test('computeSeatExpiresAt returns an ISO 8601 string', () => {
  const result = computeSeatExpiresAt(new Date('2026-01-01T00:00:00.000Z'));
  assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('isSeatPurchaseSession is true only when metadata.type is exactly "seat"', () => {
  assert.equal(isSeatPurchaseSession({ metadata: { type: 'seat' } }), true);
  assert.equal(isSeatPurchaseSession({ metadata: { type: 'pro_purchase' } }), false);
  assert.equal(isSeatPurchaseSession({ metadata: {} }), false);
  assert.equal(isSeatPurchaseSession({ metadata: null }), false);
  assert.equal(isSeatPurchaseSession({}), false);
});

// ─── classifyExistingPro ────────────────────────────────────────────────────

test('classifyExistingPro: no Pro at all is "none"', () => {
  assert.equal(classifyExistingPro({}, NOW), 'none');
  assert.equal(classifyExistingPro({ isPro: false }, NOW), 'none');
});

test('classifyExistingPro: comp and instructor are "permanent" regardless of proExpiresAt', () => {
  assert.equal(classifyExistingPro({ isPro: true, proSource: 'comp', proExpiresAt: null }, NOW), 'permanent');
  assert.equal(classifyExistingPro({ isPro: true, proSource: 'instructor', proExpiresAt: null }, NOW), 'permanent');
  // Even a past date doesn't matter for these — they're exempt from expiry.
  assert.equal(classifyExistingPro({ isPro: true, proSource: 'comp', proExpiresAt: '2020-01-01T00:00:00.000Z' }, NOW), 'permanent');
});

test('classifyExistingPro: stripe/seat with a future proExpiresAt is "active"', () => {
  assert.equal(classifyExistingPro({ isPro: true, proSource: 'stripe', proExpiresAt: '2026-09-01T00:00:00.000Z' }, NOW), 'active');
  assert.equal(classifyExistingPro({ isPro: true, proSource: 'seat', proExpiresAt: '2026-09-01T00:00:00.000Z' }, NOW), 'active');
});

test('classifyExistingPro: stale case — isPro true, stripe/seat sourced, proExpiresAt already in the past is "none"', () => {
  const stale = { isPro: true, proSource: 'stripe', proExpiresAt: '2026-08-01T00:00:00.000Z' };
  assert.equal(classifyExistingPro(stale, NOW), 'none');
  const staleSeat = { isPro: true, proSource: 'seat', proExpiresAt: '2026-08-01T00:00:00.000Z' };
  assert.equal(classifyExistingPro(staleSeat, NOW), 'none');
});

test('classifyExistingPro: stripe/seat with no proExpiresAt at all is "none", not "active"', () => {
  assert.equal(classifyExistingPro({ isPro: true, proSource: 'stripe', proExpiresAt: null }, NOW), 'none');
});

// ─── resolveSeatGrant — the three branches + the stale-expiry case ─────────

test('branch 1 — permanent (comp): does not redeem, seat stays valid', () => {
  const current = { isPro: true, proExpiresAt: null, proSource: 'comp', xp: 5 };
  const result = resolveSeatGrant(current, NOW);
  assert.equal(result.action, 'skip');
  assert.equal(result.updatedProgress, null);
});

test('branch 1 — permanent (instructor): does not redeem, seat stays valid', () => {
  const current = { isPro: true, proExpiresAt: null, proSource: 'instructor' };
  const result = resolveSeatGrant(current, NOW);
  assert.equal(result.action, 'skip');
  assert.equal(result.updatedProgress, null);
});

test('branch 2 — active stripe: redeems and EXTENDS from the current expiry, not from now', () => {
  const current = { isPro: true, proExpiresAt: '2026-09-01T00:00:00.000Z', proSource: 'stripe', xp: 5 };
  const result = resolveSeatGrant(current, NOW);
  assert.equal(result.action, 'grant');
  assert.equal(result.extended, true);
  // 90 days from the EXISTING expiry (2026-09-01), not from NOW (2026-08-15).
  assert.equal(result.proExpiresAt, '2026-11-30T00:00:00.000Z');
  assert.deepEqual(result.updatedProgress, { xp: 5, isPro: true, proExpiresAt: '2026-11-30T00:00:00.000Z', proSource: 'seat' });
});

test('branch 2 — active earlier seat: redeems and extends from the current expiry', () => {
  const current = { isPro: true, proExpiresAt: '2026-09-01T00:00:00.000Z', proSource: 'seat' };
  const result = resolveSeatGrant(current, NOW);
  assert.equal(result.action, 'grant');
  assert.equal(result.extended, true);
  assert.equal(result.proExpiresAt, '2026-11-30T00:00:00.000Z');
});

test('branch 3 — no Pro: grants fresh 90 days from now', () => {
  const current = { xp: 10 };
  const result = resolveSeatGrant(current, NOW);
  assert.equal(result.action, 'grant');
  assert.equal(result.extended, false);
  assert.equal(result.proExpiresAt, '2026-11-13T00:00:00.000Z');
  assert.deepEqual(result.updatedProgress, { xp: 10, isPro: true, proExpiresAt: '2026-11-13T00:00:00.000Z', proSource: 'seat' });
});

test('stale-expiry case: isPro true but proExpiresAt already past — treated as no Pro, fresh grant from now, NOT extended from the stale date', () => {
  const current = { isPro: true, proExpiresAt: '2026-08-01T00:00:00.000Z', proSource: 'stripe' };
  const result = resolveSeatGrant(current, NOW);
  assert.equal(result.action, 'grant');
  assert.equal(result.extended, false, 'must not be treated as an extension of the stale date');
  // Fresh 90 days from NOW, not 90 days from the stale 2026-08-01 date
  // (which would produce an earlier, worse-value expiry).
  assert.equal(result.proExpiresAt, '2026-11-13T00:00:00.000Z');
});

// ─── resolveSeatLookupOutcome ───────────────────────────────────────────────

test('resolveSeatLookupOutcome: token does not exist at all', () => {
  const outcome = resolveSeatLookupOutcome(null, 'learner1');
  assert.equal(outcome.httpStatus, 404);
  assert.equal(outcome.body.error, 'invalid_token');
});

test('resolveSeatLookupOutcome: unredeemed seat returns null (caller proceeds)', () => {
  const outcome = resolveSeatLookupOutcome({ id: 'seat1', redeemed_at: null, redeemed_by: null }, 'learner1');
  assert.equal(outcome, null);
});

test('resolveSeatLookupOutcome: idempotent retry by the same user who already redeemed it', () => {
  const seat = { redeemed_by: 'learner1', redeemed_at: '2026-08-01T00:00:00.000Z', pro_expires_at: '2026-10-30T00:00:00.000Z' };
  const outcome = resolveSeatLookupOutcome(seat, 'learner1');
  assert.equal(outcome.httpStatus, 200);
  assert.equal(outcome.body.redeemed, true);
  assert.equal(outcome.body.alreadyRedeemed, true);
  assert.equal(outcome.body.proExpiresAt, '2026-10-30T00:00:00.000Z');
});

test('resolveSeatLookupOutcome: conflict when a different user already redeemed it', () => {
  const seat = { redeemed_by: 'someone-else', redeemed_at: '2026-08-01T00:00:00.000Z' };
  const outcome = resolveSeatLookupOutcome(seat, 'learner1');
  assert.equal(outcome.httpStatus, 409);
  assert.equal(outcome.body.error, 'already_redeemed');
});

test('resolveSeatLookupOutcome: invalidated (refunded, unredeemed) seat reads as an unknown token', () => {
  const seat = { redeemed_at: null, redeemed_by: null, invalidated_at: '2026-08-20T00:00:00.000Z' };
  const outcome = resolveSeatLookupOutcome(seat, 'learner1');
  assert.equal(outcome.httpStatus, 404);
  assert.equal(outcome.body.error, 'invalid_token');
});

test('resolveSeatLookupOutcome: invalidated check wins even if somehow also marked redeemed', () => {
  // Shouldn't happen in practice (invalidated_at is only ever set on an
  // unredeemed seat), but the invalidated check runs first regardless —
  // defense in depth, not reliant on that invariant holding elsewhere.
  const seat = { redeemed_at: '2026-08-01T00:00:00.000Z', redeemed_by: 'learner1', invalidated_at: '2026-08-20T00:00:00.000Z' };
  const outcome = resolveSeatLookupOutcome(seat, 'learner1');
  assert.equal(outcome.httpStatus, 404);
  assert.equal(outcome.body.error, 'invalid_token');
});
