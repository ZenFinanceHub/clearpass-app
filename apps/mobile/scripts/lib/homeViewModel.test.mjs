// Run: node --experimental-strip-types --test scripts/lib/homeViewModel.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import {
  buildHomeViewModel, daysUntil, weakestTopic, challengeFeasible, topicPracticeRoute, JOURNEY_START_QUESTIONS,
  nudgeFitsRecommendation, upcomingScheduledMock, SCHEDULED_MOCK_WINDOW_HOURS,
} from '../../src/home/homeViewModel.ts';
import { qotdIndex, qotdDateKey, qotdStorageKey, QOTD_XP } from '../../src/qotd.ts';
import { futureScheduledMocks, formatTestDateTime } from '../../src/scheduledMocks.ts';
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
    nudges: f.nudges,
    qotd: f.qotd,
    scheduledMocks: f.scheduledMocks,
    reminderOfferAvailable: f.reminderOfferAvailable,
    pendingChallengeInvites: f.pendingChallengeInvites,
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

// ─── M1: contextual Home features ────────────────────────────────────────────

const nudge = (type, title = type, topic) => ({ id: `${type}_x`, type, title, ...(topic ? { topic } : {}) });

test('nudge: supplies the headline only when no context rule applies, with its id for "Not now"', () => {
  const vm = vmFor('nudge');
  assert.equal(vm.coach.action.id, 'weak-topic');
  // ready_for_mock is skipped (recommendation is a topic); the next nudge fits.
  assert.equal(vm.coach.headline, 'Mock score dropped');
  assert.equal(vm.coach.nudgeId, 'mock_score_dropped_fixture');
  // The advice and CTA are still the recommendation.
  assert.match(vm.coach.advice, /Hazard Awareness is your trickiest topic/);
  // No nudges: the default headline, no dismiss.
  const plain = vmFor('established');
  assert.equal(plain.coach.nudgeId, null);
  assert.equal(plain.coach.headline, "Let's sharpen up");
});

test('nudge: every stronger context rule wins over a nudge', () => {
  const f = getFixture('established', NOW);
  const nudges = [nudge('mock_score_dropped', 'Mock score dropped')];
  const cases = [
    ['new', base({ ...f.progress, totalQuestionsAnswered: 0 }, { nudges }), "Hi, I'm Pip!"],
    ['test day', base({ ...f.progress, testDate: new Date(2026, 10, 26, 9).toISOString() }, { nudges }), "It's test day!"],
    ['test past', base({ ...f.progress, testDate: new Date(2026, 10, 20).toISOString() }, { nudges }), 'How did your test go?'],
    ['mock passed', base({ ...f.progress, mockTestHistory: [{ passed: true, score: 23, takenAt: NOW.toISOString() }] }, { nudges }), 'You passed your last mock!'],
    ['streak at risk', base({ ...f.progress, lastStudied: new Date(2026, 10, 25, 20).toISOString() }, { nudges }), 'Keep your 5-day streak going'],
    ['final week', base({ ...f.progress, testDate: new Date(2026, 11, 1).toISOString() }, { nudges }), '5 days to go'],
    ['long streak', base({ ...f.progress, studyStreakDays: 9 }, { nudges }), '9-day streak!'],
  ];
  for (const [label, args, headline] of cases) {
    const vm = buildHomeViewModel(args);
    assert.equal(vm.coach.headline, headline, label);
    assert.equal(vm.coach.nudgeId, null, label);
  }
  // Loading and error never take a nudge.
  assert.equal(vmFor('loading', { nudges }).coach.nudgeId ?? null, null);
  assert.equal(vmFor('error', { nudges }).coach.nudgeId ?? null, null);
});

test('nudge fit rules: mock nudge only above a mock, topic nudges never contradict the topic', () => {
  const weak = { id: 'weak-topic', topic: 'HazardAwareness' };
  assert.equal(nudgeFitsRecommendation(nudge('ready_for_mock'), weak), false);
  assert.equal(nudgeFitsRecommendation(nudge('ready_for_mock'), { id: 'free-mock' }), true);
  assert.equal(nudgeFitsRecommendation(nudge('ready_for_mock'), { id: 'pro-mock' }), true);
  assert.equal(nudgeFitsRecommendation(nudge('struggling_topic', 'x', 'MotorwayRules'), weak), false);
  assert.equal(nudgeFitsRecommendation(nudge('struggling_topic', 'x', 'HazardAwareness'), weak), true);
  assert.equal(nudgeFitsRecommendation(nudge('struggling_topic', 'x', 'MotorwayRules'), { id: 'due-review' }), true);
  assert.equal(nudgeFitsRecommendation(nudge('weak_area_detected'), weak), false);
  assert.equal(nudgeFitsRecommendation(nudge('weak_area_detected'), { id: 'mixed' }), true);
  for (const t of ['mock_score_dropped', 'streak_at_risk', 'milestone_close', 'inactivity']) {
    assert.equal(nudgeFitsRecommendation(nudge(t), weak), true, t);
  }
  // Nothing fits: the default headline.
  const vm = vmFor('established', { nudges: [nudge('ready_for_mock', 'Ready for a mock test?')] });
  assert.equal(vm.coach.nudgeId, null);
  assert.equal(vm.coach.headline, "Let's sharpen up");
});

test('QOTD: open row until answered today, then a done row; hidden while loading, errored or not loaded', () => {
  const open = vmFor('established');
  assert.deepEqual(open.qotd, { state: 'open', label: 'Question of the day', detail: 'Tap to answer', xp: 10, correct: null });
  const wrong = vmFor('qotd-done');
  assert.equal(wrong.qotd.state, 'done');
  assert.equal(wrong.qotd.correct, false);
  assert.equal(wrong.qotd.detail, 'Answered today: not quite');
  assert.equal(vmFor('pro').qotd.detail, 'Answered today: correct');
  assert.equal(vmFor('new').qotd.state, 'open');
  assert.equal(vmFor('loading', { qotd: { answered: false, correct: null } }).qotd, null);
  assert.equal(vmFor('error', { qotd: { answered: false, correct: null } }).qotd, null);
  assert.equal(vmFor('established', { qotd: null }).qotd, null);
  // QOTD isn't a goal item: the goal count is unchanged.
  assert.equal(open.dailyPlan.total, vmFor('established', { qotd: null }).dailyPlan.total);
});

test('QOTD helpers keep the current Home pick, key and XP', () => {
  assert.equal(QOTD_XP, 10);
  assert.equal(qotdDateKey(new Date('2026-11-26T23:30:00Z')), '2026-11-26');
  assert.equal(qotdStorageKey('2026-11-26'), '@clearpass/qotd_2026-11-26');
  // Same arithmetic as before: 20261126 % count.
  assert.equal(qotdIndex('2026-11-26', 1000), 20261126 % 1000);
  assert.equal(qotdIndex('2026-01-05', 777), 20260105 % 777);
});

test('scheduled mock: soonest one within 48h becomes a Daily goal row; none otherwise', () => {
  assert.equal(SCHEDULED_MOCK_WINDOW_HOURS, 48);
  const vm = vmFor('scheduled-mock');
  assert.deepEqual(vm.scheduledMock, { id: 'fixture-sched-1', label: 'Mock Test', when: 'Tomorrow at 18:00', route: '/(tabs)/mock' });
  const at = (h) => ({ id: `h${h}`, dateTimeIso: new Date(NOW.getTime() + h * 3_600_000).toISOString(), label: '' });
  assert.equal(upcomingScheduledMock([at(-1)], NOW), null);
  assert.equal(upcomingScheduledMock([at(49)], NOW), null);
  assert.equal(upcomingScheduledMock([at(48)], NOW).id, 'h48');
  assert.equal(upcomingScheduledMock([at(30), at(2), at(-3)], NOW).id, 'h2');
  assert.equal(upcomingScheduledMock([{ id: 'bad', dateTimeIso: 'nope', label: '' }], NOW), null);
  // An empty label falls back to the current Home's default.
  assert.equal(vmFor('established', { scheduledMocks: [at(3)] }).scheduledMock.label, 'Mock Test');
  assert.equal(vmFor('established').scheduledMock, null);
  assert.equal(vmFor('loading', { scheduledMocks: [at(3)] }).scheduledMock, null);
});

test('scheduled-mock helpers match the current Home', () => {
  const now = new Date(2026, 10, 26, 12);
  assert.equal(formatTestDateTime(new Date(2026, 10, 26, 9, 5).toISOString(), now), 'Today at 09:05');
  assert.equal(formatTestDateTime(new Date(2026, 10, 27, 18).toISOString(), now), 'Tomorrow at 18:00');
  assert.equal(formatTestDateTime(new Date(2026, 11, 3, 7, 30).toISOString(), now), '3 Dec at 07:30');
  const list = [{ dateTimeIso: new Date(2026, 10, 26, 11).toISOString() }, { dateTimeIso: new Date(2026, 10, 26, 13).toISOString() }];
  assert.equal(futureScheduledMocks(list, now).length, 1);
});

test('secondary card: at most one; challenge invites outrank the reminder offer', () => {
  assert.equal(vmFor('established').secondaryCard, null);
  assert.deepEqual(vmFor('reminder-offer').secondaryCard, { kind: 'reminder-offer' });
  assert.deepEqual(vmFor('challenge-invites').secondaryCard, { kind: 'challenge-invites', count: 2, title: '2 friends challenged you', route: '/challenge' });
  assert.equal(vmFor('established', { pendingChallengeInvites: 1 }).secondaryCard.title, 'A friend challenged you');
  for (const s of ['loading', 'error']) {
    assert.equal(vmFor(s, { pendingChallengeInvites: 3, reminderOfferAvailable: true }).secondaryCard, null, s);
  }
  // New learners can get the reminder offer too (the current Home shows it to everyone).
  assert.deepEqual(vmFor('new', { reminderOfferAvailable: true }).secondaryCard, { kind: 'reminder-offer' });
});
