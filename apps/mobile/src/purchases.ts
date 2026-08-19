import { Platform } from 'react-native';
import Purchases, { type PurchasesError, type PurchasesPackage } from 'react-native-purchases';
import { setIapReady } from './purchaseGate';

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;

let configured = false;

// Called once at app boot (see app/_layout.tsx), after we know who's signed
// in. appUserID is the Supabase user id, not RevenueCat's own anonymous id —
// so a RevenueCat webhook's app_user_id can be matched straight back to
// user_progress.id with no separate mapping table (see
// POST /api/revenuecat-webhook in server/proxy.js). Never called on web —
// react-native-purchases wraps native StoreKit/Play Billing, and web already
// has its own route (Stripe Checkout).
export async function configurePurchases(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey) {
    // No key configured for this platform yet (iOS today: no App Store
    // product; Android: no Play Store product) — stay in the coming-soon
    // state rather than attempting to configure the SDK with nothing.
    setIapReady(false);
    return;
  }

  try {
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
    const offerings = await Purchases.getOfferings();
    // No keys or user data — just enough to diagnose a misconfigured
    // RevenueCat dashboard (missing current offering, or a current
    // offering whose packages don't include a threeMonth one) without a
    // debugger attached to a device.
    console.log('[purchases] offerings loaded', {
      platform: Platform.OS,
      hasCurrentOffering: !!offerings.current,
      currentOfferingId: offerings.current?.identifier ?? null,
      packageIdentifiers: offerings.current?.availablePackages.map(p => p.identifier) ?? [],
    });
    // Readiness is specifically "the quarterly package is available", not
    // just "some package exists" — that's the one getProPackage() below
    // actually buys, so the gate shouldn't claim readiness for a product
    // mix that doesn't include it.
    setIapReady(!!offerings.current?.threeMonth);
  } catch {
    // Any failure here (network, misconfigured product, ...) must leave the
    // app in the safe coming-soon state, not a half-configured one that
    // lets someone tap into a purchase flow that isn't really ready.
    setIapReady(false);
  }
}

// The quarterly package to buy for the 'pro' entitlement — matches the
// existing Stripe subscription (£7.99/3 months, PRO_DURATION_MONTHS in
// server/lib/proExpiry.js), not just whatever happens to be first in
// availablePackages (an offering could have other package types
// configured too). Returns null if it isn't available. Callers should
// only reach this once getPurchaseRoute() is 'iap', but returning null
// rather than throwing keeps this safe to call defensively regardless.
export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.threeMonth ?? null;
  } catch {
    return null;
  }
}

export type PurchaseOutcome =
  | { status: 'success'; proEntitlementActive: boolean }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

// Triggers the native purchase sheet. On success, checks RevenueCat's own
// CustomerInfo immediately rather than trusting the purchase call alone —
// RC's local record of entitlement state is available instantly, with no
// webhook round-trip, and is what actually lets a caller unlock the UI
// without waiting on (or guessing at) when the RevenueCat webhook reaches
// Supabase. Supabase (via that webhook) remains the source of truth for
// anything persistent — this is purely for immediate feedback, the same
// role payment-success.tsx's own optimistic local flip already plays for
// Stripe.
export async function purchaseProPackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    await Purchases.purchasePackage(pkg);
  } catch (e) {
    const err = e as PurchasesError;
    if (err.userCancelled) return { status: 'cancelled' };
    return { status: 'error', message: err.message || 'Something went wrong. Please try again.' };
  }

  // The purchase itself succeeded — the money's spent. From here, any
  // failure checking RC's own state must not be reported as a purchase
  // failure; fall back to proEntitlementActive: false and let the webhook
  // + payment-success.tsx's own Supabase resync be the safety net.
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return { status: 'success', proEntitlementActive: customerInfo.entitlements.active['pro'] !== undefined };
  } catch {
    return { status: 'success', proEntitlementActive: false };
  }
}
