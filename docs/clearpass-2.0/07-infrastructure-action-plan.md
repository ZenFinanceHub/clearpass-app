# ClearPass 2.0 — Infrastructure Action Plan (ordered, with approval gates)

For Craig. Last updated 2026-11-26. This consolidates every remaining infrastructure step into one sequence.

**Every step is prepared, not authorised.** Each gate (G1–G5) needs your explicit go-ahead. Nothing here changes production data, credentials or pricing.

## Where we are (audits complete)

| Audit | Result |
|---|---|
| ✅ C1 (Vercel, Supabase, GitHub) | **Previews:** off; history deleted; Standard Protection on; GitHub Actions hardened.<br>**Not yet in place:** branch protection, the production `APP_ENV` variables.<br>**Over-scoped:** `STRIPE_SECRET_KEY` (unused) and `SLACK_WEBHOOK_CLEARPASS` (in Preview).<br>**Build override:** the learner build-command override is still on.<br>**Supabase:** the Clear Pass organisation is on Pro. |
| ✅ A14 (RevenueCat) | All three in-app holders are genuine production purchases, with no sandbox activity. Metrics reconciled in `04-craig-actions.md` §T |
| ✅ R1 (Railway) | **Plan:** Hobby ($5/month including $5 usage).<br>**Layout:** 1 environment (production), 1 service (`clearpass-app`), US East (Virginia), 1 replica.<br>**Source:** `ZenFinanceHub/clearpass-app`, branch `main`, root `apps/mobile/server`, start command `node proxy.js`.<br>**Deploys:** **auto-deploy ON, Wait for CI OFF**, no watch paths.<br>**Variables:** `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_SECRET` are present. The RevenueCat ID variables and `CLEARPASS_SERVER_ENV` are absent. The Stripe key type is unverified (masked). |

**Consequence:** today, **every merge to `main` deploys production on three Vercel projects and Railway**, with no CI gate on Railway. Gate G1 fixes this first.

---

## Gate G1 — Release control (no cost). Do this before any merge.

### Recommended: a `production` release branch

Point all production deployments at a new `production` branch instead of `main`.

**What changes:**
- Merging to `main` no longer deploys anything. On Vercel, `main` builds become "preview" builds, which the existing Ignored Build Step skips.
- **Releasing** becomes a single, deliberate, approved step: Claude Code fast-forwards `production` to an approved `main` commit (`git push origin <sha>:production`).
- That one push deploys Vercel (3 projects) and Railway together, from a commit CI has already passed on `main`.

**Why it's better than switching auto-deploy off:**
- Every platform still deploys automatically, but only on an explicit release.
- Railway's "Wait for CI" can verify the commit, because CI ran on that exact commit when it landed on `main`.
- No manual redeploys from dashboards. Rollback stays a one-click platform action.
- Staged merges can go ahead freely, and you release in whatever groups you approve.

**Steps:**
1. **Claude Code (needs G1 approval):** read the commit currently live on Vercel and Railway (from each dashboard's latest production deployment, gathered in prompt P1 step 0). If they match `origin/main` (expected `d791923`), create `production` at that exact commit. Nothing deploys, because it's the same code that's already live.
2. **Chrome prompt P1** (below): switch the production branch to `production` on all three Vercel projects and on Railway. Turn **Wait for CI** on in Railway.
3. **Chrome prompt C7a** (below): branch rulesets.
   - `main`: changes only via PR, no reviewer required, no force-push or deletion.
   - `production`: no deletion and no force-push. Only fast-forwards from `main`.

**Rollback under this model:**
- Use the platform's instant rollback: Vercel → Deployments → previous → "Instant Rollback"; Railway → Deployments → previous → "Redeploy".
- Then revert on `main`, and fast-forward `production` again.
- `production` is never force-pushed.

### Alternative (what you originally asked for): turn Railway auto-deploy off

Chrome prompt **P1-alt** turns Railway auto-deploy OFF and Wait for CI ON. There's no equivalent switch on Vercel. The closest is setting Ignored Build Step to "Don't build anything" during staged merges, then deploying each approved commit by hand from the dashboard.

That works, but it's more manual and easier to get wrong. P1-alt is included in case you prefer it.

---

## Gate G2 — Pre-merge configuration (no cost)

| Step | Prompt | What | When |
|---|---|---|---|
| G2.1 | **C1b** (in `06-chrome-prompts.md`) | **A12:** add `EXPO_PUBLIC_APP_ENV=production` (clearpass-app) and `NEXT_PUBLIC_APP_ENV=production` (instructor-web), Production scope only. **Also turn off the learner build-command override** | Before #108 is merged |
| G2.2 | **C5** (in `06-chrome-prompts.md`) | Delete the unused `STRIPE_SECRET_KEY` from clearpass-app. Limit `SLACK_WEBHOOK_CLEARPASS` to Production | Any time |
| G2.3 | **C7b** (below) | Add the 7 CI checks to the `main` ruleset | Right after #109 merges |

**Vercel privileged variables (investigated, read-only):**
- The only server-side code on Vercel is `apps/mobile/api/support.ts`, which reads `ANTHROPIC_API_KEY` and `SLACK_WEBHOOK_CLEARPASS` (both legitimately needed, Production only).
- `STRIPE_SECRET_KEY` is read by nothing on Vercel, in any commit's history.
- Client bundles only contain `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*` values. The live production bundles were fetched and contain no secret patterns.
- **No rotation is required.** Any other non-public variable C1 listed for clearpass-app is unused on Vercel and can be removed in C5 the same way. Tell me its name first.

---

## Gate G3 — Merges and releases

These follow the sequence in `03-implementation-tracker.md` ("Recommended merge and deploy order"). Under the G1 model:
- **Merge** = no deployment.
- **Release** = fast-forward `production`, which needs approval each time. After any release that changes the server, Claude Code runs `npm run smoke:instructor` and reports PASS or FAIL.

---

## Gate G4 — Hosted staging (cost approval: ≈ $10–15/month)

| Item | Expected cost | Notes |
|---|---|---|
| Supabase `clearpass-staging` (Clear Pass org, Pro, Micro compute) | **~$10/month** | Pro's $10 compute credit is already used by production |
| Railway `staging` environment (same project, Hobby) | **~$0–5/month** | Hobby includes $5 of usage. Production's share of that isn't known yet, so check Usage after a week. Staging can sleep when idle |
| Stripe test mode, RevenueCat sandbox, Apple/Google testers | $0 | |
| Staging Anthropic key with a spend cap | pence to £1–2 | Optional. Ask Pip can stay off in staging |
| **Total** | **≈ $10–15/month** | Verify against real usage after the first month |

**Never in staging:**
- production credentials, webhook secrets or keys (every value is created new for staging);
- customer data (the staging database is replayed from `schema.sql` and seeded with synthetic accounts only);
- live-mode Stripe;
- the production RevenueCat project's webhook.

| Step | Who | What |
|---|---|---|
| G4.1 | Chrome **C2** (`06-chrome-prompts.md`, rev 2) | Create `clearpass-staging` in the Clear Pass org, same region as production. You type the DB password yourself |
| G4.2 | You | Create `~/.config/clearpass/staging-db.env` (chmod 600; setup guide §1) |
| G4.3 | Claude Code | Apply `schema.sql` (best after #112 merges) and the migrations to **staging only**, then seed synthetic accounts. Report migration names and PASS/FAIL |
| G4.4 | Chrome **R3** (below) | Railway: create an **empty** `staging` environment (never "duplicate"), with a service from the same repo. Variables are listed below |
| G4.5 | Chrome **S1** (written when reached) | Stripe test mode: test products and prices mirroring production amounts; test webhook endpoints → the staging Railway URL (`/api/webhook`, `/api/stripe/connect-webhook`); Connect in test mode. The signing secrets go into Railway staging only |
| G4.6 | Chrome **RC1** (written when reached) | RevenueCat: a separate staging project (webhook → the staging URL, its own webhook auth value and v2 secret key, its own project and entitlement IDs). First check that RevenueCat allows the same store apps in a second project. If it doesn't, the fallback is to keep the single production project, rely on #113's sandbox flagging, and point no webhook at staging |
| G4.7 | Chrome **V1** (written when reached) | Vercel Preview variables (`EXPO_PUBLIC_APP_ENV=staging` plus the staging URLs and anon key) and EAS `preview` environment variables. Only then decide whether to turn previews back on |

**Staging server variables.** Names are checked against the server code (`apps/mobile/server/proxy.js` and `lib/*`); no working variable is renamed.

| Variable | Staging value | Production today |
|---|---|---|
| `CLEARPASS_SERVER_ENV` | `staging` (read once #117 merges; harmlessly ignored before) | absent (= production) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | the staging project (you paste the service key yourself) | present |
| `PUBLIC_API_URL` | **the staging Railway URL. Required:** the code falls back to the production URL (`proxy.js:2795`), so emails and links from staging would point at production | not in your R1 summary (falls back to the production URL) |
| `CRON_SECRET` | a new random value | present |
| `STRIPE_SECRET_KEY` | `sk_test_…` or `rk_test_…` from Stripe test mode | present (type unverified) |
| `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` | from the **test** webhook endpoints | the first is present; the Connect one wasn't in your summary |
| `STRIPE_PRICE_ID`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_SEAT_PRICE_ID` | test-mode price IDs | not in your summary (needed for web checkout and seats) |
| `REVENUECAT_WEBHOOK_SECRET`, `REVENUECAT_SECRET_API_KEY` | from the staging RevenueCat project | present |
| `REVENUECAT_PROJECT_ID`, `REVENUECAT_PRO_ENTITLEMENT_ID` | the staging project's IDs (**required once #117 merges**) | absent (correct: production IDs are pinned in code) |
| `ANTHROPIC_API_KEY` | optional, a staging key with a spend cap | not in your summary (needed for Ask Pip) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `LIFECYCLE_REPLY_TO`, `ADMIN_ALERT_EMAIL` | **leave unset**, so staging sends no email | not in your summary |
| `SLACK_WEBHOOK_UPDATES` | **leave unset**, so staging posts nothing to Slack | not in your summary |

The server reads 18 variable names; your R1 summary mentioned 7 of them. The others may simply have been left out of the summary. If you'd like that confirmed, the full name list from R1 (names only) is enough.

---

## Gate G5 — Optional follow-ups (separate approvals)

- Set `CLEARPASS_SERVER_ENV=production` on Railway once #117 is live, so the server names its environment explicitly.
- Rate-limit or origin-check the public `/api/support` Vercel function (finding I9).
- **Future performance review, not part of the redesign: European hosting.** Railway runs in US East (Virginia) and the users are in the UK. Moving the server to Railway's EU region, close to the Supabase region, could cut latency. It's recorded here and not scheduled. **The current region is kept.**

---

## Prompts

### P1 — Release control: `production` branch (run only after Claude Code has created the `production` branch, G1)

```text
You are changing deployment settings for my app ClearPass so that production deploys only from a branch called "production". I am signed in to Vercel, Railway and GitHub in this Chrome.

SAFETY: Change ONLY the settings listed. Do not redeploy, promote, roll back, delete or pause anything. Never reveal, copy or report any variable value. If a page asks you to confirm anything not listed here, cancel it. If the "production" branch doesn't appear in a branch picker, STOP and tell me. Don't create branches yourself.

Step 0 (read-only, do first):
- In Vercel (https://vercel.com/zenfinancehubs-projects), for each of clearpass-app, clearpass-instructor-web and clearpass-web: Deployments → the current Production deployment → report its commit hash (short) and branch.
- In Railway (https://railway.com/dashboard) → ClearPass project → production → clearpass-app service → Deployments: report the active deployment's commit hash and branch.
- Confirm https://github.com/ZenFinanceHub/clearpass-app/branches lists a branch named "production", and report its latest commit hash.
- If any of the hashes differ from the "production" branch's hash, STOP here and report. Don't change anything.

Step 1 — Vercel, for EACH of clearpass-app, clearpass-instructor-web and clearpass-web:
  Settings → Environments → Production → Branch Tracking (or Settings → Git → "Production Branch"): change the production branch from "main" to "production". Save.
  Leave Ignored Build Step as "Only build production". Don't change anything else.

Step 2 — Railway: ClearPass project → production environment → clearpass-app service → Settings:
  a. Source → Branch connected to production: change "main" to "production".
  b. Turn "Wait for CI" ON.
  c. Leave automatic deployments ON. They will now only trigger when the production branch moves.
  d. Leave root directory, start command, region and replicas unchanged.

Step 3 — Report: for each Vercel project and for Railway, the production branch before and after; Wait for CI before and after; the Step 0 commit hashes; and confirmation that nothing was deployed or redeployed.
```

### P1-alt — Railway: auto-deploy off and Wait for CI on (the alternative; don't run as well as P1)

```text
You are changing one Railway service's deployment settings for my app ClearPass. I am signed in to Railway in this Chrome.

SAFETY: Change ONLY the two settings below. Do not deploy, redeploy, restart, roll back or delete anything. Never reveal or report any variable value. If a page asks you to confirm anything else, cancel it.

1. https://railway.com/dashboard → ClearPass project → production environment → clearpass-app service → Settings.
2. Report the current values of: the source branch, automatic deployments (on/off), and Wait for CI (on/off).
3. Turn automatic deployments OFF for this service (the toggle may be labelled "Auto deploy", "Automatic deployments" or "Deploy on push"). Save if needed.
4. Turn "Wait for CI" ON. Save if needed.
5. Reload the page and report both settings as saved.

Report: before/after for automatic deployments and Wait for CI, and confirmation that nothing was deployed.
```

Under P1-alt, every server release is a manual "Deploy latest commit" in Railway, which you'd approve each time. Vercel would need Ignored Build Step set to "Don't build anything" (ask for that prompt if you choose this route).

### C7a — GitHub rulesets for `main` and `production` (no CI checks yet; safe before #109)

```text
You are adding branch rulesets to my GitHub repository ZenFinanceHub/clearpass-app. I am signed in to GitHub in this Chrome. I am the only person who works on this repository.

SAFETY: Create exactly the two rulesets below. Don't change other settings, rulesets, secrets, collaborators or Actions settings. If a page asks you to confirm anything else, cancel it.

Ruleset 1 — https://github.com/ZenFinanceHub/clearpass-app/settings/rules → New ruleset → New branch ruleset
- Name: main protection. Enforcement: Active. Bypass list: EMPTY.
- Target branches: Include default branch (main).
- Rules (tick only these):
  - Restrict deletions.
  - Block force pushes.
  - Require a pull request before merging:
    - Required approvals: 0.
    - Dismiss stale approvals, Code Owners review, Approval of most recent push, and Conversation resolution: all OFF.
- Create.

Ruleset 2 — New branch ruleset
- Name: production protection. Enforcement: Active. Bypass list: EMPTY.
- Target branches: Include by pattern → production.
- Rules (tick only these):
  - Restrict deletions.
  - Block force pushes.
  (Do NOT require pull requests on this one. Releases are fast-forward pushes of commits already merged to main.)
- Create.

Re-open both and report every saved setting. Confirm nothing else changed.
```

### C7b — Add the required CI checks to `main` (run right after #109 merges)

```text
In my GitHub repository ZenFinanceHub/clearpass-app, edit ONE existing ruleset. I am signed in in this Chrome.

SAFETY: Edit only the ruleset named "main protection". Change nothing else.

1. https://github.com/ZenFinanceHub/clearpass-app/settings/rules → open "main protection".
2. Tick "Require status checks to pass". Leave "Require branches to be up to date before merging" OFF.
3. Add these checks, choosing each from the GitHub Actions suggestions:
     Typecheck (apps/mobile)
     Typecheck (apps/instructor-web)
     Unit tests (packages/core, packages/content)
     Unit tests (apps/mobile/server)
     Unit tests (apps/mobile scripts)
     Unit tests (apps/instructor-web)
     E2E (Playwright, stubbed backend)
   Do NOT add "Native fingerprint (informational)" or any "Vercel" check.
4. Save. Re-open the ruleset and report the saved list of required checks and all other rules unchanged.
```

### R3 — Railway staging environment (run after G4 approval and after C2; Claude Code fills the marked values first)

```text
You are creating an ISOLATED staging environment in Railway for my app ClearPass. I am signed in to Railway in this Chrome.

SAFETY:
- Create a NEW EMPTY environment. NEVER choose "Duplicate environment" or "Fork". Production variables must not be copied.
- Do not change, redeploy or restart anything in the production environment.
- Never reveal, copy or report any variable value. When a secret must be entered, STOP and ask me to paste it myself.
- If any step shows a charge or plan change, STOP and tell me.

1. https://railway.com/dashboard → ClearPass project → environment switcher → New Environment → name it "staging" → choose an EMPTY environment (not duplicate).
2. In staging: New → GitHub Repo → ZenFinanceHub/clearpass-app.
   Service settings:
   - Branch: main (staging follows main).
   - Root directory: apps/mobile/server.
   - Start command: node proxy.js.
   - Region: the same as production.
   - Replicas: 1.
   - Wait for CI: ON.
   - If offered, enable "App Sleeping" (serverless) to save cost.
   - Generate a Railway domain and report it.
3. Variables. Add these names. Non-secret values are given; for every value marked <YOU PASTE>, STOP and let me paste it myself:
   CLEARPASS_SERVER_ENV = staging
   SUPABASE_URL = <STAGING SUPABASE URL, from Claude Code>
   SUPABASE_SERVICE_KEY = <YOU PASTE>
   PUBLIC_API_URL = https://<the staging Railway domain from step 2>
   CRON_SECRET = <YOU PASTE: a new random value>
   (Stripe, RevenueCat and Anthropic variables come later, in prompts S1 and RC1.)
   Do NOT add RESEND_*, LIFECYCLE_REPLY_TO, ADMIN_ALERT_EMAIL or SLACK_WEBHOOK_UPDATES.
4. Deploy staging only. Report: the environment name, service settings, domain, variable NAMES added, and confirmation that the production environment was not changed.
```

S1 (Stripe test mode), RC1 (RevenueCat staging) and V1 (Vercel Preview and EAS preview variables) are written when G4.3 and G4.4 are done, because they need the staging URLs.
