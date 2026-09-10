'use strict';

// Mirrors packages/core/src/entitlement.ts, which is the tested spec for
// these rules. Duplicated here (not required) because this server is plain
// CommonJS with no build step and no @clearpass/core dependency — it can't
// require() TypeScript. Keep the two in sync by hand.

// Higher wins. A paid Stripe or IAP grant is never silently downgraded by
// any free grant. 'iap' (RevenueCat-mediated App Store/Play Store purchases)
// sits at the same tier as 'stripe' — both mean "the user paid us directly",
// just through a different rail; see shouldApplyProGrant below for how a tie
// between the two is actually broken. 'comp' (manually granted, e.g.
// reviewers/partners/beta testers) sits above 'instructor' so the automated
// instructor-grant cron can never silently overwrite a deliberate manual
// comp — comp is a one-off human decision, instructor is a recurring
// automated reconciliation. Equal priority still applies for same-source
// pairs (e.g. a Stripe renewal, or the instructor cron re-confirming an
// existing instructor grant).
const PRO_SOURCE_PRIORITY = { stripe: 4, iap: 4, comp: 3, instructor: 2, seat: 1 };

function shouldApplyProGrant(currentSource, incomingSource, currentExpiresAt, incomingExpiresAt) {
  if (!currentSource) return true;

  // A permanent grant (no expiry at all — comp or instructor, the only two
  // sources ever written with proExpiresAt: null) is never replaced by a
  // DIFFERENT source's grant that DOES carry an expiry, regardless of
  // source priority. Without this, a higher-priority but time-limited grant
  // (a real iap/stripe purchase) would silently downgrade someone from
  // permanent free access to a grant that eventually expires and clears
  // entirely — an instructor or comp user who makes one purchase and lets
  // it lapse would lose Pro outright, with nothing to reconcile it back
  // (grant-instructor-pro only grants to the verified subset; an unverified
  // grandfathered instructor who fell through this gap would never be
  // re-granted). Restricted to currentSource !== incomingSource so a
  // same-source renewal/reapplication (e.g. RENEWAL for someone whose
  // stored proExpiresAt happens to be missing) is unaffected — that case
  // already always succeeds via the currentSource === incomingSource check
  // below, and must keep doing so.
  if (currentSource !== incomingSource && !currentExpiresAt && incomingExpiresAt) return false;

  const currentPriority = PRO_SOURCE_PRIORITY[currentSource];
  const incomingPriority = PRO_SOURCE_PRIORITY[incomingSource];
  if (incomingPriority !== currentPriority) return incomingPriority > currentPriority;

  // Equal priority. A source reapplying/renewing over itself always goes
  // through, same as before 'iap' existed — trust the payment processor's
  // own renewal semantics without second-guessing dates.
  if (currentSource === incomingSource) return true;

  // Equal priority, different source — today that only means stripe <-> iap
  // (the only tie in the table). Whichever grant actually lasts longer
  // wins, so a real purchase on one platform never gets silently clobbered
  // by a shorter-lived grant from the other. No incoming expiry, or a tie,
  // never wins — callers must pass both dates to break this tie at all.
  if (!incomingExpiresAt) return false;
  if (!currentExpiresAt) return true;
  return incomingExpiresAt > currentExpiresAt;
}

// Comp-sourced Pro is granted unconditionally and never expires on its own —
// a manual, one-off decision with no automated signal to key off.
//
// Instructor-sourced Pro is exempt only *while the profile is still an
// instructor*. accountType is optional and, when omitted, this preserves
// the old unconditional-exemption behaviour — every existing call site that
// doesn't have a profile row handy (e.g. the /api/explain quota check,
// which only reads user_progress) keeps working exactly as before. Only a
// caller that actually looked up the profile (the expire-pro cron) gets the
// stricter check. Passing a non-'instructor' accountType for anything other
// than an 'instructor'-sourced state has no effect — 'comp' and paid
// sources never look at it.
function isExemptFromProExpiry(source, accountType) {
  if (source === 'comp') return true;
  if (source === 'instructor') return accountType === undefined || accountType === 'instructor';
  return false;
}

function isEligibleForProExpiry(state, nowIso, accountType) {
  if (isExemptFromProExpiry(state.proSource, accountType)) return false;
  if (state.isPro !== true) return false;
  // Instructor grants carry no proExpiresAt (see grant-instructor-pro) — an
  // instructor grant only ever reaches here once it's no longer exempt
  // (accountType !== 'instructor', checked above), and at that point it's
  // eligible immediately. There's no date to wait out, unlike stripe/iap/
  // seat below.
  if (state.proSource === 'instructor') return true;
  return !!state.proExpiresAt && state.proExpiresAt < nowIso;
}

// Used when an instructor switches their own account back to learner. Only
// clears the Pro grant if it was actually instructor-sourced — a learner who
// separately paid, or was manually comp'd, keeps that entitlement untouched;
// it has nothing to do with their now-former instructor status.
function clearInstructorGrant(state) {
  if (state.proSource !== 'instructor') return state;
  return { ...state, isPro: false, proExpiresAt: null, proSource: null };
}

// Used when a RevenueCat EXPIRATION event confirms an iap-sourced
// subscription's paid period has actually ended (see
// POST /api/revenuecat-webhook below). Mirrors clearInstructorGrant's guard
// exactly: only clears if the grant is still iap-sourced, so a late-arriving
// or out-of-order EXPIRATION for a grant that's since been superseded (e.g.
// manually comp'd) can never clobber it.
function clearIapGrant(state) {
  if (state.proSource !== 'iap') return state;
  return { ...state, isPro: false, proExpiresAt: null, proSource: null };
}

// True if this progress state already reflects a correct, unconditional
// instructor-sourced Pro grant. Deliberately does NOT check proExpiresAt —
// 'instructor' is exempt from expiry (isExemptFromProExpiry above), so its
// value is entitlement-irrelevant. Checking it used to make
// grant-instructor-pro's idempotency check brittle against any record that
// reached { isPro: true, proSource: 'instructor' } by a path other than
// that cron (e.g. a hand backfill) without also explicitly nulling
// proExpiresAt — exactly what happened in production: a backfill script
// set proSource alone, leaving a stale/absent proExpiresAt behind, so the
// cron re-wrote three already-correct accounts and reported them as freshly
// "granted" instead of recognizing them as already done.
function isInstructorGrantAlreadyCorrect(state) {
  return state.isPro === true && state.proSource === 'instructor';
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
  clearIapGrant,
  isInstructorGrantAlreadyCorrect,
  hasBlockingRelationships,
};
