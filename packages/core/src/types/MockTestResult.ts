import { TopicCategory } from './TopicCategory';

export interface MockTestResult {
  id: string;
  score: number;
  passed: boolean;
  takenAt: string;
  timeTakenSeconds: number;
  topicBreakdown: Record<TopicCategory, number>;
  // Optional: absent on history entries recorded before pause tracking
  // existed. Undefined must never be treated as/rendered as zero.
  pauseCount?: number;
  pausedSeconds?: number;
  // Optional: absent on history entries recorded before session length
  // varied (Standard 50 vs Quick 25) was tracked per result. Consumers that
  // assume a fixed total must fall back explicitly, not treat undefined as 50.
  total?: number;
  passMark?: number;
}
