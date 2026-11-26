/**
 * Daily Coach Home view model (P2-1). PURE: no React Native, no storage,
 * no network, no @clearpass/core import (so plain Node can test it — see
 * scripts/lib/homeViewModel.test.mjs).
 *
 * It turns state the app ALREADY computes into what Home shows. It never
 * calculates readiness: the caller passes `readinessScore`
 * (calculateReadiness(progress).score) and `passProbability`
 * (computeAndSavePassProbability) exactly as today's Home does, and the
 * roadmap value is the same `passProbability ?? readinessScore` the
 * current Home feeds to RoadmapPath.
 *
 * Presentation-only rules defined here:
 *  - Journey start: fewer than JOURNEY_START_QUESTIONS answered and no mock
 *    taken -> show "Journey started" instead of an assessed-looking "0% ready".
 *  - Free goal cap: a free learner's daily goals never need more questions
 *    than the free daily limit (FREE_QUESTION_LIMIT, passed in), and a
 *    challenge they can't complete on the free plan is left out.
 *  - Coach: Pip's advice line IS the recommendation, so the CTA acts on it.
 *  - Contextual extras (M1, placement plan in PR #115): a tutor nudge can
 *    supply Pip's headline only when no context rule applies and it fits the
 *    recommendation; Question of the Day and a scheduled mock within 48h are
 *    rows in the Daily goal card; challenge invites and the reminder offer
 *    are the only secondary cards, and at most one shows (invites first).
 */
import { copy, PRO_BENEFITS, topicName } from './homeCopy.ts';
import { formatTestDateTime } from '../scheduledMocks.ts';
import { QOTD_XP } from '../qotd.ts';

export type HomePlatform = 'ios' | 'android' | 'web';
/** Existing Pip artwork poses (apps/mobile/assets/pip). No others exist. */
export type PipPose = 'celebrating' | 'encouraging' | 'neutral' | 'sleepy' | 'streak' | 'teaching' | 'thinking';

export interface HomeProgress {
  totalQuestionsAnswered: number;
  topicScores: Record<string, number>;
  mockTestHistory: ReadonlyArray<{ passed: boolean; score: number; takenAt?: string; total?: number; passMark?: number }>;
  hazardPerceptionHistory: ReadonlyArray<{ passed: boolean }>;
  studyStreakDays: number;
  lastStudied: string;
  testDate: string | null;
  isPro: boolean;
  dailyQuestionsAnswered: number;
  dailyChallenge: {
    date: string; description: string; completed: boolean; currentCount: number; targetCount: number;
    challengeType?: string;
  } | null;
}

export interface HomeInputs {
  now: Date;
  platform: HomePlatform;
  loading: boolean;
  /** Progress failed to load: show the error/retry state. */
  error?: boolean;
  displayName: string | null;
  progress: HomeProgress | null;
  /** calculateReadiness(progress).score — consumed, never recomputed. */
  readinessScore: number;
  /** Existing pass probability (0–100) or null while not yet computed. */
  passProbability: number | null;
  /** Spaced-repetition questions due now. */
  dueReviewCount: number;
  /** hasFreeMockLeft(progress) from src/conversion.ts. */
  freeMockAvailable: boolean;
  /** FREE_QUESTION_LIMIT from src/subscription.ts (10 today). */
  freeDailyQuestionLimit: number;
  /** '@clearpass/has_submitted_result' === 'true' (existing key). */
  testResultSubmitted?: boolean;
  /** Non-dismissed tutor nudges from refreshNudges() (src/tutorNudges.ts), generator order. */
  nudges?: ReadonlyArray<HomeNudge>;
  /** Today's Question of the Day; null/undefined while not yet loaded (row hidden). */
  qotd?: QotdInput | null;
  /** Entries from '@clearpass/scheduled_mock_tests' (the current Home's key). */
  scheduledMocks?: ReadonlyArray<{ id: string; dateTimeIso: string; label: string }>;
  /** useReminderOffer(...).visible (src/components/ReminderOffer.tsx): native, not yet opted in. */
  reminderOfferAvailable?: boolean;
  /** Pending `challenges` rows for this learner (same query as the current Home). */
  pendingChallengeInvites?: number;
}

/** The fields of a TutorNudge the Home uses. */
export interface HomeNudge {
  id: string;
  type: 'struggling_topic' | 'mock_score_dropped' | 'streak_at_risk' | 'milestone_close' | 'ready_for_mock' | 'weak_area_detected' | 'inactivity';
  title: string;
  /** actionParams.topic (struggling_topic only). */
  topic?: string;
}

/** answered: the '@clearpass/qotd_<date>' key exists; correct: the stored option was right. */
export interface QotdInput { answered: boolean; correct: boolean | null }

export type RecommendationId = 'first-practice' | 'test-day' | 'due-review' | 'free-mock' | 'pro-mock' | 'weak-topic' | 'hazard' | 'mixed';
export type CoachIcon = 'school' | 'flag' | 'refresh' | 'clipboard' | 'locate' | 'eye' | 'shuffle';

export interface Coach {
  pose: PipPose;
  headline: string;
  /** Set when the headline came from a tutor nudge: Home shows "Not now", which dismisses it. */
  nudgeId?: string | null;
  advice: string;
  /** null in loading/error states (error shows a retry instead). */
  action: null | { id: RecommendationId; cta: string; route: string; icon: CoachIcon };
}

export interface PlanItem { id: 'questions' | 'challenge' | 'mock' | 'streak'; label: string; detail?: string; done: boolean; route: string }
export interface QuickAction { id: 'mock' | 'hazards' | 'signs' | 'pip'; label: string; route: string; icon: string }

export type Countdown =
  | { kind: 'days'; days: number; title: string; subtitle: string }
  | { kind: 'today'; title: string; subtitle: string }
  | { kind: 'past'; title: string; subtitle: string }
  | { kind: 'none'; title: string; subtitle: string };

export type Upgrade =
  | { kind: 'pro'; eyebrow: string; headline: string; sub: string; benefits: string[]; cta: string; route: '/paywall' }
  | { kind: 'free-mock'; title: string; body: string; cta: string; route: '/(tabs)/mock' };

export interface QotdRow { state: 'open' | 'done'; label: string; detail: string; xp: number; correct: boolean | null }
export interface ScheduledMockRow { id: string; label: string; when: string; route: '/(tabs)/mock' }
export type SecondaryCard =
  | { kind: 'challenge-invites'; count: number; title: string; route: '/challenge' }
  | { kind: 'reminder-offer' };

export interface HomeViewModel {
  state: 'loading' | 'error' | 'new' | 'established';
  greeting: { title: string; subtitle: string };
  countdown: Countdown;
  isPro: boolean;
  roadmap: {
    /** Same number the roadmap gauge shows. */
    value: number;
    journeyStart: boolean;
    badge: string;
    journeyLine: string | null;
    explainer: string;
  };
  coach: Coach;
  dailyPlan: { items: PlanItem[]; completed: number; total: number };
  streak: { days: number; studiedToday: boolean; atRisk: boolean; label: string; note: string };
  quickActions: QuickAction[];
  upgrade: Upgrade | null;
  /** "I passed" / resit prompt: only after the test date (spec §6.1). */
  showTestResultPrompt: boolean;
  /** Question of the Day row inside the Daily goal card (not counted in the goal). */
  qotd: QotdRow | null;
  /** Soonest scheduled mock starting within SCHEDULED_MOCK_WINDOW_HOURS: a Daily goal row. */
  scheduledMock: ScheduledMockRow | null;
  /** At most one secondary contextual card. */
  secondaryCard: SecondaryCard | null;
}

// ─── Date helpers (local calendar days, like the current Home) ──────────────

const DAY_MS = 86_400_000;
function localDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
export function daysBetween(fromIso: string | Date, to: Date): number | null {
  const from = typeof fromIso === 'string' ? new Date(fromIso) : fromIso;
  if (Number.isNaN(from.getTime())) return null;
  return Math.round((localDay(to) - localDay(from)) / DAY_MS);
}
/** Days from now until the test (negative once passed), or null if unset/invalid. */
export function daysUntil(testDateIso: string | null, now: Date): number | null {
  if (!testDateIso) return null;
  const d = daysBetween(testDateIso, now);
  return d === null ? null : -d;
}

export const DAILY_QUESTION_TARGET = 10;
/** Journey-start threshold: below this many answers (and no mock) readiness isn't shown as a score. */
export const JOURNEY_START_QUESTIONS = 10;
const WEAK_TOPIC_THRESHOLD = 70; // same threshold calculateReadiness uses for weak topics
const MOCK_READY_QUESTIONS = 30;
/** A scheduled mock shows on Home only once it is this close. */
export const SCHEDULED_MOCK_WINDOW_HOURS = 48;

/**
 * Can this nudge's title sit above this recommendation without contradicting
 * it? Pip's advice and CTA are the recommendation, so a nudge that points
 * somewhere else is skipped (the next one is tried):
 *  - "Ready for a mock test?" only when the recommendation is a mock;
 *  - a topic nudge only when the recommendation isn't a different topic
 *    (nudges use review accuracy, the recommendation topic scores, so the
 *    two can name different topics).
 */
export function nudgeFitsRecommendation(nudge: HomeNudge, rec: { id: RecommendationId; topic?: string | null }): boolean {
  switch (nudge.type) {
    case 'ready_for_mock':
      return rec.id === 'free-mock' || rec.id === 'pro-mock';
    case 'struggling_topic':
      return rec.id !== 'weak-topic' || (!!nudge.topic && nudge.topic === rec.topic);
    case 'weak_area_detected':
      return rec.id !== 'weak-topic';
    default:
      return true;
  }
}

/** Soonest entry in (now, now + window], or null. */
export function upcomingScheduledMock<T extends { dateTimeIso: string }>(
  list: ReadonlyArray<T>, now: Date, windowHours = SCHEDULED_MOCK_WINDOW_HOURS,
): T | null {
  const start = now.getTime();
  const end = start + windowHours * 3_600_000;
  let best: T | null = null;
  for (const m of list) {
    const t = new Date(m.dateTimeIso).getTime();
    if (Number.isNaN(t) || t <= start || t > end) continue;
    if (!best || t < new Date(best.dateTimeIso).getTime()) best = m;
  }
  return best;
}

export function weakestTopic(scores: Record<string, number>): { key: string; score: number } | null {
  let best: { key: string; score: number } | null = null;
  for (const [key, raw] of Object.entries(scores)) {
    const score = Math.round(raw);
    // Only topics the learner has actually attempted (score > 0).
    if (score <= 0 || score >= WEAK_TOPIC_THRESHOLD) continue;
    if (!best || score < best.score || (score === best.score && key < best.key)) best = { key, score };
  }
  return best;
}

/** Practice route that opens a session on one topic (ui_v2 `topic` param in practice.tsx). */
export const topicPracticeRoute = (topicKey: string) => `/(tabs)/practice?topic=${encodeURIComponent(topicKey)}`;

/**
 * Can a learner complete today's challenge? Pro: always. Free: only if it
 * fits the free daily question limit (correct answers can't exceed questions
 * answered), the free mock is still available for a mock challenge, and not
 * the 20-minute timed challenge (10 questions rarely take 20 minutes).
 */
export function challengeFeasible(
  dc: NonNullable<HomeProgress['dailyChallenge']>,
  opts: { isPro: boolean; freeLimit: number; freeMockAvailable: boolean },
): boolean {
  if (opts.isPro || dc.completed) return true;
  switch (dc.challengeType) {
    case 'mock': return opts.freeMockAvailable;
    case 'timeMinutes': return false;
    case 'topic':
    case 'anyQuestions':
    case 'practiceScore':
    default:
      return dc.targetCount <= opts.freeLimit;
  }
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildHomeViewModel(input: HomeInputs): HomeViewModel {
  const { now, platform, loading, progress: p } = input;
  const isNew = !p || p.totalQuestionsAnswered < 1;
  const state: HomeViewModel['state'] = loading ? 'loading' : input.error ? 'error' : isNew ? 'new' : 'established';
  const isPro = !!p?.isPro;
  const freeLimit = Math.max(1, input.freeDailyQuestionLimit);

  const days = daysUntil(p?.testDate ?? null, now);
  const lastGap = p && p.totalQuestionsAnswered > 0 ? daysBetween(p.lastStudied, now) : null;
  const studiedToday = lastGap === 0;
  const streakDays = p?.studyStreakDays ?? 0;
  const atRisk = streakDays > 0 && !studiedToday;
  const weak = p ? weakestTopic(p.topicScores) : null;
  const lastMock = p && p.mockTestHistory.length > 0 ? p.mockTestHistory[p.mockTestHistory.length - 1]! : null;
  const mockAllowed = isPro || input.freeMockAvailable;
  const answeredToday = studiedToday ? (p?.dailyQuestionsAnswered ?? 0) : 0;

  // Greeting
  const greeting = {
    title: copy.greeting.title(input.displayName),
    subtitle: state === 'loading' ? copy.greeting.loading
      : state === 'error' ? copy.greeting.error
      : state === 'new' ? copy.greeting.new
      : studiedToday ? copy.greeting.studiedToday
      : copy.greeting.default,
  };

  // Countdown
  let countdown: Countdown;
  if (days === null) countdown = { kind: 'none', title: copy.countdown.none, subtitle: copy.countdown.noneSub };
  else if (days < 0) countdown = { kind: 'past', title: copy.countdown.past, subtitle: copy.countdown.pastSub };
  else if (days === 0) countdown = { kind: 'today', title: copy.countdown.today, subtitle: copy.countdown.todaySub };
  else countdown = { kind: 'days', days, title: copy.countdown.days(days), subtitle: copy.countdown.daysSub };

  // Roadmap
  const value = Math.round(Math.max(0, Math.min(100, input.passProbability ?? input.readinessScore)));
  const answered = p?.totalQuestionsAnswered ?? 0;
  const journeyStart = answered < JOURNEY_START_QUESTIONS && (p?.mockTestHistory.length ?? 0) === 0;
  const roadmap = {
    value,
    journeyStart,
    badge: journeyStart ? copy.roadmap.journeyBadge : copy.roadmap.readyBadge(value),
    journeyLine: journeyStart && state !== 'loading' ? copy.roadmap.journeyLine(JOURNEY_START_QUESTIONS - answered) : null,
    explainer: copy.roadmap.explainer,
  };

  // Recommendation: one activity, never something this platform/plan can't do.
  // Hazard perception is native-only and Pro-only; mocks need Pro or the free mock.
  type Rec = { id: RecommendationId; advice: string; cta: string; route: string; icon: CoachIcon; topic?: string };
  let rec: Rec;
  if (isNew) rec = { id: 'first-practice', ...copy.rec.first, route: '/(tabs)/practice', icon: 'school' };
  else if (days !== null && days >= 0 && days <= 1) rec = { id: 'test-day', ...copy.rec.testDay, route: '/testday', icon: 'flag' };
  else if (input.dueReviewCount > 0) rec = { id: 'due-review', ...copy.rec.due(input.dueReviewCount), route: '/(tabs)/practice?mode=review', icon: 'refresh' };
  else if (p!.mockTestHistory.length === 0 && p!.totalQuestionsAnswered >= MOCK_READY_QUESTIONS && mockAllowed) {
    rec = isPro
      ? { id: 'pro-mock', ...copy.rec.proMock, route: '/(tabs)/mock', icon: 'clipboard' }
      : { id: 'free-mock', ...copy.rec.freeMock, route: '/(tabs)/mock', icon: 'clipboard' };
  } else if (weak) rec = { id: 'weak-topic', ...copy.rec.weakTopic(topicName(weak.key), weak.score), route: topicPracticeRoute(weak.key), icon: 'locate', topic: weak.key };
  else if (platform !== 'web' && isPro && !p!.hazardPerceptionHistory.some((h) => h.passed)) {
    rec = { id: 'hazard', ...copy.rec.hazard, route: '/(tabs)/hazard', icon: 'eye' };
  } else if (isPro) rec = { id: 'pro-mock', ...copy.rec.proMock, route: '/(tabs)/mock', icon: 'clipboard' };
  else rec = { id: 'mixed', ...copy.rec.mixed, route: '/(tabs)/practice', icon: 'shuffle' };

  // Coach: headline from context (first rule wins), advice = the recommendation.
  const recPose: Record<RecommendationId, PipPose> = {
    'first-practice': 'teaching', 'test-day': 'encouraging', 'due-review': 'thinking', 'free-mock': 'encouraging',
    'pro-mock': 'encouraging', 'weak-topic': 'thinking', hazard: 'teaching', mixed: 'neutral',
  };
  let coach: Coach;
  if (state === 'loading') coach = { pose: 'sleepy', headline: copy.headline.loading, advice: copy.advice.loading, action: null };
  else if (state === 'error') coach = { pose: 'thinking', headline: copy.headline.error, advice: copy.advice.error, action: null };
  else {
    let headline: string = copy.headline.byRec[rec.id] ?? copy.headline.steady;
    let pose: PipPose = recPose[rec.id];
    let nudgeId: string | null = null;
    // Tutor nudge: only when no context rule below applies (it's the final else).
    const nudge = (input.nudges ?? []).find((n) => nudgeFitsRecommendation(n, rec)) ?? null;
    if (state === 'new') { headline = copy.headline.new; pose = 'teaching'; }
    else if (days === 0) { headline = copy.headline.testDay; pose = 'encouraging'; }
    else if (days !== null && days < 0) { headline = copy.headline.testPast; pose = 'thinking'; }
    else if (lastMock?.passed) { headline = copy.headline.mockPassed; pose = 'celebrating'; }
    else if (atRisk && streakDays >= 2) { headline = copy.headline.streakAtRisk(streakDays); pose = 'streak'; }
    else if (days !== null && days <= 7) { headline = copy.headline.finalWeek(days); pose = 'encouraging'; }
    else if (streakDays >= 7) { headline = copy.headline.streak(streakDays); pose = 'streak'; }
    else if (lastGap !== null && lastGap >= 3) { headline = copy.headline.returning; pose = 'encouraging'; }
    else if (nudge) { headline = nudge.title; nudgeId = nudge.id; }
    coach = { pose, headline, nudgeId, advice: rec.advice, action: { id: rec.id, cta: rec.cta, route: rec.route, icon: rec.icon } };
  }

  // Daily plan from today's local activity. No new stored data.
  const questionTarget = isPro ? DAILY_QUESTION_TARGET : Math.min(DAILY_QUESTION_TARGET, freeLimit);
  const dc = p?.dailyChallenge ?? null;
  // dailyChallenge.date is written as toISOString().split('T')[0] (UTC date) by the current Home.
  const dcToday = dc && dc.date === now.toISOString().split('T')[0] ? dc : null;
  const showChallenge = !!dcToday && challengeFeasible(dcToday, { isPro, freeLimit, freeMockAvailable: input.freeMockAvailable });
  const mockToday = !!p?.mockTestHistory.some((m) => m.takenAt && daysBetween(m.takenAt, now) === 0);
  const items: PlanItem[] = [
    {
      id: 'questions',
      label: copy.plan.questions(questionTarget),
      detail: `${Math.min(answeredToday, questionTarget)} of ${questionTarget}`,
      done: answeredToday >= questionTarget,
      route: '/(tabs)/practice',
    },
  ];
  if (showChallenge) {
    items.push({ id: 'challenge', label: copy.plan.challenge, detail: dcToday!.description, done: !!dcToday!.completed, route: '/(tabs)/practice' });
  }
  if (mockAllowed && !isNew && dcToday?.challengeType !== 'mock') {
    items.push({ id: 'mock', label: copy.plan.mock, done: mockToday, route: '/(tabs)/mock' });
  } else {
    items.push({ id: 'streak', label: streakDays > 0 ? copy.plan.streak : copy.plan.startStreak, done: studiedToday, route: '/(tabs)/practice' });
  }
  const completed = items.filter((i) => i.done).length;

  const quickActions: QuickAction[] = [
    { id: 'mock', label: copy.quick.mock, route: '/(tabs)/mock', icon: 'clipboard-outline' },
    // Hazard perception isn't available on web (spec §6.1): hide the tile.
    ...(platform === 'web' ? [] : [{ id: 'hazards' as const, label: copy.quick.hazards, route: '/(tabs)/hazard', icon: 'play-circle-outline' }]),
    { id: 'signs', label: copy.quick.signs, route: '/roadsigns', icon: 'warning-outline' },
    { id: 'pip', label: copy.quick.pip, route: '/(tabs)/tutor', icon: 'chatbubble-ellipses-outline' },
  ];

  // Upgrade: never for Pro, never before the learner has started.
  let upgrade: Upgrade | null = null;
  if (state === 'established' && !isPro) {
    if (input.freeMockAvailable) {
      if (rec.id !== 'free-mock') upgrade = { kind: 'free-mock', ...copy.freeMock, route: '/(tabs)/mock' };
    } else {
      const scoredMock = lastMock && typeof lastMock.total === 'number' && typeof lastMock.passMark === 'number' ? lastMock : null;
      let headline: string = copy.pro.headline.default;
      let sub: string = copy.pro.sub.default;
      if (answeredToday >= freeLimit) { headline = copy.pro.headline.limitReached(freeLimit); sub = copy.pro.sub.limitReached; }
      else if (days !== null && days >= 0 && days <= 30) { headline = copy.pro.headline.testSoon(days); sub = copy.pro.sub.testSoon; }
      else if (scoredMock && !scoredMock.passed) { headline = copy.pro.headline.mockShort(scoredMock.score, scoredMock.total!, scoredMock.passMark!); sub = copy.pro.sub.mockShort; }
      upgrade = {
        kind: 'pro',
        eyebrow: copy.pro.eyebrow,
        headline,
        sub,
        benefits: PRO_BENEFITS.map((b) => ('web' in b && platform === 'web' ? b.web : b.text(freeLimit))),
        cta: copy.pro.cta,
        route: '/paywall',
      };
    }
  }

  // Contextual extras: never while loading or in the error state.
  const ready = state === 'new' || state === 'established';
  const qotd: QotdRow | null = ready && input.qotd ? (
    input.qotd.answered
      ? { state: 'done', label: copy.qotd.label, detail: input.qotd.correct === null ? copy.qotd.done : input.qotd.correct ? copy.qotd.doneCorrect : copy.qotd.doneWrong, xp: QOTD_XP, correct: input.qotd.correct }
      : { state: 'open', label: copy.qotd.label, detail: copy.qotd.open, xp: QOTD_XP, correct: null }
  ) : null;
  const nextMock = ready ? upcomingScheduledMock(input.scheduledMocks ?? [], now) : null;
  const scheduledMock: ScheduledMockRow | null = nextMock
    ? { id: nextMock.id, label: nextMock.label || copy.scheduled.defaultLabel, when: formatTestDateTime(nextMock.dateTimeIso, now), route: '/(tabs)/mock' }
    : null;
  const invites = input.pendingChallengeInvites ?? 0;
  const secondaryCard: SecondaryCard | null = !ready ? null
    : invites > 0 ? { kind: 'challenge-invites', count: invites, title: copy.invites(invites), route: '/challenge' }
    : input.reminderOfferAvailable ? { kind: 'reminder-offer' }
    : null;

  return {
    state,
    greeting,
    countdown,
    isPro,
    roadmap,
    coach,
    dailyPlan: { items, completed, total: items.length },
    streak: {
      days: streakDays,
      studiedToday,
      atRisk,
      label: copy.streak.label(streakDays),
      note: streakDays === 0 ? copy.streak.zero : atRisk ? copy.streak.atRisk : copy.streak.safe,
    },
    quickActions,
    upgrade,
    showTestResultPrompt: days !== null && days < 0 && !input.testResultSubmitted,
    qotd,
    scheduledMock,
    secondaryCard,
  };
}
