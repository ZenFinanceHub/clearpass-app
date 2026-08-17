'use strict';

const PRO_DURATION_MONTHS = 3;

function computeProExpiresAt(fromDate = new Date()) {
  const d = new Date(fromDate);
  const expires = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + PRO_DURATION_MONTHS,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds()
  ));
  return expires.toISOString();
}

// Fixed calendar days, not calendar months like Stripe's PRO_DURATION_MONTHS
// — RevenueCat's webhook fires per renewal period regardless of platform
// product length, so this is a flat 90-day grant recomputed from whenever
// the webhook is processed, not derived from the store's own expiration
// timestamp in the payload (see the revenuecat-webhook handler in proxy.js).
const IAP_DURATION_DAYS = 90;

function computeIapExpiresAt(fromDate = new Date()) {
  const d = new Date(fromDate);
  return new Date(d.getTime() + IAP_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

module.exports = { computeProExpiresAt, PRO_DURATION_MONTHS, computeIapExpiresAt, IAP_DURATION_DAYS };
