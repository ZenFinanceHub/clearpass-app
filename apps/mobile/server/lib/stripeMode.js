'use strict';

// Live/test-mode guard for the Stripe webhooks (/api/webhook and
// /api/stripe/connect-webhook). Production must never act on a test-mode
// event, and a staging/local server must never act on a live-mode one.
//
// Expected mode comes from config that already exists, nothing new to set:
//   - STRIPE_SECRET_KEY prefix: sk_live_/rk_live_ -> live, sk_test_/rk_test_
//     -> test (production today runs on an rk_live_ restricted key).
//   - CLEARPASS_SERVER_ENV, if set, must agree: staging/local -> test only,
//     production -> live only. Unset (Railway today) -> the key decides.
// Anything else (unrecognised key prefix, unknown CLEARPASS_SERVER_ENV, or the
// two disagreeing) is a configuration error and fails closed.
//
// Why test-mode events can reach a live endpoint at all: Stripe sends BOTH
// live and test events from connected accounts to a live Connect webhook
// endpoint, so /api/stripe/connect-webhook in production really does see
// test-mode account.updated events.

const LIVE_KEY_PREFIXES = ['sk_live_', 'rk_live_'];
const TEST_KEY_PREFIXES = ['sk_test_', 'rk_test_'];
const TEST_ONLY_SERVER_ENVS = ['staging', 'local'];

// Pure. Returns { ok: true, mode: 'live'|'test' } or { ok: false, reason }.
// The reason never contains the key itself.
function resolveExpectedStripeMode(env) {
  const key = typeof env.STRIPE_SECRET_KEY === 'string' ? env.STRIPE_SECRET_KEY.trim() : '';
  let keyMode = null;
  if (LIVE_KEY_PREFIXES.some((p) => key.startsWith(p))) keyMode = 'live';
  else if (TEST_KEY_PREFIXES.some((p) => key.startsWith(p))) keyMode = 'test';
  if (!keyMode) {
    return { ok: false, reason: 'STRIPE_SECRET_KEY is missing or has an unrecognised prefix' };
  }

  const serverEnv = env.CLEARPASS_SERVER_ENV;
  if (serverEnv === undefined || serverEnv === '') return { ok: true, mode: keyMode };
  if (TEST_ONLY_SERVER_ENVS.includes(serverEnv)) {
    if (keyMode !== 'test') {
      return { ok: false, reason: `CLEARPASS_SERVER_ENV=${serverEnv} requires a test-mode Stripe key, but a live key is configured` };
    }
    return { ok: true, mode: 'test' };
  }
  if (serverEnv === 'production') {
    if (keyMode !== 'live') {
      return { ok: false, reason: 'CLEARPASS_SERVER_ENV=production requires a live-mode Stripe key, but a test key is configured' };
    }
    return { ok: true, mode: 'live' };
  }
  return { ok: false, reason: `CLEARPASS_SERVER_ENV has an unrecognised value (${JSON.stringify(serverEnv)})` };
}

// Signature first, mode second. Returns { ok: true, event } when the caller
// should process the event, otherwise { ok: false, status, body } to send
// as-is, with nothing processed and nothing written (the caller's dedup
// insert into stripe_webhook_events only runs on ok: true).
//
// Status codes:
//   - bad signature: 400 (unchanged behaviour).
//   - mode can't be determined (config error): 500. Stripe retries non-2xx
//     for up to 3 days, so genuine events are re-delivered and processed once
//     the config is fixed, instead of being acknowledged and lost.
//   - event.livemode doesn't match the expected mode: 200 + logged error.
//     That can never succeed on retry (livemode is fixed in the signed
//     event), and a 4xx/5xx here would make Stripe retry it for days and
//     eventually warn about / disable the endpoint, which on the live Connect
//     endpoint (which legitimately receives test events, see above) would
//     put genuine live deliveries at risk.
function verifyStripeWebhookEvent({ stripe, rawBody, signature, secret, env, label }) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error(`[${label}] signature verification failed:`, err.message);
    return { ok: false, status: 400, body: `Webhook Error: ${err.message}` };
  }

  const expected = resolveExpectedStripeMode(env);
  if (!expected.ok) {
    console.error(`[${label}] cannot determine expected Stripe mode, refusing event ${event.id}: ${expected.reason}`);
    return { ok: false, status: 500, body: { error: 'Stripe mode not configured' } };
  }

  const eventMode = event.livemode === true ? 'live' : event.livemode === false ? 'test' : null;
  if (eventMode !== expected.mode) {
    console.error(
      `[${label}] ignoring ${eventMode ?? 'unknown'}-mode event ${event.id} (${event.type}) on a ${expected.mode}-mode server`,
    );
    return { ok: false, status: 200, body: { received: true, ignored: 'livemode_mismatch' } };
  }

  return { ok: true, event };
}

// Express handler for a raw-body Stripe webhook route: verifies, then hands
// the event to handleEvent(event, req, res). getStripe is a function so the
// route reads the same lazily-null `stripe` client proxy.js always has.
function createStripeWebhookRoute({ getStripe, secretEnvVar, notConfiguredError, label, env = process.env }, handleEvent) {
  return async (req, res) => {
    const stripe = getStripe();
    const secret = env[secretEnvVar];
    if (!stripe || !secret) {
      return res.status(500).json({ error: notConfiguredError });
    }
    const result = verifyStripeWebhookEvent({
      stripe,
      rawBody: req.body,
      signature: req.headers['stripe-signature'],
      secret,
      env,
      label,
    });
    if (!result.ok) {
      return typeof result.body === 'string'
        ? res.status(result.status).send(result.body)
        : res.status(result.status).json(result.body);
    }
    return handleEvent(result.event, req, res);
  };
}

module.exports = {
  resolveExpectedStripeMode,
  verifyStripeWebhookEvent,
  createStripeWebhookRoute,
};
