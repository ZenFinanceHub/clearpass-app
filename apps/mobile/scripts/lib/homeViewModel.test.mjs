// Run: node --experimental-strip-types --test scripts/lib/homeViewModel.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { buildHomeViewModel, daysUntil, weakestTopic } from '../../src/home/homeViewModel.ts';
import { getFixture, FIXTURE_NAMES } from '../../src/home/homeFixtures.ts';
import { hasFreeMockLeft } from './homeTestHelpers.mjs';

const NOW = new Date(2026, 10, 26, 12); // 26 Nov 2026, local noon
const POSES = new Set(['celebrating', 'encouraging', 'neutral', 'sleepy', 'streak', 'teaching', 'thinking']);

function vmFor(name, over = {}) {
  const f = getFixture(name, NOW);
  return buildHomeViewModel({
    now: NOW,
    platform: 'ios',
    loading: f.loading,
    displayName: f.displayName,
    progress: f.progress,
    readinessScore: 40,
    passProbability: null,
    dueReviewCount: f.dueReviewCount,
    freeMockAvailable: hasFreeMockLeft(f.progress),
    ...over,
  });
}

test('every fixture builds, uses only existing Pip poses and existing routes', () => {
  for (const name of FIXTURE_NAMES) {
    for (const platform of ['ios', 'android', 'web']) {
      const vm = vmFor(name, { platform });
      assert.ok(POSES.has(vm.pip.pose), `${name}: ${vm.pip.pose}`);
      assert.ok(vm.recommendation.route.startsWith('/'));
      assert.equal(vm.dailyPlan.total, 3);
      assert.ok(vm.dailyPlan.completed >= 0 && vm.dailyPlan.completed <= 3);
    }
  }
});

test('loading state', () => {
  const vm = vmFor('loading');
  assert.equal(vm.state, 'loading');
  assert.equal(vm.pip.pose, 'sleepy');
  assert.equal(vm.upgrade, null);
});

test('new learner: first practice, teaching Pip, countdown, no upgrade nag', () => {
  const vm = vmFor('new', { readinessScore: 0 });
  assert.equal(vm.state, 'new');
  assert.equal(vm.greeting.title, 'Hi Sam');
  assert.equal(vm.recommendation.id, 'first-practice');
  assert.equal(vm.recommendation.route, '/(tabs)/practice');
  assert.equal(vm.pip.pose, 'teaching');
  assert.deepEqual(vm.countdown, { kind: 'days', days: 42, title: '42 days', subtitle: 'until your test' });
  assert.equal(vm.upgrade, null);
  assert.equal(vm.dailyPlan.items[2].id, 'streak');
});

test('established free learner: weakest attempted topic, Go Pro once free mock is used', () => {
  const vm = vmFor('established');
  assert.equal(vm.state, 'established');
  assert.equal(vm.recommendation.id, 'weak-topic');
  assert.match(vm.recommendation.title, /Hazard Awareness/);
  assert.match(vm.recommendation.description, /58%/);
  assert.equal(vm.streak.days, 5);
  assert.equal(vm.streak.studiedToday, true);
  assert.equal(vm.countdown.kind, 'days');
  assert.equal(vm.upgrade?.kind, 'pro');
  assert.equal(vm.upgrade?.route, '/paywall');
  // 6 of 10 questions, challenge not done, free mock used -> streak item (studied today)
  assert.deepEqual(vm.dailyPlan.items.map((i) => [i.id, i.done]), [['questions', false], ['challenge', false], ['streak', true]]);
  assert.equal(vm.dailyPlan.completed, 1);
  assert.equal(vm.dailyPlan.items[1].detail, 'Answer 5 Safety Margins questions');
});

test('pro learner: celebrating after a passed mock, no upgrade, mock in the plan', () => {
  const vm = vmFor('pro', { readinessScore: 88 });
  assert.equal(vm.isPro, true);
  assert.equal(vm.pip.pose, 'celebrating');
  assert.equal(vm.upgrade, null);
  assert.equal(vm.dailyPlan.items[2].id, 'mock');
  assert.equal(vm.dailyPlan.items[0].done, true);
  assert.equal(vm.dailyPlan.items[1].done, true);
  // All topics >= 70 and hazard passed -> a mock is the next step.
  assert.equal(vm.recommendation.id, 'pro-mock');
});

test('no test date: optional prompt, returning-learner Pip, free mock recommended', () => {
  const vm = vmFor('no-test-date');
  assert.equal(vm.countdown.kind, 'none');
  assert.equal(vm.countdown.subtitle, 'Optional');
  assert.equal(vm.pip.pose, 'encouraging');
  assert.equal(vm.pip.title, 'Welcome back!');
  assert.equal(vm.recommendation.id, 'free-mock');
  assert.match(vm.recommendation.description, /25 questions in 28 minutes/);
  assert.match(vm.recommendation.description, /22/);
  // Not studied today: yesterday's dailyQuestionsAnswered must not count.
  assert.equal(vm.dailyPlan.items[0].done, false);
  assert.equal(vm.streak.studiedToday, false);
});

test('hazard perception is never offered on web', () => {
  const f = getFixture('pro', NOW);
  const progress = { ...f.progress, hazardPerceptionHistory: [], mockTestHistory: [{ passed: false, score: 30, takenAt: f.progress.mockTestHistory[0].takenAt }] };
  const base = { now: NOW, loading: false, displayName: 'J', progress, readinessScore: 70, passProbability: null, dueReviewCount: 0, freeMockAvailable: false };
  assert.equal(buildHomeViewModel({ ...base, platform: 'ios' }).recommendation.id, 'hazard');
  const web = buildHomeViewModel({ ...base, platform: 'web' });
  assert.notEqual(web.recommendation.id, 'hazard');
  assert.ok(!web.quickActions.some((q) => q.id === 'hazards'));
  assert.ok(buildHomeViewModel({ ...base, platform: 'android' }).quickActions.some((q) => q.id === 'hazards'));
});

test('free learners without the free mock are never sent to a mock or hazards', () => {
  const f = getFixture('established', NOW);
  const progress = { ...f.progress, topicScores: Object.fromEntries(Object.keys(f.progress.topicScores).map((k) => [k, 90])) };
  const vm = buildHomeViewModel({ now: NOW, platform: 'ios', loading: false, displayName: null, progress, readinessScore: 80, passProbability: null, dueReviewCount: 0, freeMockAvailable: false });
  assert.equal(vm.recommendation.id, 'mixed');
  assert.equal(vm.greeting.title, 'Hi there');
});

test('due reviews and test day take priority', () => {
  assert.equal(vmFor('established', { dueReviewCount: 7 }).recommendation.id, 'due-review');
  assert.match(vmFor('established', { dueReviewCount: 1 }).recommendation.title, /^Review 1 due question$/);
  const f = getFixture('established', NOW);
  const today = buildHomeViewModel({
    now: NOW, platform: 'ios', loading: false, displayName: 'A', readinessScore: 60, passProbability: null,
    dueReviewCount: 3, freeMockAvailable: false, progress: { ...f.progress, testDate: new Date(2026, 10, 26, 9).toISOString() },
  });
  assert.equal(today.countdown.kind, 'today');
  assert.equal(today.recommendation.id, 'test-day');
  assert.equal(today.pip.pose, 'encouraging');
  assert.equal(today.showTestResultPrompt, false);
});

test('test result prompt only after the test date and until submitted', () => {
  const f = getFixture('established', NOW);
  const past = { ...f.progress, testDate: new Date(2026, 10, 20).toISOString() };
  const args = { now: NOW, platform: 'ios', loading: false, displayName: 'A', readinessScore: 60, passProbability: null, dueReviewCount: 0, freeMockAvailable: false, progress: past };
  const vm = buildHomeViewModel(args);
  assert.equal(vm.countdown.kind, 'past');
  assert.equal(vm.showTestResultPrompt, true);
  assert.equal(buildHomeViewModel({ ...args, testResultSubmitted: true }).showTestResultPrompt, false);
  assert.equal(vmFor('established').showTestResultPrompt, false);
});

test('roadmap value is the existing pass probability, else readiness — never recomputed', () => {
  assert.equal(vmFor('established', { readinessScore: 47, passProbability: null }).roadmapValue, 47);
  assert.equal(vmFor('established', { readinessScore: 47, passProbability: 63.4 }).roadmapValue, 63);
  assert.equal(vmFor('established', { readinessScore: 130 }).roadmapValue, 100);
});

test('streak at risk', () => {
  const f = getFixture('established', NOW);
  const vm = buildHomeViewModel({
    now: NOW, platform: 'ios', loading: false, displayName: 'A', readinessScore: 50, passProbability: null, dueReviewCount: 0,
    freeMockAvailable: false, progress: { ...f.progress, lastStudied: new Date(2026, 10, 25, 20).toISOString() },
  });
  assert.equal(vm.streak.atRisk, true);
  assert.equal(vm.pip.pose, 'streak');
  assert.match(vm.pip.title, /5-day streak/);
});

test('helpers', () => {
  assert.equal(daysUntil(null, NOW), null);
  assert.equal(daysUntil('nope', NOW), null);
  assert.equal(daysUntil(new Date(2026, 10, 27, 23).toISOString(), NOW), 1);
  assert.deepEqual(weakestTopic({ A: 0, B: 65, C: 50, D: 90 }), { key: 'C', score: 50 });
  assert.equal(weakestTopic({ A: 0, B: 90 }), null);
});
