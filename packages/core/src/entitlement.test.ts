import { describe, expect, test } from 'vitest';
import {
  clearInstructorGrant,
  hasBlockingRelationships,
  isEligibleForProExpiry,
  isExemptFromProExpiry,
  shouldApplyProGrant,
} from './entitlement';

describe('shouldApplyProGrant', () => {
  test('applies when there is no current source', () => {
    expect(shouldApplyProGrant(null, 'instructor')).toBe(true);
    expect(shouldApplyProGrant(undefined, 'seat')).toBe(true);
  });

  test('a stripe grant is never blocked, regardless of current source', () => {
    expect(shouldApplyProGrant('instructor', 'stripe')).toBe(true);
    expect(shouldApplyProGrant('seat', 'stripe')).toBe(true);
    expect(shouldApplyProGrant('stripe', 'stripe')).toBe(true);
  });

  test('an existing stripe grant is never overwritten by instructor or seat', () => {
    expect(shouldApplyProGrant('stripe', 'instructor')).toBe(false);
    expect(shouldApplyProGrant('stripe', 'seat')).toBe(false);
  });

  test('an existing instructor grant is not overwritten by a lower-priority seat grant', () => {
    expect(shouldApplyProGrant('instructor', 'seat')).toBe(false);
  });

  test('an instructor grant can reapply over itself (idempotent reconciliation)', () => {
    expect(shouldApplyProGrant('instructor', 'instructor')).toBe(true);
  });

  test('a seat grant can upgrade to an instructor grant', () => {
    expect(shouldApplyProGrant('seat', 'instructor')).toBe(true);
  });

  test('an existing comp grant is never overwritten by instructor or seat', () => {
    expect(shouldApplyProGrant('comp', 'instructor')).toBe(false);
    expect(shouldApplyProGrant('comp', 'seat')).toBe(false);
  });

  test('a comp grant can upgrade an existing instructor or seat grant', () => {
    expect(shouldApplyProGrant('instructor', 'comp')).toBe(true);
    expect(shouldApplyProGrant('seat', 'comp')).toBe(true);
  });

  test('an existing stripe grant is never overwritten by comp', () => {
    expect(shouldApplyProGrant('stripe', 'comp')).toBe(false);
  });

  test('a comp grant can reapply over itself (idempotent reconciliation)', () => {
    expect(shouldApplyProGrant('comp', 'comp')).toBe(true);
  });
});

describe('isExemptFromProExpiry', () => {
  test('instructor-sourced grants are exempt', () => {
    expect(isExemptFromProExpiry('instructor')).toBe(true);
  });

  test('comp-sourced grants are exempt', () => {
    expect(isExemptFromProExpiry('comp')).toBe(true);
  });

  test('stripe and seat grants are not exempt', () => {
    expect(isExemptFromProExpiry('stripe')).toBe(false);
    expect(isExemptFromProExpiry('seat')).toBe(false);
  });

  test('no source is not exempt', () => {
    expect(isExemptFromProExpiry(null)).toBe(false);
    expect(isExemptFromProExpiry(undefined)).toBe(false);
  });
});

describe('isEligibleForProExpiry', () => {
  const NOW = '2026-08-14T00:00:00.000Z';

  test('a stripe grant past its expiry date is eligible', () => {
    expect(
      isEligibleForProExpiry({ isPro: true, proExpiresAt: '2026-08-01T00:00:00.000Z', proSource: 'stripe' }, NOW)
    ).toBe(true);
  });

  test('a stripe grant not yet expired is not eligible', () => {
    expect(
      isEligibleForProExpiry({ isPro: true, proExpiresAt: '2026-09-01T00:00:00.000Z', proSource: 'stripe' }, NOW)
    ).toBe(false);
  });

  test('an instructor grant past its (irrelevant) expiry date is never eligible', () => {
    expect(
      isEligibleForProExpiry({ isPro: true, proExpiresAt: '2026-08-01T00:00:00.000Z', proSource: 'instructor' }, NOW)
    ).toBe(false);
  });

  test('an instructor grant with no expiry date at all is never eligible', () => {
    expect(
      isEligibleForProExpiry({ isPro: true, proExpiresAt: null, proSource: 'instructor' }, NOW)
    ).toBe(false);
  });

  test('a comp grant past its (irrelevant) expiry date is never eligible', () => {
    expect(
      isEligibleForProExpiry({ isPro: true, proExpiresAt: '2026-08-01T00:00:00.000Z', proSource: 'comp' }, NOW)
    ).toBe(false);
  });

  test('a non-pro user is never eligible', () => {
    expect(
      isEligibleForProExpiry({ isPro: false, proExpiresAt: '2026-08-01T00:00:00.000Z', proSource: 'stripe' }, NOW)
    ).toBe(false);
  });

  test('a pro user with no expiry date and a non-exempt source is not eligible', () => {
    expect(
      isEligibleForProExpiry({ isPro: true, proExpiresAt: null, proSource: 'seat' }, NOW)
    ).toBe(false);
  });
});

describe('clearInstructorGrant', () => {
  test('clears isPro, proExpiresAt, and proSource when the grant is instructor-sourced', () => {
    const result = clearInstructorGrant({
      isPro: true,
      proExpiresAt: null,
      proSource: 'instructor',
      xp: 500,
    });
    expect(result).toEqual({ isPro: false, proExpiresAt: null, proSource: null, xp: 500 });
  });

  test('leaves a stripe-sourced grant completely untouched', () => {
    const state = { isPro: true, proExpiresAt: '2027-01-01T00:00:00.000Z', proSource: 'stripe' as const, xp: 10 };
    expect(clearInstructorGrant(state)).toEqual(state);
  });

  test('leaves a comp-sourced grant completely untouched', () => {
    const state = { isPro: true, proExpiresAt: null, proSource: 'comp' as const };
    expect(clearInstructorGrant(state)).toEqual(state);
  });

  test('leaves a user with no proSource at all untouched (nothing to clear)', () => {
    const state = { isPro: false, proExpiresAt: null };
    expect(clearInstructorGrant(state)).toEqual(state);
  });
});

describe('hasBlockingRelationships', () => {
  test('true when any relationship has status accepted', () => {
    expect(hasBlockingRelationships([{ status: 'pending' }, { status: 'accepted' }])).toBe(true);
  });

  test('false when every relationship is pending or rejected', () => {
    expect(hasBlockingRelationships([{ status: 'pending' }, { status: 'rejected' }])).toBe(false);
  });

  test('false for an empty relationship list', () => {
    expect(hasBlockingRelationships([])).toBe(false);
  });

  test('true when any relationship has status consent_withdrawn — still a real pupil, sharing is just off', () => {
    expect(hasBlockingRelationships([{ status: 'pending' }, { status: 'consent_withdrawn' }])).toBe(true);
  });

  test('true when relationships are a mix of accepted and consent_withdrawn', () => {
    expect(hasBlockingRelationships([{ status: 'accepted' }, { status: 'consent_withdrawn' }])).toBe(true);
  });
});
