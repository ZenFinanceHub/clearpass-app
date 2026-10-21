/**
 * Sanity rules for the theory test date a learner types in during onboarding.
 * A past date (we've seen 1973, almost certainly a date of birth) breaks the
 * countdown, the reminders and the urgency copy, so it's rejected with a
 * message that says what we're asking for.
 */

export const MAX_YEARS_AHEAD = 2;

/** Returns an error message, or null if the date is acceptable. */
export function testDateError(isoDate: string, now: Date): string | null {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return 'Enter a valid date in DD/MM/YYYY format';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (day < today) {
    return 'That date has passed. Enter the date of your theory test (not your date of birth), or tap "I don’t have a date yet".';
  }
  const latest = new Date(today.getFullYear() + MAX_YEARS_AHEAD, today.getMonth(), today.getDate());
  if (day > latest) return 'That’s more than 2 years away. Check the year, or tap "I don’t have a date yet".';
  return null;
}
