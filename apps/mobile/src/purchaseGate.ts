import { useSyncExternalStore } from 'react';
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
 * Apple.
 *
 * The actual decision (resolvePurchaseRoute) lives in @clearpass/core so
 * it's unit-testable without mocking react-native — this module only
 * supplies the real Platform.OS and the IAP-readiness flag.
 *
 *  - 'stripe_checkout': web only. Open Stripe Checkout via Linking.openURL.
 *  - 'coming_soon': either platform, until IAP is ready there — no price,
 *    no external link, no alternate purchase route.
 *  - 'iap': either platform, once setIapReady(true) has been called —
 *    RevenueCat is configured and a real quarterly offering exists. See
 *    src/purchases.ts, called once at app boot.
 */
let iapReady = false;
const listeners = new Set<() => void>();

/** Set by src/purchases.ts once RevenueCat is configured and its offerings
 *  have been fetched — at app boot, and again on each refreshIapReady().
 *  Defaults to false: the safe fallback is not letting someone attempt a
 *  purchase that isn't actually wired up yet — the same fails-closed
 *  philosophy as the instructor route guard in app/_layout.tsx. Drives the
 *  route on both iOS and Android identically; resolvePurchaseRoute no
 *  longer special-cases either platform.
 *
 *  Now notifies subscribers, because readiness resolves *after* first
 *  render. Previously this was plain module state read once during render,
 *  so a cold start on a slow network left the paywall showing its
 *  unavailable state with no way back short of a remount — including for
 *  an App Store reviewer, who would simply see no purchase to review.
 *  Renders that depend on the route must use usePurchaseRoute(). */
export function setIapReady(ready: boolean): void {
  if (iapReady === ready) return; // don't wake subscribers for a no-op
  iapReady = ready;
  listeners.forEach(listener => listener());
}

function subscribeToPurchaseRoute(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Non-reactive read, for callers outside a render (event handlers,
 *  effects, module scope). Inside a component, use usePurchaseRoute(). */
export function getPurchaseRoute(): PurchaseRoute {
  return resolvePurchaseRoute(Platform.OS as AppPlatform, iapReady);
}

/** Reactive equivalent: re-renders when readiness resolves or changes.
 *  getPurchaseRoute is passed as the server snapshot too — this app ships
 *  a static web export (app.json web.output), and useSyncExternalStore
 *  throws during hydration without one. The snapshot is a string, so its
 *  identity is stable and this cannot loop. */
export function usePurchaseRoute(): PurchaseRoute {
  return useSyncExternalStore(subscribeToPurchaseRoute, getPurchaseRoute, getPurchaseRoute);
}

/**
 * Copy for the state where no purchase route is available (no price, no
 * external link). Renamed from COMING_SOON_COPY, and rewritten: "coming
 * soon" described the world before the store products existed. They exist
 * now on both stores, so the only way a shipped build reaches this state
 * is a *failure* — no RevenueCat API key baked into the build, offerings
 * that wouldn't load, or an offering with no quarterly package. Telling a
 * user we haven't built it yet, when really we couldn't reach the store,
 * sends them away permanently instead of prompting a retry.
 *
 * Store-neutral wording: this is shared by iOS and Android.
 */
export const IAP_UNAVAILABLE_COPY = {
  title: 'Pro isn’t available right now',
  body: "We couldn't load subscription options from the store. Check your connection and try again in a moment.",
  retryLabel: 'Try again',
};

/** Compact variant for the inline daily-limit prompt (PaywallPrompt). */
export const IAP_UNAVAILABLE_COPY_COMPACT = {
  title: 'Pro isn’t available right now',
  body: "You've reached today's free limit. We couldn't load subscription options from the store — please try again shortly.",
  buttonLabel: 'Got it',
};

/**
 * The subscription terms that must appear on the paywall itself, before
 * purchase — App Store guideline 3.1.2 (and Google Play's equivalent
 * subscription-disclosure policy). Apple rejected 1.1.0 build 17 under
 * 3.1.2 for showing none of this.
 *
 * Lives here rather than in paywall.tsx for the same reason the route
 * decision does: this is store-specific copy keyed off Platform.OS, and
 * purchaseGate is the one module allowed to read Platform.OS for purchase
 * purposes. The 'iap' route serves iOS *and* Android, so the renewal
 * sentence and the terms link cannot be hardcoded to Apple's — an Android
 * user must not be told their payment is charged to an Apple ID.
 *
 * Price is stated here as a fixed string rather than read from the
 * RevenueCat package: it must render before offerings load and in the
 * stripe_checkout branch where there is no RevenueCat at all. It matches
 * Pro Quarterly on both stores and PRO_DURATION_MONTHS in
 * server/lib/proExpiry.js. If the store price ever changes, change it here.
 *
 * There is deliberately no trial wording. Pro Quarterly has no
 * introductory offer configured on either store — the paywall previously
 * advertised "7 days free", which was a false claim on every platform.
 */
const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const CLEARPASS_TERMS_URL = 'https://clearpass-app.vercel.app/terms';
const CLEARPASS_PRIVACY_URL = 'https://clearpass-app.vercel.app/privacy-policy';

export interface SubscriptionDisclosure {
  name: string;
  /** Duration and price stated together, as 3.1.2 requires. */
  priceLine: string;
  renewalTerms: string;
  termsUrl: string;
  privacyUrl: string;
}

export function getSubscriptionDisclosure(): SubscriptionDisclosure {
  const base = {
    name: 'ClearPass Pro',
    priceLine: '£7.99 for 3 months, auto-renewing',
    privacyUrl: CLEARPASS_PRIVACY_URL,
  };

  if (Platform.OS === 'ios') {
    return {
      ...base,
      renewalTerms:
        'Payment is charged to your Apple ID account at confirmation of purchase. '
        + 'The subscription renews automatically unless cancelled at least 24 hours '
        + 'before the end of the current period. You can manage and cancel '
        + 'subscriptions in your Apple ID account settings.',
      // Apple's standard EULA, as linked from the App Store description.
      termsUrl: APPLE_EULA_URL,
    };
  }

  if (Platform.OS === 'android') {
    return {
      ...base,
      renewalTerms:
        'Payment is charged to your Google Play account at confirmation of purchase. '
        + 'The subscription renews automatically unless cancelled at least 24 hours '
        + 'before the end of the current period. You can manage and cancel '
        + 'subscriptions in your Google Play account settings.',
      termsUrl: CLEARPASS_TERMS_URL,
    };
  }

  // Web / Stripe: same product and terms, but the store-account wording
  // above applies to neither, and cancellation is via the billing portal.
  return {
    ...base,
    renewalTerms:
      'Payment is charged to your card at confirmation of purchase. The '
      + 'subscription renews automatically unless cancelled at least 24 hours '
      + 'before the end of the current period. You can manage and cancel your '
      + 'subscription from your account settings.',
    termsUrl: CLEARPASS_TERMS_URL,
  };
}
