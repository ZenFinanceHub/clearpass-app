# Stripe Sandbox Migration for Connect Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire ClearPass's classic Stripe Test mode integration in favor of a single, correctly-named Stripe sandbox under Zengus Ventures Ltd that supports both the existing subscription/Pro-purchase checkout flow and the new Stripe Connect Express payout feature (PR #20), which cannot be configured in classic Test mode.

**Architecture:** No application code changes. This is entirely a Stripe Dashboard configuration exercise (new sandbox, Connect setup, Product/Price, two webhook endpoints) followed by a 4-variable Railway environment update (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET`) on the single `clearpass-app` Railway service. The app already reads all Stripe config from environment variables (`apps/mobile/server/proxy.js`) and has no client-side Stripe key anywhere — so once the 4 Railway variables point at the new sandbox, the whole app follows automatically.

**Tech Stack:** Stripe Dashboard (sandboxes, Connect, Webhooks), Railway CLI (`railway variable`, `railway deployment redeploy` — already linked to project `Clearpass` / service `clearpass-app` / environment `production` in this working directory), Express server (`apps/mobile/server/proxy.js`).

## Global Constraints

- The new sandbox must be created under the **Zengus Ventures Ltd** account (the account currently used for classic Test mode, key prefix `sk_test_51TJVdRHuKtBOOS4s...`), using Stripe's **"Copy your account"** creation option.
- Never use, reference, or migrate anything to the existing **"Zen Finance Hub Ltd sandbox"** (key prefix `sk_test_51TJVdhHhN7tx1V7Z...`) — it is a legacy, unrelated leftover. No task in this plan touches it.
- Railway target for every variable change: project **Clearpass**, service **clearpass-app**, environment **production** (already linked — confirmed via `railway status` during planning; this is the only place Stripe secrets live, there is no committed `.env` with real values in this repo).
- The app has **no client-side Stripe publishable key** anywhere (confirmed via repo-wide grep for `pk_test`/`pk_live`/`publishable`) — Pro purchase uses a server-created Stripe Checkout redirect (`stripe.checkout.sessions.create` in `proxy.js`), not Stripe.js/Elements. Credential migration is 100% a Railway/server-side concern; nothing in the mobile app bundle needs to change.
- Do not change any live Railway credentials while executing Tasks 1-4 of this plan — those are Stripe Dashboard-only steps. Credentials only change in Task 6, and only once Tasks 1-4 have produced every new value Task 6 needs.

## Design Decisions / Audit Findings (resolved during research)

1. **Every Stripe touchpoint in the codebase is env-var driven, in exactly one file.** `apps/mobile/server/proxy.js` is the only place `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` are read (line 7 — `stripe` client init; line 61 — subscription webhook secret; line 185 — checkout line item price). No other file in the repo (mobile app, web app, packages) references a Stripe key, test/live prefix, or webhook secret.

2. **Railway currently holds exactly 4 Stripe-related variables on `clearpass-app`/`production`** (confirmed via `railway variables --kv`, values not printed here): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, and — already present — `STRIPE_CONNECT_WEBHOOK_SECRET`. That fourth one predates this plan (PR #20's own description says it was "not yet set anywhere" when written); its current value is stale/unverified and must be treated as a placeholder to be overwritten in Task 6 regardless of what it currently contains, since a Connect webhook secret is only meaningful once Connect is actually configured in a sandbox (Task 2).

3. **The Pro "subscription" is actually a one-time Stripe Checkout payment, not a recurring Stripe Subscription.** `proxy.js:184` uses `mode: 'payment'` with a single `line_items` price, and `paywall.tsx:135` displays `£7.99 / 3 months` as a flat one-off charge (the "3 months" access window is enforced app-side via `computeProExpiresAt()`, not by Stripe). This matters for Task 3: the new sandbox needs a one-time Price of **GBP 799** (£7.99), not a recurring price.

4. **Stripe's "Copy your account" sandbox creation explicitly excludes several Connect settings** (per current Stripe docs): Connect onboarding options (OAuth redirect URIs, Tax), Connect tax reporting, and Connect email domain settings are *not* copied — confirming the user's premise that platform Connect setup cannot be inherited and must be done fresh inside the new sandbox (Task 2). Whether Products/Prices/Webhooks/Customers are copied is not documented either way by Stripe — this plan treats them as **not** carried over and has Craig verify/recreate them explicitly (Tasks 3-4) rather than assume.

5. **Webhook endpoint URLs do not change** — only the Stripe account/sandbox issuing the events changes. Both webhooks re-register against the same Railway host: `https://clearpass-app-production.up.railway.app/api/webhook` (subscription, event `checkout.session.completed`) and `https://clearpass-app-production.up.railway.app/api/stripe/connect-webhook` (Connect, event `account.updated`, "Listen to events on Connected accounts" toggle). The Connect webhook route doesn't exist on `main` yet — it ships with PR #20 (`docs/superpowers/plans/2026-07-14-stripe-connect-instructor-payouts.md`) — so registering it only matters once that branch is merged or the worktree is deployed; Task 4 notes this dependency.

6. **PR #20 (Stripe Connect instructor payouts) is fully coded and reviewed, blocked solely on this migration** — confirmed via `gh pr view 20`: type-check clean, unit tests passing, but the PR's own checklist has "Live walkthrough in Stripe test mode" unchecked because Connect can't be configured in classic Test mode. Task 8 of this plan is that walkthrough, now unblocked.

7. **Railway CLI is already authenticated and linked** in this working directory (`railway status` → project `Clearpass`, service `clearpass-app`, environment `production`), so credential updates and rollback can use exact `railway variable set` / `railway deployment redeploy` commands rather than only the Railway Dashboard.

---

### Task 1: Create the new sandbox under Zengus Ventures Ltd

**Files:** none (Stripe Dashboard only) — **Craig, manual.**

- [x] **Step 1: Open the account picker in the Stripe Dashboard**

While viewing the **Zengus Ventures Ltd** classic account (not the Zen Finance Hub Ltd one), click the account picker (top left) → **Switch to sandbox** → **Create sandbox**.

- [x] **Step 2: Name it unambiguously**

Give it a name that cannot be confused with the legacy "Zen Finance Hub Ltd sandbox," e.g. `Zengus Ventures — ClearPass Sandbox`. Avoid the word "Zen Finance" entirely in the name.

- [x] **Step 3: Choose "Copy your account"**

Select **Copy your account** (not "Create from scratch") so business/payout/payment-method settings carry over from the Zengus Ventures Ltd classic account. Confirm creation.

- [x] **Step 4: Verify**

In the new sandbox, go to Settings → Business details and confirm the business name/country reflects Zengus Ventures Ltd (copied), not blank/default placeholder data. Note the sandbox's name for reference in later tasks — no ID is needed, the account picker name is sufficient.

---

### Task 2: Complete Connect (Express) platform setup fresh in the new sandbox

**Files:** none (Stripe Dashboard only) — **Craig, manual.**

- [x] **Step 1: Enable Connect**

Inside the new sandbox (confirm the account picker shows the sandbox name from Task 1, not classic Test mode or Zen Finance Hub), go to **Settings → Connect**. Confirm/enable Connect for the platform and allow **Express** accounts (Connect setup was explicitly excluded from the Task 1 copy — this is expected to be blank and need filling in).

- [x] **Step 2: Fill in the platform profile**

Complete whatever platform profile/branding fields Stripe requires before Express accounts can be created (business name, support email/URL — reuse ClearPass's existing support details). This is the step that was impossible in classic Test mode and is the entire reason for this migration.

- [x] **Step 3: Verify**

Settings → Connect → Overview should show Connect as enabled with Express accounts allowed, inside the new sandbox specifically (double-check the account picker before screenshotting/confirming — it's easy to accidentally be looking at classic Test mode or another sandbox).

---

### Task 3: Recreate/verify the Pro Price in the new sandbox

**Files:** none (Stripe Dashboard only) — **Craig, manual.**

**Produces:** a new `price_...` ID (from a one-time GBP 799 price), consumed by Task 6's `STRIPE_PRICE_ID` update.

- [x] **Step 1: Check whether the Product/Price was copied**

In the new sandbox, go to Product catalog and check whether a "ClearPass Pro" (or similarly named) product/price already exists from the Task 1 copy. Stripe's docs don't confirm either way whether catalog data is copied — treat "not found" as the expected case.

- [x] **Step 2: Create the Price if missing**

If not present, create a new Product (e.g. "ClearPass Pro") with a **one-time** Price: currency **GBP**, amount **£7.99** (799 in pence) — matching the display in `apps/mobile/app/paywall.tsx:135` (`£7.99 / 3 months`) and the existing `mode: 'payment'` (not recurring) checkout in `proxy.js:184`. Do **not** create a recurring/subscription price — the app does not use Stripe's subscription billing.

- [x] **Step 3: Verify**

Copy the new Price's ID (starts `price_...`) — this is the value Task 6 sets as `STRIPE_PRICE_ID`. Confirm the price shows GBP 799.00, one-time, in the new sandbox's Product catalog.

---

### Task 4: Register both webhooks in the new sandbox

**Files:** none (Stripe Dashboard only) — **Craig, manual.**

**Produces:** two new `whsec_...` signing secrets, consumed by Task 6's `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` updates.

- [x] **Step 1: Register the existing subscription webhook**

In the new sandbox, go to Developers → Webhooks → **Add endpoint**:
- URL: `https://clearpass-app-production.up.railway.app/api/webhook`
- Events to send: `checkout.session.completed`

Copy the endpoint's signing secret (`whsec_...`) — this becomes the new `STRIPE_WEBHOOK_SECRET` in Task 6.

- [x] **Step 2: Register the new Connect webhook**

Add a second endpoint in the same sandbox:
- URL: `https://clearpass-app-production.up.railway.app/api/stripe/connect-webhook`
- Toggle **"Listen to events on Connected accounts"** (this is what makes it a Connect webhook rather than a second platform webhook)
- Event: `account.updated`

Copy this endpoint's signing secret — this becomes the new `STRIPE_CONNECT_WEBHOOK_SECRET` in Task 6.

Note: the `/api/stripe/connect-webhook` route only exists on the `worktree-stripe-connect-payouts` branch / PR #20, not on `main` yet — registering the endpoint now is harmless (Stripe will just get 404s until that code is deployed), but Task 8's Connect walkthrough requires PR #20 to be merged/deployed first.

- [x] **Step 3: Verify**

Both endpoints appear under Developers → Webhooks in the new sandbox with status "Enabled" and zero deliveries so far (deliveries start showing up once Task 6/7/8 exercise them).

---

### Task 5: Snapshot current classic Test mode Railway variables (rollback prep)

**Files:** none (local file outside the git repo — never commit this) — **Craig or Claude, Railway CLI, read-only.**

- [x] **Step 1: Capture current values to a local, non-repo file**

```bash
mkdir -p ~/.secrets
railway variable list --service clearpass-app --environment production --kv \
  | grep -E '^(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|STRIPE_PRICE_ID|STRIPE_CONNECT_WEBHOOK_SECRET)=' \
  > ~/.secrets/clearpass-stripe-classic-test-rollback-2026-07-14.env
chmod 600 ~/.secrets/clearpass-stripe-classic-test-rollback-2026-07-14.env
```

- [x] **Step 2: Verify**

```bash
wc -l ~/.secrets/clearpass-stripe-classic-test-rollback-2026-07-14.env
```

Expected: `4` (all four classic Test mode values captured). This file is the rollback source of truth for Task 9 — do not commit it, do not paste its contents into chat/PRs. Delete it once the new sandbox has been stable for a couple of weeks (Task 10).

---

### Task 6: Point Railway at the new sandbox

**Files:** none (Railway environment variables) — values obtained from Tasks 3-4 (Craig, Stripe Dashboard); **recommend Craig runs the commands below personally** rather than pasting the new secret values into chat, since they're freshly generated live-ish (sandbox) credentials — the commands are provided here so either Craig or Claude can execute them.

- [x] **Step 1: Set all four variables without triggering 4 separate deploys**

```bash
railway variable set STRIPE_SECRET_KEY --stdin --service clearpass-app --environment production --skip-deploys
# paste the new sandbox's sk_test_... value, then Ctrl-D

railway variable set STRIPE_WEBHOOK_SECRET --stdin --service clearpass-app --environment production --skip-deploys
# paste the Task 4 Step 1 whsec_... value, then Ctrl-D

railway variable set STRIPE_PRICE_ID --stdin --service clearpass-app --environment production --skip-deploys
# paste the Task 3 price_... value, then Ctrl-D

railway variable set STRIPE_CONNECT_WEBHOOK_SECRET --stdin --service clearpass-app --environment production --skip-deploys
# paste the Task 4 Step 2 whsec_... value, then Ctrl-D
```

- [x] **Step 2: Trigger one deploy for all four changes**

```bash
railway deployment redeploy --service clearpass-app --environment production
```

- [x] **Step 3: Verify**

```bash
railway variable list --service clearpass-app --environment production --kv | grep STRIPE_SECRET_KEY
```

Expected: value now starts with the new sandbox's key prefix, not `sk_test_51TJVdRHuKtBOOS4s` (classic) or `sk_test_51TJVdhHhN7tx1V7Z` (Zen Finance Hub — must never appear here). Then:

```bash
curl -s https://clearpass-app-production.up.railway.app/api/config
```

Expected: `{"stripeTestMode":true}` (sandbox keys are still `sk_test_`-prefixed, so this flag stays true — no code change needed here, just confirming the deploy picked up the new key).

---

### Task 7: Verify the EXISTING subscription/Pro-purchase flow end-to-end in the new sandbox

**Files:** none (manual verification) — this is the task most likely to catch a missed variable, since it's the flow already in production use.

- [x] **Step 1: Trigger a real checkout against the new sandbox**

Using the `run` skill (or the deployed web/app build), start a Pro purchase for a disposable test account. At Stripe's checkout, use test card `4242 4242 4242 4242`, any future expiry, any CVC.

- [x] **Step 2: Confirm the webhook fired and updated Supabase**

```bash
railway logs --service clearpass-app --environment production | grep -A2 "Webhook - userId"
```

Expected: `Webhook - userId from metadata: <test user id>` followed by `Supabase update result: success`.

- [x] **Step 3: Confirm Supabase state**

In the Supabase SQL editor for the project referenced in `apps/mobile/server` (`SUPABASE_URL`), run:

```sql
select progress->'isPro' as is_pro, progress->'proExpiresAt' as pro_expires_at
from user_progress where id = '<test user id>';
```

Expected: `is_pro = true`, `pro_expires_at` set to a future date.

- [x] **Step 4: Confirm in the Stripe Dashboard**

In the new sandbox: Payments shows the completed test payment; Developers → Webhooks → the `/api/webhook` endpoint shows a `checkout.session.completed` delivery with a `200` response (not a signature-verification failure, which would indicate `STRIPE_WEBHOOK_SECRET` wasn't updated correctly in Task 6).

- [x] **Step 5: If a referral was involved, confirm the commission side-effect too**

If the test user was referred by an instructor (`profiles.referred_by` set), also confirm a new row appeared in `instructor_earnings` with `status = 'pending'`, `amount = 2.50` — this shares the same webhook handler, so it's a cheap additional check while already verifying Step 3.

---

### Task 8: Verify the new Connect payout flow end-to-end

**Files:** none (manual verification) — requires PR #20 merged/deployed first (its code isn't on `main` yet).

- [x] **Step 1: Merge or deploy PR #20**

This plan only migrates credentials — it doesn't merge PR #20. Confirm with Craig whether to merge `worktree-stripe-connect-payouts` to `main` (or deploy that branch directly) before this task, since the Connect webhook route it registers in Task 4 doesn't exist until then.

- [x] **Step 2: Run the existing walkthrough**

Follow Task 9, Step 3 of `docs/superpowers/plans/2026-07-14-stripe-connect-instructor-payouts.md` verbatim (lazy onboarding at £10 threshold → Stripe hosted Express onboarding with test data → webhook flips `instructor_connect_accounts.status` to `onboarded` → "Request Payout" creates a real test-mode transfer → Payout History shows "Paid") — now runnable for the first time since Connect is finally configured in a sandbox.

- [x] **Step 3: Verify**

Same expectations as that plan's Task 9: `payouts` row `status = 'paid'` with a `stripe_transfer_id`, matching `instructor_earnings` rows `paid`, transfer visible in the new sandbox's Connect → the test Express account → Balance.

---

### Task 9: Rollback runbook (only if Task 6/7/8 reveals a breakage)

**Files:** none — uses the Task 5 snapshot. **Not executed unless something breaks; keep as a documented procedure.**

- [x] **Step 1: Restore the four classic Test mode values**

```bash
source ~/.secrets/clearpass-stripe-classic-test-rollback-2026-07-14.env
railway variable set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" --service clearpass-app --environment production --skip-deploys
railway variable set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" --service clearpass-app --environment production --skip-deploys
railway variable set STRIPE_PRICE_ID="$STRIPE_PRICE_ID" --service clearpass-app --environment production --skip-deploys
railway variable set STRIPE_CONNECT_WEBHOOK_SECRET="$STRIPE_CONNECT_WEBHOOK_SECRET" --service clearpass-app --environment production --skip-deploys
railway deployment redeploy --service clearpass-app --environment production
```

- [x] **Step 2: Verify the rollback**

```bash
curl -s https://clearpass-app-production.up.railway.app/api/config
```

Expected: `{"stripeTestMode":true}` (unchanged — classic Test mode is still `sk_test_`-prefixed). Then repeat Task 7's checkout smoke test against classic Test mode to confirm the subscription flow works again, unblocking any testing that depended on it.

- [x] **Step 3: Note what's NOT rolled back**

Any Connect accounts, transfers, or payout rows created against the new sandbox during Tasks 6-8 stay in that sandbox's test data — harmless, since it's a sandbox, but don't expect them to appear if you switch back to the new sandbox later without re-running Task 7/8's verification.

---

### Task 10: Final report and cleanup

**Files:** none (summary only)

- [x] **Step 1: Prepare the report**

Summarize for Craig:
- New sandbox name (Task 1) and confirmation it's under Zengus Ventures Ltd, not Zen Finance Hub Ltd.
- New `STRIPE_PRICE_ID` value and that it's a one-time £7.99 GBP price, matching the existing checkout (Task 3).
- Both new webhook endpoints and their secrets are now Railway-only — never committed to the repo (Tasks 4/6).
- Confirmation that Task 7 (existing subscription flow) passed in the new sandbox before treating the migration as complete — this was the highest-risk regression per the original request.
- PR #20 status: unblocked; Task 8's walkthrough result (pass/fail) and whether it's ready to merge.
- Reminder: delete `~/.secrets/clearpass-stripe-classic-test-rollback-2026-07-14.env` once the new sandbox has proven stable for a couple of weeks — it holds live classic Test mode secrets in plaintext on disk.

---

## Self-Review

**Spec coverage:**
- Sandbox creation, named correctly under Zengus Ventures Ltd, via "Copy your account" — Task 1.
- Connect (Express) setup fresh in the new sandbox — Task 2.
- Full credential audit (Railway env vars, client-side keys, anywhere else in the codebase) — Design Decisions 1-2, Task 1's constraint list, and Task 6.
- Webhook re-registration for both `checkout.session.completed` and `account.updated`, new signing secrets — Task 4.
- Verification strategy prioritizing the *existing* subscription flow, not just the new Connect feature — Task 7 (dedicated, detailed, checked first) before Task 8.
- Rollback plan to quickly revert Railway env vars — Task 5 (snapshot) + Task 9 (runbook), using exact `railway variable set` commands against the already-linked Railway project.
- Manual-vs-code split flagged explicitly: Tasks 1-4 marked "Craig, manual — Stripe Dashboard"; Tasks 5-6, 9 give exact CLI commands (code/config); Tasks 7-8 are manual verification walkthroughs.

**Placeholder scan:** No TBD/TODO. Every Dashboard step names the exact menu path; every CLI step has the exact command; every verification step names the exact expected output or query.

**Type/value consistency:** `STRIPE_PRICE_ID` (Task 3) → Task 6 Step 1 → Task 7 Step 4 (Stripe Dashboard checkout uses whatever price Task 6 set — implicit, not re-stated, but consistent). Webhook secrets from Task 4 Steps 1-2 map 1:1 to Task 6 Step 1's four `railway variable set` calls in the same order they're introduced. Railway service/environment (`clearpass-app`/`production`) is identical across Tasks 5, 6, 7, 9.
