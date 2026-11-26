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
