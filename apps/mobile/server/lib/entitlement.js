'use strict';

// Mirrors packages/core/src/entitlement.ts, which is the tested spec for
// these rules. Duplicated here (not required) because this server is plain
// CommonJS with no build step and no @clearpass/core dependency — it can't
// require() TypeScript. Keep the two in sync by hand.

// Higher wins. A paid Stripe grant is never silently downgraded by any free
// grant. 'comp' (manually granted, e.g. reviewers/partners/beta testers) sits
// above 'instructor' so the automated instructor-grant cron can never
// silently overwrite a deliberate manual comp — comp is a one-off human
// decision, instructor is a recurring automated reconciliation. Equal
// priority still applies (e.g. a Stripe renewal, or the instructor cron
// re-confirming an existing instructor grant).
const PRO_SOURCE_PRIORITY = { stripe: 4, comp: 3, instructor: 2, seat: 1 };

function shouldApplyProGrant(currentSource, incomingSource) {
  if (!currentSource) return true;
  return PRO_SOURCE_PRIORITY[incomingSource] >= PRO_SOURCE_PRIORITY[currentSource];
}

// Instructor-sourced and comp-sourced Pro are both granted unconditionally
// and never expire on their own — instructor for as long as the account is
// an instructor, comp for as long as someone manually granted it stands.
function isExemptFromProExpiry(source) {
  return source === 'instructor' || source === 'comp';
}

function isEligibleForProExpiry(state, nowIso) {
  if (isExemptFromProExpiry(state.proSource)) return false;
  return state.isPro === true && !!state.proExpiresAt && state.proExpiresAt < nowIso;
}

// Used when an instructor switches their own account back to learner. Only
// clears the Pro grant if it was actually instructor-sourced — a learner who
// separately paid, or was manually comp'd, keeps that entitlement untouched;
// it has nothing to do with their now-former instructor status.
function clearInstructorGrant(state) {
  if (state.proSource !== 'instructor') return state;
  return { ...state, isPro: false, proExpiresAt: null, proSource: null };
}

// True if any relationship is 'accepted' OR 'consent_withdrawn' — an
// instructor switching to learner must unlink every real pupil first, so no
// pupil is left with an instructor who no longer exists as one.
// 'consent_withdrawn' blocks too: that pupil turned off progress sharing,
// not the relationship itself — the instructor is still their instructor of
// record (name, lesson notes, and the option to re-consent all still work).
// Only 'pending' (an invite not yet accepted) and 'rejected' (already
// unlinked) are non-blocking.
function hasBlockingRelationships(relationships) {
  return relationships.some(r => r.status === 'accepted' || r.status === 'consent_withdrawn');
}

module.exports = {
  shouldApplyProGrant,
  isExemptFromProExpiry,
  isEligibleForProExpiry,
  clearInstructorGrant,
  hasBlockingRelationships,
};
