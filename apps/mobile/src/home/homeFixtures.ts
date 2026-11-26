/**
 * Synthetic learners for the Daily Coach Home preview (/dev/home-preview)
 * and the view-model tests. Invented data only — no real user data.
 * Pure: no imports, dates relative to `now`.
 */
import type { HomeProgress } from './homeViewModel.ts';

export type FixtureName = 'new' | 'established' | 'pro' | 'no-test-date' | 'loading' | 'error';
export const FIXTURE_NAMES: FixtureName[] = ['new', 'established', 'pro', 'no-test-date', 'loading', 'error'];

/** Full progress object: HomeProgress plus the remaining UserProgress fields RoadmapPath reads. */
export interface FixtureProgress extends HomeProgress {
  userId: string;
  readinessScore: number;
  xp: number;
  achievements: string[];
  battleModeHistory: [];
  proExpiresAt: string | null;
  mockTestHistory: Array<{ id: string; score: number; passed: boolean; takenAt: string; timeTakenSeconds: number; topicBreakdown: Record<string, number>; total?: number; passMark?: number }>;
  hazardPerceptionHistory: Array<{ passed: boolean; [k: string]: unknown }>;
}

export interface Fixture {
  name: FixtureName;
  displayName: string | null;
  loading: boolean;
  error?: boolean;
  progress: FixtureProgress | null;
  dueReviewCount: number;
}

const TOPICS = [
  'Alertness', 'Attitude', 'SafetyAndYourVehicle', 'SafetyMargins', 'HazardAwareness', 'VulnerableRoadUsers',
  'OtherTypes', 'VehicleHandling', 'MotorwayRules', 'RulesOfTheRoad', 'RoadAndTrafficSigns',
  'DocumentsAndRegulations', 'AccidentsAndEmergencies', 'VehicleLoading',
];

const scores = (values: Partial<Record<string, number>>, fallback = 0): Record<string, number> =>
  Object.fromEntries(TOPICS.map((t) => [t, values[t] ?? fallback]));

const daysFrom = (now: Date, n: number, hour = 10) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, hour);
  return d.toISOString();
};
const utcDay = (now: Date) => now.toISOString().split('T')[0]!;

function base(now: Date): FixtureProgress {
  return {
    userId: 'fixture-user',
    topicScores: scores({}),
    totalQuestionsAnswered: 0,
    mockTestHistory: [],
    hazardPerceptionHistory: [],
    readinessScore: 0,
    lastStudied: daysFrom(now, 0),
    studyStreakDays: 0,
    xp: 0,
    achievements: [],
    dailyChallenge: null,
    testDate: null,
    battleModeHistory: [],
    isPro: false,
    proExpiresAt: null,
    dailyQuestionsAnswered: 0,
  };
}

const mock = (now: Date, daysAgo: number, score: number, total: number, passMark: number) => ({
  id: `fixture-mock-${daysAgo}`,
  score,
  passed: score >= passMark,
  takenAt: daysFrom(now, -daysAgo, 18),
  timeTakenSeconds: total === 25 ? 1500 : 3000,
  topicBreakdown: scores({}, 0),
  total,
  passMark,
});

export function getFixture(name: FixtureName, now: Date = new Date()): Fixture {
  switch (name) {
    case 'new':
      return {
        name, displayName: 'Sam', loading: false, dueReviewCount: 0,
        progress: { ...base(now), testDate: daysFrom(now, 42) },
      };
    case 'established':
      return {
        name, displayName: 'Alex', loading: false, dueReviewCount: 0,
        progress: {
          ...base(now),
          totalQuestionsAnswered: 186,
          topicScores: scores({
            Alertness: 82, Attitude: 78, SafetyAndYourVehicle: 74, SafetyMargins: 66, HazardAwareness: 58,
            VulnerableRoadUsers: 71, RulesOfTheRoad: 76, RoadAndTrafficSigns: 84, MotorwayRules: 62,
          }),
          mockTestHistory: [mock(now, 2, 19, 25, 22)],
          studyStreakDays: 5,
          lastStudied: daysFrom(now, 0, 8),
          dailyQuestionsAnswered: 6,
          xp: 940,
          testDate: daysFrom(now, 21),
          dailyChallenge: {
            date: utcDay(now), description: 'Answer 5 Safety Margins questions', targetCount: 5,
            currentCount: 2, completed: false, xpReward: 30, challengeType: 'topic', topicCategory: 'SafetyMargins',
          } as FixtureProgress['dailyChallenge'],
        },
      };
    case 'pro':
      return {
        name, displayName: 'Jordan', loading: false, dueReviewCount: 0,
        progress: {
          ...base(now),
          isPro: true,
          totalQuestionsAnswered: 512,
          topicScores: scores({}, 86),
          mockTestHistory: [mock(now, 6, 41, 50, 43), mock(now, 1, 46, 50, 43)],
          hazardPerceptionHistory: [{ passed: true, score: 52 }],
          studyStreakDays: 12,
          lastStudied: daysFrom(now, 0, 7),
          dailyQuestionsAnswered: 14,
          xp: 3120,
          testDate: daysFrom(now, 9),
          dailyChallenge: {
            date: utcDay(now), description: 'Score 80% or more in a practice set', targetCount: 1,
            currentCount: 1, completed: true, xpReward: 40, challengeType: 'practiceScore',
          } as FixtureProgress['dailyChallenge'],
        },
      };
    case 'no-test-date':
      return {
        name, displayName: 'Riley', loading: false, dueReviewCount: 0,
        progress: {
          ...base(now),
          totalQuestionsAnswered: 64,
          topicScores: scores({ Alertness: 72, Attitude: 80, RoadAndTrafficSigns: 75, RulesOfTheRoad: 70 }),
          studyStreakDays: 0,
          lastStudied: daysFrom(now, -4),
          dailyQuestionsAnswered: 12,
          xp: 260,
        },
      };
    case 'loading':
      return { name, displayName: null, loading: true, dueReviewCount: 0, progress: null };
    case 'error':
      return { name, displayName: null, loading: false, error: true, dueReviewCount: 0, progress: null };
  }
}
