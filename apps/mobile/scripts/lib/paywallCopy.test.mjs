// Run: node --experimental-strip-types --test scripts/lib/paywallCopy.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { latestScoredMock, mockScoreLine, daysToTest, homeProBannerSub, orderPlans } from '../../src/paywallCopy.ts';

const mock = over => ({ score: 18, passed: false, takenAt: '2026-11-01T10:00:00Z', total: 25, passMark: 22, ...over });
const NOW = new Date(2026, 10, 4, 12); // 4 Nov 2026, local

test('latest mock with a recorded total wins; old entries without one are skipped', () => {
  const old = { score: 40, passed: false };
  assert.equal(latestScoredMock({ mockTestHistory: [old] }), null);
  assert.equal(latestScoredMock({ mockTestHistory: [mock({ score: 15 }), mock({ score: 19 }), old] }).score, 19);
  assert.equal(latestScoredMock(null), null);
});

test('mock score line: short of the pass mark, and passed', () => {
  assert.equal(mockScoreLine({ mockTestHistory: [mock()] }), 'Your last mock: 18/25. You need 22 to pass, 4 more right answers.');
  assert.match(mockScoreLine({ mockTestHistory: [mock({ score: 21 })] }), /1 more right answer\.$/);
  assert.match(mockScoreLine({ mockTestHistory: [mock({ score: 23, passed: true })] }), /^You passed your last mock with 23\/25/);
  assert.equal(mockScoreLine({ mockTestHistory: [] }), null);
});

test('days to test ignores past and invalid dates', () => {
  assert.equal(daysToTest(new Date(2026, 10, 18).toISOString(), NOW), 14);
  assert.equal(daysToTest(new Date(2026, 10, 4).toISOString(), NOW), 0);
  assert.equal(daysToTest(new Date(2026, 9, 1).toISOString(), NOW), null);
  assert.equal(daysToTest('not a date', NOW), null);
  assert.equal(daysToTest(null, NOW), null);
});

test('home banner: test within 30 days first, then a failed mock, then generic', () => {
  const soon = new Date(2026, 10, 18).toISOString();
  const far = new Date(2027, 1, 1).toISOString();
  assert.match(homeProBannerSub({ testDate: soon, mockTestHistory: [mock()] }, NOW), /^Your test is in 14 days\./);
  assert.match(homeProBannerSub({ testDate: new Date(2026, 10, 5).toISOString() }, NOW), /^Your test is tomorrow\./);
  assert.equal(homeProBannerSub({ testDate: far, mockTestHistory: [mock()] }, NOW), 'Last mock 18/25, pass mark 22. Unlimited mocks to close the gap.');
  assert.equal(homeProBannerSub({ mockTestHistory: [mock({ score: 24, passed: true })] }, NOW), 'Unlimited mock tests, hazard perception & questions');
  assert.equal(homeProBannerSub(null, NOW), 'Unlimited mock tests, hazard perception & questions');
});

test('monthly is listed first', () => {
  assert.deepEqual(orderPlans(['quarterly', 'monthly']), ['monthly', 'quarterly']);
  assert.deepEqual(orderPlans(['quarterly']), ['quarterly']);
  assert.deepEqual(orderPlans([]), []);
});
