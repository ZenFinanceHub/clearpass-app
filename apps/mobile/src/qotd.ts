/**
 * Question of the Day: which question today is, where the answer is kept,
 * and the XP it earns. Extracted unchanged from the current Home
 * (app/(tabs)/home.tsx) so the Daily Coach Home (ui_v2) reuses the exact
 * same pick and storage key. Pure: no imports, testable with plain Node.
 */

/** XP awarded the first time today's question is answered. */
export const QOTD_XP = 10;

/** The day key the current Home has always used: the UTC calendar date. */
export function qotdDateKey(now: Date): string {
  return now.toISOString().split('T')[0]!;
}

/** Deterministic daily pick: YYYYMMDD as a number, modulo the question count. */
export function qotdIndex(dateKey: string, questionCount: number): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const seed = y! * 10000 + m! * 100 + d!;
  return seed % questionCount;
}

/** AsyncStorage key holding the chosen option index once answered today. */
export function qotdStorageKey(dateKey: string): string {
  return `@clearpass/qotd_${dateKey}`;
}
