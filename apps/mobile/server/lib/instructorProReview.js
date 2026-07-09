'use strict';

const QUARTER_MONTHS = 3;

function toUTCDate(input) {
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addMonthsUTC(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function getQuarterAnchor(instructorSinceISO) {
  const d = new Date(instructorSinceISO);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function getQuarterNumberForDate(anchor, date) {
  const monthsSinceAnchor =
    (date.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (date.getUTCMonth() - anchor.getUTCMonth());
  return Math.floor(monthsSinceAnchor / QUARTER_MONTHS) + 1;
}

function getQuarterBounds(anchor, quarterNumber) {
  const startMonthOffset = (quarterNumber - 1) * QUARTER_MONTHS;
  const quarterStart = addMonthsUTC(anchor, startMonthOffset);
  const months = [0, 1, 2].map(i => ({
    start: addMonthsUTC(anchor, startMonthOffset + i),
    end: addMonthsUTC(anchor, startMonthOffset + i + 1),
  }));
  const quarterEnd = new Date(months[2].end.getTime() - 86400000);
  return { quarterStart, quarterEnd, months };
}

function getMonthIndexInQuarter(anchor, date) {
  const monthsSinceAnchor =
    (date.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (date.getUTCMonth() - anchor.getUTCMonth());
  return ((monthsSinceAnchor % QUARTER_MONTHS) + QUARTER_MONTHS) % QUARTER_MONTHS;
}

function isLastDayOfMonth(date) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  return next.getUTCDate() === 1;
}

function isWarningDay(date) {
  return date.getUTCDate() === 20;
}

function daysUntilMonthEnd(date) {
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return lastDay.getUTCDate() - date.getUTCDate();
}

function resolveQualification({ monthConversions, peakActiveCount }) {
  if (peakActiveCount >= 10) {
    return { qualifies: true, qualifyReason: 'ten_plus_standing' };
  }
  if (monthConversions.every(c => c >= 2)) {
    return { qualifies: true, qualifyReason: 'monthly_pace' };
  }
  return { qualifies: false, qualifyReason: 'failed' };
}

function getMonthStatus({ monthConversions, peakActiveCount }) {
  if (peakActiveCount >= 10) return 'qualifies_via_standing';
  if (monthConversions >= 2) return 'on_track';
  return 'at_risk';
}

async function computeMonthConversions(supabaseAdmin, instructorId, monthStart, monthEnd) {
  const { count, error } = await supabaseAdmin
    .from('instructor_earnings')
    .select('id', { count: 'exact', head: true })
    .eq('instructor_id', instructorId)
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', monthEnd.toISOString());
  if (error) throw error;
  return count || 0;
}

async function computeActiveReferredProCount(supabaseAdmin, instructorId) {
  const { data: earnings, error } = await supabaseAdmin
    .from('instructor_earnings')
    .select('learner_id')
    .eq('instructor_id', instructorId);
  if (error) throw error;

  const learnerIds = [...new Set((earnings || []).map(e => e.learner_id).filter(Boolean))];
  if (learnerIds.length === 0) return 0;

  const { data: progressRows, error: progressErr } = await supabaseAdmin
    .from('user_progress')
    .select('id, progress')
    .in('id', learnerIds);
  if (progressErr) throw progressErr;

  return (progressRows || []).filter(row => row.progress?.isPro === true).length;
}

const BRAND_TEAL = '#0D9488';
const RISK_RED = '#DC2626';

function emailShell(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
        ${bodyHtml}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildQuarter1UpdateEmailHtml({ instructorName, conversions, activeCount }) {
  return emailShell(`
    <tr><td style="background:${BRAND_TEAL};padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your ClearPass referral activity</h1>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;">Hi ${instructorName}, here's how your referrals are going so far:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <tr>
          <td width="50%" style="padding:0 8px 0 0;">
            <div style="background:#f0fdfa;border-radius:8px;padding:16px;">
              <div style="color:${BRAND_TEAL};font-size:11px;font-weight:700;text-transform:uppercase;">New Pro conversions this month</div>
              <div style="color:#111827;font-size:28px;font-weight:700;margin-top:4px;">${conversions}</div>
            </div>
          </td>
          <td width="50%" style="padding:0 0 0 8px;">
            <div style="background:#f0fdfa;border-radius:8px;padding:16px;">
              <div style="color:${BRAND_TEAL};font-size:11px;font-weight:700;text-transform:uppercase;">Active referred Pro students</div>
              <div style="color:#111827;font-size:28px;font-weight:700;margin-top:4px;">${activeCount}</div>
            </div>
          </td>
        </tr>
      </table>
      <p style="color:#374151;font-size:15px;">You're in your first quarter as a ClearPass instructor, so your Pro access is free with no conditions attached. Your free Pro continues automatically this quarter &mdash; nothing for you to do.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">ClearPass &bull; Instructor Program</p>
    </td></tr>
  `);
}

const STATUS_COPY = {
  on_track: { label: 'On track', color: BRAND_TEAL, body: "You're on pace this month &mdash; keep it up and your free Pro will continue." },
  qualifies_via_standing: { label: 'Qualifies via 10+ standing', color: BRAND_TEAL, body: 'You have 10 or more active Pro-subscribed referred students, so you qualify for free Pro regardless of monthly pace.' },
  at_risk: { label: 'At risk', color: RISK_RED, body: "You're below pace this month. Refer more students to Pro to keep your free access." },
};

function buildMonthEndEmailHtml({ instructorName, conversions, activeCount, status, quarterResolved, qualifies }) {
  const s = STATUS_COPY[status];
  const resolutionHtml = quarterResolved
    ? `<p style="color:#374151;font-size:15px;">${qualifies
        ? 'Your free Pro continues into next quarter.'
        : "Your free Pro has lapsed this quarter &mdash; you'll need to subscribe to keep Pro features, or you can requalify in a future quarter by hitting the referral targets again."}</p>`
    : '';
  return emailShell(`
    <tr><td style="background:${BRAND_TEAL};padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your monthly ClearPass Pro referral update</h1>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;">Hi ${instructorName}, here's your referral activity for this month:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <tr>
          <td width="50%" style="padding:0 8px 0 0;">
            <div style="background:#f0fdfa;border-radius:8px;padding:16px;">
              <div style="color:${BRAND_TEAL};font-size:11px;font-weight:700;text-transform:uppercase;">New Pro conversions this month</div>
              <div style="color:#111827;font-size:28px;font-weight:700;margin-top:4px;">${conversions}</div>
            </div>
          </td>
          <td width="50%" style="padding:0 0 0 8px;">
            <div style="background:#f0fdfa;border-radius:8px;padding:16px;">
              <div style="color:${BRAND_TEAL};font-size:11px;font-weight:700;text-transform:uppercase;">Active referred Pro students</div>
              <div style="color:#111827;font-size:28px;font-weight:700;margin-top:4px;">${activeCount}</div>
            </div>
          </td>
        </tr>
      </table>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
        <div style="color:${s.color};font-size:13px;font-weight:700;text-transform:uppercase;">${s.label}</div>
        <p style="color:#374151;font-size:14px;margin:8px 0 0;">${s.body}</p>
      </div>
      ${resolutionHtml}
    </td></tr>
    <tr><td style="padding:0 32px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">ClearPass &bull; Instructor Program</p>
    </td></tr>
  `);
}

function buildWarningEmailHtml({ instructorName, conversions, activeCount, daysRemaining, conversionsNeeded }) {
  return emailShell(`
    <tr><td style="background:${RISK_RED};padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your free ClearPass Pro is at risk this month</h1>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;">Hi ${instructorName}, just a friendly heads up &mdash; you're behind pace to keep your free Pro this month.</p>
      <ul style="color:#374151;font-size:15px;">
        <li>${conversions} new Pro conversion${conversions === 1 ? '' : 's'} so far this month</li>
        <li>${activeCount} active Pro-subscribed referred students</li>
        <li>${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left this month</li>
      </ul>
      <p style="color:#374151;font-size:15px;">Refer ${conversionsNeeded} more student${conversionsNeeded === 1 ? '' : 's'} to Pro before the end of the month to stay on track, or reach 10 active referred Pro students at any point to qualify regardless of monthly pace.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">ClearPass &bull; Instructor Program</p>
    </td></tr>
  `);
}

module.exports = {
  getQuarterAnchor,
  getQuarterNumberForDate,
  getQuarterBounds,
  getMonthIndexInQuarter,
  isLastDayOfMonth,
  isWarningDay,
  daysUntilMonthEnd,
  toUTCDate,
  resolveQualification,
  getMonthStatus,
  computeMonthConversions,
  computeActiveReferredProCount,
  buildQuarter1UpdateEmailHtml,
  buildMonthEndEmailHtml,
  buildWarningEmailHtml,
};
