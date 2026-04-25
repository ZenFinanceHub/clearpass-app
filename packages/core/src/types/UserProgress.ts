import { TopicCategory } from './TopicCategory';
import { MockTestResult } from './MockTestResult';

export interface UserProgress {
  userId: string;
  topicScores: Record<TopicCategory, number>;
  totalQuestionsAnswered: number;
  mockTestHistory: MockTestResult[];
  readinessScore: number;
  lastStudied: string;
  studyStreakDays: number;
}
