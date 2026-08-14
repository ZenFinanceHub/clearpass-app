export type ProSource = 'stripe' | 'instructor' | 'seat';

export interface ProGrantState {
  isPro: boolean;
  proExpiresAt: string | null;
  proSource?: ProSource | null;
}

// Higher wins. A paid Stripe grant is never silently downgraded by a free
// instructor or seat grant; an instructor grant is never downgraded by a
// seat grant. Equal priority still applies, so e.g. a Stripe renewal for an
// already-'stripe' user, or the instructor cron re-confirming an existing
// instructor grant, both go through.
const PRO_SOURCE_PRIORITY: Record<ProSource, number> = {
  stripe: 3,
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

// Instructor-sourced Pro is granted unconditionally for as long as the
// account is an instructor and never expires on its own.
export function isExemptFromProExpiry(source: ProSource | null | undefined): boolean {
  return source === 'instructor';
}

export function isEligibleForProExpiry(state: ProGrantState, nowIso: string): boolean {
  if (isExemptFromProExpiry(state.proSource)) return false;
  return state.isPro === true && !!state.proExpiresAt && state.proExpiresAt < nowIso;
}
