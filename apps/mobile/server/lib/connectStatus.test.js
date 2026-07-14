const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveConnectStatus } = require('./connectStatus');

test('not_started when nothing submitted yet', () => {
  assert.equal(
    deriveConnectStatus({ payouts_enabled: false, details_submitted: false, requirements: {} }),
    'not_started',
  );
});

test('pending once details are submitted but payouts are not yet enabled', () => {
  assert.equal(
    deriveConnectStatus({ payouts_enabled: false, details_submitted: true, requirements: {} }),
    'pending',
  );
});

test('onboarded once Stripe enables payouts', () => {
  assert.equal(
    deriveConnectStatus({ payouts_enabled: true, details_submitted: true, requirements: {} }),
    'onboarded',
  );
});

test('restricted takes priority when Stripe has disabled the account', () => {
  assert.equal(
    deriveConnectStatus({
      payouts_enabled: false,
      details_submitted: true,
      requirements: { disabled_reason: 'requirements.past_due' },
    }),
    'restricted',
  );
});

test('restricted even if payouts_enabled is still true (defensive — Stripe disables asynchronously)', () => {
  assert.equal(
    deriveConnectStatus({
      payouts_enabled: true,
      details_submitted: true,
      requirements: { disabled_reason: 'rejected.fraud' },
    }),
    'restricted',
  );
});

test('missing requirements object does not throw', () => {
  assert.equal(
    deriveConnectStatus({ payouts_enabled: false, details_submitted: false }),
    'not_started',
  );
});
