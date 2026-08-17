const test = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldApplyProGrant,
  isExemptFromProExpiry,
  isEligibleForProExpiry,
  clearInstructorGrant,
  isInstructorGrantAlreadyCorrect,
  hasBlockingRelationships,
} = require('./entitlement');

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

test('shouldApplyProGrant: an existing comp grant is never overwritten by instructor or seat', () => {
  assert.equal(shouldApplyProGrant('comp', 'instructor'), false);
  assert.equal(shouldApplyProGrant('comp', 'seat'), false);
});

test('shouldApplyProGrant: a comp grant can upgrade an existing instructor grant, but not stripe', () => {
  assert.equal(shouldApplyProGrant('instructor', 'comp'), true);
  assert.equal(shouldApplyProGrant('stripe', 'comp'), false);
});

test('isExemptFromProExpiry is true for instructor- and comp-sourced grants only', () => {
  assert.equal(isExemptFromProExpiry('instructor'), true);
  assert.equal(isExemptFromProExpiry('comp'), true);
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

test('isEligibleForProExpiry excludes comp grants even with a past expiry date', () => {
  assert.equal(
    isEligibleForProExpiry(
      { isPro: true, proExpiresAt: '2020-01-01T00:00:00.000Z', proSource: 'comp' },
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

test('clearInstructorGrant clears an instructor-sourced grant', () => {
  assert.deepEqual(
    clearInstructorGrant({ isPro: true, proExpiresAt: null, proSource: 'instructor', xp: 500 }),
    { isPro: false, proExpiresAt: null, proSource: null, xp: 500 }
  );
});

test('clearInstructorGrant leaves a stripe-sourced grant untouched', () => {
  const state = { isPro: true, proExpiresAt: '2027-01-01T00:00:00.000Z', proSource: 'stripe' };
  assert.deepEqual(clearInstructorGrant(state), state);
});

test('clearInstructorGrant leaves a comp-sourced grant untouched', () => {
  const state = { isPro: true, proExpiresAt: null, proSource: 'comp' };
  assert.deepEqual(clearInstructorGrant(state), state);
});

test('isInstructorGrantAlreadyCorrect: true for proExpiresAt null — the shape grant-instructor-pro itself writes', () => {
  assert.equal(isInstructorGrantAlreadyCorrect({ isPro: true, proExpiresAt: null, proSource: 'instructor' }), true);
});

test('isInstructorGrantAlreadyCorrect: true for proExpiresAt absent entirely — the exact production bug this fixes', () => {
  assert.equal(isInstructorGrantAlreadyCorrect({ isPro: true, proSource: 'instructor' }), true);
});

test('isInstructorGrantAlreadyCorrect: true for a stale non-null proExpiresAt — irrelevant, instructor is expiry-exempt regardless', () => {
  assert.equal(
    isInstructorGrantAlreadyCorrect({ isPro: true, proExpiresAt: '2020-01-01T00:00:00.000Z', proSource: 'instructor' }),
    true
  );
});

test('isInstructorGrantAlreadyCorrect: false when proSource is not instructor, regardless of isPro', () => {
  assert.equal(isInstructorGrantAlreadyCorrect({ isPro: true, proExpiresAt: null, proSource: 'stripe' }), false);
  assert.equal(isInstructorGrantAlreadyCorrect({ isPro: true, proExpiresAt: null, proSource: 'comp' }), false);
  assert.equal(isInstructorGrantAlreadyCorrect({ isPro: true, proExpiresAt: null }), false);
});

test('isInstructorGrantAlreadyCorrect: false when isPro is not true, even with proSource instructor', () => {
  assert.equal(isInstructorGrantAlreadyCorrect({ isPro: false, proExpiresAt: null, proSource: 'instructor' }), false);
});

test('hasBlockingRelationships is true when any relationship is accepted', () => {
  assert.equal(hasBlockingRelationships([{ status: 'pending' }, { status: 'accepted' }]), true);
});

test('hasBlockingRelationships is false when none are accepted', () => {
  assert.equal(hasBlockingRelationships([{ status: 'pending' }, { status: 'rejected' }]), false);
  assert.equal(hasBlockingRelationships([]), false);
});

test('hasBlockingRelationships is true when any relationship is consent_withdrawn — still a real pupil, sharing is just off', () => {
  assert.equal(hasBlockingRelationships([{ status: 'pending' }, { status: 'consent_withdrawn' }]), true);
});

test('hasBlockingRelationships is true for a mix of accepted and consent_withdrawn', () => {
  assert.equal(hasBlockingRelationships([{ status: 'accepted' }, { status: 'consent_withdrawn' }]), true);
});
