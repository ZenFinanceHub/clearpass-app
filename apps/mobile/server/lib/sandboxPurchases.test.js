'use strict';

// RevenueCat SANDBOX (TestFlight / App Review / licence tester) purchases:
// they still grant Pro, are recorded as proSource 'iap_sandbox', never act
// on a real 'iap' grant, and are excluded from every paying/revenue/
// conversion number. Genuine customers' entitlements must be unchanged.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldApplyProGrant,
  clearIapGrant,
  iapSourceForEnvironment,
  isEligibleForProExpiry,
} = require('./entitlement');
const {
  SANDBOX_PURCHASE_MARKER_EVENT,
  buildSandboxPurchaseMarkerRow,
  resolveRevenueCatUpdate,
  resolveTransferSourceUpdate,
  resolveTransferDestinationUpdate,
  applyTransfer,
  applySingleUserUpdate,
} = require('./revenuecatWebhook');
const { resolveStripeProGrant } = require('./stripeWebhook');
const { grantInstructorProForUser } = require('./grantInstructorPro');
const { computeDailyStats, formatDailyStatsMessage, PAYING_SOURCES } = require('./dailyStats');
const { sandboxTesterUserIds, computeFunnelStats } = require('./funnelStats');
const { resolveSeatGrant } = require('./seats');

const USER = 'c3d4e5f6-a7b8-4901-c234-567890abcdef';
const SOURCE_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const DEST_ID = 'b2c3d4e5-f6a7-4890-b123-4567890abcde';

const EXP_MS = Date.now() + 1000 * 60 * 60 * 24 * 30;
const EXP_ISO = new Date(EXP_MS).toISOString();
const LATER_MS = EXP_MS + 1000 * 60 * 60 * 24 * 60;
const LATER_ISO = new Date(LATER_MS).toISOString();
const PAST_ISO = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

function createStubDb(initial = {}, { markerFails = false, withMarker = true } = {}) {
  const store = new Map(Object.entries(initial));
  const markers = [];
  const db = {
    store,
    markers,
    deletedEvents: [],
    async getProgress(id) {
      return store.has(id) ? store.get(id) : null;
    },
    async upsertProgress(id, progress) {
      store.set(id, progress);
      return { error: null };
    },
    async deleteWebhookEvent(eventId) {
      db.deletedEvents.push(eventId);
    },
  };
  if (withMarker) {
    db.recordSandboxPurchase = async (userId, event) => {
      if (markerFails) throw new Error('stub marker failure');
      markers.push(buildSandboxPurchaseMarkerRow(userId, event));
    };
  }
  return db;
}

function rcEvent(type, environment, extra = {}) {
  return {
    id: `evt_${type}_${environment}_${Math.random().toString(16).slice(2)}`,
    type,
    app_user_id: USER,
    expiration_at_ms: EXP_MS,
    store: 'APP_STORE',
    product_id: 'clearpass_pro_monthly',
    ...(environment === undefined ? {} : { environment }),
    ...extra,
  };
}

function withRcKey(value, fn) {
  const before = process.env.REVENUECAT_SECRET_API_KEY;
  if (value === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
  else process.env.REVENUECAT_SECRET_API_KEY = value;
  return Promise.resolve(fn()).finally(() => {
    if (before === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
    else process.env.REVENUECAT_SECRET_API_KEY = before;
  });
}

const silentSlack = { posts: [], async post(t) { this.posts.push(t); return true; } };

// ── Source mapping / precedence ──────────────────────────────────────────────

test('iapSourceForEnvironment: only explicit SANDBOX is iap_sandbox; PRODUCTION, missing and unknown stay iap', () => {
  assert.equal(iapSourceForEnvironment('SANDBOX'), 'iap_sandbox');
  assert.equal(iapSourceForEnvironment('PRODUCTION'), 'iap');
  assert.equal(iapSourceForEnvironment(undefined), 'iap');
  assert.equal(iapSourceForEnvironment(null), 'iap');
  assert.equal(iapSourceForEnvironment('sandbox'), 'iap');
});

test('shouldApplyProGrant: iap_sandbox never replaces a real grant, and every real grant replaces it', () => {
  for (const real of ['stripe', 'iap', 'seat']) {
    assert.equal(shouldApplyProGrant(real, 'iap_sandbox', EXP_ISO, LATER_ISO), false, `sandbox over ${real}`);
    assert.equal(shouldApplyProGrant('iap_sandbox', real, LATER_ISO, EXP_ISO), true, `${real} over sandbox`);
  }
  // Permanent grants: sandbox can't replace them (and they replace sandbox).
  assert.equal(shouldApplyProGrant('comp', 'iap_sandbox', null, EXP_ISO), false);
  assert.equal(shouldApplyProGrant('instructor', 'iap_sandbox', null, EXP_ISO), false);
  assert.equal(shouldApplyProGrant('iap_sandbox', 'instructor'), true);
  // No existing grant, or a sandbox renewal over itself.
  assert.equal(shouldApplyProGrant(null, 'iap_sandbox', null, EXP_ISO), true);
  assert.equal(shouldApplyProGrant('iap_sandbox', 'iap_sandbox', EXP_ISO, LATER_ISO), true);
});

test('clearIapGrant: clears only the grant from the matching environment', () => {
  const real = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap', xp: 3 };
  const sandbox = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox', xp: 3 };
  assert.deepEqual(clearIapGrant(real), { isPro: false, proExpiresAt: null, proSource: null, xp: 3 });
  assert.equal(clearIapGrant(real, 'iap_sandbox'), real);
  assert.equal(clearIapGrant(sandbox), sandbox);
  assert.deepEqual(clearIapGrant(sandbox, 'iap_sandbox'), { isPro: false, proExpiresAt: null, proSource: null, xp: 3 });
  // Never usable to clear a non-iap grant.
  const stripe = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'stripe' };
  assert.equal(clearIapGrant(stripe, 'stripe'), stripe);
});

test('iap_sandbox grants expire through the normal expire-pro rule', () => {
  assert.equal(isEligibleForProExpiry({ isPro: true, proSource: 'iap_sandbox', proExpiresAt: PAST_ISO }, new Date().toISOString()), true);
  assert.equal(isEligibleForProExpiry({ isPro: true, proSource: 'iap_sandbox', proExpiresAt: EXP_ISO }, new Date().toISOString()), false);
});

// ── Single-user events ───────────────────────────────────────────────────────

test('SANDBOX INITIAL_PURCHASE on a free user still grants Pro (App Review), as iap_sandbox', () => {
  const { progress } = resolveRevenueCatUpdate('INITIAL_PURCHASE', EXP_MS, {}, 'SANDBOX');
  assert.deepEqual(progress, { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' });
});

test('PRODUCTION INITIAL_PURCHASE and RENEWAL are unchanged: proSource iap', () => {
  assert.deepEqual(resolveRevenueCatUpdate('INITIAL_PURCHASE', EXP_MS, {}, 'PRODUCTION').progress,
    { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' });
  const current = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' };
  assert.deepEqual(resolveRevenueCatUpdate('RENEWAL', LATER_MS, current, 'PRODUCTION').progress,
    { isPro: true, proExpiresAt: LATER_ISO, proSource: 'iap' });
});

test('missing environment behaves exactly as before (production iap)', () => {
  assert.deepEqual(resolveRevenueCatUpdate('INITIAL_PURCHASE', EXP_MS, {}).progress,
    { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' });
  const current = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' };
  assert.deepEqual(resolveRevenueCatUpdate('EXPIRATION', null, current).progress,
    { isPro: false, proExpiresAt: null, proSource: null });
});

test('tested in sandbox, then bought for real: PRODUCTION purchase replaces iap_sandbox with iap', () => {
  const current = { isPro: true, proExpiresAt: LATER_ISO, proSource: 'iap_sandbox' };
  const { progress } = resolveRevenueCatUpdate('INITIAL_PURCHASE', EXP_MS, current, 'PRODUCTION');
  assert.deepEqual(progress, { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' });
});

test('bought for real, later sandbox events (purchase/renewal/cancellation/expiration) never touch the real grant', () => {
  const current = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' };
  for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'EXPIRATION']) {
    const { progress } = resolveRevenueCatUpdate(type, LATER_MS, current, 'SANDBOX');
    assert.equal(progress, null, type);
  }
});

test('sandbox RENEWAL extends, CANCELLATION sets the end date, EXPIRATION clears an iap_sandbox grant', () => {
  const current = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' };
  assert.deepEqual(resolveRevenueCatUpdate('RENEWAL', LATER_MS, current, 'SANDBOX').progress,
    { isPro: true, proExpiresAt: LATER_ISO, proSource: 'iap_sandbox' });
  assert.deepEqual(resolveRevenueCatUpdate('CANCELLATION', LATER_MS, current, 'SANDBOX').progress,
    { proExpiresAt: LATER_ISO });
  assert.deepEqual(resolveRevenueCatUpdate('EXPIRATION', null, current, 'SANDBOX').progress,
    { isPro: false, proExpiresAt: null, proSource: null });
});

test('PRODUCTION CANCELLATION/EXPIRATION never clear an iap_sandbox grant', () => {
  const current = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' };
  assert.equal(resolveRevenueCatUpdate('CANCELLATION', LATER_MS, current, 'PRODUCTION').progress, null);
  assert.equal(resolveRevenueCatUpdate('EXPIRATION', null, current, 'PRODUCTION').progress, null);
});

test('sandbox purchase by a Stripe, comp, instructor or seat user changes nothing', () => {
  for (const current of [
    { isPro: true, proExpiresAt: EXP_ISO, proSource: 'stripe' },
    { isPro: true, proExpiresAt: null, proSource: 'comp' },
    { isPro: true, proExpiresAt: null, proSource: 'instructor' },
    { isPro: true, proExpiresAt: EXP_ISO, proSource: 'seat' },
  ]) {
    assert.equal(resolveRevenueCatUpdate('INITIAL_PURCHASE', LATER_MS, current, 'SANDBOX').progress, null, current.proSource);
    assert.equal(resolveRevenueCatUpdate('EXPIRATION', null, current, 'SANDBOX').progress, null, current.proSource);
  }
});

test('Stripe web purchase over an iap_sandbox grant is a normal stripe grant', () => {
  const patch = resolveStripeProGrant({ isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' }, undefined);
  assert.equal(patch.proSource, 'stripe');
  assert.equal(patch.isPro, true);
});

test('instructor Pro still applies over an iap_sandbox grant', async () => {
  const db = createStubDb({ [USER]: { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' } });
  db.postSlack = async () => true;
  const result = await grantInstructorProForUser(USER, db);
  assert.equal(result.outcome, 'granted');
  assert.deepEqual(db.store.get(USER), { isPro: true, proExpiresAt: null, proSource: 'instructor' });
});

test('seat redemption over an iap_sandbox grant grants a fresh seat (sandbox is not real paid time to extend)', () => {
  const now = new Date().toISOString();
  const r = resolveSeatGrant({ isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' }, now);
  assert.equal(r.action, 'grant');
  assert.equal(r.extended, false);
  assert.equal(r.updatedProgress.proSource, 'seat');
});

// ── applySingleUserUpdate wiring + reporting marker ──────────────────────────

test('applySingleUserUpdate: SANDBOX INITIAL_PURCHASE grants iap_sandbox and records one marker row', async () => {
  const db = createStubDb({ [USER]: { xp: 7 } });
  const event = rcEvent('INITIAL_PURCHASE', 'SANDBOX');
  const result = await applySingleUserUpdate(event, db);
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(db.store.get(USER), { xp: 7, isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' });
  assert.equal(db.markers.length, 1);
  const row = db.markers[0];
  assert.equal(row.user_id, USER);
  assert.equal(row.event, SANDBOX_PURCHASE_MARKER_EVENT);
  assert.equal(row.platform, 'ios');
  assert.ok(row.anon_id.length >= 8 && row.anon_id.length <= 64);
  assert.equal(row.props.environment, 'SANDBOX');
  assert.equal(row.props.rc_event_id, event.id);
});

test('applySingleUserUpdate: PRODUCTION purchase records no marker and grants iap', async () => {
  const db = createStubDb({});
  await applySingleUserUpdate(rcEvent('INITIAL_PURCHASE', 'PRODUCTION'), db);
  assert.equal(db.markers.length, 0);
  assert.equal(db.store.get(USER).proSource, 'iap');
});

test('applySingleUserUpdate: sandbox marker is recorded even when a real grant blocks the sandbox grant', async () => {
  const real = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' };
  const db = createStubDb({ [USER]: real });
  await applySingleUserUpdate(rcEvent('INITIAL_PURCHASE', 'SANDBOX', { expiration_at_ms: LATER_MS }), db);
  assert.deepEqual(db.store.get(USER), real);
  assert.equal(db.markers.length, 1);
});

test('applySingleUserUpdate: a failing marker write never fails or blocks the grant', async () => {
  const db = createStubDb({}, { markerFails: true });
  const result = await applySingleUserUpdate(rcEvent('INITIAL_PURCHASE', 'SANDBOX'), db);
  assert.deepEqual(result, { ok: true });
  assert.equal(db.store.get(USER).proSource, 'iap_sandbox');
  assert.deepEqual(db.deletedEvents, []);
});

test('applySingleUserUpdate: adapters without recordSandboxPurchase still work', async () => {
  const db = createStubDb({}, { withMarker: false });
  const result = await applySingleUserUpdate(rcEvent('INITIAL_PURCHASE', 'SANDBOX'), db);
  assert.deepEqual(result, { ok: true });
  assert.equal(db.store.get(USER).proSource, 'iap_sandbox');
});

test('applySingleUserUpdate: SANDBOX EXPIRATION for a user who now has real iap leaves them Pro', async () => {
  const real = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap', xp: 1 };
  const db = createStubDb({ [USER]: real });
  await applySingleUserUpdate(rcEvent('EXPIRATION', 'SANDBOX', { expiration_at_ms: null }), db);
  assert.deepEqual(db.store.get(USER), real);
});

test('buildSandboxPurchaseMarkerRow: Play Store maps to android, unknown store to null, long ids truncated', () => {
  assert.equal(buildSandboxPurchaseMarkerRow(USER, { id: 'e1234567', store: 'PLAY_STORE' }).platform, 'android');
  assert.equal(buildSandboxPurchaseMarkerRow(USER, { id: 'e1234567', store: 'STRIPE' }).platform, null);
  const row = buildSandboxPurchaseMarkerRow(USER, { id: 'x'.repeat(200) });
  assert.equal(row.anon_id.length, 64);
});

// ── TRANSFER (restore onto another account) ──────────────────────────────────

test('TRANSFER pure helpers respect the environment', () => {
  const real = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' };
  const sandbox = { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' };
  assert.equal(resolveTransferSourceUpdate(real, 'iap_sandbox'), null);
  assert.deepEqual(resolveTransferSourceUpdate(sandbox, 'iap_sandbox'), { isPro: false, proExpiresAt: null, proSource: null });
  assert.equal(resolveTransferSourceUpdate(sandbox), null);
  assert.deepEqual(resolveTransferDestinationUpdate({}, EXP_ISO, 'iap_sandbox').progress,
    { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' });
  assert.equal(resolveTransferDestinationUpdate(real, LATER_ISO, 'iap_sandbox').progress, null);
});

test('SANDBOX TRANSFER via RevenueCat: destination gets iap_sandbox, a real iap source is not cleared', async () => {
  await withRcKey('sk_test_stub', async () => {
    const db = createStubDb({
      [SOURCE_ID]: { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' },
      [DEST_ID]: {},
    });
    const rcApi = { getProEntitlement: async (id) => (id === DEST_ID ? { active: true, expiresAt: LATER_ISO } : { active: false, expiresAt: null }) };
    const event = { id: 'evt_t1', type: 'TRANSFER', environment: 'SANDBOX', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };
    const result = await applyTransfer(event, db, rcApi, silentSlack);
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: LATER_ISO, proSource: 'iap_sandbox' });
    assert.deepEqual(db.store.get(SOURCE_ID), { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' });
  });
});

test('SANDBOX TRANSFER via RevenueCat: an iap_sandbox source is cleared', async () => {
  await withRcKey('sk_test_stub', async () => {
    const db = createStubDb({
      [SOURCE_ID]: { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' },
      [DEST_ID]: {},
    });
    const rcApi = { getProEntitlement: async (id) => (id === DEST_ID ? { active: true, expiresAt: EXP_ISO } : { active: false, expiresAt: null }) };
    const event = { id: 'evt_t2', type: 'TRANSFER', environment: 'SANDBOX', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };
    await applyTransfer(event, db, rcApi, silentSlack);
    assert.deepEqual(db.store.get(SOURCE_ID), { isPro: false, proExpiresAt: null, proSource: null });
    assert.equal(db.store.get(DEST_ID).proSource, 'iap_sandbox');
  });
});

test('PRODUCTION TRANSFER (restore) via RevenueCat is unchanged and upgrades an iap_sandbox destination to iap', async () => {
  await withRcKey('sk_test_stub', async () => {
    const db = createStubDb({
      [SOURCE_ID]: { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' },
      [DEST_ID]: { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' },
    });
    const rcApi = { getProEntitlement: async (id) => (id === DEST_ID ? { active: true, expiresAt: LATER_ISO } : { active: false, expiresAt: null }) };
    const event = { id: 'evt_t3', type: 'TRANSFER', environment: 'PRODUCTION', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };
    await applyTransfer(event, db, rcApi, silentSlack);
    assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: LATER_ISO, proSource: 'iap' });
    assert.deepEqual(db.store.get(SOURCE_ID), { isPro: false, proExpiresAt: null, proSource: null });
  });
});

test('SANDBOX TRANSFER local fallback: only an iap_sandbox source is used and moved', async () => {
  await withRcKey(undefined, async () => {
    const db = createStubDb({
      [SOURCE_ID]: { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' },
      [DEST_ID]: {},
    });
    const event = { id: 'evt_t4', type: 'TRANSFER', environment: 'SANDBOX', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };
    await applyTransfer(event, db, undefined, silentSlack);
    // The real iap source isn't a sandbox grant: nothing to move, nothing cleared.
    assert.deepEqual(db.store.get(SOURCE_ID), { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap' });
    assert.deepEqual(db.store.get(DEST_ID), {});

    const db2 = createStubDb({
      [SOURCE_ID]: { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' },
      [DEST_ID]: {},
    });
    await applyTransfer({ ...event, id: 'evt_t5' }, db2, undefined, silentSlack);
    assert.deepEqual(db2.store.get(DEST_ID), { isPro: true, proExpiresAt: EXP_ISO, proSource: 'iap_sandbox' });
    assert.deepEqual(db2.store.get(SOURCE_ID), { isPro: false, proExpiresAt: null, proSource: null });
  });
});

// ── Reporting ────────────────────────────────────────────────────────────────

const NOW = '2026-08-25T12:00:00.000Z';
const FUTURE = '2026-12-01T00:00:00.000Z';
const OLD = '2026-01-01T00:00:00.000Z';

test('PAYING_SOURCES never includes iap_sandbox', () => {
  assert.equal(PAYING_SOURCES.includes('iap_sandbox'), false);
});

test('computeDailyStats: active iap_sandbox is reported separately, not paying, not free, not in conversion', () => {
  const profiles = [
    { id: 'u1', account_type: 'learner', created_at: OLD },
    { id: 'u2', account_type: 'learner', created_at: OLD },
    { id: 'u3', account_type: 'learner', created_at: OLD },
  ];
  const progressRows = [
    { id: 'u1', progress: { isPro: true, proSource: 'iap', proExpiresAt: FUTURE } },
    { id: 'u2', progress: { isPro: true, proSource: 'iap_sandbox', proExpiresAt: FUTURE } },
    { id: 'u3', progress: {} },
  ];
  const stats = computeDailyStats({ profiles, progressRows, nowIso: NOW, refCode: null });
  assert.equal(stats.payingTotal, 1);
  assert.equal(stats.payingIap, 1);
  assert.equal(stats.sandboxPro, 1);
  assert.equal(stats.freeLearners, 1);
  assert.equal(stats.conversionPct, 50); // 1 paying / (1 paying + 1 free)
  assert.match(formatDailyStatsMessage(stats, null), /Sandbox\/test Pro, active:\* 1/);
});

test('computeDailyStats: an expired iap_sandbox learner is just a free learner', () => {
  const stats = computeDailyStats({
    profiles: [{ id: 'u1', account_type: 'learner', created_at: OLD }],
    progressRows: [{ id: 'u1', progress: { isPro: true, proSource: 'iap_sandbox', proExpiresAt: OLD } }],
    nowIso: NOW,
    refCode: null,
  });
  assert.equal(stats.sandboxPro, 0);
  assert.equal(stats.payingTotal, 0);
  assert.equal(stats.freeLearners, 1);
});

test('sandboxTesterUserIds: marker or current iap_sandbox excludes, unless now a real payer', () => {
  const events = [
    { user_id: 'tester', anon_id: 'revenuecat:e1', event: SANDBOX_PURCHASE_MARKER_EVENT, created_at: NOW },
    { user_id: 'converted', anon_id: 'revenuecat:e2', event: SANDBOX_PURCHASE_MARKER_EVENT, created_at: NOW },
  ];
  const progressRows = [{ id: 'current', progress: { isPro: true, proSource: 'iap_sandbox' } }, { id: 'nobody', progress: null }];
  const ids = sandboxTesterUserIds({ events, progressRows, payingUserIds: ['converted'] });
  assert.deepEqual(ids.sort(), ['current', 'tester']);
});

test('computeFunnelStats: a sandbox tester\'s purchase does not count as Purchased; a real buyer\'s does', () => {
  const at = '2026-08-25T11:00:00.000Z';
  const events = [
    { user_id: 'tester', anon_id: 'anon-tester-1', event: 'purchase_succeeded', created_at: at },
    { user_id: 'tester', anon_id: 'revenuecat:e1', event: SANDBOX_PURCHASE_MARKER_EVENT, created_at: at },
    { user_id: 'buyer', anon_id: 'anon-buyer-01', event: 'purchase_succeeded', created_at: at },
  ];
  const excludedUserIds = sandboxTesterUserIds({ events, progressRows: [], payingUserIds: ['buyer'] });
  const steps = computeFunnelStats({ events, excludedUserIds, nowIso: NOW });
  const purchased = steps.find((s) => s.key === 'purchase_succeeded');
  assert.equal(purchased.last24h, 1);
  assert.equal(purchased.last7d, 1);
});
