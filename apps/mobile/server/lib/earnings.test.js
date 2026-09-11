const test = require('node:test');
const assert = require('node:assert/strict');
const { markPayoutAndEarningsPaid } = require('./earnings');

function createStubDb({ payoutError = null, earningsError = null } = {}) {
  const calls = {};
  return {
    calls,
    async markPayoutPaid(payoutId, transferId, paidAt) {
      calls.payout = { payoutId, transferId, paidAt };
      return { error: payoutError };
    },
    async markEarningsPaid(payoutId, paidAt) {
      calls.earnings = { payoutId, paidAt };
      return { error: earningsError };
    },
  };
}

test('markPayoutAndEarningsPaid stamps the same paid_at on both the payout and its claimed earnings', async () => {
  const db = createStubDb();
  const result = await markPayoutAndEarningsPaid(db, {
    payoutId: 'payout-1',
    transferId: 'tr_123',
    paidAt: '2026-09-11T00:00:00.000Z',
  });

  assert.equal(result.payoutError, null);
  assert.equal(result.earningsError, null);
  assert.deepEqual(db.calls.payout, {
    payoutId: 'payout-1',
    transferId: 'tr_123',
    paidAt: '2026-09-11T00:00:00.000Z',
  });
  assert.deepEqual(db.calls.earnings, {
    payoutId: 'payout-1',
    paidAt: '2026-09-11T00:00:00.000Z',
  });
});

test('markPayoutAndEarningsPaid still marks earnings paid even if the payout row update fails', async () => {
  const db = createStubDb({ payoutError: { message: 'stub payout failure' } });
  const result = await markPayoutAndEarningsPaid(db, { payoutId: 'p1', transferId: 't1', paidAt: 'now' });

  assert.ok(result.payoutError);
  assert.equal(result.earningsError, null);
  assert.ok(db.calls.earnings, 'earnings update must still be attempted after a payout-row failure');
});

test('markPayoutAndEarningsPaid still attempts the payout row update even if marking earnings paid fails', async () => {
  const db = createStubDb({ earningsError: { message: 'stub earnings failure' } });
  const result = await markPayoutAndEarningsPaid(db, { payoutId: 'p1', transferId: 't1', paidAt: 'now' });

  assert.equal(result.payoutError, null);
  assert.ok(result.earningsError);
  assert.ok(db.calls.payout, 'payout update must still be attempted even though earnings failed');
});
