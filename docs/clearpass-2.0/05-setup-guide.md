# ClearPass 2.0 — Setup Guide: Staging, CI and Sandbox Payments

For Craig. Last updated 2026-11-25. Covers actions A1, A2 and A3 in `04-craig-actions.md`.

**Golden rules while doing this:**
- Secrets go **only** into the provider dashboards (Vercel, Railway, EAS, GitHub) or into `~/.config/clearpass/*.env`, which is outside the repo and `chmod 600`.
- Never paste secrets into chat, issues, PRs or this repo. **The GitHub repo is public.**
- Staging must never share a key, database or webhook with production.

## Why this is needed (current state, verified)

- The app **hardcodes the production Supabase URL and anon key** (`apps/mobile/src/supabase.ts:4-5`) and the production Railway URL (`src/proxyUrl.ts:1`; development builds use `localhost:3001` for the API but still the **production database**).
- So today, every local dev run and every Vercel preview talks to the production database.
- PR **P0-4** makes both environment-driven. When nothing is set, they keep today's production values, so production builds and OTAs are unaffected. It also adds a guard that refuses to start a non-production build pointed at production.

## Cost summary

| Item | Expected monthly cost | Notes |
|---|---|---|
| Hosted staging Supabase project | **$0** if it fits within the Free plan's 2 active projects (pauses after ~1 week of inactivity). **~$10/month** (Micro compute) if added to an org already on Pro ($25/month base, which includes $10 of compute credit covering one project) | Supabase charges per project for compute. Check which plan the org holding the new project is on. **GAP:** I couldn't confirm the current org and plan from here. Recommendation: create it in a ClearPass-only org, not the org shared with Zen Footy. |
| Local Supabase (Docker) | $0 | Runs on your machine; Docker is installed |
| Railway staging environment | ~$1–5/month of usage | Hobby plan is $5/month including $5 of usage. Staging plus production together may stay inside that, or add a few dollars. Enable sleep on staging |
| GitHub Actions | **$0** | Standard runners are free for **public** repos |
| Vercel Preview deployments | $0 extra | Uses the existing plan |
| EAS preview builds and updates | $0 extra within the current EAS plan allowance | Check build quota on expo.dev |
| Stripe test mode / sandbox | $0 | |
| RevenueCat sandbox, Apple sandbox testers, Google licence testers | $0 | |
| Staging Anthropic API key | Pence to a few £/month | Put a spend limit on it (§3.4) |
| **Total** | **≈ $0–20/month** | Most likely ~$5–15 |

Pricing references (check before committing; providers change pricing):
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)
- [Railway plans](https://docs.railway.com/pricing/plans)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

---

## §1. Hosted staging Supabase project (A1)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and choose (or create) an **organisation that does not contain Zen Footy**. Click **New project**.
   - Name: `clearpass-staging`
   - Region: **the same region as production**
   - Database password: generate a strong one and store it in your password manager.
2. Create a local credentials file. This mirrors the production setup in `CLAUDE.md`, so Claude Code can apply the schema without ever seeing the password.
   ```bash
   mkdir -p ~/.config/clearpass
   ${EDITOR:-nano} ~/.config/clearpass/staging-db.env
   chmod 600 ~/.config/clearpass/staging-db.env
   ```
   Contents (use your real values in the file only):
   ```
   SUPABASE_DB_PASSWORD=<staging database password>
   SUPABASE_DB_URL_TEMPLATE=<staging Session pooler connection string, port 5432, with the literal [YOUR-PASSWORD] placeholder>
   ```
   The connection string is under **Project Settings → Database → Connection string → Session pooler**.
3. Tell Claude Code it's done. Claude Code then:
   - applies `schema.sql` and the migrations to **staging only**, via a staging variant of `npm run db:migrate` that reads `staging-db.env`;
   - seeds synthetic accounts;
   - creates the storage buckets (`question-images`, hazard clips) and copies the public assets.

   This copy only reads from production and stores no customer data.
4. **Authentication → URL Configuration:**
   - Site URL: the staging web URL (Vercel preview branch alias, see §3).
   - Redirect URLs: `https://*-zenfinancehub.vercel.app/**` (adjust to your Vercel team slug), `clearpass://auth/callback`, `http://localhost:8081/**`.
5. **Authentication → Providers:** keep **Email** on. Leave Apple and Google **off** in staging for now; email/password and magic link are enough for review. Social sign-in is tested on production builds in Phase 7.
6. **Authentication → Emails:** the default Supabase SMTP is fine for staging (rate-limited, fine for a handful of testers).
7. Note these values for §2–§3. They're shown under **Project Settings → API**:
   - Project URL
   - **anon/publishable key** (safe for clients)
   - **service_role key** (server only, secret)

## §2. EAS (mobile preview builds) — part of A1

Claude Code will add `"environment": "preview"` to the `preview` build profile in `eas.json` (in PR P0-4). Then you run, from `apps/mobile`:

```bash
eas env:create --environment preview --name EXPO_PUBLIC_APP_ENV --value staging --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value <staging Project URL> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <staging anon key> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value <staging Railway URL from §3.3> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_UI_V2 --value 1 --visibility plaintext
```

Do **not** copy the production RevenueCat keys into `preview` until §6 is done.

## §3. Vercel and Railway — part of A1

### 3.1 Vercel (web previews)

1. Open the Vercel project for `apps/mobile` (`clearpass-app`) and go to **Settings → Environment Variables**.
2. Add the five variables from §2 with the **Preview** environment scope only.
3. Check that **no Preview-scoped variable holds a production Supabase or Railway value**.
4. **Settings → Deployment Protection:** turn on **Vercel Authentication** for Preview deployments, so previews are visible only to your Vercel team.

### 3.2 Railway: create the staging environment

1. Open the Railway project **Clearpass** and go to **Environments → New environment** → `staging`.
2. Choose an **empty** environment. **Do not duplicate production**, because that would copy production secrets.
3. Add the `clearpass-app` service from the same GitHub repo.
4. Set it to deploy from the `staging` branch, or deploy manually, rather than from `main`.

### 3.3 Railway staging variables (Service → Variables)

| Variable | Staging value |
|---|---|
| `SUPABASE_URL` | staging Project URL |
| `SUPABASE_SERVICE_KEY` | staging service_role key |
| `ANTHROPIC_API_KEY` | staging key (§3.4) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_SEAT_PRICE_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET` | test-mode values (§5) |
| `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_SECRET` | per §6 |
| `CRON_SECRET` | a new random value (`openssl rand -hex 32`) |
| `PUBLIC_API_URL` | the staging service's Railway URL |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `LIFECYCLE_REPLY_TO`, `ADMIN_ALERT_EMAIL` | **leave unset.** No real emails from staging. P0-4 confirms the server degrades safely without them |
| `SLACK_WEBHOOK_UPDATES` | **leave unset.** Staging must not post into the production stats channel |

Then:
- Under **Service → Settings**, turn on **serverless/sleep** to keep costs down.
- Don't add any cron-job.org schedules for staging.

### 3.4 Anthropic staging key

In console.anthropic.com:
1. Create a **workspace** `clearpass-staging`.
2. Set a **monthly spend limit**, for example £10.
3. Create an API key in that workspace and put it in Railway staging only.

## §4. GitHub Actions (A2)

1. Go to GitHub → `ZenFinanceHub/clearpass-app` → **Settings → Actions → General**.
2. Set **Actions permissions** to **Allow ZenFinanceHub, and select non-ZenFinanceHub, actions and reusable workflows**, then tick **Allow actions created by GitHub**. The workflow only needs `actions/checkout`, `actions/setup-node` and `actions/cache`.
3. Set **Fork pull request workflows** to **Require approval for all outside collaborators**. This matters because the repo is public.
4. Set **Workflow permissions** to **Read repository contents and packages permissions**, and leave **Allow GitHub Actions to create and approve pull requests** unticked.
5. No repository secrets are needed. The CI runs fully stubbed and never contacts Supabase, Railway, Stripe or RevenueCat.
6. Optional, after the first green run: **Settings → Branches → Add rule** for `main`: require the `ci` check to pass before merging.

Cost: free (public repo, standard runners).

## §5. Stripe test mode / sandbox (part of A3)

The web purchase is a **one-time Checkout payment** (`mode: 'payment'`), not a Stripe subscription. The 2026-07-14 plan in `docs/superpowers/plans/2026-07-14-stripe-sandbox-migration.md` describes the existing Zengus Ventures sandbox. Reuse that sandbox if it still exists; otherwise create one from the same account using **Copy your account**.

In the sandbox:
1. **Products:** make sure there are one-time GBP prices matching production:
   - **£2.99** (1 month)
   - **£7.99** (3 months)
   - the instructor **seat** price, same amount as production

   Note the three `price_…` IDs.
2. **Developers → API keys:** copy the `sk_test_…` secret key into Railway **staging** `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint:**
   - `https://<staging railway url>/api/webhook`, with the same events as the production endpoint. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
   - `https://<staging railway url>/api/stripe/connect-webhook` as a Connect endpoint, with the same events as production. Put its signing secret in `STRIPE_CONNECT_WEBHOOK_SECRET`.
4. **Connect:** make sure Connect is enabled in the sandbox, so instructor-payout flows can be exercised with test Express accounts.
5. Testing uses Stripe test cards only (for example `4242 4242 4242 4242`). No real cards.

## §6. RevenueCat sandbox (part of A3)

Native in-app purchases use RevenueCat with App Store and Google Play. Sandbox purchases are free and are flagged as sandbox in RevenueCat.

**Apple (iOS):**
1. In App Store Connect, go to **Users and Access → Sandbox → Test Accounts → +**. Create a tester using a new email alias you control (for example `you+cpsandbox1@…`), region **United Kingdom**.
2. On the test iPhone, go to **Settings → App Store → Sandbox Account** and sign in with the tester. Keep your real Apple ID signed in as normal.
3. Make sure the existing subscription products (monthly and 3-month) are in an approved or "Ready to Submit" state. They already are if they're live.

**Google (Android):**
1. In Play Console, go to **Settings → License testing**. Add the Gmail account(s) that will test, and set **License response** to `RESPOND_NORMALLY`.
2. Purchases only work for builds distributed through Play. Use the **internal testing** track (an `internal` submit profile already exists in `eas.json`) and add the tester to the internal testing list. Licence testers are never charged.

**RevenueCat:**
1. In the dashboard, the **Sandbox data** toggle shows sandbox purchases separately.
2. **Decision needed later:**
   - The production webhook (`/api/revenuecat-webhook`) **already receives sandbox events**. The production `revenuecat_webhook_events` table contains sandbox-style `TEST` events and accelerated renewals.
   - A staging build using the same RevenueCat project would therefore send its sandbox purchases to **production's** webhook.
   - P0-4 will check how `server/lib/revenuecatWebhook.js` treats `environment: SANDBOX` and propose one of:
     - (a) a second RevenueCat project for staging, with a separate public key and a webhook pointed at staging; or
     - (b) production ignoring sandbox events.

     Option (b) is a server change and needs approval.
3. Until that's settled, **don't run sandbox purchases** from staging builds; purchase testing waits for Phase 5.

## §7. After setup — what Claude Code checks (no production access)

- The staging app signs in a seeded account and syncs progress to staging. A query on production confirms the account does **not** exist there (read-only check).
- The Playwright guard test still fails on any production host.
- Stripe test checkout from the web preview completes and the staging webhook marks the seeded account Pro.
- No production Slack post, email or webhook event is produced by staging activity.

## Note on the public repository

The repo is public. Real secret files (`.env`, `.env.local`, `google-play-service-account.json`) are correctly git-ignored, and only `.env.example` files are tracked (verified 2026-11-25). Some docs include **partial** Stripe test-key prefixes and the Apple ID email in `eas.json`. These aren't secrets, but consider whether the repo should be private. Making it private would change GitHub Actions to the private-repo allowance: 2,000 free minutes/month on the Free plan, which is expected to be enough.
