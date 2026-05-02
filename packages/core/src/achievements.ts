import { UserProgress } from './types/UserProgress';
import { awardXp } from './xp';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  check: (progress: UserProgress) => boolean;
}

// TIME_LIMIT_SECONDS for a mock is 57 * 60 = 3420.
// 20+ minutes remaining means timeTakenSeconds <= 37 * 60 = 2220.
const SPEED_DEMON_MAX_SECONDS = 37 * 60;

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_session',
    title: 'First Steps',
    description: 'Complete your first practice session',
    xpReward: 25,
    check: (p) => (p.totalQuestionsAnswered ?? 0) >= 10,
  },
  {
    id: 'perfect_ten',
    title: 'Perfect Ten',
    description: 'Score 10/10 in a practice session',
    xpReward: 50,
    check: (p) => (p.achievements ?? []).includes('perfect_ten_eligible'),
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Complete a mock test with 20+ minutes remaining',
    xpReward: 75,
    check: (p) =>
      (p.mockTestHistory ?? []).some(
        (t) => t.timeTakenSeconds <= SPEED_DEMON_MAX_SECONDS,
      ),
  },
  {
    id: 'road_scholar',
    title: 'Road Scholar',
    description: 'Get all 14 topics above 60% mastery',
    xpReward: 100,
    check: (p) => Object.values(p.topicScores).every((s) => s >= 60),
  },
  {
    id: 'test_ready',
    title: 'Test Ready',
    description: 'Reach a readiness score of 80 or higher',
    xpReward: 150,
    check: (p) => (p.readinessScore ?? 0) >= 80,
  },
  {
    id: 'streak_3',
    title: 'Hat Trick',
    description: 'Study 3 days in a row',
    xpReward: 30,
    check: (p) => (p.studyStreakDays ?? 0) >= 3,
  },
  {
    id: 'streak_7',
    title: 'Week Warrior',
    description: 'Study 7 days in a row',
    xpReward: 75,
    check: (p) => (p.studyStreakDays ?? 0) >= 7,
  },
  {
    id: 'century',
    title: 'Century',
    description: 'Answer 100 questions',
    xpReward: 50,
    check: (p) => (p.totalQuestionsAnswered ?? 0) >= 100,
  },
  {
    id: 'mock_master',
    title: 'Mock Master',
    description: 'Complete 5 mock tests',
    xpReward: 60,
    check: (p) => (p.mockTestHistory ?? []).length >= 5,
  },
  {
    id: 'first_pass',
    title: 'First Pass',
    description: 'Pass a mock test for the first time',
    xpReward: 100,
    check: (p) => (p.mockTestHistory ?? []).some((t) => t.passed),
  },
];

export function checkAchievements(progress: UserProgress): {
  newAchievements: Achievement[];
  updatedProgress: UserProgress;
} {
  const already = new Set(progress.achievements ?? []);
  const newAchievements: Achievement[] = [];
  let updated = { ...progress };

  for (const achievement of ACHIEVEMENTS) {
    if (already.has(achievement.id)) continue;
    if (!achievement.check(updated)) continue;
    newAchievements.push(achievement);
    updated = {
      ...updated,
      achievements: [...(updated.achievements ?? []), achievement.id],
    };
    updated = awardXp(updated, achievement.xpReward);
  }

  return { newAchievements, updatedProgress: updated };
}
