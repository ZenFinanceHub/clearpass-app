const test = require('node:test');
const assert = require('node:assert/strict');
const { computeProExpiresAt, PRO_DURATION_MONTHS } = require('./proExpiry');

test('PRO_DURATION_MONTHS is 3, matching the quarterly product', () => {
  assert.equal(PRO_DURATION_MONTHS, 3);
});

test('computeProExpiresAt adds 3 calendar months to the given date', () => {
  const result = computeProExpiresAt(new Date('2026-07-09T12:34:56.000Z'));
  assert.equal(result, '2026-10-09T12:34:56.000Z');
});

test('computeProExpiresAt defaults to 3 months from now when called with no args', () => {
  const before = Date.now();
  const result = new Date(computeProExpiresAt()).getTime();
  const after = Date.now();
  const approxThreeMonthsMs = 1000 * 60 * 60 * 24 * 89; // conservative lower bound
  assert.ok(result - before >= approxThreeMonthsMs);
  assert.ok(result - after <= 1000 * 60 * 60 * 24 * 93); // conservative upper bound
});

test('computeProExpiresAt returns an ISO 8601 string', () => {
  const result = computeProExpiresAt(new Date('2026-01-15T00:00:00.000Z'));
  assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(result).toISOString(), result);
});

test('computeProExpiresAt rolls over correctly across a month-end (Nov 30 -> Feb 28)', () => {
  const result = computeProExpiresAt(new Date('2026-11-30T00:00:00.000Z'));
  assert.equal(result, '2027-03-02T00:00:00.000Z');
});
