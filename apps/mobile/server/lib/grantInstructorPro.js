'use strict';

const { shouldApplyProGrant, isInstructorGrantAlreadyCorrect } = require('./entitlement');

// Grants (or confirms/declines) instructor-sourced Pro for one user. Shared
// by the grant-instructor-pro cron's bulk loop and POST /api/instructor/
// verification's auto-verify path, so both go through the exact same rules
// — a change here can't drift between "grant on the next daily run" and
// "grant instantly on auto-verify".
//
// db adapter, same shape/convention as stripeWebhook.js's applyStripeProGrant:
//   - getProgress(userId) -> Promise<object|null>  (MUST throw on a real
//     read error — never return null/undefined for that. A missing row is
//     legitimately null (a brand new user_progress row hasn't been created
//     yet); an actual query failure is not the same thing and must not be
//     silently treated as "no progress yet", which would grant right over
//     an error instead of failing loudly.)
//   - upsertProgress(userId, progress) -> Promise<{ error: any }>
//   - postSlack(text) -> Promise<boolean>
//
// Returns { outcome: 'already_correct' | 'skipped' | 'granted' | 'error', error? }.
async function grantInstructorProForUser(userId, db, { displayName } = {}) {
  const currentProgress = (await db.getProgress(userId)) || {};

  if (isInstructorGrantAlreadyCorrect(currentProgress)) {
    return { outcome: 'already_correct' };
  }

  if (!shouldApplyProGrant(currentProgress.proSource, 'instructor')) {
    return { outcome: 'skipped' };
  }

  const updatedProgress = { ...currentProgress, isPro: true, proExpiresAt: null, proSource: 'instructor' };
  const { error } = await db.upsertProgress(userId, updatedProgress);
  if (error) {
    return { outcome: 'error', error };
  }

  // Non-fatal: the grant itself already succeeded via the write above, so a
  // Slack outage must not be reported as the grant having failed.
  const name = displayName && displayName.trim() ? displayName.trim() : 'no name yet';
  const slackPosted = await db.postSlack(`Instructor Pro granted: ${name} (${userId})`);

  return { outcome: 'granted', slackPosted };
}

module.exports = { grantInstructorProForUser };
