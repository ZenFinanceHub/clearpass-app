# Stripe Live Cutover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut Railway's `clearpass-app` service over from the Zengus Ventures Ltd Stripe **sandbox** (today's interim credentials) to the Zengus Ventures Ltd **live** account, closing the two real gaps the live audit found (missing checkout webhook, wrong-named Price) while leaving Connect — already enabled and correctly webhooked on live — untouched.

**Architecture:** No application code changes. Same as the sandbox migration: a Stripe Dashboard configuration exercise (archive one Price, create a fresh one, register one webhook, reconcile one webhook secret) followed by a 4-variable Railway update on the single `clearpass-app` service. The one architectural addition this plan makes over the sandbox migration: `STRIPE_SECRET_KEY` moves from a full-access standard key to a **purpose-scoped Restricted key** created fresh for ClearPass, rather than reusing whatever standard live secret key the Zengus Ventures Ltd account currently has (see Design Decision 5 — this account's standard key is shared with other live products and must not be touched).

**Tech Stack:** Stripe Dashboard (Live mode — Products, Webhooks, API keys), Railway CLI (`railway variable`, `railway deployment redeploy` — already linked to project `Clearpass` / service `clearpass-app` / environment `production`), Express server (`apps/mobile/server/proxy.js`).

## Global Constraints

- Every Dashboard step in this plan happens in **Live mode** on the **Zengus Ventures Ltd** account (`acct_1TJVdRHuKtBOOS4s`) — check the account picker shows "Live" (not a sandbox, not Test mode) before each Dashboard action. This is the same account that also runs Zen Footy and ZenTax's live Stripe integrations (confirmed — the read-only audit key, scoped only to this account, could see all three products' webhooks in one list call).
- **Never roll, regenerate, or otherwise touch the account's shared standard live secret key** (whatever `sk_live_...` value Zen Footy/ZenTax currently use, if any). Doing so would invalidate it for those other products too, since a standard secret key is one shared credential per Stripe account, not per-product. ClearPass gets its own **Restricted key** instead (Design Decision 5, Task 5).
- Railway target for every variable change: project **Clearpass**, service **clearpass-app**, environment **production** (already linked and confirmed via `railway status` during this session).
- The read-only `STRIPE_AUDIT_KEY` restricted key (used for the preceding audit) must be revoked and removed once this plan completes (Task 9) — it has no further purpose and is a live-mode credential sitting in Railway unnecessarily.
- Do not change any Railway credential before Tasks 1-3 have produced every new value Task 5 needs — mirrors the sandbox migration's own sequencing rule.
- **Task 6 (the real-money checkout verification) must be performed by Craig personally.** No agent should ever hold a card-charging-capable live key or attempt to simulate a real payment — this is a hard line, not a convenience choice.

## Design Decisions / Audit Findings (resolved during research)

1. **Connect is already enabled on live and needs no setup work.** The live platform account (`acct_1TJVdRHuKtBOOS4s`) has `transfers: active` in its capabilities, and `GET /v1/accounts` (list connected accounts) succeeds with an empty list rather than an error — both confirm Connect is genuinely available, unlike classic Test mode. Zero connected (Express) accounts exist yet, which is expected — no instructor has onboarded on live. This plan does **not** repeat the sandbox migration's Task 2 (Connect platform setup) — there is nothing to configure.

2. **A live Price object with matching specs already exists, under the wrong product name.** `price_1TYSA3HuKtBOOS4s1lr6aASy` — £7.99 GBP, `type: one_time`, `active: true` — lives on product `prod_UXXEWYhGU7Eb2G`, named **"ClearPass Premium - 3 Months"**, not "ClearPass Pro". This price ID is also what the old classic-Test-mode rollback file recorded as `STRIPE_PRICE_ID`, suggesting it's genuinely the price real historical customers paid through. Per Craig's decision: archive it, create a fresh "ClearPass Pro" price matching current naming (Task 1). Stripe does not allow deleting a Price or Product once used in a transaction — only archiving (`active: false`) is possible; this plan never attempts a delete.

3. **A live Connect webhook already exists and is correctly scoped — it only needs its signing secret reconciled.** `we_1Tt9cQHuKtBOOS4sMbBgTah5` → `.../api/stripe/connect-webhook`, subscribed to `account.updated`, `status: enabled`, created 2026-07-14 (same day as the classic-Test rollback — this was set up as part of PR #20's original work and left behind when development moved to the sandbox). Its single subscribed event matches the webhook handler code exactly (`apps/mobile/server/proxy.js:191` only checks `event.type === 'account.updated'`) — no re-registration needed, only Task 3's secret reconciliation.

4. **No live webhook exists for ClearPass's own checkout flow.** Three live webhooks exist on the account total; only one belongs to ClearPass (the Connect one above). The other two (`zen-footy.vercel.app/api/stripe/webhook`, `zen-tax-app.vercel.app/api/stripe/webhook`) belong to different products. Whatever `STRIPE_WEBHOOK_SECRET` Railway holds today is either stale or sandbox-only — it doesn't correspond to any endpoint that exists on live. The correct URL, confirmed from code (`proxy.js:91`), is `https://clearpass-app-production.up.railway.app/api/webhook` (not `/api/stripe/webhook`, which is what the other two products use) — Task 2 registers this fresh.

5. **The live account's standard secret key is shared across products and must not be regenerated.** The same read-only audit key that surfaced ClearPass's webhooks also surfaced Zen Footy's and ZenTax's — confirming all three live under one Stripe account. Standard secret keys are one shared value per account (Stripe never allows re-viewing a standard key's full value after creation, only "rolling" it, which invalidates the old value everywhere it's used). Rolling it for ClearPass's benefit would silently break Zen Footy and ZenTax's live payment processing. Instead, ClearPass gets a **Restricted key**, scoped only to what its own code actually calls (confirmed via grep of `apps/mobile/server/proxy.js`: `checkout.sessions.create`, `accounts.create`, `accountLinks.create`, `transfers.create`) — Checkout Sessions (Write), Connect (Write), Transfers (Write), leaving everything else "None." This is strictly safer than reusing the shared key regardless of whether that key is even recoverable, and mirrors the same least-privilege pattern already used for the read-only `STRIPE_AUDIT_KEY` in the preceding audit.

6. **This is real money — verification cannot use Stripe's test cards.** Task 6 is a deliberate, small (£7.99), real transaction on Craig's own card, immediately refunded. This is the single highest-risk step in the whole cutover and the only one that cannot be run by an agent under any circumstances.

7. **A full live Connect payout walkthrough is out of scope for this cutover and deferred.** The sandbox migration's Task 8 (onboard an Express account, run a real test-mode transfer) doesn't have a live-money-safe equivalent worth bundling here — actually onboarding a real instructor's real bank details and moving real payout money is a separate, higher-stakes undertaking that should happen when the first real instructor actually signs up for payouts, not as part of flipping this switch. Task 7 verifies only that the Connect webhook's plumbing (signature, delivery) works, using Stripe's built-in test-event sender — zero real accounts or transfers involved.

8. **Railway CLI is already authenticated and linked** (confirmed via `railway status` during this session), same as the sandbox migration.

---

### Task 1: Archive the old Price/Product, create the new "ClearPass Pro" Price

**Files:** none (Stripe Dashboard, Live mode only) — **Craig, manual.**

**Produces:** a new `price_...` ID, consumed by Task 5's `STRIPE_PRICE_ID` update.

- [ ] **Step 1: Archive the old price**

In the Stripe Dashboard, switch to **Live mode**. Go to Product catalog → find **"ClearPass Premium - 3 Months"** (`prod_UXXEWYhGU7Eb2G`) → open its price `price_1TYSA3HuKtBOOS4s1lr6aASy` → **Archive price**. Then archive the product itself (Product catalog → the product's "..." menu → Archive product). Archiving does not delete historical payment records or affect anyone who already purchased through it — it only stops it from being usable in new checkout sessions.

- [ ] **Step 2: Create the new Price**

Create a new Product named **"ClearPass Pro"** with a **one-time** Price: currency **GBP**, amount **£7.99** (799 pence) — matching `apps/mobile/app/paywall.tsx:135` (`£7.99`) and the existing `mode: 'payment'` (not recurring) checkout in `proxy.js:261`. Do not create a recurring/subscription price.

- [ ] **Step 3: Verify**

Copy the new Price's ID (`price_...`). Confirm in Product catalog: "ClearPass Pro", GBP 799.00, one-time, active — and confirm "ClearPass Premium - 3 Months" now shows as archived, not active.

---

### Task 2: Create the missing checkout webhook on live

**Files:** none (Stripe Dashboard, Live mode only) — **Craig, manual.**

**Produces:** a new `whsec_...` signing secret, consumed by Task 5's `STRIPE_WEBHOOK_SECRET` update.

- [ ] **Step 1: Register the endpoint**

Still in Live mode: Developers → Webhooks → **Add endpoint**:
- URL: `https://clearpass-app-production.up.railway.app/api/webhook`
- Events to send: `checkout.session.completed`

- [ ] **Step 2: Verify**

The new endpoint appears under Developers → Webhooks with status "Enabled" and zero deliveries so far. Copy its signing secret (`whsec_...`) — this becomes `STRIPE_WEBHOOK_SECRET` in Task 5. Confirm the URL has no typo (`/api/webhook`, not `/api/stripe/webhook` — that path belongs to Zen Footy/ZenTax, not ClearPass).

---

### Task 3: Reconcile the existing Connect webhook's signing secret

**Files:** none (Stripe Dashboard, Live mode only) — **Craig, manual.**

**Produces:** a confirmed or freshly-rolled `whsec_...` signing secret, consumed by Task 5's `STRIPE_CONNECT_WEBHOOK_SECRET` update.

- [ ] **Step 1: Try to reveal the existing secret first**

In Live mode: Developers → Webhooks → open `we_1Tt9cQHuKtBOOS4sMbBgTah5` (`.../api/stripe/connect-webhook`). Under "Signing secret," click **Reveal**. If it shows a `whsec_...` value, copy it — done, skip Step 2.

- [ ] **Step 2: Roll the secret only if Step 1 doesn't produce a usable value**

If the secret was never saved anywhere accessible and can't be revealed, use the endpoint's "..." menu → **Roll secret**. This generates a new signing secret **for the same endpoint** — the endpoint ID, URL, and event subscription (`account.updated`) all stay unchanged; only the secret rotates. This is safe to do regardless of timing, since Railway currently points at the sandbox's Connect webhook secret, not this live one — nothing live-dependent breaks by rolling it.

- [ ] **Step 3: Verify**

Whichever value you obtained, confirm it's the current secret shown for `we_1Tt9cQHuKtBOOS4sMbBgTah5` specifically (not a different endpoint) before using it in Task 5.

---

### Task 4: Snapshot current sandbox Railway variables (rollback prep)

**Files:** none (local file outside the git repo — never commit this) — **Claude, Railway CLI, read-only.**

- [ ] **Step 1: Capture current sandbox values to a local, non-repo file**

```bash
mkdir -p ~/.secrets
railway variable list --service clearpass-app --environment production --kv \
  | grep -E '^(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|STRIPE_PRICE_ID|STRIPE_CONNECT_WEBHOOK_SECRET)=' \
  > ~/.secrets/clearpass-stripe-sandbox-rollback-2026-07-18.env
chmod 600 ~/.secrets/clearpass-stripe-sandbox-rollback-2026-07-18.env
```

- [ ] **Step 2: Verify**

```bash
wc -l ~/.secrets/clearpass-stripe-sandbox-rollback-2026-07-18.env
```

Expected: `4`. This is the rollback source of truth for Task 8 — do not commit it, do not paste its contents into chat/PRs. This supersedes (does not replace) the earlier `clearpass-stripe-classic-test-rollback-2026-07-14.env`, which stays as a separate, older recovery point back to classic Test mode if ever needed.

---

### Task 5: Create ClearPass's own Restricted key, then point Railway at live

**Files:** none (Stripe Dashboard for the key, Railway environment variables for the update) — **Craig, manual for the Dashboard part and recommended to run the Railway commands personally** rather than pasting a fresh live-capable secret into chat.

**Produces:** the values Task 1 (Price), Task 2 (webhook secret), and Task 3 (Connect webhook secret) generated, plus a new Restricted key, all become the 4 Railway variables.

- [ ] **Step 1: Create ClearPass's Restricted key**

Live mode → Developers → API keys → **Create restricted key**. Name it `clearpass-app-production`. Grant:
- **Checkout Sessions** → Write
- **Connect** → Write
- **Transfers** → Write

Leave everything else — including Customers, Charges, Payment Intents, and all other resources — as "None." Copy the resulting `rk_live_...` value. This key becomes `STRIPE_SECRET_KEY`; it is **not** the account's shared standard key and does not affect Zen Footy or ZenTax.

- [ ] **Step 2: Set all four variables without triggering 4 separate deploys**

```bash
railway variable set STRIPE_SECRET_KEY --stdin --service clearpass-app --environment production --skip-deploys
# paste the Task 5 Step 1 rk_live_... value, then Ctrl-D

railway variable set STRIPE_WEBHOOK_SECRET --stdin --service clearpass-app --environment production --skip-deploys
# paste the Task 2 whsec_... value, then Ctrl-D

railway variable set STRIPE_PRICE_ID --stdin --service clearpass-app --environment production --skip-deploys
# paste the Task 1 price_... value, then Ctrl-D

railway variable set STRIPE_CONNECT_WEBHOOK_SECRET --stdin --service clearpass-app --environment production --skip-deploys
# paste the Task 3 whsec_... value, then Ctrl-D
```

- [ ] **Step 3: Trigger one deploy for all four changes**

```bash
railway deployment redeploy --service clearpass-app --environment production
```

- [ ] **Step 4: Verify**

```bash
railway variable list --service clearpass-app --environment production --kv | grep STRIPE_SECRET_KEY
```

Expected: value now starts `rk_live_...` (not `sk_test_...`). Then:

```bash
curl -s https://clearpass-app-production.up.railway.app/api/config
```

Expected: `{"stripeTestMode":false}` — this flips from `true` to `false` for the first time in this migration, since `proxy.js:751` checks `sk.startsWith('sk_test_')` and this is the first live-prefixed key in the whole process (the sandbox key was still `sk_test_`-prefixed, same as classic Test mode).

---

### Task 6: Real-money checkout verification (Craig only — not automatable)

**Files:** none (manual verification, live payment) — **Craig, personally, using his own real card. No agent may perform, simulate, or hold credentials for this step.**

This is the highest-risk step in the entire cutover: it moves real money. Stripe's test cards (`4242 4242 4242 4242` etc.) only work in Test mode / sandboxes — they do nothing on live, so there is no automatable equivalent to the sandbox migration's Task 7.

- [ ] **Step 1: Make a real £7.99 purchase**

Using a disposable or your own test account in the live, deployed app, go through the Pro purchase flow for real, entering your own real card details at Stripe's hosted checkout.

- [ ] **Step 2: Confirm the webhook fired and updated Supabase**

```bash
railway logs --service clearpass-app --environment production | grep -A2 "Webhook - userId"
```

Expected: `Webhook - userId from metadata: <your test user id>` followed by `Supabase update result: success`.

- [ ] **Step 3: Confirm Supabase state**

```sql
select progress->'isPro' as is_pro, progress->'proExpiresAt' as pro_expires_at
from user_progress where id = '<test user id>';
```

Expected: `is_pro = true`, `pro_expires_at` set to a future date.

- [ ] **Step 4: Confirm in the Stripe Dashboard (Live mode)**

Payments shows the completed real payment (£7.99, GBP). Developers → Webhooks → the `/api/webhook` endpoint shows a `checkout.session.completed` delivery with a `200` response, not a signature-verification failure.

- [ ] **Step 5: Refund immediately**

In the Stripe Dashboard (Live mode), open the payment from Step 4 → **Refund** → full amount. Do this in the same sitting as Step 1-4, not batched for later — there is no reason to hold real money longer than it takes to confirm the flow works.

- [ ] **Step 6: If a referral was involved, confirm the commission side-effect too**

If the test user was referred by an instructor (`profiles.referred_by` set), also confirm a new row appeared in `instructor_earnings` with `status = 'pending'`, `amount = 2.50` — same webhook handler, cheap additional check while already here. Note this creates a real (if small) pending-commission record tied to the refunded purchase — decide with the instructor's own bookkeeping in mind whether to manually clear this test row afterward (not covered by Stripe's refund, since it's Supabase-side).

---

### Task 7: Verify the Connect webhook's plumbing (no real payout)

**Files:** none (manual verification) — **Craig, Stripe Dashboard.** Full live payout verification (onboarding a real Express account, a real transfer) is explicitly deferred — see Design Decision 7 — and is not part of this task.

- [ ] **Step 1: Send a test event**

Live mode → Developers → Webhooks → `we_1Tt9cQHuKtBOOS4sMbBgTah5` → **Send test webhook** → select `account.updated`.

- [ ] **Step 2: Confirm delivery**

The endpoint's recent deliveries should show the test event with a `200` response, confirming `STRIPE_CONNECT_WEBHOOK_SECRET` was set correctly in Task 5 (a wrong secret shows as a signature-verification failure instead). Optionally cross-check Railway logs:

```bash
railway logs --service clearpass-app --environment production | grep "connect-webhook"
```

A test event references a fake/example account ID, so `[connect-webhook] Failed to update account ...` is an expected, harmless log line here (no matching row in `instructor_connect_accounts`) — the goal is confirming signature verification succeeds, not that the update applies.

---

### Task 8: Rollback runbook (only if Task 5/6/7 reveals a breakage)

**Files:** none — uses the Task 4 snapshot. **Not executed unless something breaks; keep as a documented procedure.**

- [ ] **Step 1: Restore the four sandbox values**

```bash
source ~/.secrets/clearpass-stripe-sandbox-rollback-2026-07-18.env
railway variable set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" --service clearpass-app --environment production --skip-deploys
railway variable set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" --service clearpass-app --environment production --skip-deploys
railway variable set STRIPE_PRICE_ID="$STRIPE_PRICE_ID" --service clearpass-app --environment production --skip-deploys
railway variable set STRIPE_CONNECT_WEBHOOK_SECRET="$STRIPE_CONNECT_WEBHOOK_SECRET" --service clearpass-app --environment production --skip-deploys
railway deployment redeploy --service clearpass-app --environment production
```

- [ ] **Step 2: Verify the rollback**

```bash
curl -s https://clearpass-app-production.up.railway.app/api/config
```

Expected: `{"stripeTestMode":true}` (back to the sandbox). Then repeat Task 6's checkout smoke test using Stripe's fake test card (`4242 4242 4242 4242`) against the sandbox, confirming the flow works there again.

- [ ] **Step 3: Note what's NOT rolled back**

The new "ClearPass Pro" Price/Product (Task 1) and the new checkout webhook (Task 2) stay live-side regardless — they're harmless while unused. The refund from Task 6 Step 5 is also final and unaffected by a Railway rollback. Only Railway's active credentials revert; nothing created directly in the live Stripe account gets undone by this step.

---

### Task 9: Cleanup — revoke the audit key

**Files:** none — **Craig, Stripe Dashboard + Railway.**

- [ ] **Step 1: Delete the restricted key from Stripe**

Live mode → Developers → API keys → find `STRIPE_AUDIT_KEY`'s restricted key (created for the preceding read-only audit) → **Delete key**.

- [ ] **Step 2: Remove the Railway variable**

```bash
railway variable delete STRIPE_AUDIT_KEY --service clearpass-app --environment production
```

- [ ] **Step 3: Verify**

```bash
railway variable list --service clearpass-app --environment production --kv | grep STRIPE_AUDIT_KEY
```

Expected: no output (variable gone). Confirm in the Stripe Dashboard that the key no longer appears under Live mode API keys.

---

### Task 10: Final report

**Files:** none (summary only)

- [ ] **Step 1: Prepare the report**

Summarize for Craig:
- Confirmation the new `STRIPE_SECRET_KEY` is the fresh, purpose-scoped `rk_live_...` restricted key (Task 5), not the account's shared standard key — and that Zen Footy/ZenTax were never touched.
- New `STRIPE_PRICE_ID` value, confirmed one-time £7.99 GBP under "ClearPass Pro" (Task 1), and that the old "ClearPass Premium - 3 Months" price/product are archived, not deleted.
- New `STRIPE_WEBHOOK_SECRET` for the freshly-created `/api/webhook` endpoint (Task 2).
- `STRIPE_CONNECT_WEBHOOK_SECRET` reconciled against the existing, already-correct Connect webhook (Task 3) — note whether it was revealed or rolled.
- Task 6's real-money verification result: amount charged, refunded, confirmed in both Stripe and Supabase.
- Task 7's result: Connect webhook signature verification confirmed via test event — full live payout walkthrough explicitly deferred to whenever the first real instructor onboards (Design Decision 7), not part of this cutover.
- Confirmation `STRIPE_AUDIT_KEY` is gone from both Stripe and Railway (Task 9).
- Reminder: both rollback snapshot files (`clearpass-stripe-sandbox-rollback-2026-07-18.env` and the older `clearpass-stripe-classic-test-rollback-2026-07-14.env`) sit in `~/.secrets` in plaintext — note how long to keep them before deleting.

---

## Self-Review

**Spec coverage:**
- Archiving the old product/price, creating the new one — Task 1.
- Creating the missing checkout webhook at the correct path — Task 2.
- Reconciling the Connect webhook's signing secret, with an explicit reveal-first-then-roll fallback — Task 3.
- Railway credential updates for all four variables — Task 5.
- Real-money verification with immediate refund, explicitly flagged Craig-only — Task 6.
- Rollback plan back to sandbox — Task 4 (snapshot) + Task 8 (runbook).
- Cleanup of `STRIPE_AUDIT_KEY` — Task 9.
- Additional finding surfaced during planning, not in the original request but directly consequential to it: the shared-standard-key risk (Design Decision 5) and the decision to mint a dedicated Restricted key instead — folded into Task 5 rather than left as a side note, since skipping it would risk breaking two other live products.

**Placeholder scan:** No TBD/TODO. Every Dashboard step names the exact menu path; every CLI step has the exact command; every verification step names the exact expected output or query.

**Type/value consistency:** `STRIPE_PRICE_ID` (Task 1) → Task 5 Step 2 → implicitly exercised in Task 6's real checkout. Webhook secrets from Task 2 and Task 3 map 1:1 to Task 5 Step 2's four `railway variable set` calls, same order as the sandbox plan introduced them. Railway service/environment (`clearpass-app`/`production`) identical across Tasks 4, 5, 6, 8, 9. `/api/config`'s expected value flips from the sandbox plan's `true` to this plan's `false` — the one deliberate, documented divergence between the two plans' otherwise-identical verification step.
