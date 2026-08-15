const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SEAT_DURATION_DAYS,
  generateSeatToken,
  computeSeatExpiresAt,
  isSeatPurchaseSession,
  resolveSeatGrant,
  resolveRedeemOutcome,
} = require('./seats');

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

test('resolveSeatGrant grants Pro when the learner has no current proSource', () => {
  const result = resolveSeatGrant({ xp: 10 }, '2027-01-01T00:00:00.000Z');
  assert.equal(result.granted, true);
  assert.deepEqual(result.updatedProgress, {
    xp: 10,
    isPro: true,
    proExpiresAt: '2027-01-01T00:00:00.000Z',
    proSource: 'seat',
  });
});

test('resolveSeatGrant does not grant when the learner already has a stripe grant', () => {
  const current = { isPro: true, proExpiresAt: '2026-09-01T00:00:00.000Z', proSource: 'stripe' };
  const result = resolveSeatGrant(current, '2027-01-01T00:00:00.000Z');
  assert.equal(result.granted, false);
  assert.deepEqual(result.updatedProgress, current, 'progress must be left completely untouched');
});

test('resolveSeatGrant does not grant when the learner already has a comp grant', () => {
  const current = { isPro: true, proExpiresAt: null, proSource: 'comp' };
  const result = resolveSeatGrant(current, '2027-01-01T00:00:00.000Z');
  assert.equal(result.granted, false);
});

test('resolveSeatGrant does not grant when the learner already has an instructor grant', () => {
  const current = { isPro: true, proExpiresAt: null, proSource: 'instructor' };
  const result = resolveSeatGrant(current, '2027-01-01T00:00:00.000Z');
  assert.equal(result.granted, false);
});

test('resolveRedeemOutcome: fresh redemption (row was claimed)', () => {
  const outcome = resolveRedeemOutcome({
    claimed: { id: 'seat1', instructor_id: 'inst1' },
    existing: null,
    userId: 'learner1',
    granted: true,
    proExpiresAt: '2027-01-01T00:00:00.000Z',
  });
  assert.equal(outcome.httpStatus, 200);
  assert.equal(outcome.body.redeemed, true);
  assert.equal(outcome.body.granted, true);
});

test('resolveRedeemOutcome: idempotent retry by the same user who already redeemed it', () => {
  const outcome = resolveRedeemOutcome({
    claimed: null,
    existing: { redeemed_by: 'learner1', redeemed_at: '2026-08-01T00:00:00.000Z', pro_expires_at: '2026-10-30T00:00:00.000Z' },
    userId: 'learner1',
  });
  assert.equal(outcome.httpStatus, 200);
  assert.equal(outcome.body.redeemed, true);
  assert.equal(outcome.body.alreadyRedeemed, true);
  assert.equal(outcome.body.proExpiresAt, '2026-10-30T00:00:00.000Z');
});

test('resolveRedeemOutcome: conflict when a different user already redeemed it', () => {
  const outcome = resolveRedeemOutcome({
    claimed: null,
    existing: { redeemed_by: 'someone-else', redeemed_at: '2026-08-01T00:00:00.000Z' },
    userId: 'learner1',
  });
  assert.equal(outcome.httpStatus, 409);
  assert.equal(outcome.body.error, 'already_redeemed');
});

test('resolveRedeemOutcome: not found when the token does not exist at all', () => {
  const outcome = resolveRedeemOutcome({ claimed: null, existing: null, userId: 'learner1' });
  assert.equal(outcome.httpStatus, 404);
  assert.equal(outcome.body.error, 'invalid_token');
});
