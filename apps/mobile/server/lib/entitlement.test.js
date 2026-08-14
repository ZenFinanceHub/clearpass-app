const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldApplyProGrant, isExemptFromProExpiry, isEligibleForProExpiry } = require('./entitlement');

test('shouldApplyProGrant applies when there is no current source', () => {
  assert.equal(shouldApplyProGrant(null, 'instructor'), true);
  assert.equal(shouldApplyProGrant(undefined, 'seat'), true);
});

test('shouldApplyProGrant: an existing stripe grant is never overwritten', () => {
  assert.equal(shouldApplyProGrant('stripe', 'instructor'), false);
  assert.equal(shouldApplyProGrant('stripe', 'seat'), false);
});

test('shouldApplyProGrant: a stripe grant always applies, regardless of current source', () => {
  assert.equal(shouldApplyProGrant('instructor', 'stripe'), true);
  assert.equal(shouldApplyProGrant('seat', 'stripe'), true);
});

test('shouldApplyProGrant: instructor grant is idempotent against itself', () => {
  assert.equal(shouldApplyProGrant('instructor', 'instructor'), true);
});

test('isExemptFromProExpiry is true only for instructor-sourced grants', () => {
  assert.equal(isExemptFromProExpiry('instructor'), true);
  assert.equal(isExemptFromProExpiry('stripe'), false);
  assert.equal(isExemptFromProExpiry('seat'), false);
  assert.equal(isExemptFromProExpiry(null), false);
});

test('isEligibleForProExpiry excludes instructor grants even with a past expiry date', () => {
  assert.equal(
    isEligibleForProExpiry(
      { isPro: true, proExpiresAt: '2020-01-01T00:00:00.000Z', proSource: 'instructor' },
      '2026-08-14T00:00:00.000Z'
    ),
    false
  );
});

test('isEligibleForProExpiry includes a stripe grant past its expiry date', () => {
  assert.equal(
    isEligibleForProExpiry(
      { isPro: true, proExpiresAt: '2020-01-01T00:00:00.000Z', proSource: 'stripe' },
      '2026-08-14T00:00:00.000Z'
    ),
    true
  );
});
