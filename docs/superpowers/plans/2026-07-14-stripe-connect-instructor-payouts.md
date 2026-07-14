# Stripe Connect Instructor Payout System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub "Request Payout" flow in `instructor.tsx` (which only emails craig@zen-finance.co.uk, with no persistence and no actual payment) with a fully automated Stripe Connect Express payout system: instructors onboard lazily the first time they hit the £10 threshold, payout requests trigger a real Stripe transfer, `instructor_earnings.status` actually transitions to `paid`, and instructors get a payout history view.

**Architecture:** Two new Supabase tables (`instructor_connect_accounts`, `payouts`) plus a `payout_id` link column on `instructor_earnings`. Three server changes in `apps/mobile/server/proxy.js`: a new `/api/instructor/connect/onboarding-link` endpoint (creates/reuses a Stripe Express account + a fresh Account Link), a new `/api/stripe/connect-webhook` endpoint (keeps `instructor_connect_accounts.status` in sync via `account.updated`), and a rewritten `/api/instructor/payout-request` endpoint (atomically claims pending earnings, creates a real `stripe.transfers.create` transfer, and marks everything `paid` or reverts to `pending` on failure). `instructor.tsx` reads the connect status and payout history directly from Supabase (same pattern already used for `instructor_earnings`) and drives a 4-state payout button.

**Tech Stack:** Express server (`apps/mobile/server/proxy.js`, deployed to Railway), Stripe Node SDK (`stripe@^22.1.0`, already a dependency), Supabase Postgres + RLS, React Native / Expo Router (`apps/mobile/app/instructor.tsx`). No unit test framework in the RN app (Playwright e2e covers only public web routes, not native screens) — server-side pure logic gets `node:test` coverage matching the existing `server/lib/proExpiry.js` / `proExpiry.test.js` precedent; everything else is verified with `tsc --noEmit` plus manual Stripe-test-mode walkthroughs.

## Global Constraints

- Country is hardcoded `'GB'` for all Stripe Connect Express accounts — ClearPass is UK-only (VAT/DVSA content, GBP referral amounts).
- The three money-moving endpoints (`connect/onboarding-link`, `payout-request`, and the connect webhook) must verify the caller via a Supabase-issued bearer token server-side (`supabaseAdmin.auth.getUser(token)`), never a client-supplied id. This is stricter than the existing `/api/create-checkout-session` convention (which trusts a client-supplied `userId`) — acceptable there for a checkout redirect, not acceptable here since these endpoints move real money to a bank account.
- `instructor_connect_accounts` and `payouts` are written **server-side only** (service-role key), matching the existing "written server-side only" comment already on `instructor_earnings` in `supabase/schema.sql`. Authenticated instructors get SELECT-only RLS policies on both new tables.
- Do not touch the existing `/api/webhook` (subscription) endpoint or its `STRIPE_WEBHOOK_SECRET` — Connect account events are a separate event stream and get their own endpoint + secret (`STRIPE_CONNECT_WEBHOOK_SECRET`), registered as a second webhook in the Stripe Dashboard.
- `apps/mobile/supabase/schema.sql` is a single append-only file applied manually via the Supabase SQL editor — there is no migrations directory or `supabase db push` workflow in this repo. New SQL is appended at the end with an explanatory comment, matching the existing file's convention.
- No unit test framework exists for the RN app — do not introduce one. Server-side pure functions (e.g. `deriveConnectStatus`) get `node:test` files alongside them, exactly like `server/lib/proExpiry.js`.
- Reuse the existing `getSupabaseAdmin()` helper (`server/proxy.js`) and the existing raw-body-before-`express.json()` webhook convention — don't invent a second pattern.

## Design Decisions (resolved during research, not left to the implementer)

1. **Stripe fields live in a new `instructor_connect_accounts` table, not new columns on `profiles`.** `profiles` has `CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);` (needed so a learner can look up an instructor by `instructor_code` in `handleEnterCode`, `instructor.tsx:983-987`). Bolting a Stripe account id/status onto `profiles` would make both broadly readable by any authenticated (or anon) client. A separate table with owner-only SELECT RLS avoids that entirely.
2. **Auth is verified via bearer token, not trusted client input**, for the three new/changed endpoints only. The existing `/api/create-checkout-session` and the old `/api/payout-request` stub trust a client-supplied `userId`/`instructorName`/`instructorEmail` with zero verification — left as-is (out of scope), but the new payout-moving endpoints do not repeat that pattern.
3. **Pending earnings are claimed atomically** via `UPDATE instructor_earnings SET status='processing' WHERE instructor_id=$1 AND status='pending' RETURNING id, amount`, and the returned rows are exactly what gets summed and paid. This avoids a race where a referral-conversion webhook inserts a new `pending` earning between reading the total and creating the transfer (which could otherwise double-count or silently drop a row on the next payout).
4. **Transfer-failure handling covers the synchronous case only, by design.** `stripe.transfers.create` rejecting (bad destination, insufficient platform balance, restricted account) is fully handled: the `payouts` row is marked `failed` with a reason, and the claimed `instructor_earnings` rows revert to `pending` so the instructor can retry. **Not covered:** the connected account's own bank later rejecting the *payout* from their Stripe balance — a second, asynchronous hop Stripe calls a "payout" (distinct from the "transfer" we create), surfaced via a `payout.failed` event on the connected account that does not carry our metadata. Reliably reconciling that needs infrastructure this app doesn't have yet. Given ClearPass's volume (a handful of instructors, £2.50 increments), this is a documented manual-reconciliation gap: Craig should periodically check Stripe Dashboard → Connect → Payouts for failed connected-account payouts. Automating that reconciliation is a reasonable future follow-up, not part of this plan.
5. **Lazy onboarding is a 4-state button, and return-from-Stripe refresh uses `AppState`, not the `return_url` query param.** Expo Router may not remount `instructor.tsx` or re-run its data-loading effect when the app was merely backgrounded during the external Stripe onboarding browser session (not fully unmounted) — so the plan adds an `AppState` "active" listener that always re-runs `loadData()`, rather than depending on parsing the `return_url`.
6. **No dedicated GET status/history endpoints.** Both `instructor_connect_accounts` and `payouts` have owner-only SELECT RLS, so the client reads them directly via the Supabase client — identical to how `instructor_earnings` is already fetched today. Only the two state-changing actions (start onboarding, request payout) need server endpoints.

---

### Task 1: Schema — Stripe Connect tables and earnings status wiring

**Files:**
- Modify: `apps/mobile/supabase/schema.sql` (append at end, after the last statement)

**Interfaces:**
- Produces: `instructor_connect_accounts` (columns: `instructor_id` PK, `stripe_account_id`, `status`, `payouts_enabled`, `details_submitted`, `created_at`, `updated_at`), `payouts` (columns: `id` PK, `instructor_id`, `amount`, `status`, `stripe_transfer_id`, `failure_reason`, `created_at`, `updated_at`), and `instructor_earnings.payout_id` — all consumed by Tasks 3-7.

- [ ] **Step 1: Append the new SQL**

Append to the end of `apps/mobile/supabase/schema.sql`:

```sql

-- Stripe Connect: instructor payout accounts
-- Kept in a separate table (not extra columns on `profiles`) because
-- `profiles` has a permissive `USING (true)` SELECT policy so learners can
-- look up an instructor by instructor_code — Stripe account id/status must
-- not ride along on that broad read.
CREATE TABLE IF NOT EXISTS instructor_connect_accounts (
  instructor_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  stripe_account_id  TEXT UNIQUE,
  status             TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'pending', 'onboarded', 'restricted')),
  payouts_enabled    BOOLEAN NOT NULL DEFAULT false,
  details_submitted  BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE instructor_connect_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can view own connect account" ON instructor_connect_accounts;
CREATE POLICY "Instructors can view own connect account" ON instructor_connect_accounts
  FOR SELECT USING (auth.uid() = instructor_id);
-- No INSERT/UPDATE policy: written server-side only, via the service role key
-- (same convention as instructor_earnings above).

-- Stripe Connect: payout batches (one row per "Request Payout" transfer attempt)
CREATE TABLE IF NOT EXISTS payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount              DECIMAL(10,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'paid', 'failed')),
  stripe_transfer_id  TEXT,
  failure_reason      TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can view own payouts" ON payouts;
CREATE POLICY "Instructors can view own payouts" ON payouts
  FOR SELECT USING (auth.uid() = instructor_id);
-- No INSERT/UPDATE policy: written server-side only, via the service role key.

-- Link each earning to the payout batch that paid it out, and constrain the
-- status values that were previously unconstrained free text (every existing
-- row is 'pending' today, so this CHECK is safe to add retroactively).
ALTER TABLE instructor_earnings ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL;
ALTER TABLE instructor_earnings DROP CONSTRAINT IF EXISTS instructor_earnings_status_check;
ALTER TABLE instructor_earnings ADD CONSTRAINT instructor_earnings_status_check CHECK (status IN ('pending', 'processing', 'paid'));
```

- [ ] **Step 2: Apply it to Supabase**

There is no migration runner in this repo — paste the appended block (just the new SQL from Step 1, not the whole file) into the Supabase SQL editor for project `uqrcdrlqujgzpxkshizh` and run it.

- [ ] **Step 3: Verify**

In the Supabase SQL editor, run:

```sql
select table_name from information_schema.tables
where table_name in ('instructor_connect_accounts', 'payouts');

select column_name from information_schema.columns
where table_name = 'instructor_earnings' and column_name = 'payout_id';
```

Expected: both tables listed, and `payout_id` present on `instructor_earnings`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/supabase/schema.sql
git commit -m "feat: add Stripe Connect payout schema (instructor_connect_accounts, payouts)"
```

---

### Task 2: Server — connect status helper with unit tests

**Files:**
- Create: `apps/mobile/server/lib/connectStatus.js`
- Create: `apps/mobile/server/lib/connectStatus.test.js`

**Interfaces:**
- Produces: `deriveConnectStatus(account: StripeAccountLike): 'not_started' | 'pending' | 'onboarded' | 'restricted'` — consumed by the webhook handler in Task 4.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/server/lib/connectStatus.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveConnectStatus } = require('./connectStatus');

test('not_started when nothing submitted yet', () => {
  assert.equal(
    deriveConnectStatus({ payouts_enabled: false, details_submitted: false, requirements: {} }),
    'not_started',
  );
});

test('pending once details are submitted but payouts are not yet enabled', () => {
  assert.equal(
    deriveConnectStatus({ payouts_enabled: false, details_submitted: true, requirements: {} }),
    'pending',
  );
});

test('onboarded once Stripe enables payouts', () => {
  assert.equal(
    deriveConnectStatus({ payouts_enabled: true, details_submitted: true, requirements: {} }),
    'onboarded',
  );
});

test('restricted takes priority when Stripe has disabled the account', () => {
  assert.equal(
    deriveConnectStatus({
      payouts_enabled: false,
      details_submitted: true,
      requirements: { disabled_reason: 'requirements.past_due' },
    }),
    'restricted',
  );
});

test('restricted even if payouts_enabled is still true (defensive — Stripe disables asynchronously)', () => {
  assert.equal(
    deriveConnectStatus({
      payouts_enabled: true,
      details_submitted: true,
      requirements: { disabled_reason: 'rejected.fraud' },
    }),
    'restricted',
  );
});

test('missing requirements object does not throw', () => {
  assert.equal(
    deriveConnectStatus({ payouts_enabled: false, details_submitted: false }),
    'not_started',
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/mobile && node server/lib/connectStatus.test.js`
Expected: FAIL with `Cannot find module './connectStatus'`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/server/lib/connectStatus.js`:

```js
'use strict';

// Derives our simplified connect status from a Stripe Account object, so the
// webhook handler stays in sync on what "onboarded" means without
// duplicating this logic inline.
function deriveConnectStatus(account) {
  if (account.requirements && account.requirements.disabled_reason) {
    return 'restricted';
  }
  if (account.payouts_enabled) {
    return 'onboarded';
  }
  if (account.details_submitted) {
    return 'pending';
  }
  return 'not_started';
}

module.exports = { deriveConnectStatus };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && node server/lib/connectStatus.test.js`
Expected: all 6 tests pass (matches the existing `node server/lib/proExpiry.test.js` invocation style — no test runner/framework needed).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/server/lib/connectStatus.js apps/mobile/server/lib/connectStatus.test.js
git commit -m "feat: add deriveConnectStatus helper for Stripe Connect account status"
```

---

### Task 3: Server — auth verification helper + onboarding-link endpoint

**Files:**
- Modify: `apps/mobile/server/proxy.js` (add near the existing `getSupabaseAdmin()` helper at line 38, and add the new route after the existing `/api/create-checkout-session` route, replacing nothing yet)

**Interfaces:**
- Consumes: `getSupabaseAdmin()` (`proxy.js:38-41`, existing), `stripe` client (`proxy.js:7-9`, existing, already configured with `STRIPE_SECRET_KEY`).
- Produces: `verifyInstructorAuth(req, res): Promise<{ userId: string, email: string | null, supabaseAdmin: SupabaseClient } | null>` — consumed by Task 5's rewritten payout-request endpoint. `POST /api/instructor/connect/onboarding-link` — consumed by `instructor.tsx` in Task 6.

- [ ] **Step 1: Add the auth helper**

In `apps/mobile/server/proxy.js`, immediately after the existing `getSupabaseAdmin()` function (ends at line 41):

```js
async function verifyInstructorAuth(req, res) {
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
```

- [ ] **Step 2: Add the onboarding-link endpoint**

Immediately after the existing `/api/create-checkout-session` route (ends at line 178, right before the `// ── Instructor payout request ──` comment):

```js
// ── Instructor Stripe Connect onboarding ───────────────────────────────────────

app.post('/api/instructor/connect/onboarding-link', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'stripe_not_configured' });
  }
  const auth = await verifyInstructorAuth(req, res);
  if (!auth) return;
  const { userId, email, supabaseAdmin } = auth;

  try {
    const { data: connectRow } = await supabaseAdmin
      .from('instructor_connect_accounts')
      .select('stripe_account_id')
      .eq('instructor_id', userId)
      .maybeSingle();

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
      await supabaseAdmin.from('instructor_connect_accounts').upsert({
        instructor_id: userId,
        stripe_account_id: accountId,
        status: 'not_started',
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'clearpass://instructor?stripe=refresh',
      return_url: 'clearpass://instructor?stripe=return',
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('[connect/onboarding-link] error:', err);
    res.status(500).json({ error: 'onboarding_link_failed', detail: String(err.message || err) });
  }
});
```

- [ ] **Step 3: Smoke-test locally**

Run: `cd apps/mobile/server && node proxy.js` (requires `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` in `server/.env` — see Task 8 if any are missing).

Get a real access token: sign in to the app against the same Supabase project, then in the RN debugger/console run `(await supabase.auth.getSession()).data.session.access_token` and copy it. Then:

```bash
curl -s -X POST http://localhost:3001/api/instructor/connect/onboarding-link \
  -H "Authorization: Bearer <paste token>" | python3 -m json.tool
```

Expected: `{"url": "https://connect.stripe.com/setup/e/acct_.../..."}`. Confirm in the Stripe Dashboard (test mode) → Connect → Accounts that a new Express account appeared, and in Supabase that `instructor_connect_accounts` has a row for that user with `status = 'not_started'`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/server/proxy.js
git commit -m "feat: add instructor Stripe Connect onboarding-link endpoint"
```

---

### Task 4: Server — Connect webhook (account.updated → sync status)

**Files:**
- Modify: `apps/mobile/server/proxy.js` (add the route immediately after the existing `/api/webhook` handler, still before `app.use(express.json())` at line 141)
- Modify: `apps/mobile/server/proxy.js:1-9` (require `deriveConnectStatus`)

**Interfaces:**
- Consumes: `deriveConnectStatus` from Task 2 (`./lib/connectStatus`).
- Produces: `POST /api/stripe/connect-webhook` — registered with Stripe Dashboard in Task 8.

- [ ] **Step 1: Add the import**

At the top of `apps/mobile/server/proxy.js`, alongside the existing `computeProExpiresAt` require (line 5):

```js
const { computeProExpiresAt } = require('./lib/proExpiry');
const { deriveConnectStatus } = require('./lib/connectStatus');
```

- [ ] **Step 2: Add the webhook route**

Immediately after the existing `/api/webhook` handler's closing `});` (line 141, right before `app.use(express.json());`):

```js
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
      await supabaseAdmin
        .from('instructor_connect_accounts')
        .update({
          status,
          payouts_enabled: !!account.payouts_enabled,
          details_submitted: !!account.details_submitted,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', account.id);
      console.log(`[connect-webhook] account ${account.id} -> ${status}`);
    } catch (e) {
      console.error('[connect-webhook] Supabase update error:', e);
    }
  }

  res.json({ received: true });
});
```

- [ ] **Step 3: Verify with the Stripe CLI**

Install/use the Stripe CLI in test mode and forward Connect events to the local server:

```bash
stripe listen --events account.updated --forward-connect-to localhost:3001/api/stripe/connect-webhook
```

Copy the printed `whsec_...` value into `server/.env` as `STRIPE_CONNECT_WEBHOOK_SECRET` for local testing, restart `node proxy.js`, then in another terminal trigger a test event:

```bash
stripe trigger account.updated
```

Expected: the server logs `[connect-webhook] account acct_... -> <status>` and does not throw.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/server/proxy.js
git commit -m "feat: add Stripe Connect webhook to sync instructor account status"
```

---

### Task 5: Server — rewrite payout-request to create a real transfer

**Files:**
- Modify: `apps/mobile/server/proxy.js:201-234` (replace the entire existing `/api/payout-request` route)
- Modify: `apps/mobile/server/package.json` (remove now-unused `nodemailer` dependency)

**Interfaces:**
- Consumes: `verifyInstructorAuth` (Task 3), `stripe` client, `getSupabaseAdmin()`.
- Produces: `POST /api/instructor/payout-request` (note the new path — distinct from the old `/api/payout-request`) — consumed by `instructor.tsx` in Task 6. Response shapes: `{ success: true, amount: number }` on success; `{ error: 'not_onboarded' }` (409), `{ error: 'below_minimum' }` (400), `{ error: 'transfer_failed', detail }` (502), `{ error: 'payout_failed', detail }` (500).

- [ ] **Step 1: Replace the stub route**

Delete the existing block at `apps/mobile/server/proxy.js:201-234` (the whole `app.post('/api/payout-request', ...)` handler, from `// ── Instructor payout request ──` through its closing `});`), and replace it with:

```js
// ── Instructor Stripe Connect payout requests ──────────────────────────────────

app.post('/api/instructor/payout-request', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'stripe_not_configured' });
  }
  const auth = await verifyInstructorAuth(req, res);
  if (!auth) return;
  const { userId, supabaseAdmin } = auth;

  try {
    const { data: connectRow } = await supabaseAdmin
      .from('instructor_connect_accounts')
      .select('stripe_account_id, payouts_enabled')
      .eq('instructor_id', userId)
      .maybeSingle();

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

    if (amount < 10) {
      if (claimed && claimed.length > 0) {
        await supabaseAdmin
          .from('instructor_earnings')
          .update({ status: 'pending' })
          .in('id', claimed.map(e => e.id));
      }
      return res.status(400).json({ error: 'below_minimum' });
    }

    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('payouts')
      .insert({ instructor_id: userId, amount, status: 'processing' })
      .select('id')
      .single();
    if (payoutError) throw payoutError;

    const earningIds = claimed.map(e => e.id);
    await supabaseAdmin.from('instructor_earnings').update({ payout_id: payout.id }).in('id', earningIds);

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: 'gbp',
        destination: connectRow.stripe_account_id,
        metadata: { payout_id: payout.id, instructor_id: userId },
      });

      await supabaseAdmin
        .from('payouts')
        .update({ status: 'paid', stripe_transfer_id: transfer.id, updated_at: new Date().toISOString() })
        .eq('id', payout.id);
      await supabaseAdmin.from('instructor_earnings').update({ status: 'paid' }).eq('payout_id', payout.id);

      res.json({ success: true, amount });
    } catch (transferErr) {
      console.error('[payout-request] transfer failed:', transferErr);
      await supabaseAdmin
        .from('payouts')
        .update({
          status: 'failed',
          failure_reason: String(transferErr.message || transferErr),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payout.id);
      // Release the claimed earnings back to pending so the instructor can retry.
      await supabaseAdmin
        .from('instructor_earnings')
        .update({ status: 'pending', payout_id: null })
        .eq('payout_id', payout.id);

      res.status(502).json({ error: 'transfer_failed', detail: String(transferErr.message || transferErr) });
    }
  } catch (err) {
    console.error('[payout-request] error:', err);
    res.status(500).json({ error: 'payout_failed', detail: String(err.message || err) });
  }
});
```

- [ ] **Step 2: Remove the now-unused nodemailer dependency**

`nodemailer` was only used by the deleted stub. In `apps/mobile/server/package.json`, remove `"nodemailer":"^8.0.7",` from `dependencies`, then run:

```bash
cd apps/mobile/server && npm install
```

Expected: `package-lock.json` updates to drop `nodemailer` and its transitive deps; no other file in `server/` references `nodemailer` (confirm with `grep -rn nodemailer apps/mobile/server` — should return nothing after this step).

- [ ] **Step 3: Verify the happy path against Stripe test mode**

Using a fully-onboarded test Connect account (complete Task 3's onboarding-link flow against Stripe's test-mode hosted onboarding, which auto-fills fake verification data), and at least £10 of `pending` rows in `instructor_earnings` for that user (insert manually via Supabase SQL editor if needed for the test):

```bash
curl -s -X POST http://localhost:3001/api/instructor/payout-request \
  -H "Authorization: Bearer <token>" | python3 -m json.tool
```

Expected: `{"success": true, "amount": <total>}`. Confirm in Supabase: the `payouts` row has `status = 'paid'` and a `stripe_transfer_id`; the claimed `instructor_earnings` rows now have `status = 'paid'` and a matching `payout_id`. Confirm in the Stripe Dashboard (test mode) → Connect → the test account → Balance that a transfer arrived.

- [ ] **Step 4: Verify the failure path**

Call the same endpoint again immediately (no new pending earnings) — expect `{"error": "below_minimum"}` with HTTP 400, and confirm no new `payouts` row was created. Then test a real transfer failure by using a Connect test account known to reject transfers (Stripe's documented test destination account behavior for triggering `transfers.create` errors, e.g. an account still missing required capabilities) — expect HTTP 502 `{"error":"transfer_failed", ...}`, and confirm in Supabase that the `payouts` row is `status = 'failed'` with a `failure_reason`, and the claimed earnings reverted to `status = 'pending'` with `payout_id = null` (i.e. they show up again as claimable on the next request).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/server/proxy.js apps/mobile/server/package.json apps/mobile/server/package-lock.json
git commit -m "feat: replace stub payout email with real Stripe Connect transfers"
```

---

### Task 6: Frontend — instructor.tsx data loading (connect status, payout history, AppState refresh)

**Files:**
- Modify: `apps/mobile/app/instructor.tsx:2-13` (RN import list — add `AppState`, `Linking`)
- Modify: `apps/mobile/app/instructor.tsx:64-70` (types block — add `ConnectStatus`, `ConnectAccountRow`, `PayoutEntry`)
- Modify: `apps/mobile/app/instructor.tsx:1213-1220` (state declarations)
- Modify: `apps/mobile/app/instructor.tsx:1222` (add AppState effect)
- Modify: `apps/mobile/app/instructor.tsx:1256-1262` (loadData — add connect status + payout history fetches, remove now-dead `instructorEmail`/`instructorUsername` wiring)

**Interfaces:**
- Produces: `connectStatus: ConnectAccountRow | null` and `payouts: PayoutEntry[]` state, passed to `InstructorDashboard` in Task 7.
- Consumes: `supabase` client (existing import), `PROXY_URL` (existing, `instructor.tsx:160-162`).

- [ ] **Step 1: Add the new imports**

Replace the RN import block at `instructor.tsx:2-13`:

```ts
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
```

- [ ] **Step 2: Add the new types**

After the existing `EarningEntry` type (`instructor.tsx:64-70`):

```ts
type ConnectStatus = 'not_started' | 'pending' | 'onboarded' | 'restricted';

type ConnectAccountRow = {
  stripe_account_id: string | null;
  status: ConnectStatus;
  payouts_enabled: boolean;
};

type PayoutEntry = {
  id: string;
  amount: number;
  status: 'processing' | 'paid' | 'failed';
  failure_reason: string | null;
  created_at: string;
};
```

- [ ] **Step 3: Update state and remove dead state**

In `InstructorScreen` (`instructor.tsx:1213-1220`), replace:

```ts
  const [learners,           setLearners]           = useState<LearnerEntry[]>([]);
  const [instructors,        setInstructors]        = useState<InstructorEntry[]>([]);
  const [instructorCode,     setInstructorCode]     = useState<string | null>(null);
  const [referralCode,       setReferralCode]       = useState<string | null>(null);
  const [earnings,           setEarnings]           = useState<EarningEntry[]>([]);
  const [instructorEmail,    setInstructorEmail]    = useState('');
  const [instructorUsername, setInstructorUsername] = useState('');
  const [loading,            setLoading]            = useState(true);
```

with:

```ts
  const [learners,           setLearners]           = useState<LearnerEntry[]>([]);
  const [instructors,        setInstructors]        = useState<InstructorEntry[]>([]);
  const [instructorCode,     setInstructorCode]     = useState<string | null>(null);
  const [referralCode,       setReferralCode]       = useState<string | null>(null);
  const [earnings,           setEarnings]           = useState<EarningEntry[]>([]);
  const [connectStatus,      setConnectStatus]      = useState<ConnectAccountRow | null>(null);
  const [payouts,            setPayouts]            = useState<PayoutEntry[]>([]);
  const [loading,            setLoading]            = useState(true);
```

(`instructorEmail`/`instructorUsername` state is removed here because — after Step 5 below and Task 7 — its only reader was the old email-based payout request body; nothing else in the file reads it. Confirm with `grep -n "instructorEmail\|instructorUsername" apps/mobile/app/instructor.tsx` after this task — the only remaining matches should be the unrelated `InstructorEntry.instructorUsername` field used by `LearnerModeView`, lines 52/1084/1089/1136/1141/1149.)

- [ ] **Step 4: Add the AppState refresh effect**

Immediately after the existing `useEffect(() => { void loadData(); }, [mode]);` (`instructor.tsx:1222`):

```ts
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void loadData();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 5: Update loadData()**

In `loadData()` (`instructor.tsx:1224-1340`), replace this line:

```ts
      setInstructorEmail(user.email ?? '');
```

with nothing (delete the line — no longer needed).

Then replace this block:

```ts
      const uname = (profile as { username?: string } | null)?.username ?? '';
      setInstructorUsername(uname);
```

with:

```ts
      const uname = (profile as { username?: string } | null)?.username ?? '';
```

(`uname` is still used two lines later for referral code generation — only the now-dead `setInstructorUsername(uname)` call is removed.)

Then, immediately after the existing earnings fetch (`instructor.tsx:1256-1262`):

```ts
      // Load earnings
      const { data: earningsData } = await supabase
        .from('instructor_earnings')
        .select('*')
        .eq('instructor_id', user.id)
        .order('created_at', { ascending: false });
      setEarnings((earningsData as EarningEntry[] | null) ?? []);
```

add:

```ts

      // Load Stripe Connect status and payout history
      const { data: connectRow } = await supabase
        .from('instructor_connect_accounts')
        .select('stripe_account_id, status, payouts_enabled')
        .eq('instructor_id', user.id)
        .maybeSingle();
      setConnectStatus((connectRow as ConnectAccountRow | null) ?? null);

      const { data: payoutRows } = await supabase
        .from('payouts')
        .select('*')
        .eq('instructor_id', user.id)
        .order('created_at', { ascending: false });
      setPayouts((payoutRows as PayoutEntry[] | null) ?? []);
```

- [ ] **Step 6: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors (Task 7 will fix the now-expected prop-mismatch errors on `EarningsSection`/`InstructorDashboard` — those are addressed in the next task, so it's fine if they appear here transiently).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/instructor.tsx
git commit -m "feat: load Stripe Connect status and payout history in instructor.tsx"
```

---

### Task 7: Frontend — payout button states and payout history UI

**Files:**
- Modify: `apps/mobile/app/instructor.tsx:149-158` (helpers — add `payoutButtonLabel`)
- Modify: `apps/mobile/app/instructor.tsx:706-790` (`EarningsSection` — new props, rewritten `handlePayout`, new button label)
- Modify: `apps/mobile/app/instructor.tsx` (new `PayoutHistorySection` component, placed after `EarningsSection`)
- Modify: `apps/mobile/app/instructor.tsx:794-932` (`InstructorDashboard` — thread `connectStatus`/`payouts` through, render `PayoutHistorySection`)
- Modify: `apps/mobile/app/instructor.tsx:1359-1369` (call site passing props to `InstructorDashboard`)
- Modify: `apps/mobile/app/instructor.tsx:1787-1819` (styles — add payout history styles)

**Interfaces:**
- Consumes: `ConnectAccountRow`, `PayoutEntry` (Task 6), `PROXY_URL` (existing), `Linking` (Task 6 import).

- [ ] **Step 1: Add the button-label helper**

After `generateReferralCode` (`instructor.tsx:154-158`):

```ts
function payoutButtonLabel(pending: number, connectStatus: ConnectAccountRow | null, requesting: boolean): string {
  if (pending < 10) return 'Request Payout';
  if (requesting) return connectStatus?.status === 'onboarded' && connectStatus.payouts_enabled ? 'Sending...' : 'Opening Stripe...';
  if (!connectStatus || connectStatus.status === 'not_started') return 'Set Up Payouts';
  if (connectStatus.status === 'pending') return 'Finish Stripe Setup';
  if (connectStatus.status === 'restricted') return 'Update Stripe Details';
  return 'Request Payout';
}
```

- [ ] **Step 2: Rewrite EarningsSection**

Replace the whole `EarningsSection` function (`instructor.tsx:706-790`):

```tsx
function EarningsSection({
  earnings,
  connectStatus,
  onRefresh,
}: {
  earnings: EarningEntry[];
  connectStatus: ConnectAccountRow | null;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const [requesting, setRequesting] = useState(false);

  const total   = earnings.reduce((s, e) => s + Number(e.amount), 0);
  const pending = earnings.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);

  async function handlePayout() {
    if (pending < 10) {
      Alert.alert('Not enough yet', 'Minimum payout is £10 — keep referring to unlock your payout!');
      return;
    }
    setRequesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        Alert.alert('Error', 'Please sign in again.');
        return;
      }

      const isOnboarded = connectStatus?.status === 'onboarded' && connectStatus.payouts_enabled;

      if (!isOnboarded) {
        const res = await fetch(`${PROXY_URL}/api/instructor/connect/onboarding-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.url) {
          await Linking.openURL(data.url);
        } else {
          Alert.alert('Error', 'Could not start Stripe setup. Please try again.');
        }
        return;
      }

      const res = await fetch(`${PROXY_URL}/api/instructor/payout-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Payout sent!', `£${Number(data.amount).toFixed(2)} is on its way to your bank account.`);
        onRefresh();
      } else if (data.error === 'not_onboarded') {
        Alert.alert('Setup incomplete', 'Please finish setting up your Stripe account to receive payouts.');
        onRefresh();
      } else if (data.error === 'below_minimum') {
        Alert.alert('Not enough yet', 'Minimum payout is £10 — keep referring to unlock your payout!');
      } else {
        Alert.alert('Payout failed', data.detail || 'Please try again in a moment.');
      }
    } catch {
      Alert.alert('Error', 'Could not process payout. Please try again.');
    } finally {
      setRequesting(false);
    }
  }

  return (
    <View style={[styles.earningsSection, { backgroundColor: theme.cardColor }]}>
      <Text style={[styles.earningsSectionTitle, { color: theme.textColor }]}>{'Your Earnings'}</Text>
      <View style={styles.earningsStatsRow}>
        <View style={styles.earningStat}>
          <Text style={[styles.earningStatVal, { color: theme.textColor }]}>{`£${total.toFixed(2)}`}</Text>
          <Text style={[styles.earningStatLabel, { color: theme.subTextColor }]}>{'Total earned'}</Text>
        </View>
        <View style={styles.earningStat}>
          <Text style={[styles.earningStatVal, { color: theme.textColor }]}>{`£${pending.toFixed(2)}`}</Text>
          <Text style={[styles.earningStatLabel, { color: theme.subTextColor }]}>{'Pending payout'}</Text>
        </View>
        <View style={styles.earningStat}>
          <Text style={[styles.earningStatVal, { color: theme.textColor }]}>{String(earnings.length)}</Text>
          <Text style={[styles.earningStatLabel, { color: theme.subTextColor }]}>{'Converted'}</Text>
        </View>
      </View>
      {earnings.length === 0 ? (
        <Text style={[styles.earningsEmptyText, { color: theme.subTextColor }]}>
          {'No conversions yet — share your referral link to start earning'}
        </Text>
      ) : (
        earnings.map((e, idx) => (
          <View key={e.id} style={styles.earningRow}>
            <View>
              <Text style={[styles.earningDate, { color: theme.textColor }]}>{formatDate(e.created_at)}</Text>
              <Text style={[styles.earningDesc, { color: theme.subTextColor }]}>{`Learner ${idx + 1} converted to Premium`}</Text>
            </View>
            <Text style={styles.earningAmount}>{'£2.50'}</Text>
          </View>
        ))
      )}
      <TouchableOpacity
        style={[styles.payoutBtn, requesting && styles.btnDisabled]}
        onPress={() => void handlePayout()}
        activeOpacity={0.85}
        disabled={requesting}
      >
        <Text style={styles.payoutBtnText}>{payoutButtonLabel(pending, connectStatus, requesting)}</Text>
      </TouchableOpacity>
      {pending < 10 && (
        <Text style={[styles.payoutMinText, { color: theme.subTextColor }]}>{'Minimum payout is £10'}</Text>
      )}
      {pending >= 10 && connectStatus?.status === 'restricted' && (
        <Text style={[styles.payoutMinText, { color: theme.subTextColor }]}>
          {'Stripe needs more information before you can be paid — tap above to update your details.'}
        </Text>
      )}
    </View>
  );
}
```

Note: `instructorName`/`instructorEmail` props are dropped entirely — they were only used in the deleted email-request body.

- [ ] **Step 3: Add PayoutHistorySection**

Immediately after the `EarningsSection` function, before the `// ─── InstructorDashboard ───` comment:

```tsx
// ─── PayoutHistorySection ─────────────────────────────────────────────────────

function PayoutHistorySection({ payouts }: { payouts: PayoutEntry[] }) {
  const theme = useTheme();
  if (payouts.length === 0) return null;

  const statusLabel: Record<PayoutEntry['status'], string> = {
    processing: 'Processing',
    paid: 'Paid',
    failed: 'Failed',
  };
  const statusColor: Record<PayoutEntry['status'], string> = {
    processing: '#F59E0B',
    paid: '#22C55E',
    failed: '#EF4444',
  };

  return (
    <View style={[styles.earningsSection, { backgroundColor: theme.cardColor }]}>
      <Text style={[styles.earningsSectionTitle, { color: theme.textColor }]}>{'Payout History'}</Text>
      {payouts.map(p => (
        <View key={p.id} style={styles.earningRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.earningDate, { color: theme.textColor }]}>{formatDate(p.created_at)}</Text>
            {p.status === 'failed' && p.failure_reason && (
              <Text style={[styles.payoutFailureText, { color: theme.subTextColor }]} numberOfLines={2}>
                {p.failure_reason}
              </Text>
            )}
          </View>
          <View style={styles.payoutHistoryRight}>
            <Text style={styles.earningAmount}>{`£${Number(p.amount).toFixed(2)}`}</Text>
            <View style={[styles.payoutStatusBadge, { borderColor: statusColor[p.status] }]}>
              <Text style={[styles.payoutStatusText, { color: statusColor[p.status] }]}>{statusLabel[p.status]}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Thread props through InstructorDashboard**

In `InstructorDashboard`'s prop signature (`instructor.tsx:794-812`), replace:

```ts
  learners,
  instructorCode,
  referralCode,
  earnings,
  instructorEmail,
  instructorUsername,
  loading,
  onRefresh,
}: {
  learners: LearnerEntry[];
  instructorCode: string | null;
  referralCode: string | null;
  earnings: EarningEntry[];
  instructorEmail: string;
  instructorUsername: string;
  loading: boolean;
  onRefresh: () => void;
}) {
```

with:

```ts
  learners,
  instructorCode,
  referralCode,
  earnings,
  connectStatus,
  payouts,
  loading,
  onRefresh,
}: {
  learners: LearnerEntry[];
  instructorCode: string | null;
  referralCode: string | null;
  earnings: EarningEntry[];
  connectStatus: ConnectAccountRow | null;
  payouts: PayoutEntry[];
  loading: boolean;
  onRefresh: () => void;
}) {
```

Then replace both `EarningsSection` call sites. The empty-state branch (`instructor.tsx:875-879`):

```tsx
        <EarningsSection
          earnings={earnings}
          instructorName={instructorUsername}
          instructorEmail={instructorEmail}
        />
```

becomes:

```tsx
        <EarningsSection earnings={earnings} connectStatus={connectStatus} onRefresh={onRefresh} />
        <PayoutHistorySection payouts={payouts} />
```

And the main-list branch (`instructor.tsx:918-922`):

```tsx
      <EarningsSection
        earnings={earnings}
        instructorName={instructorUsername}
        instructorEmail={instructorEmail}
      />
```

becomes:

```tsx
      <EarningsSection earnings={earnings} connectStatus={connectStatus} onRefresh={onRefresh} />
      <PayoutHistorySection payouts={payouts} />
```

- [ ] **Step 5: Update the InstructorScreen call site**

At `instructor.tsx:1359-1369`, replace:

```tsx
        <InstructorDashboard
          learners={learners}
          instructorCode={instructorCode}
          referralCode={referralCode}
          earnings={earnings}
          instructorEmail={instructorEmail}
          instructorUsername={instructorUsername}
          loading={loading}
          onRefresh={() => void loadData()}
        />
```

with:

```tsx
        <InstructorDashboard
          learners={learners}
          instructorCode={instructorCode}
          referralCode={referralCode}
          earnings={earnings}
          connectStatus={connectStatus}
          payouts={payouts}
          loading={loading}
          onRefresh={() => void loadData()}
        />
```

- [ ] **Step 6: Add the new styles**

In the `StyleSheet.create` block, immediately after `payoutMinText` (`instructor.tsx:1819`):

```ts
  payoutHistoryRight:  { alignItems: 'flex-end', gap: 4 },
  payoutStatusBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  payoutStatusText:  { fontSize: 11, fontWeight: '700' },
  payoutFailureText: { fontSize: 11, marginTop: 2, maxWidth: 200 },
```

- [ ] **Step 7: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: clean (this closes out the transient prop-mismatch errors expected at the end of Task 6).

- [ ] **Step 8: Manual smoke test**

Use the `run` skill to launch the app (Expo web or a simulator) signed in as a test instructor account. Confirm:
- With `pending < £10`: button reads "Request Payout", tapping shows the existing "Not enough yet" alert, no network call fires.
- With `pending >= £10` and no connect account yet: button reads "Set Up Payouts"; tapping opens Stripe's hosted onboarding in the device browser.
- Abandon onboarding partway (close the browser before finishing) and return to the app (foreground it): button now reads "Finish Stripe Setup" (confirm this only works once Task 4's webhook or a manual `instructor_connect_accounts` update reflects `details_submitted = true`; if you abandoned before entering any details, it should still read "Set Up Payouts").
- Complete onboarding fully in Stripe test mode, foreground the app: button reads "Request Payout" and tapping it completes a real transfer (per Task 5, Step 3) and the earnings + a new "Paid" row in Payout History appear after `onRefresh()`.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/instructor.tsx
git commit -m "feat: wire lazy Stripe Connect onboarding and payout history into instructor dashboard"
```

---

### Task 8: Environment variables and Stripe Dashboard setup (non-code, Craig)

**Files:** none (external configuration)

- [ ] **Step 1: Confirm existing env vars are already set**

`STRIPE_SECRET_KEY` is already set in Railway (used by the existing subscription checkout) and is reused as-is for Connect API calls — no new secret key needed.

- [ ] **Step 2: Add the one new required env var**

Add to Railway's environment for the `apps/mobile/server` service (and to local `server/.env` for development):

```
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
```

This is obtained in Step 3 below — it is **not** the same value as the existing `STRIPE_WEBHOOK_SECRET`.

- [ ] **Step 3: Enable Stripe Connect and register the Connect webhook**

In the Stripe Dashboard (test mode first, then live mode once verified):
1. Settings → Connect → confirm Connect is enabled for the platform and Express accounts are allowed (may require filling in platform profile / branding details if not already done for this account).
2. Developers → Webhooks → Add endpoint → URL: `https://clearpass-app-production.up.railway.app/api/stripe/connect-webhook` (mirroring the existing `/api/webhook` endpoint's host) → toggle **"Listen to events on Connected accounts"** (this is the setting that makes it a *Connect* webhook, distinct from the platform's own `/api/webhook`) → select event `account.updated`.
3. Copy the signing secret shown for this new endpoint into `STRIPE_CONNECT_WEBHOOK_SECRET` (Step 2).

- [ ] **Step 4: Update the in-file env var documentation**

In `apps/mobile/server/proxy.js`, update the comment block listing required env vars (currently lines 15-21):

```js
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID
//   STRIPE_CONNECT_WEBHOOK_SECRET  — separate signing secret for the Connect webhook (Connected-account events, not the platform webhook)
//   ANTHROPIC_API_KEY
//   RESEND_API_KEY
//   CRON_SECRET  — shared secret for /api/cron/* endpoints (set in Railway dashboard)
//     Suggested value: r8Kp3Nq7Zm2Xt5Yb4Vw9As1Dc6Ef0Gh
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/server/proxy.js
git commit -m "docs: document STRIPE_CONNECT_WEBHOOK_SECRET env var"
```

---

### Task 9: Full verification and report

**Files:** none (verification only)

- [ ] **Step 1: Full project type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: clean (matches whatever the pre-existing baseline was — confirm no *new* errors versus main).

- [ ] **Step 2: Server unit tests**

Run: `cd apps/mobile && node server/lib/connectStatus.test.js && node server/lib/proExpiry.test.js`
Expected: all pass.

- [ ] **Step 3: End-to-end manual walkthrough in Stripe test mode**

Using the `run` skill against a real Supabase test project (or a disposable test instructor account on the real project — clean up any test `payouts`/`instructor_earnings` rows afterward), walk the full lifecycle once more end-to-end:
1. Instructor with `< £10` pending — confirm no Stripe account is created (lazy onboarding: check `instructor_connect_accounts` has no row for this user).
2. Instructor crosses `£10` — taps "Set Up Payouts" — completes Stripe's hosted onboarding with test data — returns to app — confirm `instructor_connect_accounts.status = 'onboarded'`, `payouts_enabled = true` (via the Task 4 webhook).
3. Taps "Request Payout" — confirm a real transfer appears in Stripe Dashboard test mode, `payouts` row is `paid`, matching `instructor_earnings` rows are `paid`, and Payout History shows a green "Paid" row.
4. Force a transfer failure (per Task 5 Step 4) — confirm the `payouts` row is `failed` with a reason, the Payout History shows a red "Failed" row with the reason text, and the underlying `instructor_earnings` rows are back to `pending` (retryable — confirm a subsequent "Request Payout" tap picks them up again).

- [ ] **Step 4: Prepare the report**

Summarize for the user:
- Files touched: `apps/mobile/supabase/schema.sql`, `apps/mobile/server/proxy.js`, `apps/mobile/server/lib/connectStatus.{js,test.js}`, `apps/mobile/server/package.json`, `apps/mobile/app/instructor.tsx`.
- New env var required in Railway + local `server/.env`: `STRIPE_CONNECT_WEBHOOK_SECRET` (Task 8).
- New Stripe Dashboard configuration required: Connect enabled + a second webhook endpoint scoped to "events on connected accounts" (Task 8, Step 3) — this is an action only Craig can take (dashboard access), flag it explicitly if not yet done.
- Known limitation, by design (Design Decision 4): bank-level payout failures *after* a successful transfer (Stripe's connected-account `payout.failed` event) are not automatically reconciled — recommend a periodic manual check of Stripe Dashboard → Connect → Payouts.
- Reminder: per project memory, the `production` EAS channel currently has no OTA channel configured (only `preview` does) — shipping this to real users needs a full app-store build, not just an OTA push, since it touches native-adjacent flows (`Linking.openURL` to Stripe, deep-link return).

---

## Self-Review

**Spec coverage:**
- Stripe Connect Express accounts — Task 3 (`stripe.accounts.create({ type: 'express', ... })`).
- Lazy onboarding (only at £10 threshold + tap) — Task 7 Step 2 (`handlePayout` only calls onboarding-link when `pending >= 10` is already gated by the earlier `pending < 10` return, and only when not yet onboarded).
- Store Stripe Connect account ID against instructor profile — Task 1 (`instructor_connect_accounts.stripe_account_id`), Task 3 Step 2 (writes it on creation).
- Real Stripe transfer on payout request — Task 5.
- `instructor_earnings.status` transitions pending → processing → paid — Task 5 Step 1 (claim + final update), Task 1 (CHECK constraint covering all three values).
- Payout history view — Task 7 Steps 3-5 (`PayoutHistorySection`), Task 6 Step 5 (data fetch).
- Handle abandoned/incomplete onboarding — Design Decision 5 + Task 7 Step 1 (`'pending'` → "Finish Stripe Setup" state) + Task 4 (webhook keeps status current) + Task 6 Step 4 (`AppState` refresh on return).
- Handle transfer failure — Task 5 Step 1 (catch block reverts earnings, marks payout failed) + Design Decision 4 (explicit scope boundary on the async bank-level failure case).
- Env vars/webhook secrets flagged, not assumed — Task 8.
- Testing strategy given no unit test suite — Task 2 (new `node:test` file, matching existing `proExpiry.test.js` precedent), Tasks 3-7's per-task manual smoke tests, Task 9's full walkthrough.

**Placeholder scan:** No TBD/TODO markers; every code step has complete, runnable code; every "Verify" step names the exact command and expected output.

**Type consistency:** `ConnectAccountRow`/`PayoutEntry` (defined Task 6 Step 2) are used with identical field names in Task 6 (state), Task 7 (`EarningsSection`, `PayoutHistorySection`, `InstructorDashboard` props), and match the columns created in Task 1. `payoutButtonLabel` (Task 7 Step 1) is called with the same three-argument signature at its one call site (Task 7 Step 2). Endpoint paths are consistent: `/api/instructor/connect/onboarding-link` and `/api/instructor/payout-request` (new paths, intentionally different from the deleted `/api/payout-request`) are used identically in Task 3/5 (server) and Task 7 (client).
