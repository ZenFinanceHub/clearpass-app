'use strict';

// Supports the instructor_signups table (see the migration of the same
// name) and its two Slack alerts:
//   - "New instructor signup" — once per row, when notified_at is still
//     null, fired from the grant-instructor-pro job.
//   - "Instructor signup not finished after 24h" — for a step-1
//     (/api/instructor/signup) auth user that never became an
//     account_type='instructor' profile, also fired from that job. These
//     never get an instructor_signups row (it references profiles(id), and
//     an abandoned signup has no profile), so "already notified" is tracked
//     on the auth user's own user_metadata instead.

const ABANDONED_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const ABANDONED_NOTIFIED_META_KEY = 'instructor_signup_abandoned_notified';

// Rows to insert into instructor_signups for every account_type='instructor'
// profile that doesn't have one yet — self-heals app-originated instructor
// accounts (the mobile app's client-side insert never touches this table)
// and any gap a past run left behind. Always source: 'app' — this only ever
// runs from the grant-instructor-pro job; a web signup missing a row here
// means complete-signup's own insert failed, which is a distinct problem
// this shouldn't paper over by guessing 'web'.
function buildAppSignupBackfillRows(instructorProfileIds, trackedUserIds) {
  const tracked = new Set(trackedUserIds);
  return instructorProfileIds
    .filter((id) => !tracked.has(id))
    .map((id) => ({ user_id: id, source: 'app' }));
}

// Slack copy for an instructor_signups row whose notified_at was still
// null. displayName is profiles.display_name, which is nullable.
function formatSignupNotification({ displayName, source, campaignRef, userId }) {
  const name = displayName && displayName.trim() ? displayName.trim() : 'no name yet';
  const ref = campaignRef && campaignRef.trim() ? campaignRef.trim() : 'none';
  return `New instructor signup: ${name}, via ${source}, ref ${ref}, user ${userId}`;
}

// Slack copy for a step-1 signup that's still incomplete 24h later. No
// profile exists for it, so there's no name/username to include — just the
// auth user id.
function formatAbandonedSignupNotification({ userId }) {
  return `Instructor signup not finished after 24h: user ${userId}`;
}

// Which step-1 auth users (instructor_signup_intent === true in
// user_metadata) are new work for the 24h-abandoned alert: no completed
// account_type='instructor' profile, older than the threshold, and not
// already flagged via ABANDONED_NOTIFIED_META_KEY. `authUsers` is the plain
// list shape returned by supabase.auth.admin.listUsers().data.users.
function findUnnotifiedAbandonedSignups(authUsers, completedProfileIds, { now = new Date() } = {}) {
  const completed = new Set(completedProfileIds);
  const cutoff = now.getTime() - ABANDONED_THRESHOLD_MS;
  return authUsers.filter((u) => {
    const meta = u.user_metadata || {};
    if (meta.instructor_signup_intent !== true) return false;
    if (completed.has(u.id)) return false;
    if (meta[ABANDONED_NOTIFIED_META_KEY] === true) return false;
    const createdAt = new Date(u.created_at).getTime();
    return createdAt <= cutoff;
  });
}

module.exports = {
  ABANDONED_THRESHOLD_MS,
  ABANDONED_NOTIFIED_META_KEY,
  buildAppSignupBackfillRows,
  formatSignupNotification,
  formatAbandonedSignupNotification,
  findUnnotifiedAbandonedSignups,
};
