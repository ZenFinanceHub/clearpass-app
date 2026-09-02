import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import Purchases, { type PurchasesError, type PurchasesPackage } from 'react-native-purchases';
import { setIapReady } from './purchaseGate';
import { supabase } from './supabase';

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;

/** The appUserID the SDK is currently configured/logged in for, or null if
 *  configure() has never succeeded. Tracking the id (not just a boolean)
 *  is what makes configurePurchases() idempotent and user-switch-aware —
 *  see configurePurchases() below. */
let configuredUserId: string | null = null;

/** Tracks a configure/logIn attempt in progress for a given userId, so two
 *  callers that both see configuredUserId === null at the same time (e.g.
 *  the boot-time auth listener and a paywall refresh landing in the same
 *  window) await the one attempt already running instead of both calling
 *  Purchases.configure()/logIn() concurrently. Cleared once that attempt
 *  settles — success or failure — so a failed attempt doesn't permanently
 *  block a later retry. */
let inFlightConfigure: { userId: string; promise: Promise<void> } | null = null;

/** Backoff between offerings attempts at boot. A transient network failure
 *  on a cold start used to latch readiness to false for the whole session. */
const OFFERINGS_RETRY_DELAYS_MS = [2000, 4000, 8000];

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Why IAP is unavailable. These are genuinely different bugs with
 *  different fixes — a missing key is a build-config problem, a throw is
 *  usually network, and a missing quarterly package is a RevenueCat
 *  dashboard problem — so they're reported as distinct modes rather than
 *  one "IAP failed". */
type IapFailureMode =
  | 'missing_api_key'
  | 'configure_threw'
  | 'get_offerings_threw'
  | 'no_quarterly_package';

type ReadinessProbe =
  | { ready: true }
  | { ready: false; mode: 'get_offerings_threw'; message: string }
  | { ready: false; mode: 'no_quarterly_package'; offeringId: string | null; packageIdentifiers: string[] };

/**
 * Reports why a build that *should* be able to sell Pro can't. Without
 * this, the only signal that a reviewer (or a real user) hit the
 * unavailable state is an App Store rejection message with no diagnostics
 * attached. Warning rather than error: it's frequently transient network,
 * and the app degrades safely — but it's never expected on a shipped
 * build, since both store products are live.
 *
 * No keys or user data in the payload, same restraint as the existing
 * offerings console.log — just enough to tell the four modes apart.
 */
function reportIapUnavailable(
  mode: IapFailureMode,
  context: { source: 'boot' | 'refresh'; attempts?: number; detail?: Record<string, unknown> },
): void {
  console.warn('[purchases] IAP unavailable', { mode, ...context });
  Sentry.captureMessage(`IAP unavailable: ${mode}`, {
    level: 'warning',
    tags: { iap_failure_mode: mode, iap_source: context.source, platform: Platform.OS },
    extra: { attempts: context.attempts, ...context.detail },
  });
}

/** One attempt at answering "can we sell the quarterly package right now?".
 *  Never throws — every failure comes back as a typed mode. */
async function probeIapReadiness(): Promise<ReadinessProbe> {
  try {
    const offerings = await Purchases.getOfferings();
    // No keys or user data — just enough to diagnose a misconfigured
    // RevenueCat dashboard (missing current offering, or a current
    // offering whose packages don't include a threeMonth one) without a
    // debugger attached to a device.
    const offeringId = offerings.current?.identifier ?? null;
    const packageIdentifiers: string[] =
      offerings.current?.availablePackages.map((p: PurchasesPackage) => p.identifier) ?? [];

    console.log('[purchases] offerings loaded', {
      platform: Platform.OS,
      hasCurrentOffering: !!offerings.current,
      currentOfferingId: offeringId,
      packageIdentifiers,
    });
    // Readiness is specifically "the quarterly package is available", not
    // just "some package exists" — that's the one getProPackage() below
    // actually buys, so the gate shouldn't claim readiness for a product
    // mix that doesn't include it.
    if (offerings.current?.threeMonth) return { ready: true };
    return { ready: false, mode: 'no_quarterly_package', offeringId, packageIdentifiers };
  } catch (e) {
    const err = e as PurchasesError;
    return { ready: false, mode: 'get_offerings_threw', message: err?.message || String(e) };
  }
}

// Called on every transition into an authenticated state — see the
// supabase.auth.onAuthStateChange subscription in app/_layout.tsx, which
// covers SIGNED_IN, INITIAL_SESSION and TOKEN_REFRESHED. That's a single
// choke point rather than a call in every sign-in/sign-up screen, so no
// future auth entry point (email, Apple, Google, ...) can miss it — the
// previous version only ran once at cold boot if a session already
// existed, so signing up fresh within the same app session never
// configured RevenueCat at all. appUserID is the Supabase user id, not
// RevenueCat's own anonymous id — so a RevenueCat webhook's app_user_id
// can be matched straight back to user_progress.id with no separate
// mapping table (see POST /api/revenuecat-webhook in server/proxy.js).
// Never called on web — react-native-purchases wraps native
// StoreKit/Play Billing, and web already has its own route (Stripe
// Checkout).
//
// Idempotent: called repeatedly for the same signed-in user (SIGNED_IN,
// INITIAL_SESSION and TOKEN_REFRESHED can all fire for one session) is a
// no-op past the first successful call. Called for a *different* user
// than the one currently configured logs that user in via RevenueCat's
// own identity switch rather than re-running configure() — configure()
// is meant to be called once per process lifetime.
export async function configurePurchases(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  if (configuredUserId === userId) return;

  if (inFlightConfigure?.userId === userId) {
    await inFlightConfigure.promise;
    return;
  }

  const promise = runConfigurePurchases(userId);
  inFlightConfigure = { userId, promise };
  try {
    await promise;
  } finally {
    if (inFlightConfigure?.userId === userId) inFlightConfigure = null;
  }
}

// The actual configure/probe work, extracted so configurePurchases() above
// can wrap it in the in-flight guard without duplicating that logic at
// every early return below.
async function runConfigurePurchases(userId: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey) {
    // No RevenueCat key baked into this build. Nothing to retry — this is
    // a build-configuration problem (the key is absent from eas.json's
    // production env and must come from EAS environment variables), and
    // it silently disables purchasing on the whole platform, so it's
    // worth reporting loudly.
    setIapReady(false);
    reportIapUnavailable('missing_api_key', {
      source: 'boot',
      detail: { expectedEnvVar: `EXPO_PUBLIC_REVENUECAT_API_KEY_${Platform.OS === 'ios' ? 'IOS' : 'ANDROID'}` },
    });
    return;
  }

  try {
    if (configuredUserId === null) {
      Purchases.configure({ apiKey, appUserID: userId });
    } else {
      // The SDK is already configured for a different user — switch
      // identity rather than calling configure() a second time.
      await Purchases.logIn(userId);
    }
    configuredUserId = userId;
  } catch (e) {
    // Split from the offerings fetch below so the two are distinguishable
    // in Sentry: this one means the SDK itself rejected the key (or the
    // logIn call failed), which no amount of retrying will fix.
    configuredUserId = null;
    setIapReady(false);
    reportIapUnavailable('configure_threw', {
      source: 'boot',
      detail: { message: (e as PurchasesError)?.message || String(e) },
    });
    return;
  }

  // Retry the offerings fetch rather than latching false on the first
  // failure. A cold start on a slow or flaky connection is exactly when
  // this fails, and the old single-attempt version left the user with no
  // purchase route for the rest of the session.
  let probe = await probeIapReadiness();
  for (let attempt = 0; !probe.ready && attempt < OFFERINGS_RETRY_DELAYS_MS.length; attempt++) {
    Sentry.addBreadcrumb({
      category: 'purchases',
      level: 'warning',
      message: `getOfferings attempt ${attempt + 1} failed (${probe.mode}), retrying`,
      data: { mode: probe.mode, nextDelayMs: OFFERINGS_RETRY_DELAYS_MS[attempt], platform: Platform.OS },
    });
    await wait(OFFERINGS_RETRY_DELAYS_MS[attempt]);
    probe = await probeIapReadiness();
  }

  if (probe.ready) {
    setIapReady(true);
    return;
  }

  setIapReady(false);
  reportIapUnavailable(probe.mode, {
    source: 'boot',
    attempts: OFFERINGS_RETRY_DELAYS_MS.length + 1,
    detail: probe.mode === 'get_offerings_threw'
      ? { message: probe.message }
      : { offeringId: probe.offeringId, packageIdentifiers: probe.packageIdentifiers },
  });
}

/**
 * Re-checks readiness on demand — called when the paywall mounts, so
 * *navigating to the paywall* triggers a fresh look rather than trusting a
 * verdict formed seconds after a cold start. This is the half of the fix
 * that actually rescues the reviewer scenario: boot may have failed while
 * the network was still coming up, but by the time someone taps through to
 * the paywall it usually isn't.
 *
 * Deliberately only ever promotes readiness to true, never demotes it. A
 * transient failure here on a paywall that is already working would
 * otherwise yank the purchase button out from under someone mid-decision.
 * Failures are still reported.
 */
export async function refreshIapReady(): Promise<void> {
  if (Platform.OS === 'web') return;

  if (configuredUserId === null) {
    // Not configured yet. This used to be a dead end — the caller just
    // gave up, and a user whose sign-in completed after the boot-time
    // configure attempt (see app/_layout.tsx) had no way back short of
    // restarting the app. Recover by finding out who's signed in now and
    // configuring for them, instead of assuming the earlier failure is
    // permanent.
    Sentry.addBreadcrumb({
      category: 'purchases',
      level: 'info',
      message: 'Paywall opened with RevenueCat not yet configured',
      data: { platform: Platform.OS },
    });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // genuinely no one signed in — nothing to configure for
    await configurePurchases(session.user.id);
    return;
  }

  const probe = await probeIapReadiness();
  if (probe.ready) {
    setIapReady(true);
    return;
  }

  reportIapUnavailable(probe.mode, {
    source: 'refresh',
    attempts: 1,
    detail: probe.mode === 'get_offerings_threw'
      ? { message: probe.message }
      : { offeringId: probe.offeringId, packageIdentifiers: probe.packageIdentifiers },
  });
}

// The quarterly package to buy for the 'pro' entitlement — matches the
// existing Stripe subscription (£7.99/3 months, PRO_DURATION_MONTHS in
// server/lib/proExpiry.js), not just whatever happens to be first in
// availablePackages (an offering could have other package types
// configured too). Returns null if it isn't available. Callers should
// only reach this once getPurchaseRoute() is 'iap', but returning null
// rather than throwing keeps this safe to call defensively regardless.
export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (configuredUserId === null) return null;
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

export type RestoreOutcome =
  | { status: 'restored' }
  | { status: 'none' }
  | { status: 'error'; message: string };

// Required by App Store guideline 3.1.1: any app selling a
// non-consumable/subscription must offer a way to restore it on a new
// device. Deliberately distinguishes 'none' from 'error' — "the call
// worked and you own nothing" is a normal outcome, not a failure, and is
// exactly what a reviewer signed into a fresh sandbox account will hit.
// Reporting that as an error would read as a broken restore.
//
// Not guarded on `configured` the way getProPackage() is: restore is the
// remedy someone reaches for precisely when their entitlement state looks
// wrong, so it calls through and reports a real error if the SDK isn't
// configured, rather than silently returning 'none' and implying they
// never bought anything.
export async function restoreProPurchases(): Promise<RestoreOutcome> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active['pro'] !== undefined
      ? { status: 'restored' }
      : { status: 'none' };
  } catch (e) {
    const err = e as PurchasesError;
    return { status: 'error', message: err.message || 'Could not restore purchases. Please try again.' };
  }
}
