require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const { computeProExpiresAt } = require('./lib/proExpiry');
const { deriveConnectStatus } = require('./lib/connectStatus');
const {
  shouldApplyProGrant,
  isEligibleForProExpiry,
  clearInstructorGrant,
  isInstructorGrantAlreadyCorrect,
  hasBlockingRelationships,
} = require('./lib/entitlement');
const { resolveRevenueCatUpdate } = require('./lib/revenuecatWebhook');
const { INSTRUCTOR_PAYOUT_STRIPE_MINOR } = require('./lib/earnings');
const {
  generateSeatToken,
  isSeatPurchaseSession,
  resolveSeatGrant,
  resolveSeatLookupOutcome,
} = require('./lib/seats');
const {
  MAX_STATS_ROWS,
  computeDailyStats,
  formatDailyStatsMessage,
} = require('./lib/dailyStats');

// Conference campaign tag reported in the daily stats post. Matches the QR
// at getclearpass.co.uk/instructors?ref=adinjc26 (27 Sep 2026).
const CONFERENCE_REF_CODE = 'adinjc26';

// Posts to #clearpass-updates via an incoming webhook (SLACK_WEBHOOK_UPDATES,
// set in Railway). Never throws and never rejects: every caller treats a
// Slack outage as irrelevant to whether its own work succeeded. A missing
// env var is a debug-level fact, not an error — local dev has no webhook.
async function postToSlack(text) {
  const url = process.env.SLACK_WEBHOOK_UPDATES;
  if (!url) {
    console.log('[slack] SLACK_WEBHOOK_UPDATES not set, skipping post');
    return false;
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      console.error('[slack] post failed:', resp.status, (await resp.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[slack] post error:', err.message || err);
    return false;
  }
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

const app = express();

// Without this, Express's req.ip is the raw TCP peer address — Railway's own
// edge, not the caller — for every request, which silently turns any
// per-IP limiter into a global one. `1` matches Railway's single edge hop
// (client -> Railway edge -> this container, no CDN in front here) and is
// the value Railway's own staff cite most often for this. Treat it as
// defence in depth, not a verified-safe value: Railway's own support forum
// has staff replies that flatly disagree with each other on whether
// X-Forwarded-For/X-Real-IP can be spoofed by the client at all, so nothing
// here should be trusted for an authorization decision — only for the
// signup rate limiter below, which the endpoint's own docs already say is
// not what makes it safe.
app.set('trust proxy', 1);

const PORT = 3001;

// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID
//   STRIPE_SEAT_PRICE_ID  — separate £5.99 one-time Price for instructor-purchased seats (not yet created — see phase 2 PR)
//   STRIPE_CONNECT_WEBHOOK_SECRET  — separate signing secret for the Connect webhook (Connected-account events, not the platform webhook)
//   ANTHROPIC_API_KEY
//   RESEND_API_KEY
//   CRON_SECRET  — shared secret for /api/cron/* endpoints (set in Railway dashboard)
//     Suggested value: r8Kp3Nq7Zm2Xt5Yb4Vw9As1Dc6Ef0Gh
//   REVENUECAT_WEBHOOK_SECRET  — shared secret for POST /api/revenuecat-webhook.
//     Set the exact same value as the "Authorization header value" field in
//     the RevenueCat dashboard's webhook configuration (app.revenuecat.com >
//     Project > Integrations > Webhooks) — RC sends it back verbatim on
//     every delivery, there is no HMAC signature scheme like Stripe's.

const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      origin.startsWith('http://localhost') ||
      origin.includes('vercel.app') ||
      origin.includes('railway.app') ||
      origin.includes('clearpass')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

// ── helpers ───────────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// Verifies the caller is a logged-in Supabase user — despite the name this
// used to have (verifyInstructorAuth), it never actually checked
// account_type; every existing call site does that separately if it needs
// to (see e.g. the switch-to-learner endpoint). Renamed because the new
// seat-redemption endpoint below needs the identical check for a learner,
// and reusing something literally named "instructor" auth for that was
// exactly the kind of confusion worth fixing while touching this again.
async function verifyAuth(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return { userId: data.user.id, email: data.user.email ?? null, supabaseAdmin };
}

function requireCronAuth(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers['x-cron-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// Stripe error types where the API response itself confirms no transfer was
// created, so it's safe to release the claimed earnings for a retry.
// Anything NOT in this set (network/connection errors, Stripe-side API
// errors, or an unrecognized error type) is treated as ambiguous — the
// transfer may have actually succeeded even though we didn't get a
// confirmed response, so those earnings are deliberately NOT reverted to
// avoid creating a second real transfer for the same money.
const SAFE_TO_RETRY_STRIPE_ERROR_TYPES = new Set([
  'StripeInvalidRequestError',
  'StripeRateLimitError',
  'StripeAuthenticationError',
  'StripePermissionError',
]);

// Mints an unredeemed seat for the purchasing instructor. Deliberately does
// NOT touch user_progress at all — nobody gets Pro at purchase time, only
// at redemption (POST /api/seats/redeem, by a learner, later). If this ever
// ran twice for the same session (it shouldn't — /api/webhook already
// dedups on Stripe's event id above), the UNIQUE constraint on
// instructor_seats.stripe_checkout_session_id is a second line of defense:
// the insert fails with 23505 and is logged, not treated as an error.
async function handleSeatPurchaseCompleted(session, supabaseAdmin) {
  const instructorId = session.metadata?.instructorId;
  if (!instructorId) {
    console.error('[webhook] seat purchase missing instructorId in metadata:', session.id);
    return;
  }

  const { error } = await supabaseAdmin.from('instructor_seats').insert({
    instructor_id: instructorId,
    stripe_checkout_session_id: session.id,
    // Captured here for free (the session object already carries it) so a
    // later charge.refunded webhook can find this seat with a plain DB
    // lookup instead of a Stripe API call — see findSeatForRefund below.
    stripe_payment_intent_id: session.payment_intent ?? null,
    invite_token: generateSeatToken(),
  });

  if (error) {
    if (error.code === '23505') {
      console.log('[webhook] seat already minted for session, skipping:', session.id);
    } else {
      console.error('[webhook] failed to mint seat for session', session.id, error.message);
    }
    return;
  }

  console.log('[webhook] seat minted for instructor', instructorId, 'session', session.id);
}

// ── Refund handling ────────────────────────────────────────────────────────
// A refunded seat purchase never touches a learner's Pro, even if the seat
// has already been redeemed — revoking access from a learner over a
// decision their instructor made is not something to do automatically.
//   - Unredeemed: nobody has benefited from it yet, so the seat is simply
//     invalidated — its invite link starts reading as an unknown token
//     (see resolveSeatLookupOutcome in lib/seats.js).
//   - Already redeemed: left completely untouched, and instead recorded in
//     seat_refund_flags plus an email to ADMIN_ALERT_EMAIL, for a human to
//     decide. The row is the durable record; the email is just the nudge —
//     if ADMIN_ALERT_EMAIL isn't set, or Resend fails, the row still exists
//     to be queried later.

// Finds the instructor_seats row a refunded Charge belongs to, or null if
// this charge isn't a seat purchase at all (e.g. a regular Pro purchase).
async function findSeatForRefund(charge, supabaseAdmin, stripeClient) {
  if (!charge.payment_intent) return null;

  // Primary path: a plain DB lookup, no Stripe API call. Populated for
  // every seat purchased after stripe_payment_intent_id shipped.
  const { data: byPaymentIntent, error: piError } = await supabaseAdmin
    .from('instructor_seats')
    .select('*')
    .eq('stripe_payment_intent_id', charge.payment_intent)
    .maybeSingle();
  if (piError) throw piError;
  if (byPaymentIntent) return byPaymentIntent;

  // Fallback for seats purchased before that column existed. Reverse-looks-up
  // the Checkout Session via its payment_intent — the one Stripe API call
  // payment_intent_data.metadata (on the purchase endpoint) exists to avoid
  // for future purchases, kept here only as a bridge for older rows.
  const sessions = await stripeClient.checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
  const session = sessions.data[0];
  if (!session || session.metadata?.type !== 'seat') return null;

  const { data: bySessionId, error: sessionError } = await supabaseAdmin
    .from('instructor_seats')
    .select('*')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();
  if (sessionError) throw sessionError;
  return bySessionId ?? null;
}

async function handleChargeRefunded(charge, supabaseAdmin) {
  try {
    const seat = await findSeatForRefund(charge, supabaseAdmin, stripe);
    if (!seat) return; // not a seat purchase (or one we can no longer trace) — nothing to do here

    if (!seat.redeemed_at) {
      const { error } = await supabaseAdmin
        .from('instructor_seats')
        .update({ invalidated_at: new Date().toISOString(), invalidated_reason: 'refunded' })
        .eq('id', seat.id)
        .is('redeemed_at', null); // guards against a race with a redemption landing first
      if (error) console.error('[charge-refunded] failed to invalidate seat', seat.id, error.message);
      else console.log('[charge-refunded] invalidated unredeemed seat', seat.id);
      return;
    }

    const { error: flagError } = await supabaseAdmin.from('seat_refund_flags').insert({
      seat_id: seat.id,
      instructor_id: seat.instructor_id,
      learner_id: seat.redeemed_by,
      stripe_charge_id: charge.id,
      refunded_amount: charge.amount_refunded,
    });
    if (flagError) {
      console.error('[charge-refunded] failed to record refund flag for seat', seat.id, flagError.message);
    }

    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (!adminEmail) {
      console.error('[charge-refunded] ADMIN_ALERT_EMAIL not set — flag recorded but no email sent for seat', seat.id);
    } else {
      try {
        await sendEmail({
          to: adminEmail,
          subject: 'Refunded seat was already redeemed — review needed',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <h2 style="color:#DC2626">Refunded seat already redeemed</h2>
              <p style="color:#374151">
                Seat <code>${seat.id}</code> (instructor <code>${seat.instructor_id}</code>) was refunded via Stripe charge
                <code>${charge.id}</code> after the learner (<code>${seat.redeemed_by}</code>) had already redeemed it.
              </p>
              <p style="color:#374151"><strong>The learner's Pro access has not been touched.</strong> Review and decide manually.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('[charge-refunded] failed to send admin alert for seat', seat.id, emailErr.message);
      }
    }

    console.log('[charge-refunded] flagged already-redeemed seat', seat.id, 'for manual review');
  } catch (err) {
    console.error('[charge-refunded] error:', err);
  }
}

// ── Webhook (must be before express.json() to receive raw body) ───────────────

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Dedup on Stripe's event id before doing anything else, so a retried
  // delivery (Stripe retries on any non-2xx, and can also just double-send)
  // can't re-grant Pro or re-insert a commission row. Insert-then-check-
  // conflict is atomic against two near-simultaneous retries; a unique
  // constraint on event_id is the source of truth, not an in-memory check.
  // On any error OTHER than "already recorded", fail closed (500) so Stripe
  // retries later rather than risk processing without dedup protection.
  const { error: dedupError } = await supabaseAdmin
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type });

  if (dedupError) {
    if (dedupError.code === '23505') {
      console.log('[webhook] duplicate event, skipping:', event.id);
      return res.json({ received: true, duplicate: true });
    }
    console.error('[webhook] dedup insert error:', dedupError);
    return res.status(500).json({ error: 'Webhook dedup failed' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Seat purchases are handled in a completely separate function and
    // return here — structurally, not conditionally. Everything below this
    // block (the isPro grant and, critically, the referral-commission
    // insert) is unreachable code for a seat purchase, not skipped by a
    // flag inside it. A seat purchase is the INSTRUCTOR paying for a
    // LEARNER's access; it must never grant the instructor Pro and must
    // never be capable of crediting anyone's referral_code, which is
    // exactly what the shared logic below does for the normal purchase flow.
    if (isSeatPurchaseSession(session)) {
      await handleSeatPurchaseCompleted(session, supabaseAdmin);
      return res.json({ received: true });
    }

    const userId = session.metadata?.userId;
    console.log('Webhook - userId from metadata:', userId);

    if (!userId) {
      console.log('No userId in metadata, skipping Supabase update');
      return res.json({ received: true });
    }

    try {
      const { data: existing } = await supabaseAdmin
        .from('user_progress')
        .select('progress')
        .eq('id', userId)
        .single();

      const updatedProgress = { ...(existing?.progress || {}) };
      if (shouldApplyProGrant(updatedProgress.proSource, 'stripe')) {
        updatedProgress.isPro = true;
        updatedProgress.proExpiresAt = computeProExpiresAt();
        updatedProgress.proSource = 'stripe';
      }

      const { error } = await supabaseAdmin
        .from('user_progress')
        .upsert({ id: userId, progress: updatedProgress, updated_at: new Date().toISOString() })
        .eq('id', userId);

      console.log('Supabase update result:', error ? error.message : 'success');

      // Track referral commission
      try {
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('referred_by')
          .eq('id', userId)
          .single();

        if (userProfile?.referred_by) {
          const { data: referrer } = await supabaseAdmin
            .from('profiles')
            .select('id, account_type')
            .eq('referral_code', userProfile.referred_by)
            .single();

          // Only a real instructor account earns commission — referral_code
          // is a column any profile can carry (e.g. a learner's "invite a
          // friend" code shares the same column), and previously this
          // matched on referral_code alone with no account_type check, so
          // any matching profile got credited regardless of role.
          if (referrer && referrer.account_type === 'instructor') {
            // This webhook only fires for Stripe Checkout purchases (every platform
            // currently routes through Stripe — see paywall.tsx), so the Stripe-fee
            // net applies here, not the App Store/Google Play commission rate.
            await supabaseAdmin.from('instructor_earnings').insert({
              instructor_id: referrer.id,
              learner_id: userId,
              amount: INSTRUCTOR_PAYOUT_STRIPE_MINOR / 100,
              status: 'pending',
            });
            console.log('[webhook] Referral commission recorded for instructor:', referrer.id);
          }
        }
      } catch (e) {
        console.error('[webhook] Referral commission error:', e);
      }
    } catch (e) {
      console.error('[webhook] Supabase error:', e);
    }
  }

  if (event.type === 'charge.refunded') {
    await handleChargeRefunded(event.data.object, supabaseAdmin);
    return res.json({ received: true });
  }

  res.json({ received: true });
});

app.post('/api/stripe/connect-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe Connect webhook not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[connect-webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'account.updated') {
    const account = event.data.object;
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const status = deriveConnectStatus(account);
      const { error } = await supabaseAdmin
        .from('instructor_connect_accounts')
        .update({
          status,
          payouts_enabled: !!account.payouts_enabled,
          details_submitted: !!account.details_submitted,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', account.id);
      if (error) {
        console.error(`[connect-webhook] Failed to update account ${account.id}: ${error.message}`);
      } else {
        console.log(`[connect-webhook] account ${account.id} -> ${status}`);
      }
    } catch (e) {
      console.error('[connect-webhook] Supabase update error:', e);
    }
  }

  res.json({ received: true });
});

// ─── POST /api/revenuecat-webhook ─────────────────────────────────────────────
// RevenueCat's server-side notification for App Store/Play Store IAP events —
// the client's own purchasePackage() call proves nothing server-side (see
// src/purchases.ts); this is what actually grants Pro. Auth is a static
// bearer token (REVENUECAT_WEBHOOK_SECRET), not an HMAC signature — RC has no
// signing scheme like Stripe's, just whatever string you configure as the
// "Authorization header value" in its dashboard, sent back verbatim.
//
// All the actual decision logic (which event types are handled, how
// expiration_at_ms maps to proExpiresAt, what a CANCELLATION vs an
// EXPIRATION does) lives in the pure, unit-tested resolveRevenueCatUpdate —
// this route is just auth + dedup + fetch/upsert wiring around it.
app.post('/api/revenuecat-webhook', express.json(), async (req, res) => {
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: 'RevenueCat webhook not configured' });
  }
  if (req.headers['authorization'] !== webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const event = req.body && req.body.event;
  if (!event || !event.id || !event.type) {
    console.error('[revenuecat-webhook] malformed payload:', JSON.stringify(req.body));
    return res.status(400).json({ error: 'Malformed payload' });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Same dedup pattern as the Stripe webhook above: insert on RC's own
  // event id before doing anything else, treat a unique-constraint conflict
  // as "already processed, skip". RC retries on any non-2xx response, same
  // as Stripe.
  const { error: dedupError } = await supabaseAdmin
    .from('revenuecat_webhook_events')
    .insert({ event_id: event.id, event_type: event.type });

  if (dedupError) {
    if (dedupError.code === '23505') {
      console.log('[revenuecat-webhook] duplicate event, skipping:', event.id);
      return res.json({ received: true, duplicate: true });
    }
    console.error('[revenuecat-webhook] dedup insert error:', dedupError);
    return res.status(500).json({ error: 'Webhook dedup failed' });
  }

  // app_user_id is the Supabase user id — set as appUserID when the app
  // calls Purchases.configure() (see src/purchases.ts), so this maps
  // straight back to user_progress.id with no separate lookup table.
  const userId = event.app_user_id;
  if (!userId) {
    console.error('[revenuecat-webhook] missing app_user_id on event:', event.id, event.type);
    return res.json({ received: true });
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('user_progress')
      .select('progress')
      .eq('id', userId)
      .single();

    const currentProgress = existing?.progress || {};
    // resolveRevenueCatUpdate trusts RC's own expiration_at_ms over any
    // locally-computed guess — see lib/revenuecatWebhook.js for the full
    // per-event-type reasoning (INITIAL_PURCHASE/RENEWAL/CANCELLATION/
    // EXPIRATION), including the fixed-duration fallback used only when
    // that field is unexpectedly absent from the payload.
    const { progress: patch, warning } = resolveRevenueCatUpdate(event.type, event.expiration_at_ms, currentProgress);

    if (warning) {
      console.warn(`[revenuecat-webhook] ${warning} (event ${event.id}, user ${userId})`);
    }

    if (!patch) {
      console.log(`[revenuecat-webhook] ${event.type}: no update applied for user`, userId);
      return res.json({ received: true });
    }

    const updatedProgress = { ...currentProgress, ...patch };
    const { error } = await supabaseAdmin
      .from('user_progress')
      .upsert({ id: userId, progress: updatedProgress, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('[revenuecat-webhook] Supabase update error:', error.message);
    } else {
      console.log(`[revenuecat-webhook] ${event.type} applied for user`, userId);
    }
  } catch (e) {
    console.error('[revenuecat-webhook] Supabase error:', e);
  }

  res.json({ received: true });
});

app.use(express.json());

// ── AI explain proxy ──────────────────────────────────────────────────────────

// Pinned server-side, not client-controlled — see the three callers this
// serves (apps/mobile/app/(tabs)/tutor.tsx, packages/ai/src/tutor.ts's
// explainAnswer(), and apps/mobile/src/studyPlan.ts's generateStudyPlan()).
// Previously the entire request body was forwarded to Anthropic
// unmodified, meaning the client controlled model, max_tokens, and
// everything else.
//
// caller selects a model from this allowlist rather than letting the
// client name a model directly — same trust boundary as before, just
// keyed by caller identity instead of collapsed to one fixed model. The
// explainer's prompts are short, single-shot, and low-stakes wording
// (explaining one already-known right/wrong answer), so Haiku is the
// right cost/quality tradeoff there; Ask Pip is open-ended multi-turn
// tutoring and the study plan generator must produce a large, strictly
// valid JSON array — both stay on Sonnet.
const CALLER_MODELS = {
  ask_pip: 'claude-sonnet-4-6',
  explainer: 'claude-haiku-4-5-20251001',
  study_plan: 'claude-sonnet-4-6',
};
const DEFAULT_CALLER = 'ask_pip';
// A ceiling, not a target — Ask Pip's and explainAnswer()'s prompts both
// self-limit well below this, so raising it doesn't lengthen their
// responses. Pinned at generateStudyPlan()'s own requirement (4000,
// JSON array output that must not be truncated mid-response) since that's
// the largest legitimate need among all three callers; it still bounds
// the cost of an abusive direct request, which is the actual point of
// pinning this server-side at all.
const ANTHROPIC_MAX_TOKENS = 4000;
const MAX_SYSTEM_CHARS = 8000;
const MAX_MESSAGES = 40;

// Shared quota on POST /api/explain, one counter across all three callers
// (Ask Pip, the wrong-answer explainer, and the orphaned study plan
// generator) since they all hit this one endpoint. Free is a LIFETIME cap
// (never resets); Pro is a per-day cap (resets at UTC midnight) — the
// server owns the free tier now, not any client-side counter.
const FREE_EXPLAIN_LIFETIME_LIMIT = 10;
// At ~$0.0092/question measured cost, 50/day put the worst-case quarterly
// cost per subscriber well above the ~$7 net revenue it's funded by. 20/day
// caps that worst case at ~$16/quarter — still above revenue, but only for
// a pathological user, and invisible to normal usage.
const PRO_EXPLAIN_DAILY_LIMIT = 20;

// Reads isPro, then reads-and-increments the caller's usage in
// explain_daily_usage. Fails OPEN on any Supabase error at any step — log
// it, return not-blocked — because Ask Pip is a headline paid feature and
// a DB hiccup here must not turn into a hard outage for it.
// Note: each branch's read-then-write is not atomic, so two concurrent
// requests from the same user landing in the same instant could both read
// the same pre-increment count and both be admitted — acceptable for a
// soft anti-abuse quota, not something this guards against.
async function checkAndIncrementExplainQuota(userId, supabaseAdmin) {
  const today = new Date().toISOString().slice(0, 10);

  let isPro = false;
  try {
    const { data: progressRow, error: progressErr } = await supabaseAdmin
      .from('user_progress')
      .select('progress')
      .eq('id', userId)
      .maybeSingle();
    if (progressErr) throw progressErr;

    const progress = progressRow?.progress || {};
    // isPro alone isn't trustworthy — expire-pro (POST /api/cron/expire-pro)
    // runs on a schedule, not instantly, so a lapsed stripe/iap/seat grant
    // can sit at isPro:true with a past proExpiresAt for up to a day (same
    // reasoning as lib/seats.js's classifyExistingPro). Re-derive it here
    // with the already-imported isEligibleForProExpiry rather than trust
    // the raw flag.
    isPro = progress.isPro === true && !isEligibleForProExpiry(progress, new Date().toISOString());
  } catch (err) {
    console.error('[explain] quota check failed reading isPro, failing open:', err);
    return { blocked: false, failedOpen: true };
  }

  // Pro: 20/day — a single row read/write against today's date, same
  // shape as the original daily-only implementation.
  if (isPro) {
    try {
      const { data: usageRow, error: usageErr } = await supabaseAdmin
        .from('explain_daily_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .maybeSingle();
      if (usageErr) throw usageErr;

      const currentCount = usageRow?.count ?? 0;
      if (currentCount >= PRO_EXPLAIN_DAILY_LIMIT) {
        return { blocked: true, count: currentCount, limit: PRO_EXPLAIN_DAILY_LIMIT, isPro };
      }

      const { error: upsertErr } = await supabaseAdmin
        .from('explain_daily_usage')
        .upsert({ user_id: userId, usage_date: today, count: currentCount + 1 }, { onConflict: 'user_id,usage_date' });
      if (upsertErr) throw upsertErr;

      return { blocked: false, count: currentCount + 1, limit: PRO_EXPLAIN_DAILY_LIMIT, isPro };
    } catch (err) {
      console.error('[explain] quota counter failed, failing open:', err);
      return { blocked: false, failedOpen: true };
    }
  }

  // Free: 10 LIFETIME, summed across every usage_date row this user has.
  // The table still buckets by day (so the Pro branch above can share it),
  // but a free user's cap is on the running total, not any single day —
  // summed in JS rather than via a Postgres aggregate, since nothing else
  // in this file relies on PostgREST's aggregate-function support and a
  // free user's row count is inherently small (capped at the limit itself).
  try {
    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from('explain_daily_usage')
      .select('usage_date, count')
      .eq('user_id', userId);
    if (rowsErr) throw rowsErr;

    const lifetimeCount = (rows || []).reduce((sum, r) => sum + r.count, 0);
    if (lifetimeCount >= FREE_EXPLAIN_LIFETIME_LIMIT) {
      return { blocked: true, count: lifetimeCount, limit: FREE_EXPLAIN_LIFETIME_LIMIT, isPro };
    }

    const todayCount = rows?.find(r => r.usage_date === today)?.count ?? 0;
    const { error: upsertErr } = await supabaseAdmin
      .from('explain_daily_usage')
      .upsert({ user_id: userId, usage_date: today, count: todayCount + 1 }, { onConflict: 'user_id,usage_date' });
    if (upsertErr) throw upsertErr;

    return { blocked: false, count: lifetimeCount + 1, limit: FREE_EXPLAIN_LIFETIME_LIMIT, isPro };
  } catch (err) {
    console.error('[explain] quota counter failed, failing open:', err);
    return { blocked: false, failedOpen: true };
  }
}

app.post('/api/explain', async (req, res) => {
  // Step 2 of rolling out auth here: enforced now. verifyAuth sends its
  // own 401 on failure — same pattern as every other authenticated
  // endpoint in this file.
  const auth = await verifyAuth(req, res);
  if (!auth) return;
  const { userId, supabaseAdmin } = auth;

  const quota = await checkAndIncrementExplainQuota(userId, supabaseAdmin);
  if (quota.blocked) {
    console.warn(
      `[explain] rejected: quota exceeded for userId=${userId} (${quota.count}/${quota.limit}, isPro=${quota.isPro})`
    );
    return res.status(429).json({ error: 'rate_limited', isPro: quota.isPro, limit: quota.limit, count: quota.count });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const { system, messages } = req.body || {};

  // Not client-controlled beyond which allowlisted model it selects — an
  // absent or unrecognised value falls back to ask_pip's model rather than
  // 400ing, so an old client (or a caller typo) degrades to the default
  // instead of breaking.
  const requestedCaller = req.body?.caller;
  const caller = Object.prototype.hasOwnProperty.call(CALLER_MODELS, requestedCaller)
    ? requestedCaller
    : DEFAULT_CALLER;
  const model = CALLER_MODELS[caller];

  // Presence and format only — never the token itself. Kept alongside
  // enforcement above while it beds in — by construction these are now
  // always true for any request that reaches this point, but still worth
  // having in the log line for now.
  const authHeader = req.headers['authorization'];
  const authHeaderPresent = authHeader !== undefined;
  const authHeaderIsBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');

  if (system !== undefined && (typeof system !== 'string' || system.length > MAX_SYSTEM_CHARS)) {
    console.warn(
      `[explain] rejected: system must be a string of at most ${MAX_SYSTEM_CHARS} characters (got ${
        typeof system === 'string' ? `${system.length} chars` : typeof system
      })`
    );
    return res.status(400).json({ error: `system must be a string of at most ${MAX_SYSTEM_CHARS} characters` });
  }

  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
    console.warn(
      `[explain] rejected: messages must be an array of at most ${MAX_MESSAGES} items (isArray=${Array.isArray(
        messages
      )}, length=${Array.isArray(messages) ? messages.length : 'n/a'})`
    );
    return res.status(400).json({ error: `messages must be an array of at most ${MAX_MESSAGES} items` });
  }

  if (!apiKey) {
    console.error('[explain] ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in server/.env' });
  }

  // Only these fields are ever sent to Anthropic — everything else in
  // req.body (temperature, top_p, a client-supplied model or max_tokens,
  // anything) is dropped, not just overridden.
  const anthropicBody = {
    model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    ...(system !== undefined ? { system } : {}),
    messages,
  };

  console.log(
    `[explain] request received: userId=${userId}, caller=${caller}, messages=${messages.length}, authHeaderPresent=${authHeaderPresent}, authHeaderIsBearer=${authHeaderIsBearer}`
  );

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    const data = await response.json();
    if (!response.ok) {
      // Anthropic's error bodies are small ({type, error: {type, message}})
      // and contain no secrets — safe to log in full for diagnosis.
      console.error(`[explain] Anthropic returned ${response.status}:`, JSON.stringify(data));
    } else {
      console.log(`[explain] Anthropic responded ${response.status}`);
    }
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[explain] Proxy error:', err);
    res.status(502).json({ error: 'Failed to reach Anthropic API', detail: String(err) });
  }
});

// ── Stripe checkout ───────────────────────────────────────────────────────────

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set' });
  }

  const auth = await verifyAuth(req, res);
  if (!auth) return;
  const { userId } = auth;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'payment',
      success_url: 'https://clearpass-app.vercel.app/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://clearpass-app.vercel.app/landing',
      metadata: { userId },
      currency: 'gbp',
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session', detail: String(err) });
  }
});

// ─── Instructor seat purchase ───────────────────────────────────────────────
// POST /api/instructor/seats/purchase
// Separate from /api/create-checkout-session above, not an extension of it:
// that endpoint has no auth check at all and grants Pro directly to
// whoever the payer is; a seat purchase must be gated to a real,
// authenticated instructor, must use a different Stripe Price (£5.99, not
// £7.99), and must NOT grant Pro to the payer — it mints an unredeemed seat
// for someone else entirely, redeemed later at POST /api/seats/redeem.
// Reusing create-checkout-session's shape for something with such a
// different authorization model and outcome would have meant bolting a
// role check and a metadata-driven behaviour switch onto an endpoint that
// currently has neither, for every future reader to untangle.

app.post('/api/instructor/seats/purchase', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'stripe_not_configured' });
  }
  const auth = await verifyAuth(req, res);
  if (!auth) return;
  const { userId, supabaseAdmin } = auth;

  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle();
    if (profileErr) throw profileErr;

    if (!profile || profile.account_type !== 'instructor') {
      return res.status(403).json({ error: 'not_an_instructor' });
    }

    // Placeholder destinations — no purchase UI exists yet (that's a later
    // phase); apps/web/instructors.html is the nearest real page today.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_SEAT_PRICE_ID, quantity: 1 }],
      mode: 'payment',
      success_url: 'https://instructors.getclearpass.co.uk/purchase-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://instructors.getclearpass.co.uk/dashboard?seat=cancelled',
      metadata: { type: 'seat', instructorId: userId },
      // Copied onto the resulting PaymentIntent so a refund is
      // self-describing in the Stripe dashboard without cross-referencing
      // our DB. findSeatForRefund's actual lookup relies on
      // instructor_seats.stripe_payment_intent_id instead (captured in
      // handleSeatPurchaseCompleted, no Stripe API call needed) — Stripe
      // doesn't guarantee metadata set here propagates onto the Charge
      // object a charge.refunded webhook delivers, so this is a defensive
      // signal and dashboard aid, not the primary correlation mechanism.
      payment_intent_data: { metadata: { type: 'seat', instructorId: userId } },
      currency: 'gbp',
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[instructor/seats/purchase] error:', err);
    res.status(500).json({ error: 'Failed to create checkout session', detail: String(err.message || err) });
  }
});

// ─── Seat redemption ────────────────────────────────────────────────────────
// POST /api/seats/redeem
// Authenticated as the redeeming learner (any account_type — not
// instructor-gated).
//
// The entitlement decision happens BEFORE any write, not after: a learner
// with permanent (comp/instructor) Pro must not consume the seat at all —
// redeeming it would burn the instructor's £5.99 for nothing, which is
// exactly the outcome resolveSeatGrant's 'skip' action exists to prevent.
// Only once the decision is "grant" do we attempt the atomic claim.
//
// The claim itself is a single conditional UPDATE, same pattern the
// phase-1 payout-request endpoint already relies on for claiming
// instructor_earnings rows: two simultaneous requests for the same token
// can only result in one row actually flipping from redeemed_at IS NULL,
// because Postgres re-evaluates the WHERE clause against the current
// committed row at lock time — the loser's UPDATE matches zero rows, not a
// partial/racy write. resolveSeatLookupOutcome handles both the initial
// "is this token even redeemable" check and the re-check if that claim
// loses a race, so the same already-redeemed/idempotent-retry rules apply
// either way.

app.post('/api/seats/redeem', async (req, res) => {
  const auth = await verifyAuth(req, res);
  if (!auth) return;
  const { userId, supabaseAdmin } = auth;

  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'missing_token' });
  }

  try {
    const { data: seat, error: seatErr } = await supabaseAdmin
      .from('instructor_seats')
      .select('id, redeemed_by, redeemed_at, pro_expires_at')
      .eq('invite_token', token)
      .maybeSingle();
    if (seatErr) throw seatErr;

    const initialOutcome = resolveSeatLookupOutcome(seat, userId);
    if (initialOutcome) {
      return res.status(initialOutcome.httpStatus).json(initialOutcome.body);
    }

    const { data: existingProgress, error: progressErr } = await supabaseAdmin
      .from('user_progress')
      .select('progress')
      .eq('id', userId)
      .maybeSingle();
    if (progressErr) throw progressErr;

    const decision = resolveSeatGrant(existingProgress?.progress || {}, new Date().toISOString());

    if (decision.action === 'skip') {
      console.log('[seats/redeem] skipped — learner already has permanent Pro:', userId);
      return res.json({ redeemed: false, seatStillValid: true, reason: 'already_has_pro' });
    }

    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('instructor_seats')
      .update({ redeemed_by: userId, redeemed_at: new Date().toISOString(), pro_expires_at: decision.proExpiresAt })
      .eq('id', seat.id)
      .is('redeemed_at', null)
      .select('id')
      .maybeSingle();
    if (claimError) throw claimError;

    if (!claimed) {
      // Someone else claimed it between our read above and this attempt.
      const { data: nowSeat, error: recheckErr } = await supabaseAdmin
        .from('instructor_seats')
        .select('redeemed_by, redeemed_at, pro_expires_at')
        .eq('id', seat.id)
        .maybeSingle();
      if (recheckErr) throw recheckErr;
      const raceOutcome = resolveSeatLookupOutcome(nowSeat, userId);
      return res.status(raceOutcome.httpStatus).json(raceOutcome.body);
    }

    const { error: updateErr } = await supabaseAdmin
      .from('user_progress')
      .upsert({ id: userId, progress: decision.updatedProgress, updated_at: new Date().toISOString() });
    if (updateErr) throw updateErr;

    console.log('[seats/redeem] redeemed seat', claimed.id, 'for', userId, 'extended:', decision.extended);
    res.json({ redeemed: true, granted: true, extended: decision.extended, proExpiresAt: decision.proExpiresAt });
  } catch (err) {
    console.error('[seats/redeem] error:', err);
    res.status(500).json({ error: 'redeem_failed', detail: String(err.message || err) });
  }
});

// ─── Seat status (read-only) ────────────────────────────────────────────────
// GET /api/seats/:token
// Public — no auth. This is the FIRST thing the redemption page calls,
// before the learner has signed up or signed in, purely to show them who
// invited them and whether the link still works. A pure SELECT, no write
// of any kind — token consumption happens only inside POST /api/seats/redeem
// above, on a completed redemption, never here. RLS deliberately gives
// learners no read access to instructor_seats (see schema.sql), so this
// has to go through the service role, same as redeem does.
app.get('/api/seats/:token', async (req, res) => {
  const { token } = req.params;
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: seat, error: seatErr } = await supabaseAdmin
      .from('instructor_seats')
      .select('instructor_id, redeemed_at, invalidated_at')
      .eq('invite_token', token)
      .maybeSingle();
    if (seatErr) throw seatErr;

    // An invalidated (refunded, unredeemed) seat reads as an unknown token
    // — see resolveSeatLookupOutcome in lib/seats.js for the same rule on
    // the actual redeem path.
    if (!seat || seat.invalidated_at) {
      return res.status(404).json({ valid: false });
    }

    const { data: instructor } = await supabaseAdmin
      .from('profiles')
      .select('username, display_name')
      .eq('id', seat.instructor_id)
      .maybeSingle();

    // Deliberately returns both raw fields rather than resolving a single
    // "the name" here — the display_name -> username -> generic fallback
    // (with its "does this look presentable" check at each step) is display
    // policy, not a data lookup, and already lives once in
    // apps/instructor-web/lib/instructorName.ts. Keeping it there means both
    // consumers (RedeemClient.tsx and generateMetadata in page.tsx) apply
    // the exact same rule instead of two copies drifting apart.
    res.json({
      valid: true,
      redeemed: !!seat.redeemed_at,
      instructorId: seat.instructor_id,
      instructorDisplayName: instructor?.display_name ?? null,
      instructorUsername: instructor?.username ?? null,
    });
  } catch (err) {
    console.error('[seats/status] error:', err);
    res.status(500).json({ error: 'status_failed' });
  }
});

// ── Instructor Stripe Connect onboarding ───────────────────────────────────────

app.post('/api/instructor/connect/onboarding-link', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'stripe_not_configured' });
  }
  const auth = await verifyAuth(req, res);
  if (!auth) return;
  const { userId, email, supabaseAdmin } = auth;

  try {
    const { data: connectRow, error: selectError } = await supabaseAdmin
      .from('instructor_connect_accounts')
      .select('stripe_account_id')
      .eq('instructor_id', userId)
      .maybeSingle();

    if (selectError) {
      console.error('[connect/onboarding-link] select error:', selectError);
      return res.status(500).json({ error: 'onboarding_link_failed', detail: String(selectError.message || selectError) });
    }

    let accountId = connectRow?.stripe_account_id ?? null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: email ?? undefined,
        business_type: 'individual',
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      const { error: upsertError } = await supabaseAdmin.from('instructor_connect_accounts').upsert({
        instructor_id: userId,
        stripe_account_id: accountId,
        status: 'not_started',
      });

      if (upsertError) {
        console.error('[connect/onboarding-link] upsert error:', upsertError);
        return res.status(500).json({ error: 'onboarding_link_failed', detail: String(upsertError.message || upsertError) });
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      // Stripe's Account Links API requires a real https:// URL here — it
      // rejects custom app schemes (e.g. clearpass://) with a url_invalid
      // error. These are plain informational pages; the actual status sync
      // happens via the Connect webhook + the app's AppState-triggered
      // refresh on foreground, same as the existing checkout success_url.
      refresh_url: 'https://clearpass-app.vercel.app/connect-refresh',
      return_url: 'https://clearpass-app.vercel.app/connect-return',
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('[connect/onboarding-link] error:', err);
    res.status(500).json({ error: 'onboarding_link_failed', detail: String(err.message || err) });
  }
});

// ── Instructor Stripe Connect payout requests ──────────────────────────────────

app.post('/api/instructor/payout-request', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'stripe_not_configured' });
  }
  const auth = await verifyAuth(req, res);
  if (!auth) return;
  const { userId, supabaseAdmin } = auth;

  try {
    const { data: connectRow, error: connectError } = await supabaseAdmin
      .from('instructor_connect_accounts')
      .select('stripe_account_id, payouts_enabled')
      .eq('instructor_id', userId)
      .maybeSingle();

    if (connectError) throw connectError;

    if (!connectRow?.stripe_account_id || !connectRow.payouts_enabled) {
      return res.status(409).json({ error: 'not_onboarded' });
    }

    // Atomically claim every pending earning row for this instructor by
    // flipping it to 'processing' in one update — the returned rows are the
    // exact set we're paying out, so a concurrent referral webhook inserting
    // a new earning mid-request can't be double-counted or dropped.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('instructor_earnings')
      .update({ status: 'processing' })
      .eq('instructor_id', userId)
      .eq('status', 'pending')
      .select('id, amount');

    if (claimError) throw claimError;

    const amount = (claimed || []).reduce((sum, e) => sum + Number(e.amount), 0);
    const claimedIds = (claimed || []).map(e => e.id);

    // Revert helper: releases the claimed earnings back to pending. Used by
    // every failure branch below the claim, so a partial failure can never
    // leave earnings stuck in 'processing' with no way to retry.
    async function revertClaim() {
      if (claimedIds.length === 0) return;
      const { error: revertError } = await supabaseAdmin
        .from('instructor_earnings')
        .update({ status: 'pending', payout_id: null })
        .in('id', claimedIds);
      if (revertError) {
        console.error('[payout-request] failed to revert claimed earnings to pending:', revertError, 'earning_ids:', claimedIds);
      }
    }

    async function markPayoutFailed(payoutId, reason) {
      const { error: failError } = await supabaseAdmin
        .from('payouts')
        .update({ status: 'failed', failure_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', payoutId);
      if (failError) {
        console.error('[payout-request] failed to mark payout failed:', failError, 'payout_id:', payoutId);
      }
    }

    if (amount < 10) {
      await revertClaim();
      return res.status(400).json({ error: 'below_minimum' });
    }

    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('payouts')
      .insert({ instructor_id: userId, amount, status: 'processing' })
      .select('id')
      .single();
    if (payoutError) {
      await revertClaim();
      throw payoutError;
    }

    const { error: stampError } = await supabaseAdmin
      .from('instructor_earnings')
      .update({ payout_id: payout.id })
      .in('id', claimedIds);

    if (stampError) {
      await revertClaim();
      await markPayoutFailed(payout.id, String(stampError.message || stampError));
      throw stampError;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: 'gbp',
        destination: connectRow.stripe_account_id,
        metadata: { payout_id: payout.id, instructor_id: userId },
      }, {
        idempotencyKey: `payout-transfer-${payout.id}`,
      });

      const { error: paidPayoutError } = await supabaseAdmin
        .from('payouts')
        .update({ status: 'paid', stripe_transfer_id: transfer.id, updated_at: new Date().toISOString() })
        .eq('id', payout.id);
      if (paidPayoutError) {
        console.error(
          '[payout-request] failed to mark payout paid after successful transfer:',
          paidPayoutError, 'payout_id:', payout.id, 'stripe_transfer_id:', transfer.id,
        );
      }

      const { error: paidEarningsError } = await supabaseAdmin
        .from('instructor_earnings')
        .update({ status: 'paid' })
        .eq('payout_id', payout.id);
      if (paidEarningsError) {
        console.error(
          '[payout-request] failed to mark earnings paid after successful transfer:',
          paidEarningsError, 'payout_id:', payout.id,
        );
      }

      res.json({ success: true, amount });
    } catch (transferErr) {
      console.error('[payout-request] transfer failed:', transferErr);
      await markPayoutFailed(payout.id, String(transferErr.message || transferErr));

      if (SAFE_TO_RETRY_STRIPE_ERROR_TYPES.has(transferErr.type)) {
        // Stripe's response confirms no transfer was created for this
        // attempt — safe to release these earnings for another payout request.
        await revertClaim();
        res.status(502).json({ error: 'transfer_failed', detail: String(transferErr.message || transferErr) });
      } else {
        // Ambiguous outcome (network/connection error, Stripe-side API
        // error, or an unrecognized error type) — Stripe may have actually
        // processed the transfer even though we didn't get a confirmed
        // response. Do NOT release these earnings for automatic retry,
        // which could create a second real transfer for the same money.
        // They stay at 'processing', still linked via payout_id to this
        // now-'failed' payout row, for manual reconciliation against the
        // Stripe Dashboard before deciding whether to retry or write off.
        res.status(502).json({
          error: 'transfer_ambiguous',
          detail: 'We could not confirm whether this payout succeeded. Please contact support before retrying.',
        });
      }
    }
  } catch (err) {
    console.error('[payout-request] error:', err);
    res.status(500).json({ error: 'payout_failed', detail: String(err.message || err) });
  }
});

// ─── Instructor self-service switch to learner ────────────────────────────────
// POST /api/instructor/switch-to-learner
// Blocked if the caller has any 'accepted' instructor_relationships — we must
// not orphan a learner whose instructor no longer exists as one; they're
// told to unlink first. Clears the Pro grant only if it's instructor-sourced
// (see clearInstructorGrant) — a learner who separately paid or was comped
// keeps that entitlement untouched.
//
// Order matters: the progress/entitlement clear happens BEFORE the
// account_type update. If the account_type update then fails, the caller is
// left as account_type: 'instructor' with a cleared grant — the next run of
// /api/cron/grant-instructor-pro simply re-grants them, a safe self-healing
// state. The reverse order would risk the opposite: account_type flips to
// 'learner' while an instructor-sourced isPro:true/proSource:'instructor'
// grant is left behind — and since expire-pro explicitly excludes
// proSource: 'instructor', that grant would never expire on its own,
// permanently leaking free Pro to a learner account.

app.post('/api/instructor/switch-to-learner', async (req, res) => {
  const auth = await verifyAuth(req, res);
  if (!auth) return;
  const { userId, supabaseAdmin } = auth;

  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle();
    if (profileErr) throw profileErr;

    if (!profile || profile.account_type !== 'instructor') {
      return res.status(409).json({ error: 'not_an_instructor' });
    }

    const { data: relationships, error: relErr } = await supabaseAdmin
      .from('instructor_relationships')
      .select('status')
      .eq('instructor_id', userId);
    if (relErr) throw relErr;

    if (hasBlockingRelationships(relationships || [])) {
      // Matches hasBlockingRelationships' own definition of blocking —
      // 'consent_withdrawn' counts too, so this number doesn't undercount
      // against what the learner-facing app.instructor.tsx shows.
      const acceptedCount = (relationships || []).filter(r => r.status === 'accepted' || r.status === 'consent_withdrawn').length;
      return res.status(409).json({ error: 'has_linked_learners', acceptedCount });
    }

    const { data: existing, error: progressErr } = await supabaseAdmin
      .from('user_progress')
      .select('progress')
      .eq('id', userId)
      .maybeSingle();
    if (progressErr) throw progressErr;

    const updatedProgress = clearInstructorGrant(existing?.progress || {});
    const { error: updateProgressErr } = await supabaseAdmin
      .from('user_progress')
      .upsert({ id: userId, progress: updatedProgress, updated_at: new Date().toISOString() });
    if (updateProgressErr) throw updateProgressErr;

    const { error: updateProfileErr } = await supabaseAdmin
      .from('profiles')
      .update({ account_type: 'learner' })
      .eq('id', userId);
    if (updateProfileErr) throw updateProfileErr;

    console.log('[switch-to-learner] switched', userId);
    res.json({ switched: true });
  } catch (err) {
    console.error('[switch-to-learner] error:', err);
    res.status(500).json({ error: 'switch_failed', detail: String(err.message || err) });
  }
});

// ─── POST /api/instructor/signup ──────────────────────────────────────────────
//
// Step 1 of 2 for web instructor signup. Public (no auth) by necessity —
// the caller has no session yet — and therefore deliberately powerless:
// it creates an auth user and records the campaign tag, and nothing else.
// No profile row, no account_type, nothing the rest of the system treats
// as privileged. Step 2 (/api/instructor/complete-signup) does that, and
// only after the magic link proves the address is really theirs.
//
// The split exists because account_type = 'instructor' is not a label, it
// is an entitlement: /api/cron/grant-instructor-pro hands every instructor
// non-expiring Pro with no further check. Granting it from an
// unauthenticated endpoint, before any verification, would let anyone mint
// free Pro for addresses they do not control.
//
// Why the writes live server-side rather than in apps/instructor-web:
//   1. profiles' RLS is `FOR INSERT WITH CHECK (auth.uid() = id)` with no
//      column-level restriction, so a client-side signup would let any
//      authenticated user self-mint account_type = 'instructor'. Minting
//      behind the service role keeps one authoritative writer.
//   2. signup_ref must be captured at account creation and survive to the
//      profile. The magic-link round trip cannot carry it in the URL:
//      emailRedirectTo is a fixed URL with no query string, and the link is
//      often opened on a different device, so neither the URL nor
//      sessionStorage survives. It rides on the auth user's user_metadata
//      instead — see step 1's createUser call.
//
// This endpoint deliberately does NOT send the email. The client calls the
// existing supabase.auth.signInWithOtp({ shouldCreateUser: false }) path
// afterwards, which is the same already-debugged flow /login uses — same
// template, same sender, same emailRedirectTo. Splitting the email out to
// Resend here would give instructors two different-looking emails for
// signup vs sign-in.
//
// NOTE: this Supabase project is shared with Zen Footy, so the service role
// reaches another product's tables. Every query below is explicitly scoped
// to profiles and to this one user id — no wildcard selects, no incidental
// reads. Keep it that way.

const MAX_SIGNUP_REF_LENGTH = 64;

// profiles.username is UNIQUE. Derive something readable from the email's
// local part, then add entropy; the caller retries on collision.
function deriveUsername(email) {
  const base = String(email).split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 16);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return (base || 'instructor') + suffix;
}

// Minimal fixed-window limiter. Deliberately in-memory and dependency-free:
// this is defence in depth, not the control that makes the endpoint safe
// (that is the verified-email split below). Consequences of the simple
// implementation, accepted knowingly:
//   - per-process, so it does not hold across multiple Railway instances
//   - resets on deploy/restart
//   - keyed on req.ip, which behind Railway's proxy is the forwarded client
//     (see app.set('trust proxy', ...) above) — but many legitimate callers
//     can still share one IP, e.g. everyone on a conference venue's WiFi NAT,
//     so the signup limit below is set generously rather than tightly; it
//     only needs to blunt a scripted flood, not fence in a busy stand
// If this ever becomes the primary control, replace it with something
// backed by shared state.
const rateBuckets = new Map();
function rateLimit(res, key, max, windowMs) {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || now >= entry.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) {
    res.status(429).json({ error: 'rate_limited' });
    return false;
  }
  entry.count++;
  return true;
}

// Opportunistic sweep so the Map cannot grow without bound on a long-lived
// process. Cheap: only runs on writes, only walks expired keys.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (now >= v.resetAt) rateBuckets.delete(k);
}, 10 * 60 * 1000).unref();

app.post('/api/instructor/signup', async (req, res) => {
  if (!rateLimit(res, `signup:${req.ip}`, 30, 15 * 60 * 1000)) return;

  const rawEmail = req.body?.email;
  const rawRef = req.body?.ref;

  if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.includes('@')) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  const email = rawEmail.trim().toLowerCase();

  // ref is attacker-controllable (it arrives from a URL). It is only ever
  // stored and later compared for equality, never interpolated into SQL or
  // HTML, but bound the charset and length anyway so a junk QR cannot write
  // arbitrary blobs into the column. An unusable ref is dropped, not
  // rejected — losing attribution is much better than blocking a signup at
  // a conference stand.
  let signupRef = null;
  if (typeof rawRef === 'string') {
    const trimmed = rawRef.trim();
    if (trimmed && trimmed.length <= MAX_SIGNUP_REF_LENGTH && /^[A-Za-z0-9_-]+$/.test(trimmed)) {
      signupRef = trimmed;
    } else if (trimmed) {
      console.warn('[instructor-signup] dropped unusable ref');
    }
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Create the auth user and stash the campaign tag on it. That is the
    // whole of step 1 — no profile, no account_type, nothing privileged.
    //
    // user_metadata is the right carrier for signup_ref between the two
    // steps: it is written server-side here, it survives the magic-link
    // round trip regardless of which device opens the email, and it is not
    // client-writable afterwards. It still satisfies "stamp the ref at
    // account creation" — just onto the auth user rather than the profile.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: {
        instructor_signup_intent: true,
        signup_ref: signupRef,
      },
    });

    // Uniform response, deliberately. Distinguishing new / existing
    // instructor / existing learner here would turn this endpoint into an
    // account-existence-and-type oracle for any address someone cares to
    // try. The caller always gets the same body, and always goes on to
    // request a magic link; whoever actually controls the mailbox finds out
    // what their account is when they click it. An already-registered
    // address simply gets a sign-in link instead of a first one.
    //
    // A genuine failure is swallowed into the same response for the same
    // reason. It is logged below with no identifiers so it is still
    // diagnosable from the Railway logs.
    if (createError) {
      const alreadyRegistered =
        createError.code === 'email_exists' ||
        createError.status === 422 ||
        /already.*registered|already.*exists/i.test(createError.message || '');
      if (!alreadyRegistered) {
        console.error('[instructor-signup] createUser failed:', createError.message);
      } else {
        console.log('[instructor-signup] step1 existing address');
      }
    } else {
      console.log('[instructor-signup] step1 created', signupRef ? 'with ref' : 'no ref');
    }

    return res.json({ ok: true });
  } catch (err) {
    // Same reasoning as above: never let the failure mode reveal anything
    // about the address. Log without identifiers.
    console.error('[instructor-signup] step1 error:', err.message || err);
    return res.json({ ok: true });
  }
});

// ─── POST /api/instructor/complete-signup ─────────────────────────────────────
//
// Step 2, and the only place an instructor profile is created. Requires a
// real session, which for this flow means the magic link was clicked — so
// the account_type is only ever granted to someone who has demonstrably
// received mail at that address.
//
// This ordering is the point of the split. Setting account_type before
// verification would let an unauthenticated caller mint instructor accounts
// for addresses they do not control, and /api/cron/grant-instructor-pro
// grants every instructor non-expiring Pro with no further check — so an
// unverified grant is a free-Pro faucet, not just junk rows.

app.post('/api/instructor/complete-signup', async (req, res) => {
  const auth = await verifyAuth(req, res);
  if (!auth) return;
  const { userId, supabaseAdmin } = auth;

  if (!rateLimit(res, `complete:${userId}`, 10, 15 * 60 * 1000)) return;

  try {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr || !userData?.user) throw userErr || new Error('user not found');
    const authUser = userData.user;

    // verifyAuth proves a valid session; this proves the address itself was
    // confirmed. Belt and braces — a session obtained by any other means
    // still cannot mint an instructor account on an unconfirmed address.
    if (!authUser.email_confirmed_at) {
      return res.status(403).json({ error: 'email_not_confirmed' });
    }

    const metadata = authUser.user_metadata || {};
    const { data: existingProfile, error: readErr } = await supabaseAdmin
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle();
    if (readErr) throw readErr;

    if (existingProfile) {
      // Safe to be specific now: the caller is authenticated as this very
      // account, so nothing is disclosed that they do not already know.
      // A learner is still never promoted — converting an existing account
      // is out of scope (see the account-split plan, decision 7).
      if (existingProfile.account_type !== 'instructor') {
        return res.status(409).json({ error: 'account_is_learner' });
      }
      // signup_ref is not rewritten: attribution belongs to the campaign
      // that created the account, so a later re-scan cannot reassign it.
      return res.json({ ok: true, status: 'already_instructor' });
    }

    // Only accounts that came through step 1 carry this flag, so an
    // unrelated profile-less session cannot use this endpoint to self-promote.
    if (metadata.instructor_signup_intent !== true) {
      return res.status(403).json({ error: 'no_instructor_intent' });
    }

    const signupRef = typeof metadata.signup_ref === 'string' ? metadata.signup_ref : null;

    let insertError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabaseAdmin.from('profiles').insert({
        id: userId,
        username: deriveUsername(authUser.email || 'instructor'),
        account_type: 'instructor',
        signup_ref: signupRef,
      });
      if (!error) { insertError = null; break; }
      insertError = error;
      // 23505 is almost always the UNIQUE username colliding — retry with
      // fresh entropy. A primary-key collision means a concurrent request
      // won; the re-read below settles that case.
      if (error.code !== '23505') break;
    }

    if (insertError) {
      const { data: raced } = await supabaseAdmin
        .from('profiles')
        .select('account_type')
        .eq('id', userId)
        .maybeSingle();
      if (raced?.account_type === 'instructor') {
        return res.json({ ok: true, status: 'already_instructor' });
      }
      console.error('[instructor-complete] profile insert failed:', insertError.message);
      return res.status(500).json({ error: 'signup_failed' });
    }

    console.log('[instructor-complete] profile created', signupRef ? 'with ref' : 'no ref');

    // Fired here rather than in step 1 on purpose: an unverified auth row is
    // not a signup, and notifying on one would report accounts that may never
    // be confirmed. This point is the first moment a real instructor account
    // exists.
    //
    // Awaited but never allowed to fail the request — the account is already
    // created and committed by this line, so a Slack outage must not turn a
    // successful signup into an error the instructor sees. postToSlack()
    // swallows its own failures; this is belt and braces around that.
    try {
      await postToSlack(
        [
          ':mortar_board: *New instructor signup*',
          `*Email:* ${authUser.email || '(unknown)'}`,
          signupRef ? `*Ref:* \`${signupRef}\`` : '*Ref:* none',
          `*When:* ${new Date().toISOString()}`,
        ].join('\n')
      );
    } catch (err) {
      console.error('[instructor-complete] slack notify failed:', err.message || err);
    }

    return res.json({ ok: true, status: 'created' });
  } catch (err) {
    console.error('[instructor-complete] error:', err.message || err);
    return res.status(500).json({ error: 'signup_failed' });
  }
});

// ─── Resend email helper ──────────────────────────────────────────────────────

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend ${resp.status}: ${body}`);
  }
  return resp.json();
}

function confirmPageHtml(success, message) {
  const icon = success ? '&#x2705;' : '&#x274C;';
  const heading = success ? 'Confirmed!' : 'Confirmation failed';
  const body = success
    ? "You'll now receive weekly progress updates for your learner on ClearPass."
    : (message || 'Something went wrong.');
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ClearPass - Parent Confirmation</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center">
  <div style="font-size:64px">${icon}</div>
  <h2 style="color:#0D9488">${heading}</h2>
  <p style="color:#374151">${body}</p>
  <p style="color:#9CA3AF;font-size:13px;margin-top:40px">ClearPass &bull; UK Theory Test Preparation</p>
</body>
</html>`;
}

// ─── POST /api/send-parent-confirmation ──────────────────────────────────────

app.post('/api/send-parent-confirmation', async (req, res) => {
  const { parent_email, confirmation_token } = req.body;
  if (!parent_email || !confirmation_token) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const confirmUrl = `https://clearpass-app.vercel.app/confirm-parent?token=${confirmation_token}`;
    await sendEmail({
      to: parent_email,
      subject: 'Confirm progress updates for your learner on ClearPass',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2 style="color:#0D9488">ClearPass Progress Updates</h2>
          <p style="color:#374151">A learner has asked ClearPass to send you weekly progress updates for their driving theory test preparation.</p>
          <p style="color:#374151">Click below to confirm and start receiving updates.</p>
          <p style="margin:24px 0">
            <a href="${confirmUrl}" style="display:inline-block;background:#0D9488;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700">
              Confirm Updates
            </a>
          </p>
          <p style="color:#9CA3AF;font-size:13px">If you did not expect this, you can safely ignore it.</p>
          <p style="color:#9CA3AF;font-size:12px">ClearPass &bull; UK Theory Test Preparation</p>
        </div>
      `,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[send-parent-confirmation]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/confirm-parent ──────────────────────────────────────────────────

app.get('/api/confirm-parent', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send(confirmPageHtml(false, 'Missing confirmation token.'));
  }
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('parent_email_subscriptions')
      .update({ confirmed: true })
      .eq('confirmation_token', token)
      .select()
      .single();
    if (error || !data) {
      return res.status(404).send(confirmPageHtml(false, 'Token not found or already confirmed.'));
    }
    res.send(confirmPageHtml(true, null));
  } catch (err) {
    console.error('[confirm-parent]', err);
    res.status(500).send(confirmPageHtml(false, 'Server error. Please try again.'));
  }
});

// ─── POST /api/send-weekly-parent-emails ─────────────────────────────────────

app.post('/api/send-weekly-parent-emails', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  let sent = 0;
  let failed = 0;

  try {
    const { data: subs } = await supabaseAdmin
      .from('parent_email_subscriptions')
      .select('parent_email, learner_id')
      .eq('confirmed', true);

    if (!subs || subs.length === 0) {
      return res.json({ sent: 0, failed: 0 });
    }

    for (const sub of subs) {
      try {
        const [{ data: progressRow }, { data: profile }] = await Promise.all([
          supabaseAdmin.from('user_progress').select('progress').eq('id', sub.learner_id).single(),
          supabaseAdmin.from('profiles').select('username').eq('id', sub.learner_id).single(),
        ]);

        const p = progressRow?.progress || {};
        const name = profile?.username || 'your learner';
        const readiness = p.readinessScore || 0;
        const totalQ = p.totalQuestionsAnswered || 0;
        const streak = p.studyStreakDays || 0;
        const mocks = (p.mockTestHistory || []).length;
        const bestMock = mocks > 0 ? Math.max(...(p.mockTestHistory || []).map(m => m.score || 0)) : null;

        await sendEmail({
          to: sub.parent_email,
          subject: `ClearPass weekly update for ${name}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <h2 style="color:#0D9488">Weekly Progress Update</h2>
              <p style="color:#374151">Here is <strong>${name}</strong>'s ClearPass progress this week:</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px">
                <tr style="background:#F0FDFA"><td style="padding:12px;font-weight:600;color:#374151">Pass Probability</td><td style="padding:12px;font-weight:700;color:#0D9488">${readiness}%</td></tr>
                <tr><td style="padding:12px;font-weight:600;color:#374151">Questions Answered</td><td style="padding:12px;color:#374151">${totalQ}</td></tr>
                <tr style="background:#F9FAFB"><td style="padding:12px;font-weight:600;color:#374151">Study Streak</td><td style="padding:12px;color:#374151">${streak} days</td></tr>
                <tr><td style="padding:12px;font-weight:600;color:#374151">Mock Tests Taken</td><td style="padding:12px;color:#374151">${mocks}</td></tr>
                ${bestMock !== null ? `<tr style="background:#F9FAFB"><td style="padding:12px;font-weight:600;color:#374151">Best Mock Score</td><td style="padding:12px;color:#374151">${bestMock} / 50</td></tr>` : ''}
              </table>
              <p style="color:#9CA3AF;font-size:13px">To unsubscribe, ask ${name} to remove your email in their ClearPass settings.</p>
              <p style="color:#9CA3AF;font-size:12px">ClearPass &bull; UK Theory Test Preparation</p>
            </div>
          `,
        });
        sent++;
      } catch (e) {
        console.error(`[weekly-email] failed for ${sub.parent_email}:`, e.message);
        failed++;
      }
    }

    res.json({ sent, failed });
  } catch (err) {
    console.error('[send-weekly-parent-emails]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/delete-account ────────────────────────────────────────────────

app.post('/api/delete-account', async (req, res) => {
  const { userToken } = req.body;
  if (!userToken) return res.status(400).json({ error: 'Missing userToken' });

  const supabaseAdmin = getSupabaseAdmin();

  // Verify caller is who they say they are
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(userToken);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const id = user.id;
  try {
    await Promise.allSettled([
      supabaseAdmin.from('parent_email_subscriptions').delete().eq('learner_id', id),
      supabaseAdmin.from('instructor_lesson_notes').delete().eq('instructor_id', id),
      supabaseAdmin.from('pass_stories').delete().eq('user_id', id),
      supabaseAdmin.from('instructor_earnings').delete().or(`instructor_id.eq.${id},learner_id.eq.${id}`),
      supabaseAdmin.from('instructor_relationships').delete().or(`instructor_id.eq.${id},learner_id.eq.${id}`),
      supabaseAdmin.from('challenges').delete().or(`challenger_id.eq.${id},challenged_id.eq.${id}`),
    ]);
    await supabaseAdmin.from('user_progress').delete().eq('id', id);
    await supabaseAdmin.from('profiles').delete().eq('id', id);
    await supabaseAdmin.auth.admin.deleteUser(id);
    console.log('[delete-account] deleted user', id);
    res.json({ success: true });
  } catch (err) {
    console.error('[delete-account]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/waitlist ───────────────────────────────────────────────────────

app.post('/api/waitlist', async (req, res) => {
  if (!rateLimit(res, `waitlist:${req.ip}`, 5, 15 * 60 * 1000)) return;

  const { email } = req.body;
  if (!email || !String(email).includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  try {
    const supabaseAdmin = getSupabaseAdmin();
    await supabaseAdmin.from('waitlist').insert({ email: String(email).trim().toLowerCase() });
    res.json({ success: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.json({ success: true, message: 'already_registered' });
    }
    console.error('[waitlist]', err);
    res.status(500).json({ error: 'Failed to save email' });
  }
});

// ─── POST /api/send-challenge-notification ────────────────────────────────────
// NOTE: Push notifications between users require a server-side relay.
// The client cannot directly push to another device. This endpoint:
// 1. Looks up the challenged user's Expo push token from profiles
// 2. Sends the notification via Expo Push API

app.post('/api/send-challenge-notification', async (req, res) => {
  const auth = await verifyAuth(req, res);
  if (!auth) return;
  const { userId, supabaseAdmin } = auth;

  const { challenged_user_id } = req.body;
  if (!challenged_user_id) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    // Caller must actually be party to a real challenge with this target —
    // otherwise an authenticated user could still push a notification to any
    // known user id with no relationship between them. Checked both ways
    // since the caller may be either side of the row (the original
    // challenger, or someone reminding the person who challenged them).
    // Two parameterized .eq() lookups rather than one .or() filter string
    // built from challenged_user_id — that value is caller-controlled input,
    // and a raw PostgREST filter string is not a safe place to interpolate it.
    const [{ data: asChallenger }, { data: asChallenged }] = await Promise.all([
      supabaseAdmin.from('challenges').select('id').eq('challenger_id', userId).eq('challenged_id', challenged_user_id).limit(1).maybeSingle(),
      supabaseAdmin.from('challenges').select('id').eq('challenger_id', challenged_user_id).eq('challenged_id', userId).limit(1).maybeSingle(),
    ]);
    if (!asChallenger && !asChallenged) {
      return res.status(403).json({ error: 'no_challenge_relationship' });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    const challenger_username = callerProfile?.username ?? 'Someone';

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('expo_push_token')
      .eq('id', challenged_user_id)
      .single();

    const token = profile?.expo_push_token;
    if (!token) return res.json({ sent: false, reason: 'no_token' });

    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: `${challenger_username} challenged you!`,
        body: 'They want to see who knows their theory best. Open ClearPass to accept!',
        sound: 'default',
        data: { type: 'challenge' },
      }),
    });
    res.json({ sent: resp.ok });
  } catch (err) {
    console.error('[challenge-notification]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/config ──────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  const sk = process.env.STRIPE_SECRET_KEY || '';
  res.json({ stripeTestMode: sk.startsWith('sk_test_') });
});

// ── Public stats ──────────────────────────────────────────────────────────────

let statsCache = null;
let statsCacheTime = 0;

app.get('/api/stats', async (req, res) => {
  if (statsCache && Date.now() - statsCacheTime < 3600000) {
    return res.json(statsCache);
  }
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { count, error } = await supabaseAdmin
      .from('pass_stories')
      .select('id', { count: 'exact', head: true })
      .eq('shared', true);
    if (error) throw error;
    statsCache = { totalPasses: count ?? 0, lastUpdated: new Date().toISOString() };
    statsCacheTime = Date.now();
    res.json(statsCache);
  } catch (err) {
    console.error('[stats] error:', err);
    if (statsCache) return res.json(statsCache);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Cron: streak reset ────────────────────────────────────────────────────────
// POST /api/cron/streak-reset
// Resets studyStreakDays to 0 for any user who did not study today (UTC).
// Schedule: daily at midnight UK time (00:00 Europe/London).

app.post('/api/cron/streak-reset', async (req, res) => {
  if (!requireCronAuth(req, res)) return;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from('user_progress')
      .select('id, progress');
    if (error) throw error;

    const todayUTC = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const toReset = (rows || []).filter(row => {
      const p = row.progress || {};
      if (!p.studyStreakDays || p.studyStreakDays === 0) return false;
      const lastStudied = p.lastStudied ? p.lastStudied.slice(0, 10) : null;
      return lastStudied !== todayUTC;
    });

    let reset = 0;
    for (const row of toReset) {
      const updatedProgress = { ...row.progress, studyStreakDays: 0 };
      const { error: updateError } = await supabaseAdmin
        .from('user_progress')
        .update({ progress: updatedProgress, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (!updateError) reset++;
      else console.error('[streak-reset] update error for', row.id, updateError.message);
    }

    console.log(`[streak-reset] reset ${reset} users`);
    res.json({ reset });
  } catch (err) {
    console.error('[streak-reset] error:', err);
    res.status(500).json({ error: 'Streak reset failed', detail: String(err) });
  }
});

// ── Cron: weekly progress email ───────────────────────────────────────────────
// POST /api/cron/weekly-email
// Emails all users who studied in the last 7 days with a progress summary.
// Schedule: every Monday at 08:00 Europe/London.

const TOPIC_LABELS = {
  Alertness: 'Alertness',
  Attitude: 'Attitude',
  SafetyAndYourVehicle: 'Safety & Your Vehicle',
  SafetyMargins: 'Safety Margins',
  HazardAwareness: 'Hazard Awareness',
  VulnerableRoadUsers: 'Vulnerable Road Users',
  OtherTypes: 'Other Types',
  VehicleHandling: 'Vehicle Handling',
  MotorwayRules: 'Motorway Rules',
  RulesOfTheRoad: 'Rules of the Road',
  RoadAndTrafficSigns: 'Road & Traffic Signs',
  DocumentsAndRegulations: 'Documents & Regulations',
  AccidentsAndEmergencies: 'Accidents & Emergencies',
  VehicleLoading: 'Vehicle Loading',
};

function buildWeeklyEmailHtml({ streak, totalQuestions, readinessScore, weakestTopic }) {
  const passPct = Math.round(readinessScore);
  const weakLabel = weakestTopic ? (TOPIC_LABELS[weakestTopic] || weakestTopic) : 'Keep going!';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="background:#0D9488;padding:28px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your weekly theory test progress</h1>
          <p style="margin:6px 0 0;color:#99f6e4;font-size:14px;">Here's how you've been getting on with ClearPass</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding:0 8px 16px 0;vertical-align:top;">
                <div style="background:#f0fdfa;border-radius:8px;padding:16px;">
                  <div style="color:#0D9488;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Questions Answered</div>
                  <div style="color:#111827;font-size:28px;font-weight:700;margin-top:4px;">${totalQuestions}</div>
                </div>
              </td>
              <td width="50%" style="padding:0 0 16px 8px;vertical-align:top;">
                <div style="background:#f0fdfa;border-radius:8px;padding:16px;">
                  <div style="color:#0D9488;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Study Streak</div>
                  <div style="color:#111827;font-size:28px;font-weight:700;margin-top:4px;">${streak} day${streak === 1 ? '' : 's'}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
                <div style="background:#f0fdfa;border-radius:8px;padding:16px;">
                  <div style="color:#0D9488;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Pass Probability</div>
                  <div style="color:#111827;font-size:28px;font-weight:700;margin-top:4px;">${passPct}%</div>
                </div>
              </td>
              <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
                <div style="background:#fff7ed;border-radius:8px;padding:16px;">
                  <div style="color:#ea580c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Focus On</div>
                  <div style="color:#111827;font-size:16px;font-weight:700;margin-top:4px;">${weakLabel}</div>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="https://clearpass-app.vercel.app" style="display:inline-block;background:#0D9488;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;">Keep practising &#8594;</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you have a ClearPass account.<br>
          <a href="https://clearpass-app.vercel.app" style="color:#9ca3af;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

app.post('/api/cron/weekly-email', async (req, res) => {
  if (!requireCronAuth(req, res)) return;
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: rows, error } = await supabaseAdmin
      .from('user_progress')
      .select('id, progress');
    if (error) throw error;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const activeRows = (rows || []).filter(row => {
      const lastStudied = row.progress?.lastStudied;
      return lastStudied && lastStudied >= sevenDaysAgo;
    });

    if (activeRows.length === 0) {
      console.log('[weekly-email] no active users, skipping');
      return res.json({ sent: 0 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authError) throw authError;
    const emailById = Object.fromEntries((authData.users || []).map(u => [u.id, u.email]));

    let sent = 0;
    for (const row of activeRows) {
      const email = emailById[row.id];
      if (!email) continue;

      const p = row.progress || {};
      const streak = p.studyStreakDays || 0;
      const totalQuestions = p.totalQuestionsAnswered || 0;
      const readinessScore = p.readinessScore || 0;

      const topicScores = p.topicScores || {};
      const attempted = Object.entries(topicScores).filter(([, v]) => v > 0);
      const weakestTopic = attempted.length > 0
        ? attempted.reduce((a, b) => (a[1] < b[1] ? a : b))[0]
        : null;

      const html = buildWeeklyEmailHtml({ streak, totalQuestions, readinessScore, weakestTopic });

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'ClearPass <hello@getclearpass.co.uk>',
          to: email,
          subject: 'Your weekly theory test progress 📊',
          html,
        }),
      });

      if (emailRes.ok) {
        sent++;
      } else {
        const errBody = await emailRes.text();
        console.error(`[weekly-email] failed for ${row.id}:`, errBody);
      }
    }

    console.log(`[weekly-email] sent ${sent} emails`);
    res.json({ sent });
  } catch (err) {
    console.error('[weekly-email] error:', err);
    res.status(500).json({ error: 'Weekly email failed', detail: String(err) });
  }
});

// ── Cron: expire pro subscriptions ───────────────────────────────────────────
// POST /api/cron/expire-pro
// Downgrades users whose proExpiresAt has passed.
// Schedule: daily at 01:00 Europe/London.

app.post('/api/cron/expire-pro', async (req, res) => {
  if (!requireCronAuth(req, res)) return;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from('user_progress')
      .select('id, progress');
    if (error) throw error;

    // isEligibleForProExpiry excludes proSource: 'instructor' rows (granted
    // by /api/cron/grant-instructor-pro below, unconditional for as long as
    // the account is an instructor) and proSource: 'comp' rows (manually
    // granted, e.g. reviewers/partners/beta testers — never expires on its
    // own, no automated process re-grants it).
    const toExpire = (rows || []).filter(row => isEligibleForProExpiry(row.progress || {}, now));

    let expired = 0;
    for (const row of toExpire) {
      // Clear proSource along with isPro/proExpiresAt — it must always
      // describe the *current* active grant, not history. Leaving a stale
      // proSource: 'stripe' behind here would permanently block
      // /api/cron/grant-instructor-pro from ever granting this user the
      // instructor exemption later (shouldApplyProGrant treats 'stripe' as
      // higher priority than 'instructor'), even after their paid period is
      // long gone.
      const updatedProgress = { ...row.progress, isPro: false, proExpiresAt: null, proSource: null };
      const { error: updateError } = await supabaseAdmin
        .from('user_progress')
        .update({ progress: updatedProgress, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (!updateError) expired++;
      else console.error('[expire-pro] update error for', row.id, updateError.message);
    }

    console.log(`[expire-pro] expired ${expired} users`);
    res.json({ expired });
  } catch (err) {
    console.error('[expire-pro] error:', err);
    res.status(500).json({ error: 'Expire pro failed', detail: String(err) });
  }
});

// ── Cron: grant instructor Pro ────────────────────────────────────────────
// POST /api/cron/grant-instructor-pro
// Idempotent reconciliation: every profile with account_type = 'instructor'
// gets unconditional, non-expiring Pro-level access tagged proSource:
// 'instructor'. Never overwrites an existing 'stripe' or 'comp' grant (see
// shouldApplyProGrant in lib/entitlement.js) — an instructor who separately
// paid keeps their own paid entitlement and its own expiry until it lapses,
// at which point expire-pro clears proSource and this cron picks them up on
// its next run; an instructor who was manually comp'd keeps that grant
// indefinitely, since comp is a deliberate one-off decision this automated
// cron should never silently override.
// Schedule: daily at 02:00 Europe/London (after expire-pro).

app.post('/api/cron/grant-instructor-pro', async (req, res) => {
  if (!requireCronAuth(req, res)) return;
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: instructors, error: instructorsErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('account_type', 'instructor');
    if (instructorsErr) throw instructorsErr;

    const instructorIds = (instructors || []).map(i => i.id);
    if (instructorIds.length === 0) {
      return res.json({ granted: 0, alreadyCorrect: 0, skipped: 0, total: 0 });
    }

    const { data: rows, error: progressErr } = await supabaseAdmin
      .from('user_progress')
      .select('id, progress')
      .in('id', instructorIds);
    if (progressErr) throw progressErr;

    const progressById = Object.fromEntries((rows || []).map(r => [r.id, r.progress || {}]));

    let granted = 0;
    let alreadyCorrect = 0;
    let skipped = 0;
    for (const id of instructorIds) {
      const currentProgress = progressById[id] || {};

      if (isInstructorGrantAlreadyCorrect(currentProgress)) {
        alreadyCorrect++;
        continue;
      }

      if (!shouldApplyProGrant(currentProgress.proSource, 'instructor')) {
        skipped++;
        continue;
      }

      const updatedProgress = { ...currentProgress, isPro: true, proExpiresAt: null, proSource: 'instructor' };
      const { error: updateError } = await supabaseAdmin
        .from('user_progress')
        .upsert({ id, progress: updatedProgress, updated_at: new Date().toISOString() });
      if (updateError) {
        console.error('[grant-instructor-pro] update error for', id, updateError.message);
        continue;
      }
      granted++;
    }

    // Every instructor checked must land in exactly one bucket. A mismatch
    // means something fell through uncounted (e.g. an update error above,
    // or a future bug in this function) — logged loudly rather than left
    // silent, since a silent gap here is exactly what let three
    // already-correct accounts get miscounted as freshly "granted" before.
    const accountedFor = granted + alreadyCorrect + skipped;
    if (accountedFor !== instructorIds.length) {
      console.error(
        `[grant-instructor-pro] count mismatch: granted(${granted}) + alreadyCorrect(${alreadyCorrect}) + skipped(${skipped}) = ${accountedFor}, expected ${instructorIds.length}`
      );
    }

    console.log(
      `[grant-instructor-pro] granted ${granted}, alreadyCorrect ${alreadyCorrect}, skipped ${skipped} (blocked by an existing stripe grant), total ${instructorIds.length}`
    );
    res.json({ granted, alreadyCorrect, skipped, total: instructorIds.length });
  } catch (err) {
    console.error('[grant-instructor-pro] error:', err);
    res.status(500).json({ error: 'Grant instructor pro failed', detail: String(err) });
  }
});

// ── Cron: seat expiry reminders ──────────────────────────────────────────
// POST /api/cron/seat-expiry-reminders
// Emails both instructor and learner 14 days before a redeemed seat's Pro
// grant expires.
// Schedule: daily, e.g. 03:00 Europe/London (after expire-pro at 01:00 and
// grant-instructor-pro at 02:00 — no dependency between them, just keeping
// the daily cron sequence in one place).
//
// Idempotent via instructor_seats.expiry_reminder_sent_at: each eligible
// seat is claimed with a conditional UPDATE (... WHERE
// expiry_reminder_sent_at IS NULL) BEFORE either email is sent — if this
// cron fires twice in the same day, the second run's claim affects 0 rows
// for every seat the first run already took, so nothing is ever sent
// twice. Tradeoff: if sending fails after a successful claim, that seat is
// marked sent without anyone actually having been emailed — logged loudly
// (grep for "will not retry") since it's silent otherwise. Acceptable for
// a reminder; this cron never changes access or entitlement, only sends
// mail about a change that's already recorded elsewhere.

function formatExpiryDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function instructorExpiryReminderHtml({ learnerName, expiryDate }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="background:#4F46E5;padding:28px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${learnerName}'s Pro access ends soon</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="color:#374151;font-size:15px;line-height:1.5;">
            The 90 days of ClearPass Pro you gave <strong>${learnerName}</strong> ends on <strong>${expiryDate}</strong>.
          </p>
          <p style="color:#374151;font-size:15px;line-height:1.5;">
            To keep their access going, buy them another seat from your dashboard — it picks up from this one's expiry date rather than starting over.
          </p>
          <p style="margin:24px 0;">
            <a href="https://instructors.getclearpass.co.uk/dashboard" style="display:inline-block;background:#4F46E5;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700">
              Go to your dashboard
            </a>
          </p>
        </td></tr>
      </table>
      <p style="color:#9CA3AF;font-size:12px;margin-top:16px;">ClearPass &bull; UK Theory Test Preparation</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function learnerExpiryReminderHtml({ expiryDate }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="background:#4F46E5;padding:28px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Your ClearPass Pro access ends soon</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="color:#374151;font-size:15px;line-height:1.5;">
            Your ClearPass Pro access ends on <strong>${expiryDate}</strong>.
          </p>
          <p style="color:#374151;font-size:15px;line-height:1.5;">
            If you'd like to keep using Pro after that, speak to your instructor.
          </p>
        </td></tr>
      </table>
      <p style="color:#9CA3AF;font-size:12px;margin-top:16px;">ClearPass &bull; UK Theory Test Preparation</p>
    </td></tr>
  </table>
</body>
</html>`;
}

app.post('/api/cron/seat-expiry-reminders', async (req, res) => {
  if (!requireCronAuth(req, res)) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data: seats, error } = await supabaseAdmin
      .from('instructor_seats')
      .select('id, instructor_id, redeemed_by, pro_expires_at')
      .not('redeemed_at', 'is', null)
      .not('pro_expires_at', 'is', null)
      .gt('pro_expires_at', now.toISOString())
      .lte('pro_expires_at', in14Days.toISOString())
      .is('expiry_reminder_sent_at', null);
    if (error) throw error;

    if (!seats || seats.length === 0) {
      return res.json({ sent: 0, skipped: 0 });
    }

    const userIds = [...new Set(seats.flatMap((s) => [s.instructor_id, s.redeemed_by]).filter(Boolean))];

    const [{ data: authData, error: authError }, { data: profileRows }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from('profiles').select('id, username').in('id', userIds),
    ]);
    if (authError) throw authError;

    const emailById = Object.fromEntries((authData.users || []).map((u) => [u.id, u.email]));
    const usernameById = Object.fromEntries((profileRows || []).map((p) => [p.id, p.username]));

    let sent = 0;
    let skipped = 0;

    for (const seat of seats) {
      // Claim before sending — see the comment above this route.
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('instructor_seats')
        .update({ expiry_reminder_sent_at: new Date().toISOString() })
        .eq('id', seat.id)
        .is('expiry_reminder_sent_at', null)
        .select('id')
        .maybeSingle();
      if (claimError) {
        console.error('[seat-expiry-reminders] claim error for', seat.id, claimError.message);
        continue;
      }
      if (!claimed) {
        // Another invocation already claimed it — not an error.
        skipped++;
        continue;
      }

      const instructorEmail = emailById[seat.instructor_id];
      const learnerEmail = seat.redeemed_by ? emailById[seat.redeemed_by] : null;
      const learnerName = (seat.redeemed_by && usernameById[seat.redeemed_by]) || 'your learner';
      const expiryDate = formatExpiryDate(seat.pro_expires_at);

      try {
        if (instructorEmail) {
          await sendEmail({
            to: instructorEmail,
            subject: `${learnerName}'s ClearPass Pro access ends in 14 days`,
            html: instructorExpiryReminderHtml({ learnerName, expiryDate }),
          });
        } else {
          console.error('[seat-expiry-reminders] no instructor email on file for seat', seat.id);
        }

        if (learnerEmail) {
          await sendEmail({
            to: learnerEmail,
            subject: 'Your ClearPass Pro access ends soon',
            html: learnerExpiryReminderHtml({ expiryDate }),
          });
        } else {
          console.error('[seat-expiry-reminders] no learner email on file for seat', seat.id);
        }

        sent++;
      } catch (emailErr) {
        console.error('[seat-expiry-reminders] send failed for seat', seat.id, '(already claimed, will not retry):', emailErr.message);
      }
    }

    console.log(`[seat-expiry-reminders] sent ${sent}, skipped ${skipped} (lost claim race)`);
    res.json({ sent, skipped });
  } catch (err) {
    console.error('[seat-expiry-reminders] error:', err);
    res.status(500).json({ error: 'Seat expiry reminders failed', detail: String(err.message || err) });
  }
});

// ─── POST /api/cron/daily-stats ───────────────────────────────────────────────
//
// Posts the daily numbers to #clearpass-updates. Same shape as every other
// cron route here: POST, x-cron-secret header, driven by cron-job.org.
// Schedule it for 08:00 Europe/London.
//
// The Pro figures are computed in JS (lib/dailyStats.js) rather than as
// database filters, on purpose: entitlement lives in lib/entitlement.js and
// "is this person Pro" must have exactly one definition. Expressing it a
// second time as PostgREST JSONB filters would drift from the rule the
// expire-pro cron actually applies.
//
// The cost of that choice is reading two tables per run. Both selects are
// explicitly column-scoped, and the row-count guard below refuses to run at
// all above MAX_STATS_ROWS rather than quietly turning into a daily full
// scan of a large table.

app.post('/api/cron/daily-stats', async (req, res) => {
  if (!requireCronAuth(req, res)) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // head:true — counts only, no rows transferred, purely to decide whether
    // the real reads below are safe to attempt.
    const [{ count: profileCount }, { count: progressCount }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_progress').select('id', { count: 'exact', head: true }),
    ]);

    if ((profileCount || 0) > MAX_STATS_ROWS || (progressCount || 0) > MAX_STATS_ROWS) {
      // Loud, not silent: a stats job that stops posting without saying so is
      // worse than one that fails visibly, because nobody notices a message
      // that never arrives.
      const msg =
        `:rotating_light: *Daily stats skipped* — table size exceeded the safety limit ` +
        `(profiles: ${profileCount}, user_progress: ${progressCount}, limit: ${MAX_STATS_ROWS}). ` +
        `These counts scan a JSONB column with no index; this needs an indexed or aggregated ` +
        `implementation before it can run again.`;
      console.error('[daily-stats] ABORTED — row count over limit:', profileCount, progressCount);
      await postToSlack(msg);
      return res.status(500).json({
        error: 'row_count_over_limit',
        profiles: profileCount,
        user_progress: progressCount,
        limit: MAX_STATS_ROWS,
      });
    }

    // Column-scoped: only the four fields the stats actually need, and only
    // the progress blob itself. No select('*'), nothing incidental — this
    // service role reaches another product's tables in the same project.
    const [{ data: profiles, error: profilesErr }, { data: progressRows, error: progressErr }] =
      await Promise.all([
        supabaseAdmin.from('profiles').select('id, account_type, signup_ref, created_at, exclude_from_stats'),
        supabaseAdmin.from('user_progress').select('id, progress'),
      ]);
    if (profilesErr) throw profilesErr;
    if (progressErr) throw progressErr;

    const stats = computeDailyStats({
      profiles: profiles || [],
      progressRows: progressRows || [],
      nowIso: new Date().toISOString(),
      refCode: CONFERENCE_REF_CODE,
    });

    const posted = await postToSlack(formatDailyStatsMessage(stats, CONFERENCE_REF_CODE));
    console.log('[daily-stats]', JSON.stringify(stats), 'posted:', posted);

    // posted:false is reported rather than thrown — the numbers were computed
    // correctly and the caller (cron-job.org) should see a success with the
    // detail, not a retry storm because Slack was briefly down.
    res.json({ ok: true, posted, stats });
  } catch (err) {
    console.error('[daily-stats] error:', err);
    res.status(500).json({ error: 'daily_stats_failed', detail: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`ClearPass proxy running on http://localhost:${PORT}`);
});
