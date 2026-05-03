import { TopicCategory } from './TopicCategory';
import { MockTestResult } from './MockTestResult';
import { DailyChallenge } from './DailyChallenge';
import { HazardSessionResult } from './HazardClip';

export interface UserProgress {
  userId: string;
  topicScores: Record<TopicCategory, number>;
  totalQuestionsAnswered: number;
  mockTestHistory: MockTestResult[];
  readinessScore: number;
  lastStudied: string;
  studyStreakDays: number;
  xp: number;
  achievements: string[];
  dailyChallenge: DailyChallenge | null;
  testDate: string | null;
  battleModeHistory: { date: string; score: number; topicsUsed: string[] }[];
  isPro: boolean;
  dailyQuestionsAnswered: number;
  hazardPerceptionHistory: HazardSessionResult[];
}
