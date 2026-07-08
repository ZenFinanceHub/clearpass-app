import { describe, expect, test } from 'vitest';
import {
  applyCorrectAnswerToChallenge,
  didChallengeJustComplete,
  questionCountsTowardChallenge,
} from './dailyChallenge';
import { DailyChallenge } from './types/DailyChallenge';
import { TopicCategory } from './types/TopicCategory';

function makeChallenge(overrides: Partial<DailyChallenge> = {}): DailyChallenge {
  return {
    date: '2026-07-08',
    description: 'Answer 10 Road Sign questions correctly',
    targetCount: 10,
    currentCount: 0,
    completed: false,
    xpReward: 75,
    challengeType: 'topic',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    ...overrides,
  };
}

describe('questionCountsTowardChallenge', () => {
  test('returns false when there is no active challenge', () => {
    expect(questionCountsTowardChallenge(null, TopicCategory.RoadAndTrafficSigns)).toBe(false);
    expect(questionCountsTowardChallenge(undefined, TopicCategory.RoadAndTrafficSigns)).toBe(false);
  });

  test('returns false when the challenge is already completed', () => {
    const dc = makeChallenge({ completed: true });
    expect(questionCountsTowardChallenge(dc, TopicCategory.RoadAndTrafficSigns)).toBe(false);
  });

  test('returns false for non-topic challenge types', () => {
    const dc = makeChallenge({ challengeType: 'anyQuestions', topicCategory: undefined });
    expect(questionCountsTowardChallenge(dc, TopicCategory.RoadAndTrafficSigns)).toBe(false);
  });

  test('returns false when the question topic does not match the challenge topic', () => {
    const dc = makeChallenge({ topicCategory: TopicCategory.RoadAndTrafficSigns });
    expect(questionCountsTowardChallenge(dc, TopicCategory.HazardAwareness)).toBe(false);
  });

  test('returns true when an in-progress topic challenge matches the question topic', () => {
    const dc = makeChallenge({ topicCategory: TopicCategory.RoadAndTrafficSigns });
    expect(questionCountsTowardChallenge(dc, TopicCategory.RoadAndTrafficSigns)).toBe(true);
  });
});

describe('applyCorrectAnswerToChallenge', () => {
  test('increments currentCount by 1 when the question matches', () => {
    const dc = makeChallenge({ currentCount: 3 });
    const result = applyCorrectAnswerToChallenge(dc, TopicCategory.RoadAndTrafficSigns);
    expect(result.currentCount).toBe(4);
  });

  test('leaves the challenge unchanged when the question does not match', () => {
    const dc = makeChallenge({ currentCount: 3 });
    const result = applyCorrectAnswerToChallenge(dc, TopicCategory.HazardAwareness);
    expect(result).toBe(dc);
  });

  test('marks the challenge completed when the target count is reached', () => {
    const dc = makeChallenge({ currentCount: 9, targetCount: 10 });
    const result = applyCorrectAnswerToChallenge(dc, TopicCategory.RoadAndTrafficSigns);
    expect(result.currentCount).toBe(10);
    expect(result.completed).toBe(true);
  });

  test('does not increment past targetCount', () => {
    const dc = makeChallenge({ currentCount: 10, targetCount: 10, completed: true });
    const result = applyCorrectAnswerToChallenge(dc, TopicCategory.RoadAndTrafficSigns);
    expect(result).toBe(dc);
  });
});

describe('didChallengeJustComplete', () => {
  test('returns true on the transition from incomplete to complete', () => {
    const before = makeChallenge({ currentCount: 9, targetCount: 10, completed: false });
    const after = makeChallenge({ currentCount: 10, targetCount: 10, completed: true });
    expect(didChallengeJustComplete(before, after)).toBe(true);
  });

  test('returns false when the challenge was already complete', () => {
    const before = makeChallenge({ currentCount: 10, targetCount: 10, completed: true });
    const after = makeChallenge({ currentCount: 10, targetCount: 10, completed: true });
    expect(didChallengeJustComplete(before, after)).toBe(false);
  });

  test('returns false when still below target after the update', () => {
    const before = makeChallenge({ currentCount: 3, targetCount: 10, completed: false });
    const after = makeChallenge({ currentCount: 4, targetCount: 10, completed: false });
    expect(didChallengeJustComplete(before, after)).toBe(false);
  });
});
