require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

const app = express();
const PORT = 3001;

// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID
//   ANTHROPIC_API_KEY
//   RESEND_API_KEY
//   CRON_SECRET  — shared secret for /api/cron/* endpoints (set in Railway dashboard)
//     Suggested value: r8Kp3Nq7Zm2Xt5Yb4Vw9As1Dc6Ef0Gh

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

function requireCronAuth(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers['x-cron-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    console.log('Webhook - userId from metadata:', userId);

    if (!userId) {
      console.log('No userId in metadata, skipping Supabase update');
      return res.json({ received: true });
    }

    try {
      const supabaseAdmin = getSupabaseAdmin();

      const { data: existing } = await supabaseAdmin
        .from('user_progress')
        .select('progress')
        .eq('id', userId)
        .single();

      const updatedProgress = { ...(existing?.progress || {}), isPro: true };

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
          const { data: instructor } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('referral_code', userProfile.referred_by)
            .single();

          if (instructor) {
            await supabaseAdmin.from('instructor_earnings').insert({
              instructor_id: instructor.id,
              learner_id: userId,
              amount: 2.50,
              status: 'pending',
            });
            console.log('[webhook] Referral commission recorded for instructor:', instructor.id);
          }
        }
      } catch (e) {
        console.error('[webhook] Referral commission error:', e);
      }
    } catch (e) {
      console.error('[webhook] Supabase error:', e);
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// ── AI explain proxy ──────────────────────────────────────────────────────────

app.post('/api/explain', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in server/.env' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Failed to reach Anthropic API', detail: String(err) });
  }
});

// ── Stripe checkout ───────────────────────────────────────────────────────────

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set' });
  }

  const { userId } = req.body;
  console.log('Creating checkout session for userId:', userId);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'payment',
      success_url: 'https://clearpass-app.vercel.app/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://clearpass-app.vercel.app/landing',
      metadata: { userId: userId ?? '' },
      currency: 'gbp',
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session', detail: String(err) });
  }
});

// ── Instructor payout request ─────────────────────────────────────────────────

app.post('/api/payout-request', async (req, res) => {
  const { instructorName, instructorEmail, amount, conversions } = req.body;
  if (!instructorName || !instructorEmail || amount === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'craig@zen-finance.co.uk',
      subject: `Payout Request - ${instructorName}`,
      text: [
        'ClearPass Instructor Payout Request',
        '',
        `Instructor: ${instructorName}`,
        `Email: ${instructorEmail}`,
        `Amount owed: £${Number(amount).toFixed(2)}`,
        `Conversions: ${conversions}`,
        '',
        'Please process this payout at your earliest convenience.',
      ].join('\n'),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[payout-request] error:', err);
    res.status(500).json({ error: 'Failed to send payout request email' });
  }
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

    const toExpire = (rows || []).filter(row => {
      const p = row.progress || {};
      return p.isPro === true && p.proExpiresAt && p.proExpiresAt < now;
    });

    let expired = 0;
    for (const row of toExpire) {
      const updatedProgress = { ...row.progress, isPro: false, proExpiresAt: null };
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

app.listen(PORT, () => {
  console.log(`ClearPass proxy running on http://localhost:${PORT}`);
});
