import type { UserProgress } from '@clearpass/core';
import { allQuestions } from '@clearpass/content';
import { FREE_QUESTION_LIMIT } from './subscription';

/** Free learners get exactly one mock test (the Quick Mock) so they reach
 *  the moment that sells Pro: a real score against the pass mark. */
export const FREE_MOCK_ALLOWANCE = 1;

export type PaywallReason = 'daily_limit' | 'mock' | 'hazard' | 'tutor' | 'mock_result' | 'general';

/** Whole days from today until the learner's saved test date, or null if
 *  they haven't set one or it has already passed. */
export function daysUntilTest(progress: Pick<UserProgress, 'testDate'> | null | undefined): number | null {
  if (!progress?.testDate) return null;
  const test = new Date(progress.testDate);
  if (Number.isNaN(test.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  test.setHours(0, 0, 0, 0);
  const days = Math.round((test.getTime() - today.getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

/** True while a free learner still has their one free mock test. */
export function hasFreeMockLeft(progress: Pick<UserProgress, 'mockTestHistory'> | null | undefined): boolean {
  return (progress?.mockTestHistory?.length ?? 0) < FREE_MOCK_ALLOWANCE;
}

/** One line that ties the upgrade to the learner's own deadline, e.g.
 *  "Your test is in 18 days. On the free plan you'd see 180 of 731 questions
 *  before then." Null when there is no usable test date. */
export function testDateUrgencyLine(progress: Pick<UserProgress, 'testDate'> | null | undefined): string | null {
  const days = daysUntilTest(progress);
  if (days === null) return null;
  if (days === 0) return 'Your test is today. Good luck!';
  const total = allQuestions.length;
  const reachable = Math.min(total, days * FREE_QUESTION_LIMIT);
  const when = days === 1 ? 'tomorrow' : `in ${days} days`;
  if (reachable >= total) return `Your test is ${when}. Pro adds full mock tests and hazard clips to your revision.`;
  return `Your test is ${when}. On the free plan you'd see ${reachable} of ${total} questions before then.`;
}
