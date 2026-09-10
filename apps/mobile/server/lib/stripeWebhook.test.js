const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveStripeProGrant, applyStripeProGrant } = require('./stripeWebhook');

// Same shape/purpose as revenuecatWebhook.test.js's stub — an in-memory
// stand-in for the db param applyStripeProGrant expects.
function createStubDb(initial = {}, { readErrorIds = new Set(), failIds = new Set(), deleteFails = false } = {}) {
  const store = new Map(Object.entries(initial));
  const deletedEvents = [];
  return {
    store,
    deletedEvents,
    async getProgress(id) {
      if (readErrorIds.has(id)) throw new Error('stub read failure');
      return store.has(id) ? store.get(id) : null;
    },
    async upsertProgress(id, progress) {
      if (failIds.has(id)) return { error: { message: 'stub upsert failure' } };
      store.set(id, progress);
      return { error: null };
    },
    async deleteWebhookEvent(eventId) {
      if (deleteFails) throw new Error('stub delete failure');
      deletedEvents.push(eventId);
    },
  };
}

const USER_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

test('resolveStripeProGrant: grants when there is no current source', () => {
  const patch = resolveStripeProGrant({});
  assert.equal(patch.isPro, true);
  assert.equal(patch.proSource, 'stripe');
  assert.ok(patch.proExpiresAt);
});

test('resolveStripeProGrant: a stripe grant renews over itself', () => {
  const patch = resolveStripeProGrant({ isPro: true, proSource: 'stripe', proExpiresAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(patch.isPro, true);
  assert.equal(patch.proSource, 'stripe');
});

test('resolveStripeProGrant: an existing comp/instructor grant (lower priority, no expiry args passed here) is still overridden — stripe always outranks them', () => {
  assert.equal(resolveStripeProGrant({ isPro: true, proSource: 'comp' }).proSource, 'stripe');
  assert.equal(resolveStripeProGrant({ isPro: true, proSource: 'instructor' }).proSource, 'stripe');
});

test('applyStripeProGrant: success — grants and writes the merged progress, preserving unrelated keys', async () => {
  const db = createStubDb({ [USER_ID]: { xp: 50, streak: 3 } });
  const event = { id: 'evt_stripe_1' };

  const result = await applyStripeProGrant(event, USER_ID, db);

  assert.deepEqual(result, { ok: true });
  const stored = db.store.get(USER_ID);
  assert.equal(stored.isPro, true);
  assert.equal(stored.proSource, 'stripe');
  assert.equal(stored.xp, 50);
  assert.equal(stored.streak, 3);
});

test('applyStripeProGrant: a read error aborts before any write, deletes the dedup row, signals retry', async () => {
  const db = createStubDb({ [USER_ID]: { xp: 50 } }, { readErrorIds: new Set([USER_ID]) });
  const event = { id: 'evt_stripe_2' };

  const result = await applyStripeProGrant(event, USER_ID, db);

  assert.deepEqual(result, { ok: false, retry: true });
  assert.deepEqual(db.store.get(USER_ID), { xp: 50 }); // untouched
  assert.deepEqual(db.deletedEvents, ['evt_stripe_2']);
});

test('applyStripeProGrant: a write error deletes the dedup row and signals retry', async () => {
  const db = createStubDb({ [USER_ID]: { xp: 50 } }, { failIds: new Set([USER_ID]) });
  const event = { id: 'evt_stripe_3' };

  const result = await applyStripeProGrant(event, USER_ID, db);

  assert.deepEqual(result, { ok: false, retry: true });
  assert.deepEqual(db.store.get(USER_ID), { xp: 50 }); // upsert failed, unchanged
  assert.deepEqual(db.deletedEvents, ['evt_stripe_3']);
});

test('applyStripeProGrant: a failing deleteWebhookEvent does not crash the handler — still reports retry', async () => {
  const db = createStubDb({ [USER_ID]: {} }, { readErrorIds: new Set([USER_ID]), deleteFails: true });
  const event = { id: 'evt_stripe_4' };

  const result = await applyStripeProGrant(event, USER_ID, db);

  assert.deepEqual(result, { ok: false, retry: true });
  assert.deepEqual(db.deletedEvents, []);
});
