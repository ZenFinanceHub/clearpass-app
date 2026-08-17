const test = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldApplyProGrant,
  isExemptFromProExpiry,
  isEligibleForProExpiry,
  clearInstructorGrant,
  clearIapGrant,
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

test('shouldApplyProGrant: an iap grant behaves like stripe against every other source', () => {
  assert.equal(shouldApplyProGrant('instructor', 'iap'), true);
  assert.equal(shouldApplyProGrant('seat', 'iap'), true);
  assert.equal(shouldApplyProGrant('comp', 'iap'), true);
  assert.equal(shouldApplyProGrant('iap', 'instructor'), false);
  assert.equal(shouldApplyProGrant('iap', 'seat'), false);
  assert.equal(shouldApplyProGrant('iap', 'comp'), false);
});

test('shouldApplyProGrant: an iap grant can reapply/renew over itself regardless of expiry order', () => {
  assert.equal(
    shouldApplyProGrant('iap', 'iap', '2027-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    true
  );
});

test('shouldApplyProGrant: stripe vs iap with no expiry args given never applies — callers must pass expiry to break the tie', () => {
  assert.equal(shouldApplyProGrant('stripe', 'iap'), false);
  assert.equal(shouldApplyProGrant('iap', 'stripe'), false);
});

test('shouldApplyProGrant: stripe vs iap — the grant with the later proExpiresAt wins', () => {
  const earlier = '2026-01-01T00:00:00.000Z';
  const later = '2026-06-01T00:00:00.000Z';
  assert.equal(shouldApplyProGrant('stripe', 'iap', later, earlier), false);
  assert.equal(shouldApplyProGrant('stripe', 'iap', earlier, later), true);
  assert.equal(shouldApplyProGrant('iap', 'stripe', later, earlier), false);
  assert.equal(shouldApplyProGrant('iap', 'stripe', earlier, later), true);
});

test('shouldApplyProGrant: stripe vs iap tie on an equal expiry date does not apply', () => {
  const same = '2026-06-01T00:00:00.000Z';
  assert.equal(shouldApplyProGrant('stripe', 'iap', same, same), false);
});

test('shouldApplyProGrant: stripe vs iap — a missing current expiry loses to any incoming expiry', () => {
  assert.equal(shouldApplyProGrant('stripe', 'iap', null, '2026-06-01T00:00:00.000Z'), true);
});

test('shouldApplyProGrant: stripe vs iap — a missing incoming expiry never wins', () => {
  assert.equal(shouldApplyProGrant('stripe', 'iap', '2026-06-01T00:00:00.000Z', null), false);
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

test('clearIapGrant clears an iap-sourced grant', () => {
  assert.deepEqual(
    clearIapGrant({ isPro: true, proExpiresAt: '2026-11-14T00:00:00.000Z', proSource: 'iap', xp: 500 }),
    { isPro: false, proExpiresAt: null, proSource: null, xp: 500 }
  );
});

test('clearIapGrant leaves a stripe-sourced grant untouched', () => {
  const state = { isPro: true, proExpiresAt: '2027-01-01T00:00:00.000Z', proSource: 'stripe' };
  assert.deepEqual(clearIapGrant(state), state);
});

test('clearIapGrant leaves a comp-sourced grant untouched — a late/stale iap EXPIRATION must never clobber a manual comp applied since', () => {
  const state = { isPro: true, proExpiresAt: null, proSource: 'comp' };
  assert.deepEqual(clearIapGrant(state), state);
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
