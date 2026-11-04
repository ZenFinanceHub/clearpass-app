/**
 * Study nudges: which local notifications to schedule, and when to offer
 * reminders. Pure functions only (no Expo imports) so they can be tested
 * with plain Node.
 *
 * Why rolling one-off notifications instead of one DAILY trigger: a repeating
 * trigger fires even on days the learner has already studied, always with the
 * same text, and never stops for someone who has left. Instead we schedule
 * the next few weeks as individual notifications and rebuild the plan every
 * time the app opens or a session finishes. Today's is skipped once they have
 * studied, and the plan thins out (then stops) if they stop opening the app.
 */

export type NudgeInput = {
  now: Date;
  hour: number;
  minute: number;
  /** ISO time of the last completed practice session, if any. */
  lastStudiedIso?: string | null;
  /** ISO date of the learner's theory test, if set. */
  testDateIso?: string | null;
  streakDays?: number;
  isPro?: boolean;
};

export type PlannedNudge = { date: Date; title: string; body: string };

/** Days from today on which a nudge fires. 0 = today (if not yet studied and
 *  the reminder time is still ahead). Daily for two weeks, then every other
 *  day to day 21, then weekly to day 56, then stops. Counted from the last
 *  time the app was opened, because the plan is rebuilt on every open.
 *  24 entries, well under iOS's 64 pending-notification limit. */
export const NUDGE_DAY_OFFSETS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  16, 18, 20, 21,
  28, 35, 42, 49, 56,
];

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from `from` (local) until the test date, or null if no future test. */
export function daysUntilTest(testDateIso: string | null | undefined, from: Date): number | null {
  if (!testDateIso) return null;
  const t = new Date(testDateIso);
  if (isNaN(t.getTime())) return null;
  const days = Math.round((startOfLocalDay(t).getTime() - startOfLocalDay(from).getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

function copyFor(dayOffset: number, fireDate: Date, input: NudgeInput): { title: string; body: string } {
  const toTest = daysUntilTest(input.testDateIso, fireDate);

  if (toTest === 0) return { title: "Today's the day 🚗", body: 'Good luck with your theory test. A few warm-up questions?' };
  if (toTest === 1) return { title: 'Your theory test is tomorrow', body: 'A short warm-up session now, then an early night.' };

  // After two weeks away, a gentler "your progress is saved" message.
  if (dayOffset >= 15) {
    return toTest !== null
      ? { title: `${toTest} days until your theory test`, body: 'Pick up where you left off. Your progress is saved.' }
      : { title: 'Still preparing for your theory test?', body: 'Pick up where you left off. Your progress is saved.' };
  }

  const ready = input.isPro
    ? { title: "Today's practice is ready 📚", body: 'A 5-minute session keeps it fresh.' }
    : { title: 'Your 10 free questions are ready 📚', body: 'A 5-minute session keeps it fresh.' };

  const rotation: Array<{ title: string; body: string }> = [ready];
  if (toTest !== null && toTest <= 60) {
    rotation.push({ title: `${toTest} days until your theory test`, body: 'Ten questions now beats cramming later.' });
  }
  if ((input.streakDays ?? 0) > 0 && dayOffset <= 1) {
    rotation.push({ title: `Keep your ${input.streakDays}-day streak going 🔥`, body: 'One quick session today keeps it alive.' });
  }
  rotation.push({ title: 'Road signs are easy marks', body: 'Brush up in a quick session today.' });
  rotation.push({ title: 'Little and often works best', body: 'Ten questions a day adds up fast before your test.' });

  return rotation[dayOffset % rotation.length];
}

/** The notifications to schedule from `now`. */
export function buildNudgePlan(input: NudgeInput): PlannedNudge[] {
  const { now, hour, minute } = input;
  const studiedToday = !!input.lastStudiedIso && sameLocalDay(new Date(input.lastStudiedIso), now);
  const testDay = input.testDateIso ? new Date(input.testDateIso) : null;

  const plan: PlannedNudge[] = [];
  for (const offset of NUDGE_DAY_OFFSETS) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute, 0, 0);
    if (date <= now) continue;
    if (offset === 0 && studiedToday) continue;
    // Nothing after the test itself.
    if (testDay && !isNaN(testDay.getTime()) && startOfLocalDay(date) > startOfLocalDay(testDay)) break;
    plan.push({ date, ...copyFor(offset, date, input) });
  }
  return plan;
}

// ─── When to offer reminders ─────────────────────────────────────────────────

export type ReminderAskState = { times: number; lastIso: string | null };

export const MAX_REMINDER_ASKS = 5;
export const MIN_DAYS_BETWEEN_ASKS = 2;

export function shouldOfferReminder(args: {
  isWeb: boolean;
  remindersOn: boolean;
  permission: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  ask: ReminderAskState;
  now: Date;
}): boolean {
  if (args.isWeb || args.remindersOn) return false;
  // The OS will no longer show its prompt; asking would lead nowhere.
  if (args.permission === 'denied' && !args.canAskAgain) return false;
  if (args.ask.times >= MAX_REMINDER_ASKS) return false;
  if (args.ask.lastIso) {
    const daysSince = (args.now.getTime() - new Date(args.ask.lastIso).getTime()) / 86_400_000;
    if (daysSince < MIN_DAYS_BETWEEN_ASKS) return false;
  }
  return true;
}

// ─── Reminders on by default ─────────────────────────────────────────────────

/**
 * One-time switch to reminders-on-by-default (Nov 2026). Before this, every
 * install started with reminders off and almost nobody turned them on, so a
 * stored `false` almost always means "never touched" rather than "chose
 * off". Each install is switched on once; after that the Settings toggle
 * wins, including turning it back off.
 */
export function reminderDefaultsToApply(args: {
  alreadyApplied: boolean;
  settings: { studyReminder: boolean; testCountdown: boolean };
  testDateIso?: string | null;
  now: Date;
}): { studyReminder: boolean; testCountdown: boolean } | null {
  if (args.alreadyApplied) return null;
  const hasFutureTest = daysUntilTest(args.testDateIso, args.now) !== null;
  return {
    studyReminder: true,
    testCountdown: args.settings.testCountdown || hasFutureTest,
  };
}
