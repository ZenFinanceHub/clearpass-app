import { TopicCategory } from './types/TopicCategory';
import { DailyChallenge, DailyChallengeType } from './types/DailyChallenge';

interface ChallengeTemplate {
  description: string;
  targetCount: number;
  challengeType: DailyChallengeType;
  topicCategory?: string;
}

// Indexed 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const DAILY_CHALLENGES: ChallengeTemplate[] = [
  {
    description: 'Study for 20 minutes today',
    targetCount: 20,
    challengeType: 'timeMinutes',
  },
  {
    description: 'Answer 10 Alertness questions correctly',
    targetCount: 10,
    challengeType: 'topic',
    topicCategory: TopicCategory.Alertness,
  },
  {
    description: 'Answer 10 Road Sign questions correctly',
    targetCount: 10,
    challengeType: 'topic',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
  },
  {
    description: 'Complete a full mock test',
    targetCount: 1,
    challengeType: 'mock',
  },
  {
    description: 'Answer 10 Safety Margins questions correctly',
    targetCount: 10,
    challengeType: 'topic',
    topicCategory: TopicCategory.SafetyMargins,
  },
  {
    description: 'Score 8 or more in a practice session',
    targetCount: 8,
    challengeType: 'practiceScore',
  },
  {
    description: 'Answer 15 questions from any topic correctly',
    targetCount: 15,
    challengeType: 'anyQuestions',
  },
];

export function generateDailyChallenge(date: Date): DailyChallenge {
  const dayOfWeek = date.getDay();
  const template = DAILY_CHALLENGES[dayOfWeek];
  const dateStr = date.toISOString().split('T')[0];

  return {
    date: dateStr,
    description: template.description,
    targetCount: template.targetCount,
    currentCount: 0,
    completed: false,
    xpReward: 75,
    challengeType: template.challengeType,
    topicCategory: template.topicCategory,
  };
}

export function isDailyChallengeComplete(challenge: DailyChallenge): boolean {
  return challenge.completed || challenge.currentCount >= challenge.targetCount;
}

export function questionCountsTowardChallenge(
  dc: DailyChallenge | null | undefined,
  topicCategory: string,
): boolean {
  if (!dc) return false;
  if (isDailyChallengeComplete(dc)) return false;
  if (dc.challengeType !== 'topic') return false;
  return dc.topicCategory === topicCategory;
}

/**
 * Whether the in-quiz "counts toward today's challenge" badge should show
 * for the current question. Deliberately separate from
 * questionCountsTowardChallenge, which gates the actual per-question
 * currentCount increment and must stay topic-only: anyQuestions and
 * practiceScore are tracked in bulk at session end instead (see
 * finaliseSession() in apps/mobile/app/(tabs)/practice.tsx), so reusing the
 * increment gate here would double-count them. This function only decides
 * whether to show a heads-up — it never mutates the challenge.
 */
export function shouldShowChallengeBadge(
  dc: DailyChallenge | null | undefined,
  topicCategory: string,
): boolean {
  if (!dc) return false;
  if (isDailyChallengeComplete(dc)) return false;
  if (dc.challengeType === 'topic') return dc.topicCategory === topicCategory;
  return dc.challengeType === 'anyQuestions' || dc.challengeType === 'practiceScore';
}

export function applyCorrectAnswerToChallenge(
  dc: DailyChallenge,
  topicCategory: string,
): DailyChallenge {
  if (!questionCountsTowardChallenge(dc, topicCategory)) return dc;
  const newCount = Math.min(dc.currentCount + 1, dc.targetCount);
  return { ...dc, currentCount: newCount, completed: newCount >= dc.targetCount };
}

export function didChallengeJustComplete(
  before: DailyChallenge,
  after: DailyChallenge,
): boolean {
  return !isDailyChallengeComplete(before) && isDailyChallengeComplete(after);
}
