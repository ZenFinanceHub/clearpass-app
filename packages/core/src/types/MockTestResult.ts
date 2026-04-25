import { TopicCategory } from './TopicCategory';

export interface MockTestResult {
  id: string;
  score: number;
  passed: boolean;
  takenAt: string;
  timeTakenSeconds: number;
  topicBreakdown: Record<TopicCategory, number>;
}
