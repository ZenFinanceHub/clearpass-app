'use strict';

const { computeIapExpiresAt } = require('./proExpiry');
const { shouldApplyProGrant, clearIapGrant } = require('./entitlement');

// RevenueCat's expiration_at_ms is epoch milliseconds — an absolute
// end-of-period timestamp computed by the store (App Store/Play Store),
// not a relative duration. This is true regardless of product length: a
// monthly subscription's value lands ~30 days out, a quarterly one ~90
// days out, but both are real calendar timestamps for that specific
// period, not an offset to add to "now" at processing time. Returns null
// when the field is absent (undefined/null) or not a finite number.
function expirationMsToIso(expirationAtMs) {
  if (expirationAtMs === null || expirationAtMs === undefined) return null;
  const ms = Number(expirationAtMs);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

// Computes the user_progress patch for one RevenueCat webhook event, given
// the event type, its expiration_at_ms (raw, possibly absent), and the
// user's current progress. Returns { progress, warning }:
//   - progress: a partial object to merge into progress, or null for "no
//     change" (an event type not handled here, or a CANCELLATION/
//     EXPIRATION whose grant is no longer iap-sourced — a late or
//     out-of-order event must never clobber a different source applied
//     since, e.g. a manual comp grant).
//   - warning: a message the caller should log loudly (not silently) when
//     RC's own expiry data was missing and a fallback was used, or null.
//
// Trusts RC's own period management over any locally-computed guess: for
// INITIAL_PURCHASE/RENEWAL, proExpiresAt comes from expiration_at_ms, not
// computeIapExpiresAt() — RC knows the actual billing period (monthly,
// quarterly, promotional, ...), a flat duration would be wrong for
// anything other than exactly what computeIapExpiresAt() assumes.
// computeIapExpiresAt() is only a fallback for the rare case RC's payload
// doesn't include it.
function resolveRevenueCatUpdate(eventType, expirationAtMs, currentProgress) {
  const currentSource = currentProgress.proSource;

  if (eventType === 'INITIAL_PURCHASE' || eventType === 'RENEWAL') {
    let incomingExpiresAt = expirationMsToIso(expirationAtMs);
    let warning = null;
    if (incomingExpiresAt === null) {
      warning = `${eventType} missing expiration_at_ms — falling back to computeIapExpiresAt()`;
      incomingExpiresAt = computeIapExpiresAt();
    }

    if (!shouldApplyProGrant(currentSource, 'iap', currentProgress.proExpiresAt, incomingExpiresAt)) {
      return { progress: null, warning };
    }

    return {
      progress: { isPro: true, proExpiresAt: incomingExpiresAt, proSource: 'iap' },
      warning,
    };
  }

  if (eventType === 'CANCELLATION') {
    // Not a revocation — the user keeps access through the period they
    // already paid for. expiration_at_ms IS the end of that period; once
    // it passes, the existing expire-pro cron reconciles it naturally via
    // isEligibleForProExpiry, no special-case revocation logic needed here.
    if (currentSource !== 'iap') return { progress: null, warning: null };

    const incomingExpiresAt = expirationMsToIso(expirationAtMs);
    if (incomingExpiresAt === null) {
      return {
        progress: null,
        warning: 'CANCELLATION missing expiration_at_ms — leaving proExpiresAt untouched, not revoking early',
      };
    }
    return { progress: { proExpiresAt: incomingExpiresAt }, warning: null };
  }

  if (eventType === 'EXPIRATION') {
    // The authoritative "access has ended" signal — unlike CANCELLATION,
    // this fires when the paid period is actually over.
    if (currentSource !== 'iap') return { progress: null, warning: null };
    const cleared = clearIapGrant(currentProgress);
    return {
      progress: { isPro: cleared.isPro, proExpiresAt: cleared.proExpiresAt, proSource: cleared.proSource },
      warning: null,
    };
  }

  // BILLING_ISSUE, PRODUCT_CHANGE, TRANSFER, etc. — acknowledged by the
  // caller (so RC doesn't retry), not acted on yet.
  return { progress: null, warning: null };
}

module.exports = { expirationMsToIso, resolveRevenueCatUpdate };
