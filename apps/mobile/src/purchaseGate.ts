import { Platform } from 'react-native';

/**
 * Single source of truth for what a purchase entry point does, per platform.
 * Every "Upgrade"/"Subscribe"/"Go Pro" surface in the app must read this
 * instead of checking Platform.OS itself — that scattering (11 separate
 * checks across 11 files) is exactly how the app shipped an external
 * Stripe checkout reachable from iOS and got rejected under App Store
 * guideline 3.1.1. When native IAP ships, only the 'ios' branch below
 * changes — every call site stays the same.
 *
 *  - 'stripe_checkout': open Stripe Checkout via Linking.openURL. Web (and,
 *    for now, Android — Android has its own separate "visit our website"
 *    branch in paywall.tsx that isn't driven by this gate; fixing Android
 *    properly is out of scope here). Legitimate on both.
 *  - 'coming_soon': iOS today. Apple forbids any purchase route other than
 *    IAP, and IAP isn't implemented yet (blocked on an account migration).
 *  - 'iap': iOS once native In-App Purchase ships. Never returned today —
 *    flip the ios branch to this when IAP lands.
 */
export type PurchaseRoute = 'stripe_checkout' | 'coming_soon' | 'iap';

export function getPurchaseRoute(): PurchaseRoute {
  if (Platform.OS === 'ios') return 'coming_soon';
  return 'stripe_checkout';
}

/** Copy for the full paywall screen's coming-soon state (no price, no external link). */
export const COMING_SOON_COPY = {
  title: 'Pro is coming to iPhone',
  body: "We're finishing up Pro for iOS so you can upgrade right here in the app. Check back soon!",
};

/** Copy for the compact inline prompt (daily-limit paywalls, PaywallPrompt). */
export const COMING_SOON_COPY_COMPACT = {
  title: 'Pro is coming soon',
  body: "You've reached today's free limit. Pro is coming to iPhone soon — thanks for bearing with us!",
  buttonLabel: 'Got it',
};
