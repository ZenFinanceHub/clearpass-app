// Run: node --experimental-strip-types --test scripts/lib/homeViewModel.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import {
  buildHomeViewModel, daysUntil, weakestTopic, challengeFeasible, topicPracticeRoute, JOURNEY_START_QUESTIONS,
} from '../../src/home/homeViewModel.ts';
import { getFixture, FIXTURE_NAMES } from '../../src/home/homeFixtures.ts';
import { hasFreeMockLeft, FREE_QUESTION_LIMIT } from './homeTestHelpers.mjs';

const NOW = new Date(2026, 10, 26, 12); // 26 Nov 2026, local noon
const TODAY_UTC = NOW.toISOString().split('T')[0];
const POSES = new Set(['celebrating', 'encouraging', 'neutral', 'sleepy', 'streak', 'teaching', 'thinking']);

function vmFor(name, over = {}) {
  const f = getFixture(name, NOW);
  return buildHomeViewModel({
    now: NOW,
    platform: 'ios',
    loading: f.loading,
    error: f.error,
    displayName: f.displayName,
    progress: f.progress,
    readinessScore: 40,
    passProbability: null,
    dueReviewCount: f.dueReviewCount,
    freeMockAvailable: hasFreeMockLeft(f.progress),
    freeDailyQuestionLimit: FREE_QUESTION_LIMIT,
    ...over,
  });
}
const base = (progress, over = {}) => ({
  now: NOW, platform: 'ios', loading: false, displayName: 'A', progress, readinessScore: 60, passProbability: null,
  dueReviewCount: 0, freeMockAvailable: false, freeDailyQuestionLimit: FREE_QUESTION_LIMIT, ...over,
});

test('every fixture builds, uses only existing Pip poses and routes', () => {
  for (const name of FIXTURE_NAMES) {
    for (const platform of ['ios', 'android', 'web']) {
      const vm = vmFor(name, { platform });
      assert.ok(POSES.has(vm.coach.pose), `${name}: ${vm.coach.pose}`);
      if (vm.coach.action) assert.ok(vm.coach.action.route.startsWith('/'));
      assert.ok(vm.dailyPlan.total >= 2 && vm.dailyPlan.total <= 3);
      assert.ok(vm.dailyPlan.completed >= 0 && vm.dailyPlan.completed <= vm.dailyPlan.total);
    }
  }
});

test('loading and error states: no action, no upgrade', () => {
  const loading = vmFor('loading');
  assert.equal(loading.state, 'loading');
  assert.equal(loading.coach.pose, 'sleepy');
  assert.equal(loading.coach.action, null);
  assert.equal(loading.upgrade, null);
  const err = vmFor('error');
  assert.equal(err.state, 'error');
  assert.equal(err.coach.action, null);
  assert.match(err.coach.advice, /try again/i);
  assert.equal(err.upgrade, null);
});

test('new learner: first practice, teaching Pip, countdown, journey start, no upgrade', () => {
  const vm = vmFor('new', { readinessScore: 0 });
  assert.equal(vm.state, 'new');
  assert.equal(vm.greeting.title, 'Hi Sam');
  assert.equal(vm.coach.action.id, 'first-practice');
  assert.equal(vm.coach.action.route, '/(tabs)/practice');
  assert.equal(vm.coach.pose, 'teaching');
  assert.deepEqual(vm.countdown, { kind: 'days', days: 42, title: '42 days', subtitle: 'to your test' });
  assert.equal(vm.upgrade, null);
  assert.equal(vm.roadmap.journeyStart, true);
  assert.equal(vm.roadmap.badge, 'Journey started');
  assert.match(vm.roadmap.journeyLine, /Answer 10 more questions/);
  assert.equal(vm.streak.label, 'Start today');
  assert.match(vm.streak.note, /starts with one set/);
});

test('journey-start threshold: < 10 answers and no mock; a mock or 10 answers ends it', () => {
  const f = getFixture('new', NOW);
  const at = (n, mocks = []) => buildHomeViewModel(base({ ...f.progress, totalQuestionsAnswered: n, mockTestHistory: mocks }, { readinessScore: 3 })).roadmap;
  assert.equal(JOURNEY_START_QUESTIONS, 10);
  assert.equal(at(0).journeyStart, true);
  assert.equal(at(9).journeyStart, true);
  assert.match(at(9).journeyLine, /Answer 1 more question to/);
  assert.equal(at(10).journeyStart, false);
  assert.equal(at(10).badge, '3% ready');
  assert.equal(at(10).journeyLine, null);
  assert.equal(at(3, [{ passed: false, score: 10, takenAt: NOW.toISOString() }]).journeyStart, false);
});

test('established free learner: Pip advice and CTA name the same weakest topic, which opens directly', () => {
  const vm = vmFor('established');
  assert.equal(vm.state, 'established');
  assert.equal(vm.coach.action.id, 'weak-topic');
  assert.match(vm.coach.advice, /Hazard Awareness is your trickiest topic at 58%/);
  assert.equal(vm.coach.action.cta, 'Practise Hazard Awareness');
  assert.equal(vm.coach.action.route, '/(tabs)/practice?topic=HazardAwareness');
  assert.equal(vm.coach.pose, 'thinking');
  assert.equal(vm.roadmap.journeyStart, false);
  assert.equal(vm.roadmap.badge, '40% ready');
  assert.equal(vm.streak.studiedToday, true);
  // 6 of 10 questions; topic challenge (5) fits the free limit; free mock used -> streak item.
  assert.deepEqual(vm.dailyPlan.items.map((i) => [i.id, i.done]), [['questions', false], ['challenge', false], ['streak', true]]);
  assert.equal(vm.dailyPlan.items[0].label, 'Answer 10 questions');
});

test('topic route helper encodes the key', () => {
  assert.equal(topicPracticeRoute('RoadAndTrafficSigns'), '/(tabs)/practice?topic=RoadAndTrafficSigns');
});

test('Go Pro: shown to established free learners without the free mock, personalised, never to Pro', () => {
  const vm = vmFor('established');
  assert.equal(vm.upgrade.kind, 'pro');
  assert.equal(vm.upgrade.route, '/paywall');
  assert.equal(vm.upgrade.headline, 'Your test is in 21 days');
  assert.ok(vm.upgrade.benefits.some((b) => /Unlimited practice questions \(free: 10 a day\)/.test(b)));
  assert.ok(vm.upgrade.benefits.some((b) => /Hazard perception clips, scored/.test(b)));
  const web = vmFor('established', { platform: 'web' });
  assert.ok(web.upgrade.benefits.some((b) => /in the iOS and Android app/.test(b)));
  // Pro: never.
  assert.equal(vmFor('pro').upgrade, null);
  // New / loading / error: never.
  assert.equal(vmFor('new').upgrade, null);
  // Free mock still unused: the free mock is the offer, not Pro.
  assert.equal(vmFor('no-test-date').upgrade, null); // free mock is already the recommendation
  const f = getFixture('established', NOW);
  const withMock = buildHomeViewModel(base({ ...f.progress, mockTestHistory: [] }, { freeMockAvailable: true }));
  assert.equal(withMock.coach.action.id, 'free-mock');
  assert.equal(withMock.upgrade, null);
  // Free mock unused but something else recommended: the soft free-mock card, still not Pro.
  const withMockDue = buildHomeViewModel(base({ ...f.progress, mockTestHistory: [] }, { freeMockAvailable: true, dueReviewCount: 4 }));
  assert.equal(withMockDue.upgrade.kind, 'free-mock');
});

test('Go Pro headline priority: daily limit reached, then test soon, then last mock', () => {
  const f = getFixture('established', NOW);
  const limit = buildHomeViewModel(base({ ...f.progress, dailyQuestionsAnswered: 10 }));
  assert.equal(limit.upgrade.headline, "You've used today's 10 free questions");
  const noDate = buildHomeViewModel(base({ ...f.progress, testDate: null }));
  assert.equal(noDate.upgrade.headline, 'Last mock 19/25. Pass mark 22.');
  const nothing = buildHomeViewModel(base({ ...f.progress, testDate: null, mockTestHistory: [{ passed: false, score: 30, takenAt: NOW.toISOString() }] }));
  assert.equal(nothing.upgrade.headline, 'Get test-ready faster');
});

test('free goal cap: goals never need more than the free daily limit', () => {
  const f = getFixture('established', NOW);
  const dc = (challengeType, targetCount) => ({ date: TODAY_UTC, description: 'x', completed: false, currentCount: 0, targetCount, challengeType });
  // 15-question challenge is impossible on 10 free questions: left out for free, kept for Pro.
  const free15 = buildHomeViewModel(base({ ...f.progress, dailyChallenge: dc('anyQuestions', 15) }));
  assert.ok(!free15.dailyPlan.items.some((i) => i.id === 'challenge'));
  const pro15 = buildHomeViewModel(base({ ...f.progress, isPro: true, dailyChallenge: dc('anyQuestions', 15) }));
  assert.ok(pro15.dailyPlan.items.some((i) => i.id === 'challenge'));
  // Question goal is capped at the free limit.
  const tight = buildHomeViewModel(base(f.progress, { freeDailyQuestionLimit: 5 }));
  assert.equal(tight.dailyPlan.items[0].label, 'Answer 5 questions');
  for (const item of free15.dailyPlan.items) assert.ok(!/Answer (1[1-9]|[2-9]\d)/.test(item.label));
  // Feasibility rules.
  const o = { isPro: false, freeLimit: 10, freeMockAvailable: false };
  assert.equal(challengeFeasible(dc('topic', 10), o), true);
  assert.equal(challengeFeasible(dc('practiceScore', 8), o), true);
  assert.equal(challengeFeasible(dc('timeMinutes', 20), o), false);
  assert.equal(challengeFeasible(dc('mock', 1), o), false);
  assert.equal(challengeFeasible(dc('mock', 1), { ...o, freeMockAvailable: true }), true);
  assert.equal(challengeFeasible({ ...dc('anyQuestions', 15), completed: true }, o), true);
});

test('pro learner: celebrating after a passed mock, mock in the plan, no upgrade', () => {
  const vm = vmFor('pro', { readinessScore: 88 });
  assert.equal(vm.isPro, true);
  assert.equal(vm.coach.pose, 'celebrating');
  assert.equal(vm.coach.headline, 'You passed your last mock!');
  assert.equal(vm.coach.action.id, 'pro-mock');
  assert.equal(vm.upgrade, null);
  assert.deepEqual(vm.dailyPlan.items.map((i) => [i.id, i.done]), [['questions', true], ['challenge', true], ['mock', false]]);
});

test('no test date: optional prompt, returning-learner headline, free mock is the action', () => {
  const vm = vmFor('no-test-date');
  assert.equal(vm.countdown.kind, 'none');
  assert.equal(vm.countdown.subtitle, 'Optional');
  assert.equal(vm.coach.headline, 'Welcome back!');
  assert.equal(vm.coach.action.id, 'free-mock');
  assert.match(vm.coach.advice, /25 questions in 28 minutes, pass mark 22/);
  assert.equal(vm.dailyPlan.items[0].done, false);
  assert.equal(vm.streak.studiedToday, false);
});

test('hazard perception is never offered on web or to free learners', () => {
  const f = getFixture('pro', NOW);
  const progress = { ...f.progress, hazardPerceptionHistory: [], mockTestHistory: [{ passed: false, score: 30, takenAt: f.progress.mockTestHistory[0].takenAt }] };
  assert.equal(buildHomeViewModel(base(progress, { platform: 'ios' })).coach.action.id, 'hazard');
  const web = buildHomeViewModel(base(progress, { platform: 'web' }));
  assert.notEqual(web.coach.action.id, 'hazard');
  assert.ok(!web.quickActions.some((q) => q.id === 'hazards'));
  assert.notEqual(buildHomeViewModel(base({ ...progress, isPro: false }, { platform: 'ios' })).coach.action.id, 'hazard');
});

test('free learners without the free mock are never sent to a mock', () => {
  const f = getFixture('established', NOW);
  const progress = { ...f.progress, topicScores: Object.fromEntries(Object.keys(f.progress.topicScores).map((k) => [k, 90])) };
  const vm = buildHomeViewModel(base(progress, { displayName: null }));
  assert.equal(vm.coach.action.id, 'mixed');
  assert.equal(vm.greeting.title, 'Hi there');
});

test('due reviews open review mode; test day takes priority', () => {
  const due = vmFor('established', { dueReviewCount: 7 });
  assert.equal(due.coach.action.id, 'due-review');
  assert.equal(due.coach.action.route, '/(tabs)/practice?mode=review');
  assert.match(vmFor('established', { dueReviewCount: 1 }).coach.advice, /^1 question is due/);
  const f = getFixture('established', NOW);
  const today = buildHomeViewModel(base({ ...f.progress, testDate: new Date(2026, 10, 26, 9).toISOString() }, { dueReviewCount: 3 }));
  assert.equal(today.countdown.kind, 'today');
  assert.equal(today.coach.action.id, 'test-day');
  assert.equal(today.coach.pose, 'encouraging');
  assert.equal(today.showTestResultPrompt, false);
});

test('test result prompt only after the test date and until submitted', () => {
  const f = getFixture('established', NOW);
  const args = base({ ...f.progress, testDate: new Date(2026, 10, 20).toISOString() });
  const vm = buildHomeViewModel(args);
  assert.equal(vm.countdown.kind, 'past');
  assert.equal(vm.showTestResultPrompt, true);
  assert.equal(buildHomeViewModel({ ...args, testResultSubmitted: true }).showTestResultPrompt, false);
  assert.equal(vmFor('established').showTestResultPrompt, false);
});

test('roadmap value is the existing pass probability, else readiness — never recomputed', () => {
  assert.equal(vmFor('established', { readinessScore: 47, passProbability: null }).roadmap.value, 47);
  assert.equal(vmFor('established', { readinessScore: 47, passProbability: 63.4 }).roadmap.value, 63);
  assert.equal(vmFor('established', { readinessScore: 130 }).roadmap.value, 100);
});

test('streak at risk', () => {
  const f = getFixture('established', NOW);
  const vm = buildHomeViewModel(base({ ...f.progress, lastStudied: new Date(2026, 10, 25, 20).toISOString() }));
  assert.equal(vm.streak.atRisk, true);
  assert.equal(vm.coach.pose, 'streak');
  assert.match(vm.coach.headline, /5-day streak/);
});

test('test helpers match the real free limits (drift guard)', async () => {
  const { readFile } = await import('node:fs/promises');
  const sub = await readFile(new URL('../../src/subscription.ts', import.meta.url), 'utf8');
  const conv = await readFile(new URL('../../src/conversion.ts', import.meta.url), 'utf8');
  assert.match(sub, new RegExp(`export const FREE_QUESTION_LIMIT = ${FREE_QUESTION_LIMIT};`));
  assert.match(conv, /export const FREE_MOCK_ALLOWANCE = 1;/);
});

test('helpers', () => {
  assert.equal(daysUntil(null, NOW), null);
  assert.equal(daysUntil('nope', NOW), null);
  assert.equal(daysUntil(new Date(2026, 10, 27, 23).toISOString(), NOW), 1);
  assert.deepEqual(weakestTopic({ A: 0, B: 65, C: 50, D: 90 }), { key: 'C', score: 50 });
  assert.equal(weakestTopic({ A: 0, B: 90 }), null);
});
