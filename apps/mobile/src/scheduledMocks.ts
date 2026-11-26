/**
 * Scheduled mock tests stored on the device. Extracted unchanged from the
 * current Home (app/(tabs)/home.tsx) so the Daily Coach Home (ui_v2) reads
 * the same key with the same pruning and date formatting. Pure: no imports,
 * testable with plain Node.
 */

export type ScheduledMockTest = {
  id: string;
  dateTimeIso: string;
  label: string;
  notifId: string | null;
};

export const SCHEDULED_TESTS_KEY = '@clearpass/scheduled_mock_tests';

/** Entries still in the future (the current Home prunes the rest on load). */
export function futureScheduledMocks<T extends { dateTimeIso: string }>(list: ReadonlyArray<T>, now: Date = new Date()): T[] {
  return list.filter((t) => new Date(t.dateTimeIso) > now);
}

/** "Today at 10:00", "Tomorrow at 18:30" or "28 Nov at 09:00" (local time). */
export function formatTestDateTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return `${d.getDate()} ${months[d.getMonth()]} at ${time}`;
}

// ─── Tests hub: the full scheduled-mock list (ClearPass 2.0, ui_v2) ─────────

export const SCHEDULED_MOCKS_EMPTY = 'No mock tests scheduled. When you book a time for a mock, it will show here.';
const DEFAULT_LABEL = 'Mock Test';

export interface ScheduledMockListRow { id: string; label: string; when: string; route: '/(tabs)/mock' }

/** Stored list from SCHEDULED_TESTS_KEY; anything unreadable counts as empty. */
export function parseScheduledMocks(raw: string | null | undefined): ScheduledMockTest[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((t): t is ScheduledMockTest =>
      !!t && typeof t === 'object'
      && typeof (t as ScheduledMockTest).id === 'string'
      && typeof (t as ScheduledMockTest).dateTimeIso === 'string');
  } catch {
    return [];
  }
}

/** Every upcoming scheduled mock, soonest first (Home shows only the next one). */
export function scheduledMockList(list: ReadonlyArray<ScheduledMockTest>, now: Date = new Date()): ScheduledMockListRow[] {
  const valid = list.filter((t) => !Number.isNaN(new Date(t.dateTimeIso).getTime()));
  return futureScheduledMocks(valid, now)
    .sort((a, b) => new Date(a.dateTimeIso).getTime() - new Date(b.dateTimeIso).getTime())
    .map((t) => ({ id: t.id, label: t.label || DEFAULT_LABEL, when: formatTestDateTime(t.dateTimeIso, now), route: '/(tabs)/mock' as const }));
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The learner's theory test date (progress.testDate) while it's today or later, else null. */
export function testDateRow(
  testDateIso: string | null | undefined, now: Date = new Date(),
): { label: string; when: string; daysLeft: number } | null {
  if (!testDateIso) return null;
  const d = new Date(testDateIso);
  if (Number.isNaN(d.getTime())) return null;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const daysLeft = Math.round((day(d) - day(now)) / 86_400_000);
  if (daysLeft < 0) return null;
  return { label: 'Your theory test', when: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`, daysLeft };
}
