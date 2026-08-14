'use strict';

// Mirrors packages/core/src/entitlement.ts, which is the tested spec for
// these rules. Duplicated here (not required) because this server is plain
// CommonJS with no build step and no @clearpass/core dependency — it can't
// require() TypeScript. Keep the two in sync by hand.

// Higher wins. A paid Stripe grant is never silently downgraded by a free
// instructor or seat grant; an instructor grant is never downgraded by a
// seat grant. Equal priority still applies (e.g. a Stripe renewal, or the
// instructor cron re-confirming an existing instructor grant).
const PRO_SOURCE_PRIORITY = { stripe: 3, instructor: 2, seat: 1 };

function shouldApplyProGrant(currentSource, incomingSource) {
  if (!currentSource) return true;
  return PRO_SOURCE_PRIORITY[incomingSource] >= PRO_SOURCE_PRIORITY[currentSource];
}

// Instructor-sourced Pro is granted unconditionally for as long as the
// account is an instructor and never expires on its own.
function isExemptFromProExpiry(source) {
  return source === 'instructor';
}

function isEligibleForProExpiry(state, nowIso) {
  if (isExemptFromProExpiry(state.proSource)) return false;
  return state.isPro === true && !!state.proExpiresAt && state.proExpiresAt < nowIso;
}

module.exports = { shouldApplyProGrant, isExemptFromProExpiry, isEligibleForProExpiry };
