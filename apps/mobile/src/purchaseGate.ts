import { Platform } from 'react-native';
import { resolvePurchaseRoute, type AppPlatform, type PurchaseRoute } from '@clearpass/core';

export type { PurchaseRoute };

/**
 * Single source of truth for what a purchase entry point does, per platform.
 * Every "Upgrade"/"Subscribe"/"Go Pro" surface in the app must read this
 * instead of checking Platform.OS itself — that scattering (11 separate
 * checks across 11 files) is exactly how the app shipped an external
 * Stripe checkout reachable from iOS and got rejected under App Store
 * guideline 3.1.1, and how Android separately grew its own hardcoded
 * "visit our website" branch in paywall.tsx — the same 3.1.1-equivalent
 * problem, just uncaught because Google enforces it less consistently than
 * Apple. Both are gone now: iOS and Android share the exact same decision
 * below, driven by IAP readiness, not a per-platform special case.
 *
 * The actual decision (resolvePurchaseRoute) lives in @clearpass/core so
 * it's unit-testable without mocking react-native — this module only
 * supplies the real Platform.OS and the IAP-readiness flag.
 *
 *  - 'stripe_checkout': web only. Open Stripe Checkout via Linking.openURL.
 *  - 'coming_soon': iOS and Android, until IAP is ready on that platform —
 *    no price, no external link, no alternate purchase route. iOS today:
 *    no App Store product yet (blocked on an account migration). Android
 *    today: no Play Store product yet (blocked on uploading a binary with
 *    the BILLING permission to unlock Play Console's Subscriptions page).
 *  - 'iap': iOS or Android, once setIapReady(true) has been called —
 *    RevenueCat is configured and a real offering/package exists for that
 *    platform. See src/purchases.ts, called once at app boot.
 */
let iapReady = false;

/** Set once at app boot by src/purchases.ts, after RevenueCat is configured
 *  and its offerings have been fetched. Defaults to false: the safe
 *  fallback is coming-soon, not letting someone attempt a purchase that
 *  isn't actually wired up yet — same fails-closed philosophy as the
 *  instructor route guard in app/_layout.tsx. */
export function setIapReady(ready: boolean): void {
  iapReady = ready;
}

export function getPurchaseRoute(): PurchaseRoute {
  return resolvePurchaseRoute(Platform.OS as AppPlatform, iapReady);
}

/** Copy for the full paywall screen's coming-soon state (no price, no external link).
 *  Platform-neutral — this is now shared by iOS and Android, not iOS-specific. */
export const COMING_SOON_COPY = {
  title: 'Pro is coming soon',
  body: "We're finishing up in-app purchases so you can upgrade right here in the app. Check back soon!",
};

/** Copy for the compact inline prompt (daily-limit paywalls, PaywallPrompt). */
export const COMING_SOON_COPY_COMPACT = {
  title: 'Pro is coming soon',
  body: "You've reached today's free limit. In-app purchases are coming soon — thanks for bearing with us!",
  buttonLabel: 'Got it',
};
