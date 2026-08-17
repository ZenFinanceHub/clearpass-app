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
    setIapReady(!!offerings.current && offerings.current.availablePackages.length > 0);
  } catch {
    // Any failure here (network, misconfigured product, ...) must leave the
    // app in the safe coming-soon state, not a half-configured one that
    // lets someone tap into a purchase flow that isn't really ready.
    setIapReady(false);
  }
}

// The package to buy for the 'pro' entitlement, or null if none is
// available. Callers should only reach this once getPurchaseRoute() is
// 'iap', but returning null rather than throwing keeps this safe to call
// defensively regardless.
export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

export type PurchaseOutcome =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

// Triggers the native purchase sheet. On success this does NOT set isPro
// locally — the RevenueCat webhook updating user_progress server-side is
// the source of truth (same as Stripe Checkout never trusting the client
// either). Callers should show a "completing your purchase" state and then
// refresh progress from Supabase, the same pattern payment-success.tsx
// already uses after a Stripe redirect.
export async function purchaseProPackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    await Purchases.purchasePackage(pkg);
    return { status: 'success' };
  } catch (e) {
    const err = e as PurchasesError;
    if (err.userCancelled) return { status: 'cancelled' };
    return { status: 'error', message: err.message || 'Something went wrong. Please try again.' };
  }
}
