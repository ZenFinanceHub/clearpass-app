'use strict';

// scripts/smoke-instructor.js creates throwaway auth users with
// user_metadata.e2e = true so its own accounts never show up as real
// signups: no Slack post anywhere in the instructor-signup/verification/
// payout-proof flow should ever fire for one, and none should be backfilled
// into instructor_signups or counted in docs/sql/instructor-signups.sql.
function isE2EUser(userMetadata) {
  return userMetadata?.e2e === true;
}

module.exports = { isE2EUser };
