import { describe, expect, test } from 'vitest';
import { resolvePurchaseRoute } from './purchaseRoute';

describe('resolvePurchaseRoute', () => {
  test('web always goes to Stripe Checkout, regardless of IAP readiness', () => {
    expect(resolvePurchaseRoute('web', false)).toBe('stripe_checkout');
    expect(resolvePurchaseRoute('web', true)).toBe('stripe_checkout');
  });

  test('iOS always stays coming_soon, regardless of IAP readiness — no App Store product yet, blocked on account migration; this is a deliberate decision, not a fallback', () => {
    expect(resolvePurchaseRoute('ios', false)).toBe('coming_soon');
    expect(resolvePurchaseRoute('ios', true)).toBe('coming_soon');
  });

  test('Android falls back to coming_soon when IAP is not ready — offerings failed to load or no quarterly package exists yet', () => {
    expect(resolvePurchaseRoute('android', false)).toBe('coming_soon');
  });

  test('Android routes to iap once IAP is ready', () => {
    expect(resolvePurchaseRoute('android', true)).toBe('iap');
  });
});
