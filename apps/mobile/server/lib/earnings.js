'use strict';

// Single source of truth for the instructor referral payout model.
//
// Lives here, not in apps/mobile/src/, because Railway's Root Directory for
// this service is apps/mobile/server — anything outside that directory
// doesn't exist in the deployed container (a prior '../src/constants/
// earnings' require from here crashed production from at least 2026-08-14
// to 2026-08-15 for exactly this reason). See
// apps/mobile/server/scripts/verify-build-boundary.sh.
//
// Required directly by apps/mobile/server/proxy.js — Node, plain require —
// and by the mobile app — TS/TSX, plain import; Expo's allowJs +
// esModuleInterop make a CommonJS module importable from TypeScript, Metro
// has no blockList excluding apps/mobile/server so it bundles fine, and
// this file has zero dependencies of its own so nothing server-only leaks
// into the client.
//
// apps/web/instructors.html is a static, unbundled page and can't import
// this file — its calculator mirrors INSTRUCTOR_PAYOUT_WORST_CASE_MINOR by
// hand. If these numbers change, update instructors.html too.

const SUBSCRIPTION_PRICE_MINOR = 799; // £7.99 per 3 months (GBP pence)
const INSTRUCTOR_SHARE_PCT = 0.30; // instructors earn 30% of net receipts
const PLATFORM_COMMISSION_PCT = 0.15; // Apple App Store / Google Play (Small Business Program rate)
const STRIPE_FEE_PCT = 0.029; // Stripe card processing fee (web checkout)
const STRIPE_FEE_FIXED_MINOR = 20; // + 20p per Stripe transaction

// Net receipts after each channel's fees, in GBP pence.
const NET_APP_STORE_MINOR = Math.round(SUBSCRIPTION_PRICE_MINOR * (1 - PLATFORM_COMMISSION_PCT));
const NET_STRIPE_MINOR = Math.round(
  SUBSCRIPTION_PRICE_MINOR - (SUBSCRIPTION_PRICE_MINOR * STRIPE_FEE_PCT + STRIPE_FEE_FIXED_MINOR)
);

// Instructor payout per learner per quarter, by purchase channel (GBP pence).
const INSTRUCTOR_PAYOUT_APP_STORE_MINOR = Math.round(NET_APP_STORE_MINOR * INSTRUCTOR_SHARE_PCT); // 204 = £2.04
const INSTRUCTOR_PAYOUT_STRIPE_MINOR = Math.round(NET_STRIPE_MINOR * INSTRUCTOR_SHARE_PCT); // 227 = £2.27

// The conservative figure quoted to instructors everywhere: the worst case across channels.
const INSTRUCTOR_PAYOUT_WORST_CASE_MINOR = Math.min(
  INSTRUCTOR_PAYOUT_APP_STORE_MINOR,
  INSTRUCTOR_PAYOUT_STRIPE_MINOR
);

function formatMinor(minor) {
  return `£${(minor / 100).toFixed(2)}`;
}

module.exports = {
  SUBSCRIPTION_PRICE_MINOR,
  INSTRUCTOR_SHARE_PCT,
  PLATFORM_COMMISSION_PCT,
  STRIPE_FEE_PCT,
  STRIPE_FEE_FIXED_MINOR,
  NET_APP_STORE_MINOR,
  NET_STRIPE_MINOR,
  INSTRUCTOR_PAYOUT_APP_STORE_MINOR,
  INSTRUCTOR_PAYOUT_STRIPE_MINOR,
  INSTRUCTOR_PAYOUT_WORST_CASE_MINOR,
  formatMinor,
};
