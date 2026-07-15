'use strict';

// Derives our simplified connect status from a Stripe Account object, so the
// webhook handler stays in sync on what "onboarded" means without
// duplicating this logic inline.
function deriveConnectStatus(account) {
  if (account.requirements && account.requirements.disabled_reason) {
    return 'restricted';
  }
  if (account.payouts_enabled) {
    return 'onboarded';
  }
  if (account.details_submitted) {
    return 'pending';
  }
  return 'not_started';
}

module.exports = { deriveConnectStatus };
