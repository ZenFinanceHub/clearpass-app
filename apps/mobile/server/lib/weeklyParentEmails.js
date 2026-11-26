'use strict';

const { requireCronAuth } = require('./cronAuth');

function weeklyParentEmailHtml(name, p) {
  const readiness = p.readinessScore || 0;
  const totalQ = p.totalQuestionsAnswered || 0;
  const streak = p.studyStreakDays || 0;
  const mocks = (p.mockTestHistory || []).length;
  const bestMock = mocks > 0 ? Math.max(...(p.mockTestHistory || []).map(m => m.score || 0)) : null;
  return `
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
          `;
}

// Builds the Express handler for POST /api/send-weekly-parent-emails.
// Dependencies are injected so the auth behaviour can be tested without a
// real Supabase client or email provider:
//   - getSupabaseAdmin() -> Supabase client
//   - sendEmail({ to, subject, html }) -> Promise
//   - env (defaults to process.env) — read on every request, so CRON_SECRET
//     changes take effect without a restart.
// Auth goes through the shared fail-closed requireCronAuth BEFORE any data
// access: a missing or wrong CRON_SECRET never reaches the database.
function createWeeklyParentEmailsHandler({ getSupabaseAdmin, sendEmail, env = process.env }) {
  return async function weeklyParentEmailsHandler(req, res) {
    if (!requireCronAuth(req, res, env)) return;

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

          await sendEmail({
            to: sub.parent_email,
            subject: `ClearPass weekly update for ${name}`,
            html: weeklyParentEmailHtml(name, p),
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
  };
}

module.exports = { createWeeklyParentEmailsHandler, weeklyParentEmailHtml };
