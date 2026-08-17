import { describe, expect, test } from 'vitest';
import { resolvePurchaseRoute } from './purchaseRoute';

describe('resolvePurchaseRoute', () => {
  test('web always goes to Stripe Checkout, regardless of IAP readiness', () => {
    expect(resolvePurchaseRoute('web', false)).toBe('stripe_checkout');
    expect(resolvePurchaseRoute('web', true)).toBe('stripe_checkout');
  });

  test('iOS falls back to coming_soon when IAP is not ready — no App Store product yet', () => {
    expect(resolvePurchaseRoute('ios', false)).toBe('coming_soon');
  });

  test('iOS routes to iap once IAP is ready', () => {
    expect(resolvePurchaseRoute('ios', true)).toBe('iap');
  });

  test('Android falls back to coming_soon when IAP is not ready — the fix for the live 3.1.1-equivalent issue: no more silent Stripe/website fallback', () => {
    expect(resolvePurchaseRoute('android', false)).toBe('coming_soon');
  });

  test('Android routes to iap once IAP is ready', () => {
    expect(resolvePurchaseRoute('android', true)).toBe('iap');
  });
});
