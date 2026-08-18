export type PurchaseRoute = 'stripe_checkout' | 'coming_soon' | 'iap';
export type AppPlatform = 'ios' | 'android' | 'web';

// Pure decision, shared by apps/mobile/src/purchaseGate.ts (which supplies
// the real Platform.OS and the IAP-readiness flag set by src/purchases.ts
// at app boot) — kept here, not in the app, so it's unit-testable without
// mocking react-native.
//
// Web always has Stripe Checkout. Android goes to native IAP once it's
// ready (RevenueCat configured, a real quarterly offering loaded), and to
// the honest coming-soon state otherwise — no external link, no "visit our
// website", since Google forbids routing a purchase anywhere but Play
// Billing once it's available, and there is no purchase route to offer
// before then.
//
// iOS is a deliberate, unconditional exception: it always stays
// coming_soon regardless of iapReady. There is no App Store product yet
// (blocked on an Apple account migration), and unlike Android this isn't
// just "not configured yet" — iOS must not flip to 'iap' as a side effect
// of RevenueCat happening to report readiness (e.g. sandbox/test
// configuration) before that migration is actually done. Revisit this
// explicitly once a real App Store product exists.
export function resolvePurchaseRoute(platform: AppPlatform, iapReady: boolean): PurchaseRoute {
  if (platform === 'web') return 'stripe_checkout';
  if (platform === 'ios') return 'coming_soon';
  return iapReady ? 'iap' : 'coming_soon';
}
