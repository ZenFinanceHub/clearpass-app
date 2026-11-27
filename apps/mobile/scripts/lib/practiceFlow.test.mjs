// Run via: npm run test:scripts
import test from 'node:test';
import assert from 'node:assert';
import { afterAnswer, canStartSession } from '../../src/practiceFlow.ts';

const LIMIT = 10;
const step = (answeredToday, isPremium, isLastQuestion) =>
  afterAnswer({ answeredToday, limit: LIMIT, isPremium, isLastQuestion });

test('below the limit: next question, or results after the last one', () => {
  assert.deepEqual(step(3, false, false), { phase: 'quiz', limitReached: false });
  assert.deepEqual(step(9, false, false), { phase: 'quiz', limitReached: false });
  assert.deepEqual(step(5, false, true), { phase: 'results', limitReached: false });
});

test('free learner finishing their 10th question sees results, flagged as limit reached', () => {
  assert.deepEqual(step(10, false, false), { phase: 'results', limitReached: true });
  assert.deepEqual(step(10, false, true), { phase: 'results', limitReached: true });
});

test('free learner can never get an 11th question', () => {
  for (let n = LIMIT; n < LIMIT + 5; n++) {
    assert.notEqual(step(n, false, false).phase, 'quiz');
  }
});

test('premium learner is never limited', () => {
  assert.deepEqual(step(10, true, false), { phase: 'quiz', limitReached: false });
  assert.deepEqual(step(25, true, true), { phase: 'results', limitReached: false });
});

test('session start: free learner at the limit is blocked, premium is not', () => {
  assert.equal(canStartSession({ answeredToday: 9, limit: LIMIT, isPremium: false }), true);
  assert.equal(canStartSession({ answeredToday: 10, limit: LIMIT, isPremium: false }), false);
  assert.equal(canStartSession({ answeredToday: 10, limit: LIMIT, isPremium: true }), true);
});
