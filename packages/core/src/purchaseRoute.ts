export type PurchaseRoute = 'stripe_checkout' | 'coming_soon' | 'iap';
export type AppPlatform = 'ios' | 'android' | 'web';

// Pure decision, shared by apps/mobile/src/purchaseGate.ts (which supplies
// the real Platform.OS and the IAP-readiness flag set by src/purchases.ts
// at app boot) — kept here, not in the app, so it's unit-testable without
// mocking react-native. Web always has Stripe Checkout; iOS and Android both
// go to native IAP once it's ready, and to the honest coming-soon state
// otherwise — no platform-specific fallback (no external link, no "visit
// our website"), since Apple and Google both forbid routing a purchase
// anywhere but their own IAP once it's available, and there is no purchase
// route to offer before then.
export function resolvePurchaseRoute(platform: AppPlatform, iapReady: boolean): PurchaseRoute {
  if (platform === 'web') return 'stripe_checkout';
  return iapReady ? 'iap' : 'coming_soon';
}
