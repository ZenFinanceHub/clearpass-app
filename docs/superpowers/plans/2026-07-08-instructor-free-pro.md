# Instructor Free-Pro Conditional Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instructors get free ClearPass Pro for their first quarter unconditionally, then keep it each subsequent quarter only if they hit referral-conversion targets, tracked via a per-quarter rollup table and enforced/notified by a daily cron job.

**Architecture:** A new `instructor_pro_quarters` Supabase table stores one row per instructor per rolling 3-calendar-month quarter (anchored to each instructor's own activation date, not a shared calendar quarter). A pure, dependency-free logic module (`apps/mobile/server/lib/instructorProReview.js`) owns all date math, qualification rules, and email copy so it can be unit tested with Node's built-in test runner. A new idempotent activation endpoint grants the unconditional quarter 1 the first time a user becomes an instructor. A new daily cron endpoint creates quarter rows as they start, computes that month's conversions and peak active-referred-Pro count live from `instructor_earnings`/`user_progress`, sends the day-20 warning and end-of-month update emails, and resolves pass/fail at each quarter's end — flipping `user_progress.progress.isPro` off only for instructors whose Pro grant originated from this program.

**Tech Stack:** Express (`apps/mobile/server/proxy.js`, Railway), Supabase (Postgres + service-role client), Resend (existing `sendEmail` helper), cron-job.org triggering `POST /api/cron/*` endpoints, Node's built-in `node:test`/`node:assert` (no new npm dependency).

## Global Constraints

- No new npm dependencies — use Node 20's built-in `node:test` / `node:assert/strict` for the one testable module in this plan.
- All date/quarter/month math is done in UTC exclusively, to keep it deterministic and testable regardless of server timezone.
- Every service-role Supabase write for this feature lives in `apps/mobile/server/proxy.js`, following the existing `getSupabaseAdmin()` / `requireCronAuth()` / `sendEmail()` patterns — do not introduce a second server entrypoint.
- `instructor_pro_quarters` RLS: instructors may `SELECT` only their own rows; there is no insert/update/delete policy, so all writes go through the service-role client.
- The quarterly job must never touch `isPro`/`proSource` for any instructor whose **current** `progress.proSource === 'stripe'`, re-checked on every run (not cached from a previous check).
- Quarter 1 is unconditional for every instructor — no warning/at-risk language is ever shown for `quarter_number === 1`, in either the day-20 or month-end email.
- A failed quarter is never terminal — quarter numbering and row creation continue indefinitely; an instructor can requalify in any later quarter.
- This repo has zero existing automated tests and no CI. The pure logic module gets full `node:test` coverage per this plan. The Express/Supabase glue endpoints (activation + cron) and the React Native UI change do **not** get automated tests — consistent with every other endpoint already in `proxy.js` — and are instead verified with the manual curl/app steps given in each task.

---

## File Structure

- **Modify** `apps/mobile/supabase/schema.sql` — add `profiles.instructor_since`, the new `instructor_pro_quarters` table, and its RLS policy. This file is the repo's living, cumulative schema (no migration runner exists); new blocks are appended and applied by hand via the Supabase SQL Editor, matching how every prior block in this file was added.
- **Create** `apps/mobile/server/lib/instructorProReview.js` — pure quarter/month date math, the qualification rule, email HTML builders, and the two live-query helpers (`computeMonthConversions`, `computeActiveReferredProCount`). This is the only file with business logic worth unit testing in isolation from Express/Supabase.
- **Create** `apps/mobile/server/lib/instructorProReview.test.js` — `node:test` coverage for every pure function in the module above.
- **Modify** `apps/mobile/server/package.json` — add a `test` script.
- **Modify** `apps/mobile/server/proxy.js` — three changes: (1) Stripe webhook now stamps `proSource: 'stripe'` on every real payment; (2) new `POST /api/instructor/activate`; (3) new `POST /api/cron/instructor-pro-review`.
- **Modify** `apps/mobile/app/instructor.tsx` — call the new activation endpoint every time the Instructor screen loads (idempotent server-side, so this also backfills instructors who already had an `instructor_code` before this feature shipped).
- **Modify** `docs/google-play-checklist.md` — add the new cron job to the existing cron-job.org checklist line, matching the file's established one-liner style.

---

## Task 1: Database schema — `instructor_since` + `instructor_pro_quarters`

**Files:**
- Modify: `apps/mobile/supabase/schema.sql`

**Interfaces:**
- Produces: `profiles.instructor_since TIMESTAMPTZ` (nullable — null means "not yet an instructor"), and table `instructor_pro_quarters` with columns `id, instructor_id, quarter_number, quarter_start, quarter_end, month1_conversions, month2_conversions, month3_conversions, active_referred_pro_count, qualifies, qualify_reason, free_pro_active, month1_update_sent_at, month2_update_sent_at, month3_update_sent_at, month1_warning_sent_at, month2_warning_sent_at, month3_warning_sent_at, created_at, updated_at`. Every later task in this plan reads/writes these exact names.

- [ ] **Step 1: Append the schema block**

Append to the end of `apps/mobile/supabase/schema.sql` (after the existing `cancellation_feedback` block, which currently ends the file at line 163):

```sql

-- Instructor free-Pro conditional access system
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instructor_since TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS instructor_pro_quarters (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quarter_number            INT NOT NULL,
  quarter_start             DATE NOT NULL,
  quarter_end               DATE NOT NULL,
  month1_conversions        INT NOT NULL DEFAULT 0,
  month2_conversions        INT NOT NULL DEFAULT 0,
  month3_conversions        INT NOT NULL DEFAULT 0,
  active_referred_pro_count INT NOT NULL DEFAULT 0,
  qualifies                 BOOLEAN,
  qualify_reason            TEXT CHECK (qualify_reason IN ('first_quarter','monthly_pace','ten_plus_standing','failed')),
  free_pro_active           BOOLEAN NOT NULL DEFAULT true,
  month1_update_sent_at     TIMESTAMPTZ,
  month2_update_sent_at     TIMESTAMPTZ,
  month3_update_sent_at     TIMESTAMPTZ,
  month1_warning_sent_at    TIMESTAMPTZ,
  month2_warning_sent_at    TIMESTAMPTZ,
  month3_warning_sent_at    TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (instructor_id, quarter_number)
);

ALTER TABLE instructor_pro_quarters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can view own quarter status" ON instructor_pro_quarters;
CREATE POLICY "Instructors can view own quarter status" ON instructor_pro_quarters
  FOR SELECT USING (auth.uid() = instructor_id);
-- No insert/update/delete policy: writes only via service role
-- (cron + /api/instructor/activate), matching instructor_earnings' pattern.
```

- [ ] **Step 2: Apply and verify**

This repo has no migration runner — every block in `schema.sql` is applied by hand. Open the Supabase Dashboard → SQL Editor for the project, paste the new block, and run it. Verify in Table Editor:
- `profiles` has a new nullable `instructor_since` column.
- `instructor_pro_quarters` exists with RLS enabled and one SELECT policy.

- [ ] **Step 3: Commit**

```bash
cd /home/craig/clearpass
git add apps/mobile/supabase/schema.sql
git commit -m "feat(schema): add instructor_since and instructor_pro_quarters for free-Pro tracking"
```

---

## Task 2: Pure logic module — quarter math, qualification rule, email copy

**Files:**
- Create: `apps/mobile/server/lib/instructorProReview.js`
- Create: `apps/mobile/server/lib/instructorProReview.test.js`
- Modify: `apps/mobile/server/package.json`

**Interfaces:**
- Consumes: nothing (pure functions) except, for the two query helpers, a Supabase service-role client matching the shape returned by `getSupabaseAdmin()` in `proxy.js`.
- Produces (all used by Task 3):
  - `getQuarterAnchor(instructorSinceISO: string): Date` — UTC midnight, 1st of the calendar month containing `instructorSince`.
  - `getQuarterNumberForDate(anchor: Date, date: Date): number` — 1-based.
  - `getQuarterBounds(anchor: Date, quarterNumber: number): { quarterStart: Date, quarterEnd: Date, months: [{start: Date, end: Date}, {start: Date, end: Date}, {start: Date, end: Date}] }` — `end` of each month is exclusive; `quarterEnd` is inclusive (last day of month 3).
  - `getMonthIndexInQuarter(anchor: Date, date: Date): number` — 0, 1, or 2.
  - `isLastDayOfMonth(date: Date): boolean`
  - `isWarningDay(date: Date): boolean` — true only on the 20th.
  - `daysUntilMonthEnd(date: Date): number`
  - `toUTCDate(input: Date | string): Date` — floors to UTC midnight.
  - `resolveQualification({ monthConversions: number[3], peakActiveCount: number }): { qualifies: boolean, qualifyReason: 'monthly_pace'|'ten_plus_standing'|'failed' }`
  - `getMonthStatus({ monthConversions: number, peakActiveCount: number }): 'on_track'|'qualifies_via_standing'|'at_risk'`
  - `computeMonthConversions(supabaseAdmin, instructorId: string, monthStart: Date, monthEnd: Date): Promise<number>`
  - `computeActiveReferredProCount(supabaseAdmin, instructorId: string): Promise<number>`
  - `buildQuarter1UpdateEmailHtml({ instructorName, conversions, activeCount }): string`
  - `buildMonthEndEmailHtml({ instructorName, conversions, activeCount, status, quarterResolved, qualifies }): string`
  - `buildWarningEmailHtml({ instructorName, conversions, activeCount, daysRemaining, conversionsNeeded }): string`

- [ ] **Step 1: Add the test script**

Modify `apps/mobile/server/package.json`:

```json
{"name":"clearpass-proxy","version":"1.0.0","main":"proxy.js","scripts":{"start":"node proxy.js","test":"node --test"},"dependencies":{"@supabase/supabase-js":"^2.105.1","cors":"^2.8.5","dotenv":"^16.0.0","express":"^4.18.0","nodemailer":"^8.0.7","stripe":"^22.1.0"}}
```

- [ ] **Step 2: Write the failing test file**

Create `apps/mobile/server/lib/instructorProReview.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getQuarterAnchor,
  getQuarterNumberForDate,
  getQuarterBounds,
  getMonthIndexInQuarter,
  isLastDayOfMonth,
  isWarningDay,
  daysUntilMonthEnd,
  resolveQualification,
  getMonthStatus,
  buildQuarter1UpdateEmailHtml,
  buildMonthEndEmailHtml,
  buildWarningEmailHtml,
} = require('./instructorProReview');

test('getQuarterAnchor floors to the 1st of the activation month, UTC', () => {
  const anchor = getQuarterAnchor('2026-03-15T10:00:00Z');
  assert.equal(anchor.toISOString().slice(0, 10), '2026-03-01');
});

test('getQuarterNumberForDate returns 1 for dates in the anchor quarter', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-03-20T00:00:00Z')), 1);
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-05-31T00:00:00Z')), 1);
});

test('getQuarterNumberForDate rolls to quarter 2 after 3 calendar months', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-06-01T00:00:00Z')), 2);
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-08-31T00:00:00Z')), 2);
  assert.equal(getQuarterNumberForDate(anchor, new Date('2026-09-01T00:00:00Z')), 3);
});

test('getQuarterBounds returns 3 whole calendar months for quarter 1', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  const { quarterStart, quarterEnd, months } = getQuarterBounds(anchor, 1);
  assert.equal(quarterStart.toISOString().slice(0, 10), '2026-03-01');
  assert.equal(quarterEnd.toISOString().slice(0, 10), '2026-05-31');
  assert.equal(months.length, 3);
  assert.equal(months[0].start.toISOString().slice(0, 10), '2026-03-01');
  assert.equal(months[0].end.toISOString().slice(0, 10), '2026-04-01');
  assert.equal(months[2].start.toISOString().slice(0, 10), '2026-05-01');
  assert.equal(months[2].end.toISOString().slice(0, 10), '2026-06-01');
});

test('getQuarterBounds returns quarter 2 immediately after quarter 1', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  const q2 = getQuarterBounds(anchor, 2);
  assert.equal(q2.quarterStart.toISOString().slice(0, 10), '2026-06-01');
  assert.equal(q2.quarterEnd.toISOString().slice(0, 10), '2026-08-31');
});

test('getMonthIndexInQuarter identifies which of the 3 months a date falls in', () => {
  const anchor = getQuarterAnchor('2026-03-15T00:00:00Z');
  assert.equal(getMonthIndexInQuarter(anchor, new Date('2026-03-20T00:00:00Z')), 0);
  assert.equal(getMonthIndexInQuarter(anchor, new Date('2026-04-20T00:00:00Z')), 1);
  assert.equal(getMonthIndexInQuarter(anchor, new Date('2026-05-20T00:00:00Z')), 2);
  assert.equal(getMonthIndexInQuarter(anchor, new Date('2026-06-20T00:00:00Z')), 0);
});

test('isLastDayOfMonth', () => {
  assert.equal(isLastDayOfMonth(new Date('2026-02-28T00:00:00Z')), true);
  assert.equal(isLastDayOfMonth(new Date('2026-04-30T00:00:00Z')), true);
  assert.equal(isLastDayOfMonth(new Date('2026-04-29T00:00:00Z')), false);
  assert.equal(isLastDayOfMonth(new Date('2028-02-29T00:00:00Z')), true);
});

test('isWarningDay only true on the 20th', () => {
  assert.equal(isWarningDay(new Date('2026-07-20T00:00:00Z')), true);
  assert.equal(isWarningDay(new Date('2026-07-19T00:00:00Z')), false);
});

test('daysUntilMonthEnd', () => {
  assert.equal(daysUntilMonthEnd(new Date('2026-07-20T00:00:00Z')), 11);
  assert.equal(daysUntilMonthEnd(new Date('2026-07-31T00:00:00Z')), 0);
});

test('resolveQualification: 10+ standing qualifies regardless of monthly pace', () => {
  const result = resolveQualification({ monthConversions: [0, 0, 0], peakActiveCount: 10 });
  assert.deepEqual(result, { qualifies: true, qualifyReason: 'ten_plus_standing' });
});

test('resolveQualification: 2+ conversions every month qualifies', () => {
  const result = resolveQualification({ monthConversions: [2, 3, 2], peakActiveCount: 4 });
  assert.deepEqual(result, { qualifies: true, qualifyReason: 'monthly_pace' });
});

test('resolveQualification: missing the pace in any single month fails', () => {
  const result = resolveQualification({ monthConversions: [2, 1, 2], peakActiveCount: 4 });
  assert.deepEqual(result, { qualifies: false, qualifyReason: 'failed' });
});

test('getMonthStatus reflects month/standing status independent of resolution', () => {
  assert.equal(getMonthStatus({ monthConversions: 0, peakActiveCount: 10 }), 'qualifies_via_standing');
  assert.equal(getMonthStatus({ monthConversions: 2, peakActiveCount: 3 }), 'on_track');
  assert.equal(getMonthStatus({ monthConversions: 1, peakActiveCount: 3 }), 'at_risk');
});

test('quarter 1 emails never use risk/warning/lapse framing', () => {
  const html = buildQuarter1UpdateEmailHtml({ instructorName: 'Sam', conversions: 0, activeCount: 0 });
  const lower = html.toLowerCase();
  for (const word of ['at risk', 'warning', 'lapse', 'lapsed']) {
    assert.equal(lower.includes(word), false, `quarter-1 email should not contain "${word}"`);
  }
  assert.match(html, /continues automatically/i);
});

test('quarter 2+ warning email states days remaining and conversions needed', () => {
  const html = buildWarningEmailHtml({
    instructorName: 'Sam', conversions: 1, activeCount: 2, daysRemaining: 8, conversionsNeeded: 1,
  });
  assert.match(html, /8/);
  assert.match(html, /1 more/i);
});

test('month-end email reflects at_risk status for quarter 2+', () => {
  const html = buildMonthEndEmailHtml({
    instructorName: 'Sam', conversions: 0, activeCount: 0, status: 'at_risk', quarterResolved: false, qualifies: null,
  });
  assert.match(html, /at risk/i);
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /home/craig/clearpass/apps/mobile/server && npm test
```

Expected: FAIL — `Cannot find module './instructorProReview'`.

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/server/lib/instructorProReview.js`:

```js
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/craig/clearpass/apps/mobile/server && npm test
```

Expected: PASS — all tests green, 0 failures.

- [ ] **Step 6: Commit**

```bash
cd /home/craig/clearpass
git add apps/mobile/server/lib/instructorProReview.js apps/mobile/server/lib/instructorProReview.test.js apps/mobile/server/package.json
git commit -m "feat(server): add instructor free-Pro quarter/qualification logic module with tests"
```

---

## Task 3: Wire the activation and cron endpoints into proxy.js

**Files:**
- Modify: `apps/mobile/server/proxy.js`

**Interfaces:**
- Consumes: every export from `apps/mobile/server/lib/instructorProReview.js` (Task 2), plus existing `getSupabaseAdmin()`, `requireCronAuth()`, `sendEmail()` from `proxy.js` itself.
- Produces: `POST /api/instructor/activate` (body `{ userId }, → { activated: boolean, reason?: string }`), `POST /api/cron/instructor-pro-review` (header `x-cron-secret`, → `{ processed: number, skippedPaid: number }`). Task 4 calls the first one.

- [ ] **Step 1: Import the new module**

Modify `apps/mobile/server/proxy.js` — insert after line 4 (`const cors = require('cors');`):

```js
const cors = require('cors');
const {
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
} = require('./lib/instructorProReview');
```

- [ ] **Step 2: Tag real Stripe payments with `proSource: 'stripe'`**

Modify `proxy.js:93` (inside the `checkout.session.completed` handler) — change:

```js
      const updatedProgress = { ...(existing?.progress || {}), isPro: true };
```

to:

```js
      const updatedProgress = { ...(existing?.progress || {}), isPro: true, proSource: 'stripe' };
```

This is the "checked fresh each run" signal the quarterly review relies on to never touch a genuine payer — without it, an instructor who was previously on the free program and then pays for real would keep showing `proSource: 'instructor_referral_free'` and get incorrectly evaluated.

- [ ] **Step 3: Add the activation endpoint**

Insert into `proxy.js` immediately before the `app.listen(PORT, ...)` call at the end of the file (currently line 760):

```js
// ─── POST /api/instructor/activate ───────────────────────────────────────────
// Idempotent: stamps instructor_since and grants the unconditional first free
// quarter of Pro exactly once. Safe to call every time a user opens the
// Instructor screen — no-ops if instructor_since is already set. Guards the
// stamp with .is('instructor_since', null) so concurrent calls can't double-grant.

app.post('/api/instructor/activate', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date();

    const { data: stamped, error: stampErr } = await supabaseAdmin
      .from('profiles')
      .update({ instructor_since: now.toISOString() })
      .eq('id', userId)
      .is('instructor_since', null)
      .select('id');
    if (stampErr) throw stampErr;

    if (!stamped || stamped.length === 0) {
      return res.json({ activated: false, reason: 'already_active' });
    }

    const anchor = getQuarterAnchor(now.toISOString());
    const { quarterStart, quarterEnd } = getQuarterBounds(anchor, 1);

    const { data: existingProgress } = await supabaseAdmin
      .from('user_progress')
      .select('progress')
      .eq('id', userId)
      .single();

    const currentProgress = existingProgress?.progress || {};
    if (currentProgress.proSource !== 'stripe') {
      const updatedProgress = { ...currentProgress, isPro: true, proSource: 'instructor_referral_free' };
      const { error: proErr } = await supabaseAdmin
        .from('user_progress')
        .upsert({ id: userId, progress: updatedProgress, updated_at: now.toISOString() });
      if (proErr) throw proErr;
    }

    const { error: quarterErr } = await supabaseAdmin
      .from('instructor_pro_quarters')
      .insert({
        instructor_id: userId,
        quarter_number: 1,
        quarter_start: quarterStart.toISOString().slice(0, 10),
        quarter_end: quarterEnd.toISOString().slice(0, 10),
        qualifies: true,
        qualify_reason: 'first_quarter',
        free_pro_active: true,
      });
    if (quarterErr) throw quarterErr;

    console.log('[instructor/activate] activated instructor', userId);
    res.json({ activated: true });
  } catch (err) {
    console.error('[instructor/activate] error:', err);
    res.status(500).json({ error: 'Activation failed', detail: String(err) });
  }
});
```

- [ ] **Step 4: Add the quarterly review cron endpoint**

Insert directly after the activation endpoint from Step 3, still before `app.listen`:

```js
// ── Cron: instructor free-Pro quarterly review ───────────────────────────────
// POST /api/cron/instructor-pro-review
// Daily job: creates new quarter rows as they start (carrying forward the
// previous quarter's free_pro_active state), sends the day-20 warning and
// end-of-month update emails, and resolves pass/fail at the end of each
// quarter (quarter_number >= 2). Skips any instructor whose current
// proSource is 'stripe', re-checked fresh on every run.
// Schedule: daily at 02:00 Europe/London (after expire-pro).

app.post('/api/cron/instructor-pro-review', async (req, res) => {
  if (!requireCronAuth(req, res)) return;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const today = toUTCDate(new Date());

    const { data: instructors, error: instructorsErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, instructor_since')
      .not('instructor_since', 'is', null);
    if (instructorsErr) throw instructorsErr;

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) throw authErr;
    const emailById = Object.fromEntries((authData.users || []).map(u => [u.id, u.email]));

    let processed = 0;
    let skippedPaid = 0;

    for (const instructor of instructors || []) {
      try {
        const { data: progressRow } = await supabaseAdmin
          .from('user_progress')
          .select('progress')
          .eq('id', instructor.id)
          .single();
        const progress = progressRow?.progress || {};

        if (progress.proSource === 'stripe') {
          skippedPaid++;
          continue;
        }

        const email = emailById[instructor.id];
        if (!email) continue;

        const anchor = getQuarterAnchor(instructor.instructor_since);
        const quarterNumber = getQuarterNumberForDate(anchor, today);
        const monthIndex = getMonthIndexInQuarter(anchor, today);
        const { quarterStart, quarterEnd, months } = getQuarterBounds(anchor, quarterNumber);

        let { data: quarterRow } = await supabaseAdmin
          .from('instructor_pro_quarters')
          .select('*')
          .eq('instructor_id', instructor.id)
          .eq('quarter_number', quarterNumber)
          .maybeSingle();

        if (!quarterRow) {
          if (quarterNumber === 1) continue; // created by /api/instructor/activate

          const { data: prevQuarter } = await supabaseAdmin
            .from('instructor_pro_quarters')
            .select('free_pro_active')
            .eq('instructor_id', instructor.id)
            .eq('quarter_number', quarterNumber - 1)
            .maybeSingle();
          const carriedFreeProActive = prevQuarter?.free_pro_active ?? true;

          const { data: inserted, error: insertErr } = await supabaseAdmin
            .from('instructor_pro_quarters')
            .insert({
              instructor_id: instructor.id,
              quarter_number: quarterNumber,
              quarter_start: quarterStart.toISOString().slice(0, 10),
              quarter_end: quarterEnd.toISOString().slice(0, 10),
              free_pro_active: carriedFreeProActive,
            })
            .select('*')
            .single();
          if (insertErr) throw insertErr;
          quarterRow = inserted;
        }

        const monthBounds = months[monthIndex];
        const monthConversions = await computeMonthConversions(
          supabaseAdmin, instructor.id, monthBounds.start, monthBounds.end
        );
        const activeCount = await computeActiveReferredProCount(supabaseAdmin, instructor.id);
        const peakActiveCount = Math.max(quarterRow.active_referred_pro_count || 0, activeCount);

        const monthConversionsField = `month${monthIndex + 1}_conversions`;
        const updates = { [monthConversionsField]: monthConversions, active_referred_pro_count: peakActiveCount };
        const instructorName = instructor.username || 'there';

        if (isWarningDay(today)) {
          const warningField = `month${monthIndex + 1}_warning_sent_at`;
          if (!quarterRow[warningField]) {
            if (quarterNumber === 1) {
              await sendEmail({
                to: email,
                subject: 'Your ClearPass referral activity',
                html: buildQuarter1UpdateEmailHtml({ instructorName, conversions: monthConversions, activeCount: peakActiveCount }),
              });
              updates[warningField] = new Date().toISOString();
            } else if (monthConversions < 2 && peakActiveCount < 10) {
              await sendEmail({
                to: email,
                subject: 'Your free ClearPass Pro is at risk this month',
                html: buildWarningEmailHtml({
                  instructorName,
                  conversions: monthConversions,
                  activeCount: peakActiveCount,
                  daysRemaining: daysUntilMonthEnd(today),
                  conversionsNeeded: 2 - monthConversions,
                }),
              });
              updates[warningField] = new Date().toISOString();
            }
          }
        }

        if (isLastDayOfMonth(today)) {
          const updateField = `month${monthIndex + 1}_update_sent_at`;
          if (!quarterRow[updateField]) {
            const isQuarterEnd = monthIndex === 2;
            const status = getMonthStatus({ monthConversions, peakActiveCount });
            let resolvedQualifies = quarterRow.qualifies;

            if (isQuarterEnd && quarterNumber >= 2) {
              const finalConversions = [
                monthIndex === 0 ? monthConversions : (quarterRow.month1_conversions || 0),
                monthIndex === 1 ? monthConversions : (quarterRow.month2_conversions || 0),
                monthIndex === 2 ? monthConversions : (quarterRow.month3_conversions || 0),
              ];
              const resolution = resolveQualification({ monthConversions: finalConversions, peakActiveCount });
              resolvedQualifies = resolution.qualifies;
              updates.qualifies = resolution.qualifies;
              updates.qualify_reason = resolution.qualifyReason;
              updates.free_pro_active = resolution.qualifies;

              if (progress.isPro !== resolution.qualifies) {
                const newProgress = { ...progress, isPro: resolution.qualifies, proSource: 'instructor_referral_free' };
                await supabaseAdmin
                  .from('user_progress')
                  .upsert({ id: instructor.id, progress: newProgress, updated_at: new Date().toISOString() });
              }
            }

            await sendEmail({
              to: email,
              subject: quarterNumber === 1 ? 'Your ClearPass referral activity' : 'Your monthly ClearPass Pro referral update',
              html: quarterNumber === 1
                ? buildQuarter1UpdateEmailHtml({ instructorName, conversions: monthConversions, activeCount: peakActiveCount })
                : buildMonthEndEmailHtml({
                    instructorName,
                    conversions: monthConversions,
                    activeCount: peakActiveCount,
                    status,
                    quarterResolved: isQuarterEnd,
                    qualifies: resolvedQualifies,
                  }),
            });
            updates[updateField] = new Date().toISOString();
          }
        }

        await supabaseAdmin.from('instructor_pro_quarters').update(updates).eq('id', quarterRow.id);
        processed++;
      } catch (e) {
        console.error(`[instructor-pro-review] failed for ${instructor.id}:`, e.message);
      }
    }

    console.log(`[instructor-pro-review] processed ${processed}, skipped ${skippedPaid} paid instructors`);
    res.json({ processed, skippedPaid });
  } catch (err) {
    console.error('[instructor-pro-review] error:', err);
    res.status(500).json({ error: 'Instructor Pro review failed', detail: String(err) });
  }
});
```

- [ ] **Step 5: Manual smoke test**

No automated test covers this step — same as every other endpoint already in `proxy.js`. With `apps/mobile/server/.env` pointed at a real (dev) Supabase project:

```bash
cd /home/craig/clearpass/apps/mobile && npm run proxy
```

In another terminal, using a real test user UUID from that Supabase project's `auth.users`:

```bash
curl -s -X POST http://localhost:3001/api/instructor/activate \
  -H "Content-Type: application/json" \
  -d '{"userId":"<test-user-uuid>"}'
```

Expected first call: `{"activated":true}`. Then re-run the same command — expected: `{"activated":false,"reason":"already_active"}`. Check in Supabase Table Editor that `profiles.instructor_since` is set and `instructor_pro_quarters` has one `quarter_number=1` row with `qualifies=true, qualify_reason='first_quarter'`.

```bash
curl -s -X POST http://localhost:3001/api/cron/instructor-pro-review \
  -H "x-cron-secret: $CRON_SECRET"
```

Expected: `{"processed":N,"skippedPaid":M}` with no 500s in the server log.

- [ ] **Step 6: Commit**

```bash
cd /home/craig/clearpass
git add apps/mobile/server/proxy.js
git commit -m "feat(server): add instructor Pro activation and quarterly review cron endpoints"
```

---

## Task 4: Client — activate instructors from the Instructor screen

**Files:**
- Modify: `apps/mobile/app/instructor.tsx`

**Interfaces:**
- Consumes: `POST /api/instructor/activate` from Task 3, via the file's existing local `PROXY_URL` constant (already defined at `instructor.tsx:155` and already used for `/api/payout-request` at `instructor.tsx:723`).

- [ ] **Step 1: Call the activation endpoint on every load**

Modify `apps/mobile/app/instructor.tsx` — this must run unconditionally on every screen load (not only inside the `if (!code) {...}` branch), so instructors who already had an `instructor_code` before this feature shipped get backfilled the next time they open the screen. The endpoint is idempotent, so repeat calls are cheap no-ops. Change:

```ts
      let code = (profile as { instructor_code?: string } | null)?.instructor_code ?? null;
      if (!code) {
        code = generateCode();
        await supabase.from('profiles').upsert({ id: user.id, instructor_code: code });
      }
      setInstructorCode(code);
```

to:

```ts
      let code = (profile as { instructor_code?: string } | null)?.instructor_code ?? null;
      if (!code) {
        code = generateCode();
        await supabase.from('profiles').upsert({ id: user.id, instructor_code: code });
      }
      setInstructorCode(code);

      // Idempotent — no-ops server-side if this instructor is already activated.
      fetch(`${PROXY_URL}/api/instructor/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {});
```

- [ ] **Step 2: Manual verification**

No RN component test harness exists in this repo. With the proxy running locally (`npm run proxy` from `apps/mobile`, per Task 3 Step 5) and `apps/mobile` started via `npm start` / Expo, sign in as a test user and open the Instructor tab. Confirm in the proxy's terminal log line `[instructor/activate] activated instructor <id>` appears once, and reopening the screen does not repeat it (server returns `already_active`, no error either way since the client swallows the response).

- [ ] **Step 3: Commit**

```bash
cd /home/craig/clearpass
git add apps/mobile/app/instructor.tsx
git commit -m "feat(mobile): activate instructor free-Pro tracking from the Instructor screen"
```

---

## Task 5: Ops doc — register the new cron job

**Files:**
- Modify: `docs/google-play-checklist.md`

- [ ] **Step 1: Add the checklist line**

Modify `docs/google-play-checklist.md` — insert after line 164 (`- [ ] Set up the weekly cron job for parent emails ...`):

```markdown
- [ ] Set up the weekly cron job for parent emails (cron-job.org or Vercel Cron calling `/api/send-weekly-parent-emails`)
- [ ] Set up the daily instructor Pro review cron (cron-job.org, `POST /api/cron/instructor-pro-review`, `x-cron-secret` header, e.g. 02:00 Europe/London)
- [ ] Verify Stripe webhook is receiving events in production
```

- [ ] **Step 2: Commit**

```bash
cd /home/craig/clearpass
git add docs/google-play-checklist.md
git commit -m "docs: add instructor Pro review cron to launch checklist"
```
