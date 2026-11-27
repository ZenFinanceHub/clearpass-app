/**
 * Pure analytics rules (no React Native imports, so scripts/lib tests can
 * run them under plain Node): the event list, the allow-list of props each
 * event may carry, and the once-only / once-per-day decisions.
 *
 * Privacy: props are enums, booleans and small integers only. No question
 * text, answers, chat text, emails, names, codes or any free text. Every
 * prop goes through sanitiseProps() before it leaves the device, so a key
 * or value not listed here is silently dropped. Full taxonomy:
 * docs/analytics/event-taxonomy.md.
 */

export type FunnelEvent =
  // Conversion funnel (Oct 2026)
  | 'taster_started'
  | 'taster_completed'
  | 'onboarding_completed'
  | 'daily_limit_hit'
  | 'paywall_prompt_viewed'
  | 'paywall_prompt_tapped'
  | 'paywall_viewed'
  | 'plan_selected'
  | 'purchase_started'
  | 'purchase_succeeded'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'free_mock_started'
  | 'free_mock_completed'
  | 'iap_unavailable'
  | 'reminder_offer_viewed'
  | 'reminder_enabled'
  | 'reminder_declined'
  | 'reminder_os_denied'
  // Activation, retention and feature usage (P0-3)
  | 'signup_started'
  | 'signup_completed'
  | 'onboarding_started'
  | 'onboarding_step_viewed'
  | 'first_question_answered'
  | 'first_session_completed'
  | 'practice_results_viewed'
  | 'feature_used'
  | 'app_opened'
  | 'instructor_invite_sent'
  | 'referral_shared'
  | 'instructor_link_accepted'
  // Fires from P2-1 (daily plan); defined now so the taxonomy is complete.
  | 'daily_plan_viewed'
  | 'daily_plan_item_started';

export const FEATURES = [
  'practice',
  'weak_spots',
  'speed_round',
  'battle',
  'bookmarked',
  'spaced_repetition',
  'mock_full',
  'mock_quick',
  'hazard',
  'road_signs',
  'highway_code',
  'ask_pip',
  'study_plan',
  'ai_study_plan',
  'leaderboard',
  'challenge',
  'test_day',
] as const;
export type Feature = (typeof FEATURES)[number];

export const ONBOARDING_STEPS = [
  'welcome',
  'practice',
  'progress',
  'date',
  'choose_account_type',
  'test_date',
  'reminders',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const PRACTICE_RESULT_MODES = [
  'practice',
  'bookmarked',
  'spaced_repetition',
  'battle',
  'speed_round',
  'weak_spots',
] as const;
export type PracticeResultMode = (typeof PRACTICE_RESULT_MODES)[number];

export const QUESTION_SOURCES = ['taster', 'practice', 'battle', 'speed_round', 'weak_spots', 'mock'] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];

export const MAX_STRING_LENGTH = 40;

export type PropSpec =
  | { type: 'enum'; values: readonly string[] }
  | { type: 'boolean' }
  | { type: 'int'; min: number; max: number };

const e = (...values: string[]): PropSpec => ({ type: 'enum', values });
const bool: PropSpec = { type: 'boolean' };
const int = (min: number, max: number): PropSpec => ({ type: 'int', min, max });

const PLAN = e('monthly', 'quarterly');
const RAIL = e('stripe', 'iap');
const TRIAL_DAYS = int(0, 365);
const PURCHASE_ROUTE = e('stripe_checkout', 'coming_soon', 'iap');
const PAYWALL_REASON = e('daily_limit', 'mock', 'hazard', 'tutor', 'mock_result', 'general', 'mock_standard_locked');
const REMINDER_CONTEXT = e('daily_limit', 'home', 'onboarding');
const PURCHASE = { plan: PLAN, rail: RAIL, trialDays: TRIAL_DAYS };

/** Allow-list: the only keys (and value shapes) each event may carry. */
export const EVENT_PROPS: Record<FunnelEvent, Record<string, PropSpec>> = {
  taster_started: {},
  taster_completed: { correct: int(0, 100) },
  onboarding_completed: { testDate: bool },
  daily_limit_hit: { at: e('session_start', 'mid_session') },
  paywall_prompt_viewed: { reason: PAYWALL_REASON, route: PURCHASE_ROUTE },
  paywall_prompt_tapped: { reason: PAYWALL_REASON, passed: bool },
  paywall_viewed: { route: PURCHASE_ROUTE },
  plan_selected: { plan: PLAN },
  purchase_started: PURCHASE,
  purchase_succeeded: PURCHASE,
  purchase_cancelled: PURCHASE,
  purchase_failed: { ...PURCHASE, reason: e('no_package') },
  free_mock_started: { mode: e('standard', 'quick') },
  free_mock_completed: { passed: bool, correct: int(0, 100), total: int(0, 100) },
  iap_unavailable: {
    mode: e('missing_api_key', 'configure_threw', 'get_offerings_threw', 'no_quarterly_package'),
    source: e('boot', 'refresh'),
  },
  reminder_offer_viewed: { context: REMINDER_CONTEXT },
  reminder_enabled: { context: REMINDER_CONTEXT },
  reminder_declined: { context: REMINDER_CONTEXT },
  reminder_os_denied: { context: REMINDER_CONTEXT },

  signup_started: {},
  signup_completed: { method: e('email', 'apple', 'google'), confirm_required: bool },
  onboarding_started: {},
  onboarding_step_viewed: { step: e(...ONBOARDING_STEPS) },
  first_question_answered: { source: e(...QUESTION_SOURCES) },
  first_session_completed: { mode: e(...PRACTICE_RESULT_MODES), limit_reached: bool },
  practice_results_viewed: { mode: e(...PRACTICE_RESULT_MODES), limit_reached: bool },
  feature_used: { feature: e(...FEATURES) },
  app_opened: { trigger: e('launch', 'foreground') },
  instructor_invite_sent: { method: e('email', 'copy_code') },
  referral_shared: { method: e('share', 'copy'), surface: e('settings', 'instructor') },
  instructor_link_accepted: { method: e('invite', 'code') },

  daily_plan_viewed: {},
  daily_plan_item_started: { item: e(...FEATURES) },
};

export type SafeProps = Record<string, string | number | boolean>;

function valueOk(spec: PropSpec, v: unknown): boolean {
  switch (spec.type) {
    case 'enum':
      return typeof v === 'string' && v.length <= MAX_STRING_LENGTH && spec.values.includes(v);
    case 'boolean':
      return typeof v === 'boolean';
    case 'int':
      return typeof v === 'number' && Number.isInteger(v) && v >= spec.min && v <= spec.max;
  }
}

/** Keeps only allow-listed keys whose values match their spec. Never throws. */
export function sanitiseProps(event: string, props: unknown): SafeProps {
  const out: SafeProps = {};
  if (!props || typeof props !== 'object' || Array.isArray(props)) return out;
  if (!Object.prototype.hasOwnProperty.call(EVENT_PROPS, event)) return out;
  const schema = EVENT_PROPS[event as FunnelEvent];
  for (const [key, spec] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    const v = (props as Record<string, unknown>)[key];
    if (valueOk(spec, v)) out[key] = v as string | number | boolean;
  }
  return out;
}

// ── Once-only events ────────────────────────────────────────────────────────

/** `stored` is a JSON array of keys already fired on this install. */
export function markOnce(stored: string | null, key: string): { fire: boolean; next: string } {
  let seen: string[] = [];
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) seen = parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      // Corrupt value: start again rather than never firing.
    }
  }
  if (seen.includes(key)) return { fire: false, next: JSON.stringify(seen) };
  return { fire: true, next: JSON.stringify([...seen, key]) };
}

// ── app_opened: at most once per local calendar day ─────────────────────────

export function localDayKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function shouldLogAppOpened(lastLoggedDay: string | null, now: Date): { fire: boolean; day: string } {
  const day = localDayKey(now);
  return { fire: lastLoggedDay !== day, day };
}

// ── Practice tab: which events a phase change produces ──────────────────────

export type PracticePhaseContext = {
  /** The `mode` route param of the practice tab (bookmarked / review / none). */
  modeParam: string | undefined;
  isPro: boolean;
  dailyCount: number;
  freeLimit: number;
};

export type PracticePhaseEvents = {
  featureUsed?: Feature;
  resultsViewed?: { mode: PracticeResultMode; limit_reached: boolean };
  sessionCompleted?: { mode: PracticeResultMode; limit_reached: boolean };
};

function standardMode(modeParam: string | undefined): PracticeResultMode {
  if (modeParam === 'bookmarked') return 'bookmarked';
  if (modeParam === 'review') return 'spaced_repetition';
  return 'practice';
}

const PLAY_PHASES: Record<string, (c: PracticePhaseContext) => PracticeResultMode> = {
  quiz: c => standardMode(c.modeParam),
  battle: () => 'battle',
  speedRound: () => 'speed_round',
  weakSpot: () => 'weak_spots',
};

const RESULT_PHASE_FOR: Record<string, string> = {
  quiz: 'results',
  battle: 'battleResults',
  speedRound: 'speedRoundResults',
  weakSpot: 'weakSpotResults',
};

/**
 * Practice tab phase change -> events. A mode counts as used when its play
 * phase is entered (once per session, not per question). A session counts
 * as completed when play moves to its results phase, or when a standard
 * session is cut off by the daily free limit.
 */
export function practicePhaseEvents(prev: string, next: string, ctx: PracticePhaseContext): PracticePhaseEvents {
  const out: PracticePhaseEvents = {};
  if (prev === next) return out;

  const enteringMode = PLAY_PHASES[next];
  if (enteringMode) {
    out.featureUsed = enteringMode(ctx) as Feature;
    return out;
  }

  const playMode = PLAY_PHASES[prev];
  if (!playMode) return out;
  const mode = playMode(ctx);
  const limitReached = prev === 'quiz' && !ctx.isPro && ctx.dailyCount >= ctx.freeLimit;

  if (next === RESULT_PHASE_FOR[prev]) {
    out.resultsViewed = { mode, limit_reached: limitReached };
    out.sessionCompleted = { mode, limit_reached: limitReached };
  } else if (prev === 'quiz' && next === 'dailyLimit') {
    out.sessionCompleted = { mode, limit_reached: true };
  }
  return out;
}
