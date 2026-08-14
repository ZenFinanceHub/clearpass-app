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

// True if any relationship is 'accepted' — an instructor switching to
// learner must unlink every accepted learner first, so no learner is left
// with an instructor who no longer exists as one.
export function hasBlockingRelationships(relationships: { status: string }[]): boolean {
  return relationships.some(r => r.status === 'accepted');
}
