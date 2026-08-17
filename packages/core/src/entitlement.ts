export type ProSource = 'stripe' | 'iap' | 'instructor' | 'comp' | 'seat';

export interface ProGrantState {
  isPro: boolean;
  proExpiresAt: string | null;
  proSource?: ProSource | null;
}

// Higher wins. A paid Stripe or IAP grant is never silently downgraded by
// any free grant. 'iap' (RevenueCat-mediated App Store/Play Store purchases)
// sits at the same tier as 'stripe' — both mean "the user paid us directly",
// just through a different rail; see shouldApplyProGrant below for how a tie
// between the two is actually broken. 'comp' (manually granted, e.g.
// reviewers/partners/beta testers) sits above 'instructor' so the automated
// instructor-grant cron can never silently overwrite a deliberate manual
// comp — comp is a one-off human decision, instructor is a recurring
// automated reconciliation. Equal priority still applies for same-source
// pairs, so e.g. a Stripe renewal for an already-'stripe' user, or the
// instructor cron re-confirming an existing instructor grant, both go
// through.
const PRO_SOURCE_PRIORITY: Record<ProSource, number> = {
  stripe: 4,
  iap: 4,
  comp: 3,
  instructor: 2,
  seat: 1,
};

export function shouldApplyProGrant(
  currentSource: ProSource | null | undefined,
  incomingSource: ProSource,
  currentExpiresAt?: string | null,
  incomingExpiresAt?: string | null
): boolean {
  if (!currentSource) return true;

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

// Instructor-sourced and comp-sourced Pro are both granted unconditionally
// and never expire on their own — instructor for as long as the account is
// an instructor, comp for as long as someone manually granted it stands.
export function isExemptFromProExpiry(source: ProSource | null | undefined): boolean {
  return source === 'instructor' || source === 'comp';
}

export function isEligibleForProExpiry(state: ProGrantState, nowIso: string): boolean {
  if (isExemptFromProExpiry(state.proSource)) return false;
  return state.isPro === true && !!state.proExpiresAt && state.proExpiresAt < nowIso;
}

// Used when an instructor switches their own account back to learner. Only
// clears the Pro grant if it was actually instructor-sourced — a learner who
// separately paid, or was manually comp'd, keeps that entitlement untouched;
// it has nothing to do with their now-former instructor status.
export function clearInstructorGrant<T extends ProGrantState>(state: T): T {
  if (state.proSource !== 'instructor') return state;
  return { ...state, isPro: false, proExpiresAt: null, proSource: null };
}

// Used when a RevenueCat EXPIRATION event confirms an iap-sourced
// subscription's paid period has actually ended (see
// POST /api/revenuecat-webhook in server/proxy.js). Mirrors
// clearInstructorGrant's guard exactly: only clears if the grant is still
// iap-sourced, so a late-arriving or out-of-order EXPIRATION for a grant
// that's since been superseded (e.g. manually comp'd) can never clobber it.
export function clearIapGrant<T extends ProGrantState>(state: T): T {
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
export function isInstructorGrantAlreadyCorrect(state: { isPro: boolean; proSource?: ProSource | null }): boolean {
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
export function hasBlockingRelationships(relationships: { status: string }[]): boolean {
  return relationships.some(r => r.status === 'accepted' || r.status === 'consent_withdrawn');
}
