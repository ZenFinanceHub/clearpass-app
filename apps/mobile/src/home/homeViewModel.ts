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
 * The recommendation and Pip choices are simple, deterministic rules. They
 * change no data. (The tracker's fuller engine in packages/core is M1.)
 */
import { copy, topicName } from './homeCopy.ts';

export type HomePlatform = 'ios' | 'android' | 'web';
/** Existing Pip artwork poses (apps/mobile/assets/pip). No others exist. */
export type PipPose = 'celebrating' | 'encouraging' | 'neutral' | 'sleepy' | 'streak' | 'teaching' | 'thinking';

export interface HomeProgress {
  totalQuestionsAnswered: number;
  topicScores: Record<string, number>;
  mockTestHistory: ReadonlyArray<{ passed: boolean; score: number; takenAt?: string }>;
  hazardPerceptionHistory: ReadonlyArray<{ passed: boolean }>;
  studyStreakDays: number;
  lastStudied: string;
  testDate: string | null;
  isPro: boolean;
  dailyQuestionsAnswered: number;
  dailyChallenge: { date: string; description: string; completed: boolean; currentCount: number; targetCount: number } | null;
}

export interface HomeInputs {
  now: Date;
  platform: HomePlatform;
  loading: boolean;
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
  /** '@clearpass/has_submitted_result' === 'true' (existing key). */
  testResultSubmitted?: boolean;
}

export type HomeRoute =
  | '/(tabs)/practice'
  | '/(tabs)/mock'
  | '/(tabs)/hazard'
  | '/(tabs)/tutor'
  | '/roadsigns'
  | '/testday'
  | '/paywall'
  | '/ipassed';

export type RecommendationId = 'first-practice' | 'test-day' | 'due-review' | 'free-mock' | 'pro-mock' | 'weak-topic' | 'hazard' | 'mixed';

export interface Recommendation {
  id: RecommendationId;
  title: string;
  description: string;
  cta: string;
  route: HomeRoute;
  icon: 'school' | 'flag' | 'refresh' | 'clipboard' | 'locate' | 'eye' | 'shuffle';
}

export interface PlanItem { id: 'questions' | 'challenge' | 'mock' | 'streak'; label: string; detail?: string; done: boolean; route: HomeRoute }

export interface QuickAction { id: 'mock' | 'hazards' | 'signs' | 'pip'; label: string; route: HomeRoute; icon: string }

export type Countdown =
  | { kind: 'days'; days: number; title: string; subtitle: string }
  | { kind: 'today'; title: string; subtitle: string }
  | { kind: 'past'; title: string; subtitle: string }
  | { kind: 'none'; title: string; subtitle: string };

export interface HomeViewModel {
  state: 'loading' | 'new' | 'established';
  greeting: { title: string; subtitle: string };
  countdown: Countdown;
  isPro: boolean;
  /** Same number the roadmap gauge shows ("% ready"). */
  roadmapValue: number;
  pip: { pose: PipPose; title: string; message: string };
  recommendation: Recommendation;
  dailyPlan: { items: PlanItem[]; completed: number; total: number };
  streak: { days: number; studiedToday: boolean; atRisk: boolean; label: string; note: string };
  quickActions: QuickAction[];
  upgrade: null | { kind: 'free-mock' | 'pro'; title: string; route: HomeRoute };
  /** "I passed" / resit prompt: only on or after the test date (spec §6.1). */
  showTestResultPrompt: boolean;
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

const DAILY_QUESTION_TARGET = 10;
const WEAK_TOPIC_THRESHOLD = 70; // same threshold calculateReadiness uses for weak topics
const MOCK_READY_QUESTIONS = 30;

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

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildHomeViewModel(input: HomeInputs): HomeViewModel {
  const { now, platform, loading, progress: p } = input;
  const isNew = !p || p.totalQuestionsAnswered < 1;
  const state: HomeViewModel['state'] = loading ? 'loading' : isNew ? 'new' : 'established';
  const isPro = !!p?.isPro;

  const days = daysUntil(p?.testDate ?? null, now);
  const lastGap = p && p.totalQuestionsAnswered > 0 ? daysBetween(p.lastStudied, now) : null;
  const studiedToday = lastGap === 0;
  const streakDays = p?.studyStreakDays ?? 0;
  const atRisk = streakDays > 0 && !studiedToday;
  const weak = p ? weakestTopic(p.topicScores) : null;
  const lastMock = p && p.mockTestHistory.length > 0 ? p.mockTestHistory[p.mockTestHistory.length - 1]! : null;
  const mockAllowed = isPro || input.freeMockAvailable;
  const roadmapValue = Math.round(Math.max(0, Math.min(100, input.passProbability ?? input.readinessScore)));

  // Greeting
  const greeting = {
    title: copy.greeting.title(input.displayName),
    subtitle: state === 'loading' ? copy.greeting.loading
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

  // Pip (first matching rule wins)
  let pip: HomeViewModel['pip'];
  if (state === 'loading') pip = { pose: 'sleepy', ...copy.pip.loading };
  else if (state === 'new') pip = { pose: 'teaching', ...copy.pip.new };
  else if (days === 0) pip = { pose: 'encouraging', ...copy.pip.testDay };
  else if (days !== null && days < 0) pip = { pose: 'thinking', ...copy.pip.testPast };
  else if (lastMock?.passed) pip = { pose: 'celebrating', ...copy.pip.mockPassed };
  else if (atRisk && streakDays >= 2) pip = { pose: 'streak', ...copy.pip.streakAtRisk(streakDays) };
  else if (days !== null && days <= 7) pip = { pose: 'encouraging', ...copy.pip.finalWeek(days) };
  else if (streakDays >= 7) pip = { pose: 'streak', ...copy.pip.streak(streakDays) };
  else if (lastGap !== null && lastGap >= 3) pip = { pose: 'encouraging', ...copy.pip.returning };
  else if (weak) pip = { pose: 'thinking', ...copy.pip.weakTopic(topicName(weak.key)) };
  else pip = { pose: 'neutral', ...copy.pip.steady };

  // One recommended activity. Never something this platform/plan can't do:
  // hazard perception is native-only and Pro-only; mocks need Pro or the free mock.
  let recommendation: Recommendation;
  if (isNew) recommendation = { id: 'first-practice', ...copy.rec.first, route: '/(tabs)/practice', icon: 'school' };
  else if (days !== null && days >= 0 && days <= 1) recommendation = { id: 'test-day', ...copy.rec.testDay, route: '/testday', icon: 'flag' };
  else if (input.dueReviewCount > 0) recommendation = { id: 'due-review', ...copy.rec.due(input.dueReviewCount), route: '/(tabs)/practice', icon: 'refresh' };
  else if (p!.mockTestHistory.length === 0 && p!.totalQuestionsAnswered >= MOCK_READY_QUESTIONS && mockAllowed) {
    recommendation = isPro
      ? { id: 'pro-mock', ...copy.rec.proMock, route: '/(tabs)/mock', icon: 'clipboard' }
      : { id: 'free-mock', ...copy.rec.freeMock, route: '/(tabs)/mock', icon: 'clipboard' };
  } else if (weak) recommendation = { id: 'weak-topic', ...copy.rec.weakTopic(topicName(weak.key), weak.score), route: '/(tabs)/practice', icon: 'locate' };
  else if (platform !== 'web' && isPro && !p!.hazardPerceptionHistory.some((h) => h.passed)) {
    recommendation = { id: 'hazard', ...copy.rec.hazard, route: '/(tabs)/hazard', icon: 'eye' };
  } else if (isPro) recommendation = { id: 'pro-mock', ...copy.rec.proMock, route: '/(tabs)/mock', icon: 'clipboard' };
  else recommendation = { id: 'mixed', ...copy.rec.mixed, route: '/(tabs)/practice', icon: 'shuffle' };

  // Daily plan: three items derived from today's local activity. No new stored data.
  const answeredToday = studiedToday ? (p?.dailyQuestionsAnswered ?? 0) : 0;
  const dc = p?.dailyChallenge ?? null;
  // dailyChallenge.date is written as toISOString().split('T')[0] (UTC date) by the current Home.
  const dcToday = dc && dc.date === now.toISOString().split('T')[0] ? dc : null;
  const mockToday = !!p?.mockTestHistory.some((m) => m.takenAt && daysBetween(m.takenAt, now) === 0);
  const items: PlanItem[] = [
    {
      id: 'questions',
      label: copy.plan.questions(DAILY_QUESTION_TARGET),
      detail: `${Math.min(answeredToday, DAILY_QUESTION_TARGET)} of ${DAILY_QUESTION_TARGET}`,
      done: answeredToday >= DAILY_QUESTION_TARGET,
      route: '/(tabs)/practice',
    },
    {
      id: 'challenge',
      label: copy.plan.challenge,
      detail: dcToday?.description,
      done: !!dcToday?.completed,
      route: '/(tabs)/practice',
    },
    mockAllowed && !isNew
      ? { id: 'mock', label: copy.plan.mock, done: mockToday, route: '/(tabs)/mock' }
      : { id: 'streak', label: copy.plan.streak, done: studiedToday, route: '/(tabs)/practice' },
  ];
  const completed = items.filter((i) => i.done).length;

  const quickActions: QuickAction[] = [
    { id: 'mock', label: copy.quick.mock, route: '/(tabs)/mock', icon: 'clipboard-outline' },
    // Hazard perception isn't available on web (spec §6.1): hide the tile.
    ...(platform === 'web' ? [] : [{ id: 'hazards' as const, label: copy.quick.hazards, route: '/(tabs)/hazard' as const, icon: 'play-circle-outline' }]),
    { id: 'signs', label: copy.quick.signs, route: '/roadsigns', icon: 'warning-outline' },
    { id: 'pip', label: copy.quick.pip, route: '/(tabs)/tutor', icon: 'chatbubble-ellipses-outline' },
  ];

  const upgrade: HomeViewModel['upgrade'] =
    state !== 'established' || isPro ? null
    : input.freeMockAvailable && recommendation.id !== 'free-mock' ? { kind: 'free-mock', title: copy.upgrade.freeMockTitle, route: '/(tabs)/mock' }
    : !input.freeMockAvailable ? { kind: 'pro', title: copy.upgrade.proTitle, route: '/paywall' }
    : null;

  return {
    state,
    greeting,
    countdown,
    isPro,
    roadmapValue,
    pip,
    recommendation,
    dailyPlan: { items, completed, total: items.length },
    streak: {
      days: streakDays,
      studiedToday,
      atRisk,
      label: copy.streak.label(streakDays),
      note: streakDays === 0 ? copy.streak.none : atRisk ? copy.streak.atRisk : copy.streak.safe,
    },
    quickActions,
    upgrade,
    showTestResultPrompt: days !== null && days < 0 && !input.testResultSubmitted,
  };
}
