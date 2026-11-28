'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');
const { resolveExpectedStripeMode, verifyStripeWebhookEvent, createStripeWebhookRoute } = require('./stripeMode');
const { applyStripeProGrant } = require('./stripeWebhook');

// Fake keys: only their prefix matters. Constructing a client and verifying
// a webhook signature are both offline — nothing here calls Stripe.
const LIVE_KEY = 'sk_live_fake_for_tests';
const LIVE_RESTRICTED_KEY = 'rk_live_fake_for_tests';
const TEST_KEY = 'sk_test_fake_for_tests';
const WEBHOOK_SECRET = 'whsec_fake_platform';
const CONNECT_SECRET = 'whsec_fake_connect';
const USER_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const INSTRUCTOR_ID = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';

function makeEvent({ livemode, type = 'checkout.session.completed', object }) {
  return {
    id: `evt_${type.replace(/\W/g, '_')}_${livemode ? 'live' : 'test'}`,
    object: 'event',
    type,
    livemode,
    data: {
      object: object ?? { id: 'cs_1', object: 'checkout.session', metadata: { userId: USER_ID, plan: 'monthly' } },
    },
  };
}

function signedRequest(event, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { body: Buffer.from(payload), headers: { 'stripe-signature': header } };
}

function mockRes() {
  return {
    statusCode: 200,
    sent: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.sent = body; return this; },
    send(body) { this.sent = body; return this; },
  };
}

// Stands in for proxy.js's /api/webhook body: dedup row, Pro grant via the
// real applyStripeProGrant, and the instructor_earnings insert — all into
// in-memory stubs, so "no side effects" is checkable.
function platformHarness(env) {
  const store = new Map();
  const dedupRows = [];
  const earnings = [];
  const refunds = [];
  const db = {
    getProgress: async (id) => store.get(id) ?? null,
    upsertProgress: async (id, progress) => { store.set(id, progress); return { error: null }; },
    deleteWebhookEvent: async () => {},
  };
  const route = createStripeWebhookRoute({
    getStripe: () => Stripe(env.STRIPE_SECRET_KEY || 'sk_test_unused'),
    secretEnvVar: 'STRIPE_WEBHOOK_SECRET',
    notConfiguredError: 'Stripe not configured',
    label: 'webhook',
    env,
  }, async (event, req, res) => {
    dedupRows.push(event.id);
    if (event.type === 'checkout.session.completed') {
      const userId = event.data.object.metadata.userId;
      const result = await applyStripeProGrant(event, userId, db);
      assert.equal(result.ok, true);
      earnings.push({ instructor_id: INSTRUCTOR_ID, learner_id: userId, status: 'pending' });
    }
    if (event.type === 'charge.refunded') refunds.push(event.data.object.id);
    res.json({ received: true });
  });
  const sideEffects = () => ({ dedupRows: dedupRows.length, earnings: earnings.length, refunds: refunds.length, grants: store.size });
  return { route, store, earnings, refunds, sideEffects };
}

function connectHarness(env) {
  const updates = [];
  const route = createStripeWebhookRoute({
    getStripe: () => Stripe(env.STRIPE_SECRET_KEY || 'sk_test_unused'),
    secretEnvVar: 'STRIPE_CONNECT_WEBHOOK_SECRET',
    notConfiguredError: 'Stripe Connect webhook not configured',
    label: 'connect-webhook',
    env,
  }, async (event, req, res) => {
    if (event.type === 'account.updated') updates.push(event.data.object.id);
    res.json({ received: true });
  });
  return { route, updates };
}

const liveEnv = { STRIPE_SECRET_KEY: LIVE_RESTRICTED_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET: CONNECT_SECRET };
const testEnv = { STRIPE_SECRET_KEY: TEST_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET: CONNECT_SECRET };

// ── resolveExpectedStripeMode ────────────────────────────────────────────────

test('mode: live and restricted live keys -> live; test keys -> test (CLEARPASS_SERVER_ENV unset, as on Railway today)', () => {
  assert.deepEqual(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: LIVE_KEY }), { ok: true, mode: 'live' });
  assert.deepEqual(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: LIVE_RESTRICTED_KEY }), { ok: true, mode: 'live' });
  assert.deepEqual(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: TEST_KEY }), { ok: true, mode: 'test' });
  assert.deepEqual(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: 'rk_test_x' }), { ok: true, mode: 'test' });
});

test('mode: missing or unrecognised key fails closed, without echoing the key', () => {
  for (const key of [undefined, '', 'pk_live_x', 'whsec_x', 'sk_org_x', 'live']) {
    const r = resolveExpectedStripeMode({ STRIPE_SECRET_KEY: key });
    assert.equal(r.ok, false, String(key));
    if (key) assert.ok(!r.reason.includes(key));
  }
});

test('mode: staging/local must use a test key; production must use a live key', () => {
  assert.deepEqual(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: TEST_KEY, CLEARPASS_SERVER_ENV: 'staging' }), { ok: true, mode: 'test' });
  assert.deepEqual(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: TEST_KEY, CLEARPASS_SERVER_ENV: 'local' }), { ok: true, mode: 'test' });
  assert.equal(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: LIVE_KEY, CLEARPASS_SERVER_ENV: 'staging' }).ok, false);
  assert.equal(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: LIVE_KEY, CLEARPASS_SERVER_ENV: 'local' }).ok, false);
  assert.deepEqual(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: LIVE_KEY, CLEARPASS_SERVER_ENV: 'production' }), { ok: true, mode: 'live' });
  assert.equal(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: TEST_KEY, CLEARPASS_SERVER_ENV: 'production' }).ok, false);
  assert.equal(resolveExpectedStripeMode({ STRIPE_SECRET_KEY: LIVE_KEY, CLEARPASS_SERVER_ENV: 'prod' }).ok, false);
});

// ── /api/webhook (platform) ──────────────────────────────────────────────────

test('webhook: live event + live key -> processed (Pro grant and earnings row)', async () => {
  const h = platformHarness(liveEnv);
  const res = mockRes();
  await h.route(signedRequest(makeEvent({ livemode: true })), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.sent, { received: true });
  assert.equal(h.store.get(USER_ID).isPro, true);
  assert.equal(h.store.get(USER_ID).proSource, 'stripe');
  assert.equal(h.earnings.length, 1);
});

test('webhook: test event + live key -> acknowledged 200, ignored, no side effects', async () => {
  const h = platformHarness(liveEnv);
  const res = mockRes();
  await h.route(signedRequest(makeEvent({ livemode: false })), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.sent, { received: true, ignored: 'livemode_mismatch' });
  assert.deepEqual(h.sideEffects(), { dedupRows: 0, earnings: 0, refunds: 0, grants: 0 });
});

test('webhook: live event + test key -> acknowledged 200, ignored, no side effects', async () => {
  const h = platformHarness(testEnv);
  const res = mockRes();
  await h.route(signedRequest(makeEvent({ livemode: true })), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.sent.ignored, 'livemode_mismatch');
  assert.deepEqual(h.sideEffects(), { dedupRows: 0, earnings: 0, refunds: 0, grants: 0 });
});

test('webhook: test event + test key -> processed', async () => {
  const h = platformHarness(testEnv);
  const res = mockRes();
  await h.route(signedRequest(makeEvent({ livemode: false })), res);
  assert.equal(res.statusCode, 200);
  assert.equal(h.store.get(USER_ID).isPro, true);
  assert.equal(h.earnings.length, 1);
});

test('webhook: unrecognised key -> 500 (Stripe retries once config is fixed), no side effects', async () => {
  for (const key of ['sk_org_fake', 'pk_live_fake']) {
    const h = platformHarness({ ...liveEnv, STRIPE_SECRET_KEY: key });
    const res = mockRes();
    await h.route(signedRequest(makeEvent({ livemode: true })), res);
    assert.equal(res.statusCode, 500, key);
    assert.deepEqual(res.sent, { error: 'Stripe mode not configured' });
    assert.deepEqual(h.sideEffects(), { dedupRows: 0, earnings: 0, refunds: 0, grants: 0 });
  }
});

test('webhook: staging server with a live key -> 500 even for a live event, no side effects', async () => {
  const h = platformHarness({ ...liveEnv, CLEARPASS_SERVER_ENV: 'staging' });
  const res = mockRes();
  await h.route(signedRequest(makeEvent({ livemode: true })), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(h.sideEffects(), { dedupRows: 0, earnings: 0, refunds: 0, grants: 0 });
});

test('webhook: staging server with a test key -> test processed, live ignored', async () => {
  const env = { ...testEnv, CLEARPASS_SERVER_ENV: 'staging' };
  const h = platformHarness(env);
  const ok = mockRes();
  await h.route(signedRequest(makeEvent({ livemode: false })), ok);
  assert.deepEqual(ok.sent, { received: true });
  const h2 = platformHarness(env);
  const ignored = mockRes();
  await h2.route(signedRequest(makeEvent({ livemode: true })), ignored);
  assert.equal(ignored.sent.ignored, 'livemode_mismatch');
  assert.deepEqual(h2.sideEffects(), { dedupRows: 0, earnings: 0, refunds: 0, grants: 0 });
});

test('webhook: signature is checked before mode (bad signature -> 400 even when mode also mismatches)', async () => {
  const h = platformHarness(liveEnv);
  const req = signedRequest(makeEvent({ livemode: false }), 'whsec_wrong');
  const res = mockRes();
  await h.route(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.sent, /^Webhook Error:/);
  assert.deepEqual(h.sideEffects(), { dedupRows: 0, earnings: 0, refunds: 0, grants: 0 });
});

test('webhook: event without a boolean livemode is ignored, not processed', async () => {
  const h = platformHarness(liveEnv);
  const event = makeEvent({ livemode: true });
  delete event.livemode;
  const res = mockRes();
  await h.route(signedRequest(event), res);
  assert.equal(res.sent.ignored, 'livemode_mismatch');
  assert.deepEqual(h.sideEffects(), { dedupRows: 0, earnings: 0, refunds: 0, grants: 0 });
});

test('webhook: missing key or webhook secret keeps the existing 500 "not configured"', async () => {
  const h = platformHarness({ STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
  const noStripe = createStripeWebhookRoute({
    getStripe: () => null, secretEnvVar: 'STRIPE_WEBHOOK_SECRET', notConfiguredError: 'Stripe not configured', label: 'webhook', env: liveEnv,
  }, async () => assert.fail('must not process'));
  const res = mockRes();
  await noStripe(signedRequest(makeEvent({ livemode: true })), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.sent, { error: 'Stripe not configured' });
  const res2 = mockRes();
  await h.route(signedRequest(makeEvent({ livemode: true })), res2);
  assert.equal(res2.statusCode, 500); // key missing -> mode undeterminable
  assert.equal(h.sideEffects().dedupRows, 0);
});

test('webhook: refunds in the matching mode reach the handler unchanged; mismatched refunds do not', async () => {
  const charge = { id: 'ch_1', object: 'charge', payment_intent: 'pi_1', amount_refunded: 599 };
  const live = platformHarness(liveEnv);
  const res = mockRes();
  await live.route(signedRequest(makeEvent({ livemode: true, type: 'charge.refunded', object: charge })), res);
  assert.deepEqual(res.sent, { received: true });
  assert.deepEqual(live.refunds, ['ch_1']);

  const mismatch = platformHarness(liveEnv);
  const res2 = mockRes();
  await mismatch.route(signedRequest(makeEvent({ livemode: false, type: 'charge.refunded', object: charge })), res2);
  assert.equal(res2.sent.ignored, 'livemode_mismatch');
  assert.deepEqual(mismatch.refunds, []);
});

test('webhook: unhandled types (e.g. disputes) in the matching mode still reach the handler', async () => {
  const h = platformHarness(liveEnv);
  const res = mockRes();
  await h.route(signedRequest(makeEvent({ livemode: true, type: 'charge.dispute.created', object: { id: 'dp_1', object: 'dispute' } })), res);
  assert.deepEqual(res.sent, { received: true });
  assert.equal(h.sideEffects().dedupRows, 1);
});

// ── /api/stripe/connect-webhook ──────────────────────────────────────────────

test('connect-webhook: live account.updated + live key -> processed', async () => {
  const h = connectHarness(liveEnv);
  const res = mockRes();
  const event = makeEvent({ livemode: true, type: 'account.updated', object: { id: 'acct_live', object: 'account' } });
  await h.route(signedRequest(event, CONNECT_SECRET), res);
  assert.deepEqual(res.sent, { received: true });
  assert.deepEqual(h.updates, ['acct_live']);
});

test('connect-webhook: test-mode account.updated on a live server (Stripe does send these) -> 200, ignored', async () => {
  const h = connectHarness(liveEnv);
  const res = mockRes();
  const event = makeEvent({ livemode: false, type: 'account.updated', object: { id: 'acct_test', object: 'account' } });
  await h.route(signedRequest(event, CONNECT_SECRET), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.sent.ignored, 'livemode_mismatch');
  assert.deepEqual(h.updates, []);
});

test('connect-webhook: live account.updated + test key -> ignored; uses its own signing secret', async () => {
  const h = connectHarness(testEnv);
  const res = mockRes();
  const event = makeEvent({ livemode: true, type: 'account.updated', object: { id: 'acct_live', object: 'account' } });
  await h.route(signedRequest(event, CONNECT_SECRET), res);
  assert.equal(res.sent.ignored, 'livemode_mismatch');
  assert.deepEqual(h.updates, []);

  const h2 = connectHarness(liveEnv);
  const res2 = mockRes();
  await h2.route(signedRequest(makeEvent({ livemode: true, type: 'account.updated' }), WEBHOOK_SECRET), res2);
  assert.equal(res2.statusCode, 400);
  assert.deepEqual(h2.updates, []);
});

test('verifyStripeWebhookEvent: returns the verified event untouched on a match', () => {
  const event = makeEvent({ livemode: true });
  const req = signedRequest(event);
  const r = verifyStripeWebhookEvent({
    stripe: Stripe(LIVE_KEY), rawBody: req.body, signature: req.headers['stripe-signature'],
    secret: WEBHOOK_SECRET, env: { STRIPE_SECRET_KEY: LIVE_KEY }, label: 't',
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.event, event);
});
