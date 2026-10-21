'use strict';

const PRO_DURATION_MONTHS = 3;

// Web plans are one-off Stripe payments (mode: 'payment'), not
// subscriptions: each buys a fixed number of calendar months.
//   quarterly — £7.99, 3 months (the original web product, STRIPE_PRICE_ID)
//   monthly   — £2.99, 1 month (STRIPE_PRICE_ID_MONTHLY)
const WEB_PLAN_MONTHS = { quarterly: PRO_DURATION_MONTHS, monthly: 1 };

function computeProExpiresAt(fromDate = new Date(), months = PRO_DURATION_MONTHS) {
  const d = new Date(fromDate);
  const expires = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + months,
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

module.exports = { computeProExpiresAt, PRO_DURATION_MONTHS, WEB_PLAN_MONTHS, computeIapExpiresAt, IAP_DURATION_DAYS };
