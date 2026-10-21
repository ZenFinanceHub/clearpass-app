'use strict';

// Conversion funnel summary for the daily Slack post, built from
// public.funnel_events. Counts distinct people (user_id, or the install's
// anon_id before signup) per step, so one learner opening the paywall five
// times is one paywall view.

// Order is the order the steps appear in Slack.
const FUNNEL_STEPS = [
  ['taster_completed', 'Finished taster'],
  ['onboarding_completed', 'Finished onboarding'],
  ['daily_limit_hit', 'Hit daily limit'],
  ['free_mock_completed', 'Finished free mock'],
  ['paywall_prompt_viewed', 'Saw upgrade prompt'],
  ['paywall_viewed', 'Opened paywall'],
  ['purchase_started', 'Started purchase'],
  ['purchase_cancelled', 'Cancelled purchase'],
  ['purchase_failed', 'Purchase failed'],
  ['purchase_succeeded', 'Purchased'],
  ['iap_unavailable', ':warning: Store unavailable (could not buy)'],
];

const FUNNEL_LOOKBACK_DAYS = 7;

function computeFunnelStats({ events, excludedUserIds, nowIso }) {
  const excluded = new Set(excludedUserIds || []);
  const now = Date.parse(nowIso);
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - FUNNEL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  // An anon_id that ever belonged to an excluded account is excluded too,
  // so the founder's own pre-signup taster run doesn't count either.
  const excludedAnon = new Set();
  for (const e of events || []) {
    if (e.user_id && excluded.has(e.user_id) && e.anon_id) excludedAnon.add(e.anon_id);
  }

  const day = Object.fromEntries(FUNNEL_STEPS.map(([k]) => [k, new Set()]));
  const week = Object.fromEntries(FUNNEL_STEPS.map(([k]) => [k, new Set()]));

  for (const e of events || []) {
    if (!(e.event in week)) continue;
    if (e.user_id && excluded.has(e.user_id)) continue;
    if (e.anon_id && excludedAnon.has(e.anon_id)) continue;
    const t = Date.parse(e.created_at);
    if (Number.isNaN(t) || t < weekAgo || t > now) continue;
    const actor = e.user_id || `anon:${e.anon_id}`;
    week[e.event].add(actor);
    if (t >= dayAgo) day[e.event].add(actor);
  }

  return FUNNEL_STEPS.map(([key, label]) => ({
    key,
    label,
    last24h: day[key].size,
    last7d: week[key].size,
  }));
}

function formatFunnelLines(steps) {
  const lines = ['', `*Funnel* _(people, 24h / ${FUNNEL_LOOKBACK_DAYS}d)_`];
  for (const s of steps) {
    lines.push(`    • ${s.label}: ${s.last24h} / ${s.last7d}`);
  }
  return lines;
}

module.exports = { FUNNEL_STEPS, FUNNEL_LOOKBACK_DAYS, computeFunnelStats, formatFunnelLines };
