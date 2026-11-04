/**
 * Personal lines for the paywall and the home "Go Pro" banner, built from
 * the learner's own numbers (last mock score, days to their test). Pure
 * functions with no imports, so they can be tested with plain Node.
 */

type MockLike = { score: number; passed: boolean; takenAt?: string; total?: number; passMark?: number };
type ProgressLike = { mockTestHistory?: MockLike[] | null; testDate?: string | null } | null | undefined;

/** The most recent mock that recorded its total and pass mark, or null.
 *  Older results have neither, and guessing 50 would be wrong for a
 *  25-question Quick Mock. */
export function latestScoredMock(progress: ProgressLike): (MockLike & { total: number; passMark: number }) | null {
  const history = progress?.mockTestHistory ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (typeof m?.total === 'number' && typeof m?.passMark === 'number' && m.total > 0) {
      return m as MockLike & { total: number; passMark: number };
    }
  }
  return null;
}

/** e.g. "Your last mock: 18/25. You need 22 to pass." Null without a mock. */
export function mockScoreLine(progress: ProgressLike): string | null {
  const m = latestScoredMock(progress);
  if (!m) return null;
  if (m.passed) return `You passed your last mock with ${m.score}/${m.total}. Pro helps you do it every time.`;
  const short = Math.max(1, m.passMark - m.score);
  return `Your last mock: ${m.score}/${m.total}. You need ${m.passMark} to pass, ${short} more right answer${short === 1 ? '' : 's'}.`;
}

/** Whole local days until the test, or null if none set or already past. */
export function daysToTest(testDate: string | null | undefined, now: Date): number | null {
  if (!testDate) return null;
  const t = new Date(testDate);
  if (Number.isNaN(t.getTime())) return null;
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const d = Math.round((b - a) / 86_400_000);
  return d >= 0 ? d : null;
}

/** Subtitle for the home "Go Pro" banner, most personal first:
 *  the test is close, then the last mock score, then the generic line. */
export function homeProBannerSub(progress: ProgressLike, now: Date): string {
  const days = daysToTest(progress?.testDate, now);
  if (days !== null && days <= 30) {
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    return `Your test is ${when}. Unlimited mocks and hazard clips to get you ready.`;
  }
  const m = latestScoredMock(progress);
  if (m && !m.passed) {
    return `Last mock ${m.score}/${m.total}, pass mark ${m.passMark}. Unlimited mocks to close the gap.`;
  }
  return 'Unlimited mock tests, hazard perception & questions';
}

/** Plans in the order the paywall shows them: the cheaper monthly price
 *  first (and selected), then the 3-month plan marked "Best value". */
export function orderPlans<T extends string>(onSale: T[]): T[] {
  const rank = (p: string) => (p === 'monthly' ? 0 : p === 'quarterly' ? 1 : 2);
  return [...onSale].sort((a, b) => rank(a) - rank(b));
}
