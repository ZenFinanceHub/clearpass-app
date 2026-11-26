'use strict';

// RevenueCat free trials: a PRODUCTION trial keeps exactly the same Pro
// access as before (isPro / proExpiresAt / expiry), but is recorded as
// proSource 'iap_trial' so it is never counted as a paying customer, and
// trial starts / conversions / cancellations are reported from durable
// funnel_events markers.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldApplyProGrant,
  clearIapGrant,
  iapGrantSource,
  iapSourcesForEnvironment,
  isEligibleForProExpiry,
} = require('./entitlement');
const {
  TRIAL_STARTED_MARKER_EVENT,
  TRIAL_CONVERTED_MARKER_EVENT,
  TRIAL_CANCELLED_MARKER_EVENT,
  SANDBOX_PURCHASE_MARKER_EVENT,
  buildSandboxPurchaseMarkerRow,
  buildTrialMarkerRow,
  classifyPeriod,
  insertFunnelMarkerOnce,
  resolveRevenueCatUpdate,
  trialMarkersFor,
  transferGrantSource,
  applySingleUserUpdate,
  applyTransfer,
} = require('./revenuecatWebhook');
const { computeDailyStats, formatDailyStatsMessage, PAYING_SOURCES, TRIAL_SOURCES } = require('./dailyStats');
const { resolveStripeProGrant } = require('./stripeWebhook');
const { resolveSeatGrant } = require('./seats');

const USER = 'c3d4e5f6-a7b8-4901-c234-567890abcdef';
const SOURCE_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const DEST_ID = 'b2c3d4e5-f6a7-4890-b123-4567890abcde';

const NOW_ISO = new Date().toISOString();
const TRIAL_END_MS = Date.now() + 1000 * 60 * 60 * 24 * 3;
const TRIAL_END_ISO = new Date(TRIAL_END_MS).toISOString();
const PAID_END_MS = TRIAL_END_MS + 1000 * 60 * 60 * 24 * 30;
const PAID_END_ISO = new Date(PAID_END_MS).toISOString();
const PAST_ISO = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
const HOUR_AGO_ISO = new Date(Date.now() - 1000 * 60 * 60).toISOString();
const TWO_DAYS_AGO_ISO = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();

// A minimal supabase-js stand-in for funnel_events, enough for
// insertFunnelMarkerOnce: select().eq().eq().limit() and insert().
function fakeFunnelClient() {
  const rows = [];
  return {
    rows,
    from(table) {
      assert.equal(table, 'funnel_events');
      const filters = [];
      const builder = {
        select() { return builder; },
        eq(col, val) { filters.push([col, val]); return builder; },
        limit(n) {
          const data = rows.filter((r) => filters.every(([c, v]) => r[c] === v)).slice(0, n).map(() => ({ id: 1 }));
          return Promise.resolve({ data, error: null });
        },
        insert(row) { rows.push(row); return Promise.resolve({ error: null }); },
      };
      return builder;
    },
  };
}

function createStubDb(initial = {}, { failWritesFor = 0 } = {}) {
  const store = new Map(Object.entries(initial));
  const client = fakeFunnelClient();
  let writeFailuresLeft = failWritesFor;
  const db = {
    store,
    client,
    deletedEvents: [],
    async getProgress(id) {
      return store.has(id) ? store.get(id) : null;
    },
    async upsertProgress(id, progress) {
      if (writeFailuresLeft > 0) {
        writeFailuresLeft--;
        return { error: new Error('stub write failure') };
      }
      store.set(id, progress);
      return { error: null };
    },
    async deleteWebhookEvent(eventId) {
      db.deletedEvents.push(eventId);
    },
    // Same wiring as proxy.js: both marker kinds go through the once-only insert.
    async recordSandboxPurchase(userId, event) {
      await insertFunnelMarkerOnce(client, buildSandboxPurchaseMarkerRow(userId, event));
    },
    async recordTrialMarker(row) {
      await insertFunnelMarkerOnce(client, row);
    },
  };
  return db;
}

let seq = 0;
function rcEvent(type, extra = {}) {
  seq++;
  return {
    id: `evt_${type}_${seq}`,
    type,
    app_user_id: USER,
    environment: 'PRODUCTION',
    expiration_at_ms: TRIAL_END_MS,
    store: 'APP_STORE',
    product_id: 'clearpass_pro_monthly',
    ...extra,
  };
}

const trialStart = (extra = {}) => rcEvent('INITIAL_PURCHASE', { period_type: 'TRIAL', ...extra });
const conversion = (extra = {}) =>
  rcEvent('RENEWAL', { period_type: 'NORMAL', is_trial_conversion: true, expiration_at_ms: PAID_END_MS, ...extra });
const trialCancel = (extra = {}) =>
  rcEvent('CANCELLATION', { period_type: 'TRIAL', cancel_reason: 'UNSUBSCRIBE', ...extra });

function markerEvents(db) {
  return db.client.rows.map((r) => r.event);
}

function captureWarnings(fn) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  return Promise.resolve(fn()).then(
    (v) => { console.warn = original; return { value: v, warnings }; },
    (e) => { console.warn = original; throw e; },
  );
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

const quietSlack = { async post() { return true; } };

function statsFor(progress, trialMarkers) {
  return computeDailyStats({
    profiles: [{ id: USER, account_type: 'learner', created_at: TWO_DAYS_AGO_ISO }],
    progressRows: [{ id: USER, progress }],
    nowIso: new Date().toISOString(),
    trialMarkers,
  });
}

// ── Classification ───────────────────────────────────────────────────────────

test('classifyPeriod: TRIAL is a trial; NORMAL, INTRO and PREPAID are paid, without warnings', () => {
  assert.deepEqual(classifyPeriod(trialStart()), { periodType: 'TRIAL', inTrial: true, isTrialConversion: false, warning: null });
  for (const p of ['NORMAL', 'INTRO', 'PREPAID']) {
    const c = classifyPeriod(rcEvent('INITIAL_PURCHASE', { period_type: p }));
    assert.equal(c.inTrial, false, p);
    assert.equal(c.periodType, p);
    assert.equal(c.warning, null, p);
  }
});

test('classifyPeriod: PROMOTIONAL is paid iap but logged for review', () => {
  const c = classifyPeriod(rcEvent('INITIAL_PURCHASE', { period_type: 'PROMOTIONAL' }));
  assert.equal(c.inTrial, false);
  assert.match(c.warning, /PROMOTIONAL/);
});

test('classifyPeriod: missing or unknown period_type is NORMAL with a warning', () => {
  const missing = classifyPeriod(rcEvent('INITIAL_PURCHASE'));
  assert.equal(missing.periodType, 'NORMAL');
  assert.equal(missing.inTrial, false);
  assert.match(missing.warning, /missing period_type — treating as NORMAL/);
  const odd = classifyPeriod(rcEvent('RENEWAL', { period_type: 'trial' }));
  assert.equal(odd.inTrial, false);
  assert.match(odd.warning, /unexpected "trial"/);
  // Event types that don't describe a purchase period don't warn.
  assert.equal(classifyPeriod(rcEvent('EXPIRATION')).warning, null);
});

test('classifyPeriod: is_trial_conversion on RENEWAL wins over a TRIAL period_type; ignored on other events', () => {
  const r = classifyPeriod(rcEvent('RENEWAL', { period_type: 'TRIAL', is_trial_conversion: true }));
  assert.equal(r.isTrialConversion, true);
  assert.equal(r.inTrial, false);
  const ip = classifyPeriod(rcEvent('INITIAL_PURCHASE', { period_type: 'TRIAL', is_trial_conversion: true }));
  assert.equal(ip.isTrialConversion, false);
  assert.equal(ip.inTrial, true);
});

test('iapGrantSource / iapSourcesForEnvironment: sandbox always wins; production owns iap and iap_trial', () => {
  assert.equal(iapGrantSource('PRODUCTION', true), 'iap_trial');
  assert.equal(iapGrantSource('PRODUCTION', false), 'iap');
  assert.equal(iapGrantSource(undefined, true), 'iap_trial');
  assert.equal(iapGrantSource('SANDBOX', true), 'iap_sandbox');
  assert.deepEqual(iapSourcesForEnvironment('PRODUCTION'), ['iap', 'iap_trial']);
  assert.deepEqual(iapSourcesForEnvironment('SANDBOX'), ['iap_sandbox']);
});

test('priority: a trial never replaces stripe, iap, comp, instructor or seat; conversion and real grants replace a trial', () => {
  for (const s of ['stripe', 'iap', 'seat']) {
    assert.equal(shouldApplyProGrant(s, 'iap_trial', PAID_END_ISO, TRIAL_END_ISO), false, `trial over ${s}`);
    assert.equal(shouldApplyProGrant(s, 'iap_trial', TRIAL_END_ISO, PAID_END_ISO), false, `trial over ${s}, later expiry`);
  }
  assert.equal(shouldApplyProGrant('comp', 'iap_trial', null, TRIAL_END_ISO), false);
  assert.equal(shouldApplyProGrant('instructor', 'iap_trial', null, TRIAL_END_ISO), false);
  for (const s of ['stripe', 'iap', 'seat', 'comp', 'instructor']) {
    assert.equal(shouldApplyProGrant('iap_trial', s, TRIAL_END_ISO, PAID_END_ISO), true, `${s} over trial`);
  }
  assert.equal(shouldApplyProGrant('iap_sandbox', 'iap_trial', PAID_END_ISO, TRIAL_END_ISO), true);
  assert.equal(shouldApplyProGrant('iap_trial', 'iap_sandbox', TRIAL_END_ISO, PAID_END_ISO), false);
});

test('PAYING_SOURCES never includes iap_trial; TRIAL_SOURCES is exactly iap_trial', () => {
  assert.ok(!PAYING_SOURCES.includes('iap_trial'));
  assert.deepEqual(TRIAL_SOURCES, ['iap_trial']);
});

// ── Trial lifecycle ──────────────────────────────────────────────────────────

test('PRODUCTION trial start: Pro active with the trial end date, iap_trial, not paying, counted as a trial', async () => {
  const db = createStubDb({ [USER]: { xp: 5 } });
  const result = await applySingleUserUpdate(trialStart(), db);
  assert.deepEqual(result, { ok: true });
  const p = db.store.get(USER);
  assert.deepEqual(p, { xp: 5, isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' });
  assert.deepEqual(markerEvents(db), [TRIAL_STARTED_MARKER_EVENT]);

  const s = statsFor(p, db.client.rows.map((r) => ({ ...r, created_at: HOUR_AGO_ISO })));
  assert.equal(s.payingTotal, 0);
  assert.equal(s.payingIap, 0);
  assert.equal(s.trialActive, 1);
  assert.equal(s.freeLearners, 0);
  assert.equal(s.trialsStarted24h, 1);
  assert.equal(s.conversionPct, 0);
});

test('trial start → conversion (is_trial_conversion): becomes paying iap with the paid end date', async () => {
  const db = createStubDb({});
  await applySingleUserUpdate(trialStart(), db);
  await applySingleUserUpdate(conversion(), db);
  const p = db.store.get(USER);
  assert.deepEqual(p, { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'iap' });
  assert.deepEqual(markerEvents(db), [TRIAL_STARTED_MARKER_EVENT, TRIAL_CONVERTED_MARKER_EVENT]);

  const s = statsFor(p, db.client.rows.map((r) => ({ ...r, created_at: HOUR_AGO_ISO })));
  assert.equal(s.payingTotal, 1);
  assert.equal(s.payingIap, 1);
  assert.equal(s.trialActive, 0);
  assert.equal(s.trialConversions24h, 1);
  assert.equal(s.conversionPct, 100);
});

test('first NORMAL RENEWAL over iap_trial without is_trial_conversion still converts (and is marked)', async () => {
  const db = createStubDb({ [USER]: { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' } });
  await applySingleUserUpdate(rcEvent('RENEWAL', { period_type: 'NORMAL', expiration_at_ms: PAID_END_MS }), db);
  assert.equal(db.store.get(USER).proSource, 'iap');
  assert.deepEqual(markerEvents(db), [TRIAL_CONVERTED_MARKER_EVENT]);
});

test('an ordinary paid RENEWAL of a paying iap user is not a trial conversion', async () => {
  const db = createStubDb({ [USER]: { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap' } });
  await applySingleUserUpdate(rcEvent('RENEWAL', { period_type: 'NORMAL', expiration_at_ms: PAID_END_MS }), db);
  assert.deepEqual(db.store.get(USER), { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'iap' });
  assert.deepEqual(markerEvents(db), []);
});

test('cancellation during the trial: still Pro until the trial ends, counted as a cancellation, then expires', async () => {
  const db = createStubDb({});
  await applySingleUserUpdate(trialStart(), db);
  await applySingleUserUpdate(trialCancel(), db);
  const afterCancel = db.store.get(USER);
  assert.deepEqual(afterCancel, { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' });
  assert.deepEqual(markerEvents(db), [TRIAL_STARTED_MARKER_EVENT, TRIAL_CANCELLED_MARKER_EVENT]);
  const cancelMarker = db.client.rows[1];
  assert.equal(cancelMarker.props.cancel_reason, 'UNSUBSCRIBE');
  assert.equal(cancelMarker.props.period_type, 'TRIAL');

  const s = statsFor(afterCancel, db.client.rows.map((r) => ({ ...r, created_at: HOUR_AGO_ISO })));
  assert.equal(s.trialActive, 1, 'still Pro, still a trial, not paying');
  assert.equal(s.payingTotal, 0);
  assert.equal(s.trialCancellations24h, 1);

  // Expire-pro cron: not before the trial end, eligible after it.
  assert.equal(isEligibleForProExpiry(afterCancel, NOW_ISO), false);
  assert.equal(isEligibleForProExpiry(afterCancel, new Date(TRIAL_END_MS + 1000).toISOString()), true);

  // RevenueCat EXPIRATION at the trial end clears it.
  await applySingleUserUpdate(rcEvent('EXPIRATION', { period_type: 'TRIAL', expiration_reason: 'UNSUBSCRIBE' }), db);
  assert.deepEqual(db.store.get(USER), { isPro: false, proExpiresAt: null, proSource: null });
  const expired = statsFor(db.store.get(USER), []);
  assert.equal(expired.trialActive, 0);
  assert.equal(expired.freeLearners, 1);
});

test('a CANCELLATION in a paid period is not a trial cancellation', async () => {
  const db = createStubDb({ [USER]: { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'iap' } });
  await applySingleUserUpdate(rcEvent('CANCELLATION', { period_type: 'NORMAL', expiration_at_ms: PAID_END_MS }), db);
  assert.deepEqual(markerEvents(db), []);
  assert.equal(db.store.get(USER).proSource, 'iap');
});

test('a trial on top of an existing active stripe/comp/seat/instructor/paid-iap grant changes nothing', async () => {
  const cases = {
    stripe: { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'stripe' },
    iap: { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'iap' },
    seat: { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'seat' },
    comp: { isPro: true, proExpiresAt: null, proSource: 'comp' },
    instructor: { isPro: true, proExpiresAt: null, proSource: 'instructor' },
    // Shorter-lived current grant: still never replaced by a trial.
    seatShort: { isPro: true, proExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), proSource: 'seat' },
  };
  for (const [name, progress] of Object.entries(cases)) {
    const db = createStubDb({ [USER]: { ...progress } });
    await applySingleUserUpdate(trialStart(), db);
    assert.deepEqual(db.store.get(USER), progress, name);
    // The trial itself still happened, so it is still recorded.
    assert.deepEqual(markerEvents(db), [TRIAL_STARTED_MARKER_EVENT], name);
  }
});

test('a trial replaces a lapsed time-limited grant the expire-pro cron has not cleared yet', () => {
  for (const source of ['stripe', 'iap', 'seat']) {
    const { progress } = resolveRevenueCatUpdate(
      'INITIAL_PURCHASE',
      TRIAL_END_MS,
      { isPro: true, proExpiresAt: PAST_ISO, proSource: source },
      'PRODUCTION',
      { inTrial: true },
    );
    assert.deepEqual(progress, { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' }, source);
  }
  // A permanent grant with no expiry is never "lapsed".
  const { progress } = resolveRevenueCatUpdate(
    'INITIAL_PURCHASE',
    TRIAL_END_MS,
    { isPro: true, proExpiresAt: null, proSource: 'comp' },
    'PRODUCTION',
    { inTrial: true },
  );
  assert.equal(progress, null);
});

test('a production trial replaces an iap_sandbox grant (real store account beats a test one)', async () => {
  const db = createStubDb({ [USER]: { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'iap_sandbox' } });
  await applySingleUserUpdate(trialStart(), db);
  assert.equal(db.store.get(USER).proSource, 'iap_trial');
});

test('Stripe purchase and seat redemption both replace an iap_trial grant', () => {
  const trial = { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' };
  const stripe = resolveStripeProGrant(trial, 'monthly');
  assert.equal(stripe.proSource, 'stripe');
  const seat = resolveSeatGrant(trial, NOW_ISO);
  assert.equal(seat.updatedProgress.proSource, 'seat');
});

test('a later trial EXPIRATION never clears a grant that has since replaced the trial', async () => {
  const db = createStubDb({ [USER]: { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'stripe' } });
  await applySingleUserUpdate(rcEvent('EXPIRATION', { period_type: 'TRIAL' }), db);
  assert.equal(db.store.get(USER).proSource, 'stripe');
});

test('SANDBOX trial: stays iap_sandbox, sandbox marker only, never trial markers', async () => {
  const db = createStubDb({});
  await applySingleUserUpdate(trialStart({ environment: 'SANDBOX' }), db);
  assert.deepEqual(db.store.get(USER), { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_sandbox' });
  assert.deepEqual(markerEvents(db), [SANDBOX_PURCHASE_MARKER_EVENT]);
  await applySingleUserUpdate(conversion({ environment: 'SANDBOX' }), db);
  assert.equal(db.store.get(USER).proSource, 'iap_sandbox');
  await applySingleUserUpdate(trialCancel({ environment: 'SANDBOX' }), db);
  assert.deepEqual(markerEvents(db), [SANDBOX_PURCHASE_MARKER_EVENT]);
});

test('SANDBOX EXPIRATION/CANCELLATION never touch a production iap_trial; production ones do', () => {
  const trial = { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' };
  assert.equal(resolveRevenueCatUpdate('EXPIRATION', TRIAL_END_MS, trial, 'SANDBOX').progress, null);
  assert.equal(resolveRevenueCatUpdate('CANCELLATION', TRIAL_END_MS, trial, 'SANDBOX').progress, null);
  assert.deepEqual(resolveRevenueCatUpdate('EXPIRATION', TRIAL_END_MS, trial, 'PRODUCTION').progress, {
    isPro: false,
    proExpiresAt: null,
    proSource: null,
  });
  assert.deepEqual(clearIapGrant(trial, 'iap'), trial, 'single-source default still only clears iap');
});

test('missing period_type: treated as NORMAL (paid iap, same as before) with a logged warning', async () => {
  const db = createStubDb({});
  const { warnings } = await captureWarnings(() => applySingleUserUpdate(rcEvent('INITIAL_PURCHASE'), db));
  assert.deepEqual(db.store.get(USER), { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap' });
  assert.ok(warnings.some((w) => /missing period_type — treating as NORMAL/.test(w)), warnings.join('\n'));
  assert.deepEqual(markerEvents(db), []);
});

// ── TRANSFER (restore onto another account) ─────────────────────────────────

test('transferGrantSource: paid source wins, trial-only stays trial, unknown falls back to iap, sandbox is sandbox', () => {
  const row = (proSource) => ({ progress: { proSource } });
  assert.equal(transferGrantSource('PRODUCTION', [row('iap_trial')]), 'iap_trial');
  assert.equal(transferGrantSource('PRODUCTION', [row('iap_trial'), row('iap')]), 'iap');
  assert.equal(transferGrantSource('PRODUCTION', []), 'iap');
  assert.equal(transferGrantSource('SANDBOX', [row('iap_trial')]), 'iap_sandbox');
});

test('TRANSFER of a trial via RevenueCat: destination keeps iap_trial, source is cleared', async () => {
  const db = createStubDb({
    [SOURCE_ID]: { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' },
    [DEST_ID]: {},
  });
  const rcApi = {
    async getProEntitlement(id) {
      return id === DEST_ID ? { active: true, expiresAt: TRIAL_END_ISO } : { active: false, expiresAt: null };
    },
  };
  const event = { id: 'evt_tr_1', type: 'TRANSFER', environment: 'PRODUCTION', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };
  const result = await withRcKey('sk_test', () => applyTransfer(event, db, rcApi, quietSlack));
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' });
  assert.deepEqual(db.store.get(SOURCE_ID), { isPro: false, proExpiresAt: null, proSource: null });
});

test('TRANSFER of a trial, local fallback: destination keeps iap_trial, source is cleared', async () => {
  const db = createStubDb({
    [SOURCE_ID]: { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' },
    [DEST_ID]: {},
  });
  const event = { id: 'evt_tr_2', type: 'TRANSFER', environment: 'PRODUCTION', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };
  const result = await withRcKey(undefined, () => applyTransfer(event, db, {}, quietSlack));
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(db.store.get(DEST_ID), { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' });
  assert.deepEqual(db.store.get(SOURCE_ID), { isPro: false, proExpiresAt: null, proSource: null });
});

test('TRANSFER of a trial never downgrades a destination that already pays', async () => {
  const db = createStubDb({
    [SOURCE_ID]: { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'iap_trial' },
    [DEST_ID]: { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'stripe' },
  });
  const event = { id: 'evt_tr_3', type: 'TRANSFER', environment: 'PRODUCTION', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };
  await withRcKey(undefined, () => applyTransfer(event, db, {}, quietSlack));
  assert.equal(db.store.get(DEST_ID).proSource, 'stripe');
});

test('TRANSFER of a paid subscription is still paid iap', async () => {
  const db = createStubDb({
    [SOURCE_ID]: { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'iap' },
    [DEST_ID]: {},
  });
  const event = { id: 'evt_tr_4', type: 'TRANSFER', environment: 'PRODUCTION', transferred_from: [SOURCE_ID], transferred_to: [DEST_ID] };
  await withRcKey(undefined, () => applyTransfer(event, db, {}, quietSlack));
  assert.equal(db.store.get(DEST_ID).proSource, 'iap');
});

// ── Markers: content and idempotency ────────────────────────────────────────

test('trialMarkersFor: one marker per relevant event, none for sandbox or unrelated events', () => {
  const p = (e) => classifyPeriod(e);
  const e1 = trialStart();
  assert.deepEqual(trialMarkersFor(e1, {}, p(e1)), [TRIAL_STARTED_MARKER_EVENT]);
  const e2 = rcEvent('INITIAL_PURCHASE', { period_type: 'NORMAL' });
  assert.deepEqual(trialMarkersFor(e2, {}, p(e2)), []);
  const e3 = conversion();
  assert.deepEqual(trialMarkersFor(e3, { proSource: 'iap' }, p(e3)), [TRIAL_CONVERTED_MARKER_EVENT]);
  const e4 = trialCancel();
  assert.deepEqual(trialMarkersFor(e4, {}, p(e4)), [TRIAL_CANCELLED_MARKER_EVENT]);
  const e5 = rcEvent('EXPIRATION', { period_type: 'TRIAL' });
  assert.deepEqual(trialMarkersFor(e5, { proSource: 'iap_trial' }, p(e5)), []);
  const e6 = trialStart({ environment: 'SANDBOX' });
  assert.deepEqual(trialMarkersFor(e6, {}, p(e6)), []);
});

test('buildTrialMarkerRow: server-written anon_id, store metadata only, no personal data', () => {
  const row = buildTrialMarkerRow(TRIAL_STARTED_MARKER_EVENT, USER, trialStart({ id: 'evt_abc', store: 'PLAY_STORE' }));
  assert.equal(row.anon_id, 'revenuecat:evt_abc');
  assert.equal(row.event, 'iap_trial_started');
  assert.equal(row.platform, 'android');
  assert.equal(row.user_id, USER);
  assert.deepEqual(Object.keys(row.props).sort(), [
    'cancel_reason', 'environment', 'is_trial_conversion', 'period_type', 'product_id', 'rc_event_id', 'rc_event_type', 'source', 'store',
  ]);
  assert.equal(row.props.environment, 'PRODUCTION');
  // Missing environment is recorded as PRODUCTION (what the grant used).
  assert.equal(buildTrialMarkerRow(TRIAL_STARTED_MARKER_EVENT, USER, trialStart({ environment: undefined })).props.environment, 'PRODUCTION');
});

test('insertFunnelMarkerOnce: a second insert for the same RevenueCat event and marker is skipped', async () => {
  const client = fakeFunnelClient();
  const row = buildTrialMarkerRow(TRIAL_STARTED_MARKER_EVENT, USER, trialStart({ id: 'evt_dup' }));
  assert.deepEqual(await insertFunnelMarkerOnce(client, row), { inserted: true });
  assert.deepEqual(await insertFunnelMarkerOnce(client, { ...row }), { inserted: false });
  assert.equal(client.rows.length, 1);
  // A different marker type for the same event id is its own row.
  const other = buildTrialMarkerRow(TRIAL_CANCELLED_MARKER_EVENT, USER, trialStart({ id: 'evt_dup' }));
  assert.deepEqual(await insertFunnelMarkerOnce(client, other), { inserted: true });
});

test('a RevenueCat retry after a failed grant write records the trial marker exactly once', async () => {
  const db = createStubDb({}, { failWritesFor: 1 });
  const event = trialStart();
  const first = await applySingleUserUpdate(event, db);
  assert.deepEqual(first, { ok: false, retry: true });
  assert.deepEqual(markerEvents(db), [], 'no marker before the grant is written');
  const retry = await applySingleUserUpdate(event, db);
  assert.deepEqual(retry, { ok: true });
  const again = await applySingleUserUpdate(event, db);
  assert.deepEqual(again, { ok: true });
  assert.deepEqual(markerEvents(db), [TRIAL_STARTED_MARKER_EVENT]);
  assert.equal(db.store.get(USER).proSource, 'iap_trial');
});

test('the sandbox marker is idempotent too (once per RevenueCat event id)', async () => {
  const db = createStubDb({}, { failWritesFor: 1 });
  const event = rcEvent('INITIAL_PURCHASE', { environment: 'SANDBOX', period_type: 'NORMAL' });
  await applySingleUserUpdate(event, db);
  await applySingleUserUpdate(event, db);
  await applySingleUserUpdate(event, db);
  assert.deepEqual(markerEvents(db), [SANDBOX_PURCHASE_MARKER_EVENT]);
});

test('a failing marker write never fails the webhook or blocks the trial grant', async () => {
  const db = createStubDb({});
  db.recordTrialMarker = async () => { throw new Error('stub marker failure'); };
  const original = console.error;
  console.error = () => {};
  try {
    const result = await applySingleUserUpdate(trialStart(), db);
    assert.deepEqual(result, { ok: true });
  } finally {
    console.error = original;
  }
  assert.equal(db.store.get(USER).proSource, 'iap_trial');
});

// ── dailyStats buckets ──────────────────────────────────────────────────────

test('computeDailyStats: trials are their own bucket, in the conversion denominator only; 24h marker figures', () => {
  const ids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000005'];
  const [paid, trial, free, excludedTrial, instructorTrial] = ids;
  const profiles = [
    { id: paid, account_type: 'learner' },
    { id: trial, account_type: 'learner' },
    { id: free, account_type: 'learner' },
    { id: excludedTrial, account_type: 'learner', exclude_from_stats: true },
    { id: instructorTrial, account_type: 'instructor' },
  ];
  const progressRows = [
    { id: paid, progress: { isPro: true, proExpiresAt: PAID_END_ISO, proSource: 'iap' } },
    { id: trial, progress: { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' } },
    { id: excludedTrial, progress: { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' } },
    { id: instructorTrial, progress: { isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' } },
  ];
  const m = (event, user_id, created_at, rc) => ({ event, user_id, anon_id: `revenuecat:${rc}`, created_at, props: { rc_event_id: rc } });
  const trialMarkers = [
    m('iap_trial_started', trial, HOUR_AGO_ISO, 'a'),
    m('iap_trial_started', trial, HOUR_AGO_ISO, 'a'), // duplicate row for the same RC event
    m('iap_trial_started', instructorTrial, HOUR_AGO_ISO, 'b'),
    m('iap_trial_started', excludedTrial, HOUR_AGO_ISO, 'c'), // excluded account
    m('iap_trial_started', free, TWO_DAYS_AGO_ISO, 'd'), // outside 24h
    m('iap_trial_converted', paid, HOUR_AGO_ISO, 'e'),
    m('iap_trial_cancelled', trial, HOUR_AGO_ISO, 'f'),
    m('iap_sandbox_purchase', free, HOUR_AGO_ISO, 'g'), // not a trial marker
  ];
  const s = computeDailyStats({ profiles, progressRows, nowIso: new Date().toISOString(), trialMarkers });
  assert.equal(s.payingTotal, 1);
  assert.equal(s.payingIap, 1);
  assert.equal(s.trialActive, 2, 'learner + instructor trial; excluded account not counted');
  assert.equal(s.freeLearners, 1);
  assert.equal(s.trialsStarted24h, 2);
  assert.equal(s.trialConversions24h, 1);
  assert.equal(s.trialCancellations24h, 1);
  // paying learners 1 / (paying 1 + free 1 + learner trial 1)
  assert.equal(s.conversionPct, 33.3);

  const msg = formatDailyStatsMessage(s);
  assert.match(msg, /\*Paying Pro, active:\* 1/);
  assert.match(msg, /\*Free trials, active:\* 2/);
  assert.match(msg, /trials \(24h\): 2 started, 1 converted to paid, 1 cancelled/);
  assert.match(msg, /paying \/ paying \+ free \+ on trial/);
});

test('computeDailyStats: trial 24h figures are n/a (not 0) when markers could not be read', () => {
  const s = statsFor({ isPro: true, proExpiresAt: TRIAL_END_ISO, proSource: 'iap_trial' }, undefined);
  assert.equal(s.trialActive, 1);
  assert.equal(s.trialsStarted24h, null);
  assert.match(formatDailyStatsMessage(s), /trials \(24h\): n\/a started, n\/a converted to paid, n\/a cancelled/);
});

test('computeDailyStats: an expired iap_trial learner is a free learner, not a trial', () => {
  const s = statsFor({ isPro: true, proExpiresAt: PAST_ISO, proSource: 'iap_trial' }, []);
  assert.equal(s.trialActive, 0);
  assert.equal(s.freeLearners, 1);
  assert.equal(s.trialsStarted24h, 0);
});
