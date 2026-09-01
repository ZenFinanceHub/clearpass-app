'use strict';

const { isEligibleForProExpiry } = require('./entitlement');

// Above this many rows in either table, the daily stats job refuses to run
// rather than sequentially scanning every progress blob. There is no index
// on the JSONB fields these counts read, so this is a straight seq scan;
// it is free at hundreds of rows and fine into the low thousands, but it
// should not silently grow into a daily full scan of a large table.
//
// The bail is deliberately LOUD — the caller reports it as an error and
// says so in Slack. A stats job that quietly stops posting is worse than
// one that fails visibly, because nobody notices the absence of a message.
const MAX_STATS_ROWS = 20000;

// Pro that someone paid for, split by channel:
//   stripe — direct card purchase on the web
//   seat   — an instructor bought a 90-day seat for a pupil (£5.99)
//   iap    — App Store / Google Play, via the RevenueCat webhook
const PAYING_SOURCES = ['stripe', 'seat', 'iap'];

// Pro that was given away. Real users, no revenue.
//   instructor — automatic, for any account_type='instructor'
//   comp       — manually granted (reviewers, partners, beta testers)
const GRANTED_SOURCES = ['instructor', 'comp'];

// "Active" is defined as the exact inverse of the rule the expire-pro cron
// uses, deliberately reusing isEligibleForProExpiry rather than restating
// it. Two definitions of "is this person Pro" would drift, and drift in
// entitlement logic means either giving away access or wrongly cutting
// someone off.
//
// Note what this inherits from that helper: 'instructor' and 'comp' are
// exempt from expiry entirely, and a paying grant with a NULL proExpiresAt
// is also never treated as expired (the `!!state.proExpiresAt` guard). That
// second case is a data-quality wrinkle rather than an intended rule, so it
// is counted separately as `indefinite` below instead of being folded in
// silently.
function isActivePro(progress, nowIso) {
  if (!progress || progress.isPro !== true) return false;
  return !isEligibleForProExpiry(progress, nowIso);
}

// profiles and progress are joined here rather than in the query because
// progress lives in a JSONB blob and roughly a quarter of profiles have no
// user_progress row at all. A profile with no progress row is a signed-up
// account that has simply never studied — it is a free learner, not a
// missing record, and counting only from user_progress would silently drop
// it from the denominator.
// profiles.exclude_from_stats marks accounts that exist but must not shape
// funnel metrics: seeded fixtures, the founder's own plus-addresses, stand
// demos, friends and family. What it does and does not affect:
//
//   counted   — totalAccounts, the learner/instructor split, refCount
//               (an account exists, and a conference scan is a scan)
//   excluded  — the Pro/free breakdown, conversion (both sides), newLast24h
//
// The split matters: leaving them in conversion flatters nothing, it
// depresses the number with accounts that were never going to buy. Leaving
// them out of the total would hide real rows. `excluded` is reported so the
// gap between totalAccounts and the conversion base is always explainable.
//
// Note this is a different exclusion from the comp/instructor one below.
// Those are excluded because they got Pro for free and will never convert;
// these are excluded because they are not real prospects at all. An account
// can be both.
function computeDailyStats({ profiles, progressRows, nowIso, refCode }) {
  const progressById = new Map((progressRows || []).map((r) => [r.id, r.progress || {}]));

  const stats = {
    totalAccounts: profiles.length,
    learners: 0,
    instructors: 0,
    excluded: 0,
    payingDirect: 0,
    payingSeat: 0,
    payingIap: 0,
    payingTotal: 0,
    grantedInstructor: 0,
    grantedComp: 0,
    grantedTotal: 0,
    indefinite: 0,
    freeLearners: 0,
    newLast24h: 0,
    refCount: 0,
    conversionPct: 0,
  };

  const dayAgoIso = new Date(Date.parse(nowIso) - 24 * 60 * 60 * 1000).toISOString();
  let payingLearners = 0;

  for (const profile of profiles) {
    const isInstructorAccount = profile.account_type === 'instructor';
    if (isInstructorAccount) stats.instructors++;
    else stats.learners++;

    // Counted regardless of exclusion — these describe the account base and
    // campaign reach, not the funnel.
    if (refCode && profile.signup_ref === refCode) stats.refCount++;

    if (profile.exclude_from_stats === true) {
      stats.excluded++;
      // Nothing below this line runs for an excluded account: no Pro
      // bucket, no free-learner tally, no 24h count. Seeding eight
      // fixtures must not read as eight new signups.
      continue;
    }

    if (profile.created_at && profile.created_at > dayAgoIso) stats.newLast24h++;

    const progress = progressById.get(profile.id) || {};
    const active = isActivePro(progress, nowIso);
    const source = progress.proSource;

    if (active && PAYING_SOURCES.includes(source)) {
      stats.payingTotal++;
      if (source === 'stripe') stats.payingDirect++;
      else if (source === 'seat') stats.payingSeat++;
      else if (source === 'iap') stats.payingIap++;
      // A paying grant with no expiry date never expires under the current
      // rule, which is almost certainly a leftover rather than an intent.
      // Surfaced so a non-zero value is visible, not averaged away.
      if (!progress.proExpiresAt) stats.indefinite++;
      if (!isInstructorAccount) payingLearners++;
    } else if (active && GRANTED_SOURCES.includes(source)) {
      stats.grantedTotal++;
      if (source === 'instructor') stats.grantedInstructor++;
      else if (source === 'comp') stats.grantedComp++;
    } else if (!isInstructorAccount) {
      // Signed up, no active Pro of any kind.
      stats.freeLearners++;
    }
  }

  // Instructors are excluded by account_type; comps fall out naturally,
  // since an active comp is neither paying nor free. Both would otherwise
  // sit permanently in the denominator and depress a number that is meant
  // to measure learners choosing to pay.
  const base = payingLearners + stats.freeLearners;
  stats.conversionPct = base === 0 ? 0 : Math.round((payingLearners / base) * 1000) / 10;

  return stats;
}

function formatDailyStatsMessage(stats, refCode) {
  const lines = [
    '*ClearPass — daily stats*',
    '',
    `*Accounts:* ${stats.totalAccounts}  ·  ${stats.learners} learner / ${stats.instructors} instructor`,
    `*New (24h):* ${stats.newLast24h}`,
    `*Excluded from funnel:* ${stats.excluded}  _(test, demo, friends & family)_`,
    '',
    `*Paying Pro, active:* ${stats.payingTotal}`,
    `    • direct (stripe): ${stats.payingDirect}`,
    `    • seats: ${stats.payingSeat}`,
    `    • in-app: ${stats.payingIap}`,
    `*Granted Pro, active:* ${stats.grantedTotal}  (${stats.grantedInstructor} instructor, ${stats.grantedComp} comp)`,
    `*Free learners:* ${stats.freeLearners}`,
    `*Conversion:* ${stats.conversionPct}%  _(paying / paying + free; instructors and comps excluded)_`,
  ];

  if (stats.indefinite > 0) {
    lines.push(
      '',
      `:warning: *${stats.indefinite}* paying account(s) have no expiry date and will never lapse — likely a backfill leftover, worth a look.`
    );
  }

  if (refCode) {
    lines.push('', `*Signups from \`${refCode}\`:* ${stats.refCount}`);
  }

  return lines.join('\n');
}

module.exports = {
  MAX_STATS_ROWS,
  PAYING_SOURCES,
  GRANTED_SOURCES,
  isActivePro,
  computeDailyStats,
  formatDailyStatsMessage,
};
