import { describe, expect, test } from 'vitest';
import { isEligibleForProExpiry, isExemptFromProExpiry, shouldApplyProGrant } from './entitlement';

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
});

describe('isExemptFromProExpiry', () => {
  test('instructor-sourced grants are exempt', () => {
    expect(isExemptFromProExpiry('instructor')).toBe(true);
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
