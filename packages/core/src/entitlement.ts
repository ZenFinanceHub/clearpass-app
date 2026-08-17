export type ProSource = 'stripe' | 'instructor' | 'comp' | 'seat';

export interface ProGrantState {
  isPro: boolean;
  proExpiresAt: string | null;
  proSource?: ProSource | null;
}

// Higher wins. A paid Stripe grant is never silently downgraded by any free
// grant. 'comp' (manually granted, e.g. reviewers/partners/beta testers) sits
// above 'instructor' so the automated instructor-grant cron can never
// silently overwrite a deliberate manual comp — comp is a one-off human
// decision, instructor is a recurring automated reconciliation. Equal
// priority still applies, so e.g. a Stripe renewal for an already-'stripe'
// user, or the instructor cron re-confirming an existing instructor grant,
// both go through.
const PRO_SOURCE_PRIORITY: Record<ProSource, number> = {
  stripe: 4,
  comp: 3,
  instructor: 2,
  seat: 1,
};

export function shouldApplyProGrant(
  currentSource: ProSource | null | undefined,
  incomingSource: ProSource
): boolean {
  if (!currentSource) return true;
  return PRO_SOURCE_PRIORITY[incomingSource] >= PRO_SOURCE_PRIORITY[currentSource];
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
