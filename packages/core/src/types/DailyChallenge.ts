export type DailyChallengeType =
  | 'topic'
  | 'mock'
  | 'practiceScore'
  | 'anyQuestions'
  | 'timeMinutes';

export interface DailyChallenge {
  date: string;
  description: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  xpReward: number;
  challengeType: DailyChallengeType;
  topicCategory?: string;
}
