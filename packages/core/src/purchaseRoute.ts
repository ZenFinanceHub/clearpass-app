export type PurchaseRoute = 'stripe_checkout' | 'coming_soon' | 'iap';
export type AppPlatform = 'ios' | 'android' | 'web';

// Pure decision, shared by apps/mobile/src/purchaseGate.ts (which supplies
// the real Platform.OS and the IAP-readiness flag set by src/purchases.ts
// at app boot) — kept here, not in the app, so it's unit-testable without
// mocking react-native.
//
// Web always has Stripe Checkout. iOS and Android both go to native IAP
// once it's ready (RevenueCat configured, a real quarterly offering
// loaded), and to the honest coming-soon state otherwise — no external
// link, no "visit our website", since routing a purchase anywhere but the
// platform's own IAP once it's available breaks App Store/Play Store
// guidelines, and there is no purchase route to offer before then.
//
// iOS used to be a deliberate, unconditional exception, always
// coming_soon regardless of iapReady — there was no App Store product and
// it was blocked on an Apple account migration, so iOS couldn't be
// allowed to flip to 'iap' as a side effect of RevenueCat happening to
// report readiness (e.g. sandbox/test configuration) before that
// migration was actually done. That block was lifted on 25 Aug 2026 once
// the Paid Apps Agreement went active: clearpass_pro_quarterly exists in
// App Store Connect (all storefronts, availability set), is attached to
// the "pro" entitlement in RevenueCat, and is in the $rc_three_month
// package of the "default" offering. iOS now behaves like Android, driven
// purely by iapReady.
//
// Note this makes iapReady load-bearing on iOS: it is set from a live
// RevenueCat getOfferings() call at app boot (src/purchases.ts), so a
// missing API key or a failed fetch drops the user — an App Store
// reviewer included — back to coming_soon, where there is no purchase to
// review. That failure mode is why the flag stays fail-closed rather than
// defaulting to 'iap' optimistically.
export function resolvePurchaseRoute(platform: AppPlatform, iapReady: boolean): PurchaseRoute {
  if (platform === 'web') return 'stripe_checkout';
  return iapReady ? 'iap' : 'coming_soon';
}
