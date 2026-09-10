const test = require('node:test');
const assert = require('node:assert/strict');
const {
  expirationMsToIso,
  resolveRevenueCatUpdate,
  isSupabaseUserId,
  resolveTransferSourceUpdate,
  resolveTransferDestinationUpdate,
  applyTransfer,
  applySingleUserUpdate,
} = require('./revenuecatWebhook');

// In-memory stand-in for the db param applyTransfer expects. `failIds` lets
// a test make specific upsertProgress calls fail, `readErrorIds` makes
// specific getProgress calls throw (a real read error, never "no row"),
// and `deleteFails` makes deleteWebhookEvent itself throw — all to exercise
// the partial-failure/retry paths without a real Supabase client.
function createStubDb(initial = {}, { failIds = new Set(), readErrorIds = new Set(), deleteFails = false } = {}) {
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

test('expirationMsToIso converts a known epoch-ms value to an ISO 8601 string', () => {
  // 2026-11-14T09:59:34.714Z in epoch ms
  assert.equal(expirationMsToIso(1794650374714), '2026-11-14T09:59:34.714Z');
});

test('expirationMsToIso returns null for null', () => {
  assert.equal(expirationMsToIso(null), null);
});

test('expirationMsToIso returns null for undefined (field absent from payload)', () => {
  assert.equal(expirationMsToIso(undefined), null);
});

test('expirationMsToIso returns null for a non-finite value', () => {
  assert.equal(expirationMsToIso(NaN), null);
  assert.equal(expirationMsToIso('not-a-number'), null);
});

test('resolveRevenueCatUpdate: INITIAL_PURCHASE with a real expiration_at_ms sets proExpiresAt to that value', () => {
  const { progress, warning } = resolveRevenueCatUpdate('INITIAL_PURCHASE', 1794650374714, {});
  assert.deepEqual(progress, { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap' });
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: RENEWAL with a real expiration_at_ms sets proExpiresAt to that value', () => {
  const current = { isPro: true, proExpiresAt: '2026-08-14T00:00:00.000Z', proSource: 'iap' };
  const { progress, warning } = resolveRevenueCatUpdate('RENEWAL', 1794650374714, current);
  assert.deepEqual(progress, { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap' });
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: INITIAL_PURCHASE with missing expiration_at_ms falls back to computeIapExpiresAt with a warning', () => {
  const before = Date.now();
  const { progress, warning } = resolveRevenueCatUpdate('INITIAL_PURCHASE', undefined, {});
  const after = Date.now();
  assert.equal(progress.isPro, true);
  assert.equal(progress.proSource, 'iap');
  const resultMs = new Date(progress.proExpiresAt).getTime();
  const ninetyDaysMs = 1000 * 60 * 60 * 24 * 90;
  assert.ok(resultMs - before >= ninetyDaysMs - 1000);
  assert.ok(resultMs - after <= ninetyDaysMs + 1000);
  assert.match(warning, /missing expiration_at_ms/);
});

test('resolveRevenueCatUpdate: RENEWAL with missing expiration_at_ms falls back with a warning too', () => {
  const { progress, warning } = resolveRevenueCatUpdate('RENEWAL', null, { isPro: true, proSource: 'iap' });
  assert.equal(progress.proSource, 'iap');
  assert.match(warning, /missing expiration_at_ms/);
});

test('resolveRevenueCatUpdate: INITIAL_PURCHASE/RENEWAL still go through shouldApplyProGrant — a later existing stripe expiry blocks a shorter iap one', () => {
  const current = { isPro: true, proExpiresAt: '2027-01-01T00:00:00.000Z', proSource: 'stripe' };
  const { progress, warning } = resolveRevenueCatUpdate('RENEWAL', 1794650374714, current); // 2026-11-14, earlier than 2027-01-01
  assert.equal(progress, null);
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: CANCELLATION sets proExpiresAt to expiration_at_ms and leaves isPro true', () => {
  const current = { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap', xp: 200 };
  const { progress, warning } = resolveRevenueCatUpdate('CANCELLATION', 1794650374714, current);
  assert.deepEqual(progress, { proExpiresAt: '2026-11-14T09:59:34.714Z' });
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: CANCELLATION with missing expiration_at_ms logs a warning and leaves proExpiresAt untouched', () => {
  const current = { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap' };
  const { progress, warning } = resolveRevenueCatUpdate('CANCELLATION', undefined, current);
  assert.equal(progress, null);
  assert.match(warning, /missing expiration_at_ms/);
});

test('resolveRevenueCatUpdate: CANCELLATION for a grant that is no longer iap-sourced is a no-op — must not clobber e.g. a manual comp', () => {
  const current = { isPro: true, proExpiresAt: null, proSource: 'comp' };
  const { progress, warning } = resolveRevenueCatUpdate('CANCELLATION', 1794650374714, current);
  assert.equal(progress, null);
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: EXPIRATION clears isPro/proExpiresAt/proSource for an iap-sourced grant', () => {
  const current = { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap', xp: 200 };
  const { progress, warning } = resolveRevenueCatUpdate('EXPIRATION', 1794650374714, current);
  assert.deepEqual(progress, { isPro: false, proExpiresAt: null, proSource: null });
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: EXPIRATION for a grant that is no longer iap-sourced is a no-op', () => {
  const current = { isPro: true, proExpiresAt: null, proSource: 'comp' };
  const { progress, warning } = resolveRevenueCatUpdate('EXPIRATION', null, current);
  assert.equal(progress, null);
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: an unhandled event type (e.g. BILLING_ISSUE) is a no-op with no warning', () => {
  const { progress, warning } = resolveRevenueCatUpdate('BILLING_ISSUE', 1794650374714, { isPro: true, proSource: 'iap' });
  assert.equal(progress, null);
  assert.equal(warning, null);
});

// ─── TRANSFER ───────────────────────────────────────────────────────────

test('isSupabaseUserId: accepts a real UUID, rejects an RC anonymous id', () => {
  assert.equal(isSupabaseUserId('a1b2c3d4-e5f6-4789-a012-3456789abcde'), true);
  assert.equal(isSupabaseUserId('$RCAnonymousID:9f8e7d6c5b4a39281706f5e4d3c2b1a0'), false);
  assert.equal(isSupabaseUserId(undefined), false);
  assert.equal(isSupabaseUserId(null), false);
});

test('normal transfer: source clears, destination is granted the source\'s expiry', () => {
  const source = { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap', xp: 50 };
  const sourcePatch = resolveTransferSourceUpdate(source);
  assert.deepEqual(sourcePatch, { isPro: false, proExpiresAt: null, proSource: null });

  const destination = {};
  const { progress, warning } = resolveTransferDestinationUpdate(destination, source.proExpiresAt);
  assert.deepEqual(progress, { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap' });
  assert.equal(warning, null);
});

test('anonymous-ID source: filtered out before either resolver is ever called, so nothing changes for it', () => {
  // The anonymous id itself is simply excluded by isSupabaseUserId — the
  // caller (proxy.js) never queries user_progress for it or calls
  // resolveTransferSourceUpdate on it at all.
  assert.equal(isSupabaseUserId('$RCAnonymousID:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), false);
});

test('source with a higher non-iap grant (comp) is left alone, not cleared', () => {
  const source = { isPro: true, proExpiresAt: null, proSource: 'comp' };
  const patch = resolveTransferSourceUpdate(source);
  assert.equal(patch, null);
});

test('destination with a permanent comp grant (proExpiresAt: null) is protected from an incoming transfer, even though comp is lower-priority than iap', () => {
  const destination = { isPro: true, proExpiresAt: null, proSource: 'comp' };
  const { progress, warning } = resolveTransferDestinationUpdate(destination, '2026-11-14T09:59:34.714Z');
  assert.equal(progress, null);
  assert.equal(warning, null);
});

test('destination with a comp grant that DOES have a real expiry is not permanent — iap/stripe outrank comp in PRO_SOURCE_PRIORITY, so it IS overridden', () => {
  const destination = { isPro: true, proExpiresAt: '2026-01-01T00:00:00.000Z', proSource: 'comp' };
  const { progress, warning } = resolveTransferDestinationUpdate(destination, '2026-11-14T09:59:34.714Z');
  assert.deepEqual(progress, { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap' });
  assert.equal(warning, null);
});

test('destination with an existing stripe grant that outlasts the incoming iap transfer is not downgraded', () => {
  const destination = { isPro: true, proExpiresAt: '2027-01-01T00:00:00.000Z', proSource: 'stripe' };
  const { progress, warning } = resolveTransferDestinationUpdate(destination, '2026-11-14T09:59:34.714Z');
  assert.equal(progress, null);
  assert.equal(warning, null);
});

test('missing expiry: no usable source proExpiresAt means no grant, just a warning', () => {
  const { progress, warning } = resolveTransferDestinationUpdate({}, null);
  assert.equal(progress, null);
  assert.match(warning, /no usable source proExpiresAt/);
});

// ─── applyTransfer (ordering, retry-safety) ────────────────────────────

const SOURCE_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const DEST_ID = 'b2c3d4e5-f6a7-4890-b123-4567890abcde';
const FUTURE_EXPIRY = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
const PAST_EXPIRY = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

test('applyTransfer: success — source iap grant with a future expiry moves to the destination', async () => {
  const db = createStubDb({
    [SOURCE_ID]: { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap', xp: 10 },
    [DEST_ID]: {},
  });
  const event = { id: 'evt_1', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

  const result = await applyTransfer(event, db);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' });
  assert.deepEqual(db.store.get(SOURCE_ID), { isPro: false, proExpiresAt: null, proSource: null, xp: 10 });
  assert.deepEqual(db.deletedEvents, []);
});

test('applyTransfer: destination upsert failure — source is never touched, dedup row deleted, retry signaled', async () => {
  const originalSource = { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' };
  const db = createStubDb(
    { [SOURCE_ID]: originalSource, [DEST_ID]: {} },
    { failIds: new Set([DEST_ID]) },
  );
  const event = { id: 'evt_2', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

  const result = await applyTransfer(event, db);

  assert.deepEqual(result, { ok: false, retry: true });
  assert.deepEqual(db.store.get(SOURCE_ID), originalSource);
  assert.deepEqual(db.store.get(DEST_ID), {});
  assert.deepEqual(db.deletedEvents, ['evt_2']);
});

test('applyTransfer: source upsert failure after destination success — a retry is safe (harmless re-grant, then the source clears)', async () => {
  const originalSource = { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' };
  const db = createStubDb(
    { [SOURCE_ID]: originalSource, [DEST_ID]: {} },
    { failIds: new Set([SOURCE_ID]) },
  );
  const event = { id: 'evt_3', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

  const firstResult = await applyTransfer(event, db);
  assert.deepEqual(firstResult, { ok: false, retry: true });
  assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' });
  assert.deepEqual(db.store.get(SOURCE_ID), originalSource);
  assert.deepEqual(db.deletedEvents, ['evt_3']);

  // RC retries the same event; this time nothing fails.
  const retryDb = createStubDb({ [SOURCE_ID]: db.store.get(SOURCE_ID), [DEST_ID]: db.store.get(DEST_ID) });
  const secondResult = await applyTransfer(event, retryDb);

  assert.deepEqual(secondResult, { ok: true });
  assert.deepEqual(retryDb.store.get(DEST_ID), { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' });
  assert.deepEqual(retryDb.store.get(SOURCE_ID), { isPro: false, proExpiresAt: null, proSource: null });
});

test('applyTransfer: no Supabase-user destinations (anonymous-only transfer) is a safe no-op', async () => {
  const db = createStubDb({});
  const event = {
    id: 'evt_4',
    type: 'TRANSFER',
    transferred_from: ['$RCAnonymousID:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    transferred_to: ['$RCAnonymousID:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
  };
  const result = await applyTransfer(event, db);
  assert.deepEqual(result, { ok: true });
  assert.equal(db.store.size, 0);
});

test('applyTransfer: an already-expired source iap grant is not used for the destination grant, but the stale source still clears', async () => {
  const db = createStubDb({
    [SOURCE_ID]: { isPro: true, proExpiresAt: PAST_EXPIRY, proSource: 'iap' },
    [DEST_ID]: {},
  });
  const event = { id: 'evt_5', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

  const result = await applyTransfer(event, db);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(db.store.get(DEST_ID), {});
  assert.deepEqual(db.store.get(SOURCE_ID), { isPro: false, proExpiresAt: null, proSource: null });
});

test('applyTransfer: destination read error — nothing written, dedup row deleted, retry signaled, posts "failed, will retry"', async () => {
  const originalSource = { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' };
  const db = createStubDb(
    { [SOURCE_ID]: originalSource, [DEST_ID]: {} },
    { readErrorIds: new Set([DEST_ID]) },
  );
  const event = { id: 'evt_6', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

  const slack = createStubSlack();
  const result = await applyTransfer(event, db, undefined, slack);

  assert.deepEqual(result, { ok: false, retry: true });
  // Nothing written at all — the read error aborts before either loop runs.
  assert.deepEqual(db.store.get(SOURCE_ID), originalSource);
  assert.deepEqual(db.store.get(DEST_ID), {});
  assert.deepEqual(db.deletedEvents, ['evt_6']);
  assert.deepEqual(slack.posts, ['ClearPass transfer: failed, will retry, event evt_6, reason read error']);
});

test('applyTransfer: source read error — nothing written, dedup row deleted, retry signaled, posts "failed, will retry"', async () => {
  const originalSource = { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' };
  const db = createStubDb(
    { [SOURCE_ID]: originalSource, [DEST_ID]: {} },
    { readErrorIds: new Set([SOURCE_ID]) },
  );
  const event = { id: 'evt_7', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

  const slack = createStubSlack();
  const result = await applyTransfer(event, db, undefined, slack);

  assert.deepEqual(result, { ok: false, retry: true });
  assert.deepEqual(db.store.get(SOURCE_ID), originalSource);
  assert.deepEqual(db.store.get(DEST_ID), {});
  assert.deepEqual(db.deletedEvents, ['evt_7']);
  assert.deepEqual(slack.posts, ['ClearPass transfer: failed, will retry, event evt_7, reason read error']);
});

test('applyTransfer: a failing deleteWebhookEvent does not crash the handler — still reports retry', async () => {
  const db = createStubDb(
    { [SOURCE_ID]: {}, [DEST_ID]: {} },
    { readErrorIds: new Set([SOURCE_ID]), deleteFails: true },
  );
  const event = { id: 'evt_8', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

  const result = await applyTransfer(event, db);

  assert.deepEqual(result, { ok: false, retry: true });
  assert.deepEqual(db.deletedEvents, []); // the delete itself failed, never recorded
});

// ─── applySingleUserUpdate (the read-error fix applied to the main path) ──

const SINGLE_USER_ID = 'c3d4e5f6-a7b8-4901-c234-567890abcdef';

test('applySingleUserUpdate: success — merges the patch into the existing progress, preserving unrelated keys', async () => {
  const db = createStubDb({ [SINGLE_USER_ID]: { xp: 20, isPro: false } });
  const event = { id: 'evt_su_1', type: 'INITIAL_PURCHASE', app_user_id: SINGLE_USER_ID, expiration_at_ms: 1794650374714 };

  const result = await applySingleUserUpdate(event, db);

  assert.deepEqual(result, { ok: true });
  const stored = db.store.get(SINGLE_USER_ID);
  assert.equal(stored.isPro, true);
  assert.equal(stored.proSource, 'iap');
  assert.equal(stored.xp, 20);
});

test('applySingleUserUpdate: a read error aborts before any write, deletes the dedup row, signals retry', async () => {
  const db = createStubDb({ [SINGLE_USER_ID]: { xp: 20 } }, { readErrorIds: new Set([SINGLE_USER_ID]) });
  const event = { id: 'evt_su_2', type: 'INITIAL_PURCHASE', app_user_id: SINGLE_USER_ID, expiration_at_ms: 1794650374714 };

  const result = await applySingleUserUpdate(event, db);

  assert.deepEqual(result, { ok: false, retry: true });
  assert.deepEqual(db.store.get(SINGLE_USER_ID), { xp: 20 }); // untouched
  assert.deepEqual(db.deletedEvents, ['evt_su_2']);
});

test('applySingleUserUpdate: a write error deletes the dedup row and signals retry', async () => {
  const db = createStubDb({ [SINGLE_USER_ID]: { xp: 20 } }, { failIds: new Set([SINGLE_USER_ID]) });
  const event = { id: 'evt_su_3', type: 'INITIAL_PURCHASE', app_user_id: SINGLE_USER_ID, expiration_at_ms: 1794650374714 };

  const result = await applySingleUserUpdate(event, db);

  assert.deepEqual(result, { ok: false, retry: true });
  assert.deepEqual(db.store.get(SINGLE_USER_ID), { xp: 20 });
  assert.deepEqual(db.deletedEvents, ['evt_su_3']);
});

test('applySingleUserUpdate: an unhandled event type is a no-op, no read/write attempted beyond the lookup, ok true', async () => {
  const db = createStubDb({ [SINGLE_USER_ID]: { xp: 20 } });
  const event = { id: 'evt_su_4', type: 'BILLING_ISSUE', app_user_id: SINGLE_USER_ID };

  const result = await applySingleUserUpdate(event, db);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(db.store.get(SINGLE_USER_ID), { xp: 20 }); // unchanged
});

test('applySingleUserUpdate: missing app_user_id is a safe no-op', async () => {
  const db = createStubDb({});
  const event = { id: 'evt_su_5', type: 'INITIAL_PURCHASE' };

  const result = await applySingleUserUpdate(event, db);

  assert.deepEqual(result, { ok: true });
  assert.equal(db.store.size, 0);
});

// A db whose every method throws — used to prove a code path never reaches
// the database at all, not just that it happens to succeed.
function createUnreachableDb() {
  const fail = () => { throw new Error('db should not have been called'); };
  return { getProgress: fail, upsertProgress: fail, deleteWebhookEvent: fail };
}

test('applySingleUserUpdate: an RC anonymous app_user_id is skipped before any read', async () => {
  const db = createUnreachableDb();
  const event = {
    id: 'evt_su_6',
    type: 'INITIAL_PURCHASE',
    app_user_id: '$RCAnonymousID:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };

  const result = await applySingleUserUpdate(event, db);

  assert.deepEqual(result, { ok: true });
});

test('applySingleUserUpdate: a TEST event with a non-UUID app_user_id is skipped before any read', async () => {
  const db = createUnreachableDb();
  const event = { id: 'evt_su_7', type: 'TEST', app_user_id: 'test_app_user_id' };

  const result = await applySingleUserUpdate(event, db);

  assert.deepEqual(result, { ok: true });
});

// ─── applyTransfer via RevenueCat lookup (REVENUECAT_SECRET_API_KEY set) ──

// Stub RC API client: `responses` maps appUserId -> { active, expiresAt };
// anything not listed resolves to { active: false, expiresAt: null }.
// `throwFor` makes specific appUserId lookups throw (a real API failure).
function createStubRcApi(responses = {}, throwFor = new Set()) {
  const calls = [];
  return {
    calls,
    async getProEntitlement(appUserId) {
      calls.push(appUserId);
      if (throwFor.has(appUserId)) throw new Error('stub RevenueCat API failure');
      return responses[appUserId] || { active: false, expiresAt: null };
    },
  };
}

// Stub Slack poster: `post` calls are recorded verbatim; `throws: true`
// makes it reject, to prove applyTransfer swallows that and carries on.
function createStubSlack({ throws = false } = {}) {
  const posts = [];
  return {
    posts,
    async post(text) {
      posts.push(text);
      if (throws) throw new Error('stub Slack failure');
      return true;
    },
  };
}

// REVENUECAT_SECRET_API_KEY gates which path applyTransfer takes, and must
// never leak between tests — every test below sets/deletes it itself and
// restores whatever was there before in a finally block.
async function withRcApiKey(value, fn) {
  const previous = process.env.REVENUECAT_SECRET_API_KEY;
  if (value === undefined) {
    delete process.env.REVENUECAT_SECRET_API_KEY;
  } else {
    process.env.REVENUECAT_SECRET_API_KEY = value;
  }
  try {
    await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.REVENUECAT_SECRET_API_KEY;
    } else {
      process.env.REVENUECAT_SECRET_API_KEY = previous;
    }
  }
}

test('applyTransfer via RC: anonymous source + active destination → granted (the case actually hit in production)', async () => {
  await withRcApiKey('sk_test', async () => {
    const db = createStubDb({ [DEST_ID]: {} });
    const rcApi = createStubRcApi({ [DEST_ID]: { active: true, expiresAt: FUTURE_EXPIRY } });
    const event = {
      id: 'evt_rc_1',
      type: 'TRANSFER',
      transferred_from: ['$RCAnonymousID:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      transferred_to: [DEST_ID],
    };

    const slack = createStubSlack();
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' });
    // No real Supabase source, so RC was never asked about one.
    assert.deepEqual(rcApi.calls, [DEST_ID]);
    assert.deepEqual(slack.posts, [`ClearPass transfer: granted, destination ${DEST_ID}, expiry ${FUTURE_EXPIRY}`]);
  });
});

test('applyTransfer via RC: destination not active in RevenueCat → no grant', async () => {
  await withRcApiKey('sk_test', async () => {
    const db = createStubDb({ [DEST_ID]: {} });
    const rcApi = createStubRcApi({ [DEST_ID]: { active: false, expiresAt: null } });
    const event = { id: 'evt_rc_2', type: 'TRANSFER', transferred_from: [], transferred_to: [DEST_ID] };

    const slack = createStubSlack();
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(db.store.get(DEST_ID), {});
    assert.deepEqual(slack.posts, [`ClearPass transfer: not granted, destination ${DEST_ID}, expiry none`]);
  });
});

test('applyTransfer via RC: a RevenueCat API error aborts before any write, deletes the dedup row, signals retry, posts "failed"', async () => {
  await withRcApiKey('sk_test', async () => {
    const db = createStubDb({ [DEST_ID]: {} });
    const rcApi = createStubRcApi({}, new Set([DEST_ID]));
    const event = { id: 'evt_rc_3', type: 'TRANSFER', transferred_from: [], transferred_to: [DEST_ID] };

    const slack = createStubSlack();
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: false, retry: true });
    assert.deepEqual(db.store.get(DEST_ID), {});
    assert.deepEqual(db.deletedEvents, ['evt_rc_3']);
    assert.deepEqual(slack.posts, [`ClearPass transfer: failed, destination ${DEST_ID}, expiry none`]);
  });
});

test('applyTransfer via RC: a failing Slack post is swallowed — does not affect the webhook result', async () => {
  await withRcApiKey('sk_test', async () => {
    const db = createStubDb({ [DEST_ID]: {} });
    const rcApi = createStubRcApi({ [DEST_ID]: { active: true, expiresAt: FUTURE_EXPIRY } });
    const event = { id: 'evt_rc_3b', type: 'TRANSFER', transferred_from: [], transferred_to: [DEST_ID] };

    const slack = createStubSlack({ throws: true });
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' });
  });
});

test('applyTransfer: REVENUECAT_SECRET_API_KEY missing falls back to local source-expiry logic, posts once that the fallback was used', async () => {
  await withRcApiKey(undefined, async () => {
    const db = createStubDb({
      [SOURCE_ID]: { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' },
      [DEST_ID]: {},
    });
    // An rcApi that would throw if ever called — proves the fallback never
    // touches it. applyTransferLocal itself never posts to Slack either
    // (asserted below via the single expected post being the fallback
    // notice, not anything from inside the local grant/clear logic).
    const rcApi = { getProEntitlement: async () => { throw new Error('should not be called'); } };
    const slack = createStubSlack();
    const event = { id: 'evt_rc_4', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' });
    assert.deepEqual(db.store.get(SOURCE_ID), { isPro: false, proExpiresAt: null, proSource: null });
    assert.deepEqual(slack.posts, ['ClearPass transfer: RevenueCat key missing, used fallback, event evt_rc_4']);
  });
});

test('applyTransfer via RC: source still active in RevenueCat → source is not cleared', async () => {
  await withRcApiKey('sk_test', async () => {
    const originalSource = { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' };
    const db = createStubDb({ [SOURCE_ID]: originalSource, [DEST_ID]: {} });
    const rcApi = createStubRcApi({
      [DEST_ID]: { active: false, expiresAt: null },
      [SOURCE_ID]: { active: true, expiresAt: FUTURE_EXPIRY },
    });
    const event = { id: 'evt_rc_5', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

    const slack = createStubSlack();
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(db.store.get(SOURCE_ID), originalSource);
    // A normal source-clearing outcome doesn't post to Slack — only
    // destination outcomes and source FAILURES do (see the two tests below).
    assert.deepEqual(slack.posts, [`ClearPass transfer: not granted, destination ${DEST_ID}, expiry none`]);
  });
});

test('applyTransfer via RC: source lookup error posts "failed, will retry" with reason', async () => {
  await withRcApiKey('sk_test', async () => {
    const originalSource = { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' };
    const db = createStubDb({ [SOURCE_ID]: originalSource, [DEST_ID]: {} });
    const rcApi = createStubRcApi(
      { [DEST_ID]: { active: false, expiresAt: null } },
      new Set([SOURCE_ID]),
    );
    const event = { id: 'evt_rc_9', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

    const slack = createStubSlack();
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: false, retry: true });
    assert.deepEqual(db.store.get(SOURCE_ID), originalSource);
    assert.deepEqual(db.deletedEvents, ['evt_rc_9']);
    // The destination's "not granted" outcome posted first, then the source
    // lookup failure aborted the whole event.
    assert.deepEqual(slack.posts, [
      `ClearPass transfer: not granted, destination ${DEST_ID}, expiry none`,
      'ClearPass transfer: failed, will retry, event evt_rc_9, reason source lookup error',
    ]);
  });
});

test('applyTransfer via RC: source DB write fails after RC confirms it is no longer active → "failed, will retry"', async () => {
  await withRcApiKey('sk_test', async () => {
    const originalSource = { isPro: true, proExpiresAt: FUTURE_EXPIRY, proSource: 'iap' };
    const db = createStubDb(
      { [SOURCE_ID]: originalSource, [DEST_ID]: {} },
      { failIds: new Set([SOURCE_ID]) },
    );
    const rcApi = createStubRcApi({
      [DEST_ID]: { active: false, expiresAt: null },
      [SOURCE_ID]: { active: false, expiresAt: null },
    });
    const event = { id: 'evt_rc_10', type: 'TRANSFER', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };

    const slack = createStubSlack();
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: false, retry: true });
    assert.deepEqual(db.store.get(SOURCE_ID), originalSource);
    assert.deepEqual(db.deletedEvents, ['evt_rc_10']);
    assert.deepEqual(slack.posts, [
      `ClearPass transfer: not granted, destination ${DEST_ID}, expiry none`,
      'ClearPass transfer: failed, will retry, event evt_rc_10, reason source write error',
    ]);
  });
});

test('applyTransfer via RC: destination active but non-expiring ("pro" with a null expiry) → no grant, warning only', async () => {
  await withRcApiKey('sk_test', async () => {
    const db = createStubDb({ [DEST_ID]: {} });
    const rcApi = createStubRcApi({ [DEST_ID]: { active: true, expiresAt: null } });
    const event = { id: 'evt_rc_6', type: 'TRANSFER', transferred_from: [], transferred_to: [DEST_ID] };

    const slack = createStubSlack();
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(db.store.get(DEST_ID), {});
    assert.deepEqual(slack.posts, [`ClearPass transfer: not granted, destination ${DEST_ID}, expiry none`]);
  });
});

test('applyTransfer via RC: destination already has a higher-priority grant → not granted, posts the RC expiry', async () => {
  await withRcApiKey('sk_test', async () => {
    const db = createStubDb({ [DEST_ID]: { isPro: true, proExpiresAt: null, proSource: 'comp' } });
    const rcApi = createStubRcApi({ [DEST_ID]: { active: true, expiresAt: FUTURE_EXPIRY } });
    const event = { id: 'evt_rc_7', type: 'TRANSFER', transferred_from: [], transferred_to: [DEST_ID] };

    const slack = createStubSlack();
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: null, proSource: 'comp' });
    assert.deepEqual(slack.posts, [`ClearPass transfer: not granted, destination ${DEST_ID}, expiry ${FUTURE_EXPIRY}`]);
  });
});

test('applyTransfer via RC: destination DB write fails after a successful lookup → failed, posts the expiry that would have been granted', async () => {
  await withRcApiKey('sk_test', async () => {
    const db = createStubDb({ [DEST_ID]: {} }, { failIds: new Set([DEST_ID]) });
    const rcApi = createStubRcApi({ [DEST_ID]: { active: true, expiresAt: FUTURE_EXPIRY } });
    const event = { id: 'evt_rc_8', type: 'TRANSFER', transferred_from: [], transferred_to: [DEST_ID] };

    const slack = createStubSlack();
    const result = await applyTransfer(event, db, rcApi, slack);

    assert.deepEqual(result, { ok: false, retry: true });
    assert.deepEqual(db.deletedEvents, ['evt_rc_8']);
    assert.deepEqual(slack.posts, [`ClearPass transfer: failed, destination ${DEST_ID}, expiry ${FUTURE_EXPIRY}`]);
  });
});
