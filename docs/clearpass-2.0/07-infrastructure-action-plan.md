# ClearPass 2.0 — Infrastructure Action Plan (ordered, with approval gates)

For Craig. Last updated 2026-11-26 (rev 2: P1 model approved, with safeguards). This consolidates every remaining infrastructure step into one sequence.

**Every step is prepared, not authorised.** Each gate (G1–G5) needs your explicit go-ahead. Nothing here changes production data, credentials or pricing.

## Where we are (audits complete)

| Audit | Result |
|---|---|
| ✅ C1 (Vercel, Supabase, GitHub) | **Previews:** off; history deleted; Standard Protection on; GitHub Actions hardened.<br>**Not yet in place:** branch protection, the production `APP_ENV` variables.<br>**Over-scoped:** `STRIPE_SECRET_KEY` (unused) and `SLACK_WEBHOOK_CLEARPASS` (in Preview).<br>**Build override:** the learner build-command override is still on.<br>**Supabase:** the Clear Pass organisation is on Pro. |
| ✅ A14 (RevenueCat) | All three in-app holders are genuine production purchases, with no sandbox activity. Metrics reconciled in `04-craig-actions.md` §T |
| ✅ R1 (Railway) | **Plan:** Hobby ($5/month including $5 usage).<br>**Layout:** 1 environment (production), 1 service (`clearpass-app`), US East (Virginia), 1 replica.<br>**Source:** `ZenFinanceHub/clearpass-app`, branch `main`, root `apps/mobile/server`, start command `node proxy.js`.<br>**Deploys:** **auto-deploy ON, Wait for CI OFF**, no watch paths.<br>**Variables:** `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_SECRET` are present. The RevenueCat ID variables and `CLEARPASS_SERVER_ENV` are absent. The Stripe key type is unverified (masked). |

**Consequence:** today, **every merge to `main` deploys production on three Vercel projects and Railway**, with no CI gate on Railway. Gate G1 fixes this first.

---

## Gate G1 — Release control with a dedicated `production` branch (approved model; no cost)

**Decision (Craig, 2026-11-26):** P1, a dedicated `production` branch. P1-alt is dropped. C7a is approved in principle, subject to reviewing the exact settings below.

### How it works
- **All four production deployments track `production`:** Vercel clearpass-app, clearpass-instructor-web and clearpass-web, plus Railway. Merging to `main` deploys nothing. On Vercel, `main` builds become preview builds, and the existing "Only build production" Ignored Build Step skips them.
- **A release** is a fast-forward of `production` to a commit already merged to `main` and green in CI. Claude Code makes it **only after your explicit message approving that specific release**, naming the commit or PR.
- **Protection** (C7a now, C7b after #109):

| | `main` | `production` |
|---|---|---|
| Deletion | Blocked | Blocked |
| Force push | Blocked | Blocked (fast-forward only) |
| How it changes | Pull requests only; **0 required reviewers** (single owner) | No PRs. **"Restrict updates"**: only the repository admin role (your account) can push |
| Required CI checks (C7b) | 7 checks | The same 7 checks, so **only CI-green commits can become production** |
| Bypass list | Empty | Repository admin (only for the "Restrict updates" rule) |

**What the protection can and can't enforce.** Claude Code pushes with your GitHub account. So "Restrict updates" stops everyone else (other collaborators, apps, tokens), but technically it can't tell you and Claude Code apart.
- **Release approval is enforced by procedure:** Claude Code never pushes `production` without your explicit per-release approval (this plan, plus a saved project rule).
- **If you want a second, technical gate,** say so. A GitHub Environment `production-release` with you as required reviewer, plus a small release workflow, would make every release need your click in GitHub. That's optional; it can be added after G1.

### Verified before changing anything (2026-11-26, read-only)
GitHub's deployment records show the **latest production deployment on all four platforms is `d791923`**, the current `main` (PR #105 merge), and every one reported `success`. That's 25 Nov: Railway at 15:55, clearpass-web 15:58, instructor-web 15:58, clearpass-app 15:59.

This shows the latest deployment, not necessarily what's serving (an earlier Instant Rollback would change that). So each prompt also confirms the **serving** commit on screen before changing anything, and Claude Code re-checks immediately before each step.

### Don't assume a branch switch deploys nothing
- **Vercel:** changing the production branch normally doesn't start a build. If it does, `production` points at the identical commit, so the output is identical. The prompt checks the Deployments list straight after.
- **Railway:** changing the source branch **may start a deployment** of `production`'s head. That's the same commit as now, so it's equivalent to a redeploy, but it does restart the single replica (seconds of possible interruption). Do it at a quiet time. Claude Code runs `npm run smoke:instructor` afterwards.
- **If any platform's serving commit isn't `d791923` at step 0, stop.** Nothing changes until we know why.

### Wait for CI with the `production` branch
- Railway's Wait for CI waits for the GitHub Actions runs triggered by the push to the branch it deploys from.
- On `main` today, CI only runs on pushes to `main`. So **#109 now also runs CI on pushes to `production`** (commit `f043c4e`). Every release push starts its own CI run, and Railway deploys only after that run passes.
- **Until #109 merges** there's no workflow for Railway to wait for, so it deploys immediately. That's acceptable, because no releases happen before #109.
- **Confirmed in practice by a validation release** (G1.10): the first release is #109's own merge commit, which changes only CI and test files. Railway's deployment page should show "Waiting for CI", then deploy after the run passes.
- The Vercel projects don't wait for CI. They build straight away, but only from a commit that already passed CI on `main` (the required checks on `production` enforce this).

### How the three Vercel deployments and Railway are coordinated
One push to `production` triggers all four independently: Vercel ×3 build in about 1–3 minutes; Railway deploys after its CI run (about 6–8 minutes). **The order isn't guaranteed, so every release must be safe in any mixed state.**

- **Compatibility rule:** each release must work in all of these combinations:
  - new web + old server;
  - old web + new server;
  - **all installed native apps (1.1.x)** + new server. Native apps update separately, so the server must stay backward-compatible with them permanently.

  If a change can't meet that, split it into two releases: server first (additive endpoint or field), web second.
- **Release types:** each release is labelled server-only, web-only, or both-compatible. In the current queue:
  - **Server-only:** #111, #113, #118, #116, #117.
  - **Web-only, no new server dependency:** #108, #110, #107, #79, #114/#115/M1. #107's events write straight to Supabase, not the server.
- **Per-release checks** by Claude Code:
  - before: the commit is on `main`; all 7 checks are green; the GitHub deployment records show all four platforms healthy;
  - after: all four deployment records reach `success` at the new commit; `smoke:instructor` passes for server changes; the web spot checks listed in the sequence.

**If one platform fails:**
- **Vercel build failure:** that project keeps serving the previous deployment.
- **Railway deploy failure or crash:** the previous deployment keeps running.

Either way the platforms are briefly out of step. Because of the compatibility rule, that's safe. Then:
1. Fix forward with a new PR and release, **or**
2. Roll back the platforms that did deploy (below), revert the PR on `main`, and release the revert, so `production` matches what's serving again.

### Rollback, covering code, data and the database
1. **Code (fast):**
   - **Vercel:** Deployments → previous production deployment → **Instant Rollback**, for each affected project. **Gotcha:** after an Instant Rollback, Vercel stops auto-promoting new production deployments until you **"Undo Rollback"** or promote one manually. The procedure finishes by undoing it once the revert release is live.
   - **Railway:** Deployments → previous successful deployment → **Redeploy**.
2. **Realign:** revert the PR on `main` (through a PR, with CI), then release the revert by fast-forwarding `production`. `production` is never force-pushed.
3. **Data written by the new code:** each server PR documents what it writes and how older code treats it.
   - #113 and #118 write `iap_sandbox` / `iap_trial` grants. Their procedure is: check read-only for active rows; if there are any, the revert must keep those priority entries.
   - #111, #116 and #117 write nothing.
4. **Database migrations:**
   - **Separate from code releases:** migrations are applied by `npm run db:migrate`, under the CLAUDE.md rules, before the release that uses them, never in the same step.
   - **Additive only** (expand, then contract): new tables and columns are nullable or defaulted. Code must work with both the old and new schema, so **rolling back code never needs a schema rollback**.
   - **Destructive steps** (DROP, type changes, etc.) only after the code that needs the old shape is gone and has soaked. They need your explicit approval.
   - **None of the queued PRs contains a migration.** #112 changes only `schema.sql`, used for local and staging replay.
5. **API compatibility:** the server is backward-compatible with every live client. Server endpoints are additive; nothing is removed or changed incompatibly while 1.1.x apps exist. The smoke test exercises the instructor/learner contract after every server release.
6. **OTA (native apps)** isn't part of this. It's released separately via `npm run ota:production`, with its own approval (A10). An OTA rollback uses EAS's republish of the previous update. Claude Code will add a guarded `ota:rollback` script, mirroring `ota:production`, before the first OTA release, so CLAUDE.md's "never run `eas update` directly" rule still holds.

### G1 steps in order: who does what

| Step | Who | Action | Verification |
|---|---|---|---|
| G1.1 | **You** | Approve G1 (this section) | — |
| G1.2 | Claude Code | Re-check: `origin/main` = `d791923`, and the four latest production deployments are `success` at `d791923`. If anything differs, **stop** and report | Report |
| G1.3 | Claude Code | Create `production` at `d791923` (`git push origin d791923:refs/heads/production`). Nothing tracks it yet, so nothing deploys | GitHub branch list. No new deployment records |
| G1.4 | **You** (Chrome) | **Prompt 1: C7a**, the rulesets for `main` and `production` | The prompt reports the saved settings |
| G1.5 | **You** (Chrome) | **Prompt 2: P1-V**, the Vercel production branch → `production` for all 3 projects | The prompt confirms serving commits before and after |
| G1.6 | Claude Code | Check the deployment records: no new Vercel production deployment, or if there is one, it's `d791923` and `success` | Report |
| G1.7 | **You** (Chrome) | **Prompt 3: P1-R**, the Railway branch → `production` and Wait for CI on (at a quiet time) | The prompt reports any deployment it started |
| G1.8 | Claude Code | Check the deployment records, then run `npm run smoke:instructor` | PASS/FAIL |
| G1.9 | **You**, then Claude Code | Approve merging **#109**; Claude Code merges it. **This deploys nothing**; Claude Code confirms no production deployment records appear | Report |
| G1.10 | **You** (Chrome), then Claude Code | **Prompt 4: C7b**, the required checks on both rulesets. Then you approve the **validation release** of #109's merge commit. Claude Code fast-forwards `production`, watches Railway "Waiting for CI" → deploy and Vercel ×3 build, confirms all four at the new commit, and runs smoke | Wait for CI and the coordination confirmed in practice |

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

These follow the sequence in `03-implementation-tracker.md`. Every release follows the coordination, verification and rollback rules in G1. Under the G1 model:
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

## Execution order: every step, who does it, and its prompt

**Never run two prompts at once.** Paste each prompt's report back to Claude Code before starting the next.

| # | Who | Step | Prompt | When |
|---|---|---|---|---|
| 1 | **You** | Approve G1 | — | Now |
| 2 | Claude Code | Re-verify all four platforms at `d791923`; create `production` | — | After 1 |
| 3 | **You** | **Prompt 1: C7a** (rulesets) | below | After 2 |
| 4 | **You** | **Prompt 2: P1-V** (Vercel ×3) | below | After 3 |
| 5 | Claude Code | Check deployment records | — | After 4 |
| 6 | **You** | **Prompt 3: P1-R** (Railway), at a quiet time | below | After 5 |
| 7 | Claude Code | Check deployment records, smoke test | — | After 6 |
| 8 | **You**, then Claude Code | Approve, then merge #109 (deploys nothing) | — | After 7 |
| 9 | **You** | **Prompt 4: C7b** (required checks) | below | After 8 |
| 10 | **You**, then Claude Code | Approve the validation release of #109; Claude Code releases and verifies | — | After 9 |
| 11 | **You** | **Prompt 5: C5** (Vercel secret clean-up) | `06-chrome-prompts.md` § C5 | Any time after 10 |
| 12 | **You**, then Claude Code | Merges and releases, one approval each, in the tracker's sequence: #106/#112 → #111 → #113 + #118 → #116 (after the Stripe prefix check) → #117 | — | After 10 |
| 13 | **You** | **Prompt 6: C1b** (A12 variables plus turning off the build override) | `06-chrome-prompts.md` § C1b | Just before #108 |
| 14 | **You**, then Claude Code | #108 → #110 → #107 → #79 → #114/#115/M1 (merges and releases) | — | After 13 |
| 15 | **You** | Approve G4 staging (≈ $10–15/month) | — | When you want hosted review |
| 16 | **You** | **Prompt 7: C2** (Supabase staging). You type the DB password | `06-chrome-prompts.md` § C2 | After 15 |
| 17 | **You** | Create `~/.config/clearpass/staging-db.env` | setup guide §1 | After 16 |
| 18 | Claude Code | Schema, migrations and seed on staging only | — | After 17 |
| 19 | **You** | **Prompt 8: R3** (Railway staging). You paste the secrets | below | After 18 |
| 20 | **You** | Prompts S1 (Stripe test mode), RC1 (RevenueCat staging), V1 (Preview/EAS variables). Claude Code writes them when 19 is done | — | After 19 |

## Prompts

### Prompt 1 — C7a: rulesets for `main` and `production` (G1.4; after Claude Code has created `production`)

```text
You are adding two branch rulesets to my GitHub repository ZenFinanceHub/clearpass-app. I am signed in to GitHub in this Chrome. I am the only person who works on this repository.

SAFETY: Create exactly the two rulesets below. Don't change any other setting, ruleset, secret, collaborator, webhook or Actions setting. If a page asks you to confirm anything else, cancel it.

Before you start: open https://github.com/ZenFinanceHub/clearpass-app/branches and confirm a branch named "production" exists. Report its latest commit's short hash. If it doesn't exist, STOP.

Ruleset 1. Open https://github.com/ZenFinanceHub/clearpass-app/settings/rules → New ruleset → New branch ruleset.
- Ruleset name: main protection
- Enforcement status: Active
- Bypass list: leave EMPTY
- Target branches: Add target → Include default branch (main)
- Branch rules (tick ONLY these):
  [x] Restrict deletions
  [x] Block force pushes
  [x] Require a pull request before merging, with:
        Required approvals: 0
        Dismiss stale pull request approvals when new commits are pushed: OFF
        Require review from Code Owners: OFF
        Require approval of the most recent reviewable push: OFF
        Require conversation resolution before merging: OFF
        Allowed merge methods: leave the default
  (Leave "Require status checks to pass" unticked for now; it's added later.)
- Click Create.

Ruleset 2. Click New ruleset → New branch ruleset.
- Ruleset name: production protection
- Enforcement status: Active
- Bypass list: Add bypass → choose the role "Repository admin" → set it to "Always allow" (not "For pull requests only").
- Target branches: Add target → Include by pattern → type: production
- Branch rules (tick ONLY these):
  [x] Restrict updates   (only bypass actors, i.e. repository admins, may push to production)
  [x] Restrict deletions
  [x] Block force pushes
  (Do NOT tick "Require a pull request before merging". Releases are fast-forward pushes of commits already merged to main.)
- Click Create.

Re-open both rulesets and report every setting exactly as saved: name, enforcement, bypass list with mode, target, each rule and its options. Confirm nothing else was changed.
```

### Prompt 2 — P1-V: Vercel production branch → `production` (G1.5)

```text
You are changing which Git branch deploys to production for three Vercel projects of my app ClearPass. I am signed in to Vercel in this Chrome. Team: https://vercel.com/zenfinancehubs-projects

SAFETY: Change ONLY the production branch setting. Do not redeploy, promote, roll back, delete or cancel any deployment. Don't change environment variables, domains, the Ignored Build Step or anything else. Never reveal or report any variable value. If a page asks you to confirm anything not listed here, cancel it.

The expected commit is d791923. Everything below is checked against it.

Do the following for EACH project in turn: clearpass-app, then clearpass-instructor-web, then clearpass-web.

A. Before changing anything:
   1. Open https://vercel.com/zenfinancehubs-projects/<project>/deployments
   2. Find the deployment marked "Current" (the one serving the Production domain). Report its short commit hash, branch, status and created time.
   3. If its commit is NOT d791923, or it isn't "Ready", or the project shows an active "Instant Rollback" banner, STOP for this project and report. Don't change it.
   4. Note the time.
B. Change the production branch:
   1. Open https://vercel.com/zenfinancehubs-projects/<project>/settings/environments (or Settings → Git if there is no Environments page).
   2. Production → Branch Tracking (or "Production Branch"): change "main" to "production". Save.
   3. Don't change "Ignored Build Step" (it should still say "Only build production"). Report its value.
C. After the change:
   1. Wait one minute. Reload the Deployments page.
   2. Report whether ANY new deployment appeared after the time you noted in A4. If one did, report its commit, branch, environment and status, and wait until it finishes (Ready or Error) before continuing.
   3. Confirm the "Current" production deployment is still commit d791923.

REPORT, per project:
| Project | Serving commit before | Production branch before → after | Ignored Build Step | New deployment after change? (commit/status) | Serving commit after |
Then: "No deployments were triggered manually, and only the production branch setting was changed."
```

### Prompt 3 — P1-R: Railway branch → `production`, Wait for CI on (G1.7; at a quiet time)

```text
You are changing which Git branch Railway deploys from, for my app ClearPass's server, and turning on "Wait for CI". I am signed in to Railway in this Chrome.

SAFETY: Change ONLY the two settings below. Do not manually deploy, redeploy, restart, roll back, delete or pause anything. Don't change variables, domains, region, replicas, root directory or start command. Never reveal or report any variable value. If a page asks you to confirm anything not listed here, cancel it.

The expected commit is d791923.

A. Before changing anything:
   1. https://railway.com/dashboard → ClearPass project → production environment → clearpass-app service → Deployments.
   2. Report the ACTIVE deployment's short commit hash, branch, status and time.
   3. If it isn't d791923, or it isn't Active/Success, STOP and report. Don't change anything.
   4. Note the time.
B. Settings (same service):
   1. Source → the branch production deploys from: change "main" to "production". Save if needed.
   2. Turn "Wait for CI" ON. Save if needed.
   3. Leave automatic deployments ON. They will now trigger only when the "production" branch moves.
   4. Report the before/after values of the branch, automatic deployments and Wait for CI.
C. After the change:
   1. Go to Deployments. Wait two minutes, then reload.
   2. Report whether a NEW deployment started after the time in A4: its commit, branch, status, and whether it shows "Waiting for CI" or similar.
   3. If one started, wait until it is Active (or Failed/Crashed), then report the final status and which deployment is now ACTIVE. Do NOT click Redeploy or Rollback yourself. If something failed, just report it.

REPORT:
| Item | Before | After |
| Branch | | |
| Automatic deploys | | |
| Wait for CI | | |
| Active deployment commit | | |
New deployment triggered by the change: yes/no (commit, status).
Then: "Only the branch and Wait for CI settings were changed, and nothing was deployed manually."
```

### Prompt 4 — C7b: required CI checks on `main` and `production` (G1.10; right after #109 merges)

```text
In my GitHub repository ZenFinanceHub/clearpass-app, edit TWO existing rulesets. I am signed in to GitHub in this Chrome.

SAFETY: Edit only the rulesets named "main protection" and "production protection", and only as described. Change nothing else.

For EACH of the two rulesets:
1. Open https://github.com/ZenFinanceHub/clearpass-app/settings/rules and open the ruleset.
2. Tick "Require status checks to pass". Leave "Require branches to be up to date before merging" OFF.
3. Add these 7 checks, choosing each from the "GitHub Actions" suggestions (type the name, then pick it):
     Typecheck (apps/mobile)
     Typecheck (apps/instructor-web)
     Unit tests (packages/core, packages/content)
     Unit tests (apps/mobile/server)
     Unit tests (apps/mobile scripts)
     Unit tests (apps/instructor-web)
     E2E (Playwright, stubbed backend)
   Do NOT add "Native fingerprint (informational)" or any "Vercel" check.
4. Save. Re-open it, and report the full saved settings (all rules, not only the new one) and the bypass list.

Report both rulesets as saved, and confirm nothing else changed.
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
