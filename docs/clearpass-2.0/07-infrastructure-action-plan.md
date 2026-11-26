# ClearPass 2.0 — Infrastructure Action Plan (ordered, with approval gates)

For Craig. Last updated 2026-11-26 (rev 3: P1 model approved, with safeguards and a technical release-approval gate, PR #119). This consolidates every remaining infrastructure step into one sequence.

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
- **A release** fast-forwards `production` to a commit already merged to `main` and green in CI. It's done **only by the Release workflow (#119), after you approve it in GitHub**. Claude Code can't move `production` itself.
- **Merging to `main`:** once G1 is complete, Claude Code can merge PRs that pass CI without asking you, which was your stated objective. Until you confirm you're happy to switch, it keeps asking before each merge.
### The technical release-approval gate (PR #119)

**Problem:** Claude Code currently uses your own GitHub login, which is the repository owner and admin. Any approval or ruleset you can pass, that login can pass, so the gate would only be procedural.

**Fix (no cost):** separate identities, plus a GitHub Environment approval.

| Identity | Who uses it | Can do | Cannot do |
|---|---|---|---|
| **Your owner account** (`ZenFinanceHub`) | You, in the browser and the GitHub mobile app | Everything; **the only approver** of production releases | — |
| **Machine user** (e.g. `clearpass-bot`; free; GitHub allows one per person) with **Write** access | Claude Code's CLI on this machine, only | Branches, PRs, merging to `main` when CI passes, triggering the Release workflow | Approve a release; read the release key; push `production`; edit rulesets, environments or secrets; change `.github/` without your review |
| **Release deploy key** (SSH, write) | Only the approved `push` job of `release.yml` | Fast-forward `production` (or roll it back) | Nothing outside that job. It's stored as a secret of the `production-release` environment, which releases it only after your approval, and only to runs from `main` |

**How a release works:**
1. Claude Code runs the **Release to production** workflow with the commit, mode (release or rollback) and a one-line reason.
2. The **verify** job checks that the commit is on `main`, is a fast-forward, and has all 7 required CI checks green. It writes a summary for you: the commits, and which areas are touched (server, learner web, instructor site, marketing site, database files).
3. GitHub emails and notifies you: *"Release to production is waiting for your review."*
4. You open it in the browser or the GitHub mobile app, read the summary, and click **Approve and deploy**, or Reject.
5. The **push** job fast-forwards `production`. Vercel ×3 build. Railway waits for the CI run on that push, then deploys.
6. The **monitor** job confirms that all four platforms report `success` at the new commit. Claude Code then runs the smoke test.

**Your overhead:** one approval click per release. **Merging to `main` needs nothing from you**, apart from PRs that change `.github/` (CI or the release workflow itself), which need your review as code owner.

**Rollback:**
- **Normal:** run the same workflow with `mode: rollback` and the previous `production` commit. It only accepts an earlier commit that was actually deployed to production. After one approval, all four platforms redeploy that commit.
- **Emergency** (seconds, no GitHub): Vercel Instant Rollback and Railway Redeploy previous. Then align `production` with a rollback release.

**Staging needs no approval:** Railway's staging environment deploys from `main`. The staging web build is a Vercel Preview of `main` (set up in V1). Both update on every merge.

**Protection settings** (Prompt 1 now; Prompt 4 adds CI checks after #109):

| | `main` | `production` |
|---|---|---|
| Deletion | Blocked | Blocked |
| Force push | Blocked | Blocked (except the release key's rollback) |
| How it changes | Pull requests only. **0 required approvals.** Code Owner review is required **only for files under `.github/`**. "Approval of the most recent push" is ON, so the bot can't change a workflow after you've approved it | **"Restrict updates"**: only bypass actors can update it |
| Required checks (Prompt 4) | 7 checks | 7 checks |
| Bypass | Repository admin, **for pull requests only** (lets you merge your own `.github` PRs in an emergency) | **Deploy keys: always** (the release key). **Repository admin: always** (your emergency override) |

**Remaining risks, and how they're covered:**
- **Your admin credentials must not be on this machine's CLI.** Step G1.12 logs the CLI out of your owner account and in as the bot. If you later need the CLI as yourself, log in, then log out again afterwards. Optionally, Claude Code's permission settings can also block `gh auth login`/`switch` commands. That's one settings change; ask if you want it.
- **Claude in Chrome acts in your signed-in browser.** Claude Code will never use browser tools on GitHub approval pages. You can also stop the extension acting on github.com (its site-access setting) except when you're running a prompt.
- **The bot can merge non-`.github` code to `main` without you.** That's intended, for development and staging, and it can't reach production without your approval.
- **If the release key leaked,** it could move `production`. It exists only as an environment secret released after approval. Re-running the setup script rotates it.

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
| G1.1 | **You** | Approve G1 | — |
| G1.2 | Claude Code | Re-check: `origin/main` = `d791923`, and all four latest production deployments are `success` at `d791923`. **Stop** if anything differs | Report |
| G1.3 | Claude Code | Create `production` at `d791923`. Nothing tracks it yet | Branch list; no new deployment records |
| G1.4 | **You** (Chrome) | **Prompt 1: rulesets** | The prompt reports the saved settings |
| G1.5 | **You** (Chrome) | **Prompt 2: Vercel ×3** production branch → `production` | Serving commits before and after |
| G1.6 | Claude Code | Check the deployment records | Report |
| G1.7 | **You** (Chrome) | **Prompt 3: Railway** branch → `production` and Wait for CI on (at a quiet time) | Any deployment it triggered |
| G1.8 | Claude Code | Check the deployment records; run `npm run smoke:instructor` | PASS/FAIL |
| G1.9 | **You**, then Claude Code | Approve merging **#109** (CI) and **#119** (release gate). Claude Code merges them using the admin bypass for `.github` PRs. **Nothing deploys** | No production deployment records |
| G1.10 | **You** (terminal) | Run the one-time gate setup (environment, release key, secret; the key is never shown): `! bash /home/craig/clearpass/.claude/worktrees/release-gate/.github/release/setup-release-gate.sh` | The script prints its checks |
| G1.11 | **You** (Chrome) | **Prompt 4: required checks** on both rulesets, and confirm the environment settings | The prompt reports both |
| G1.12 | **You** (browser, then terminal) | **Prompt 5: create the machine user** and add it as a collaborator. Then switch this machine's CLI: `! gh auth logout --hostname github.com --user ZenFinanceHub`, then `! gh auth login --hostname github.com --git-protocol https --web`, signing in **as the bot** in a private browser window | Claude Code checks `gh api user` = the bot and admin = false |
| G1.13 | Claude Code, then **you** | **Validation release:** Claude Code runs the Release workflow for the #109/#119 merge commit. You approve it in GitHub. It confirms the gate, Wait for CI, and all four platforms at the new commit; Claude Code runs the smoke test | Workflow summary; smoke PASS |

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

**Never run two prompts at once.** Paste each report back to Claude Code before starting the next.

| # | Who | Step | Prompt / command |
|---|---|---|---|
| 1 | **You** | Approve G1, including the release gate | — |
| 2 | Claude Code | Re-verify all four platforms at `d791923`; create `production` | — |
| 3 | **You** | Rulesets | **Prompt 1** |
| 4 | **You** | Vercel ×3 production branch | **Prompt 2** |
| 5 | Claude Code | Check the deployment records | — |
| 6 | **You** | Railway branch and Wait for CI (quiet time) | **Prompt 3** |
| 7 | Claude Code | Check the records; smoke test | — |
| 8 | **You**, then Claude Code | Approve, then merge #109 and #119 (nothing deploys) | — |
| 9 | **You** | One-time gate setup | `! bash /home/craig/clearpass/.claude/worktrees/release-gate/.github/release/setup-release-gate.sh` |
| 10 | **You** | Required checks plus the environment check | **Prompt 4** |
| 11 | **You** | Machine user and the CLI switch | **Prompt 5** plus 2 terminal commands |
| 12 | Claude Code, then **you** | Validation release: Claude Code starts it; you click Approve in GitHub | — |
| 13 | **You** | Vercel secret clean-up (any time after 12) | **Prompt 6:** `06-chrome-prompts.md` § C5 |
| 14 | Claude Code; **you** approve each release | Merges (no approval needed), then releases in the tracker's order: #106/#112 → #111 → #113 + #118 → #116 (after the Stripe prefix check) → #117 | — |
| 15 | **You** | A12 variables plus turning off the build override, just before #108 | **Prompt 7:** `06-chrome-prompts.md` § C1b |
| 16 | Claude Code; **you** approve each release | #108 → #110 → #107 → #79 → #114/#115/M1 | — |
| 17 | **You** | Approve G4 staging (≈ $10–15/month) | — |
| 18 | **You** | Supabase staging (you type the DB password) | **Prompt 8:** `06-chrome-prompts.md` § C2 |
| 19 | **You** | Create `~/.config/clearpass/staging-db.env` | setup guide §1 |
| 20 | Claude Code | Schema, migrations and seed on staging only | — |
| 21 | **You** | Railway staging (you paste the secrets) | **Prompt 9:** R3 below |
| 22 | **You** | Stripe test mode, RevenueCat staging, Vercel Preview / EAS preview (incl. the staging Ignored Build Step) | S1, RC1, V1, written when 21 is done |

## Prompts

### Prompt 1 — Rulesets for `main` and `production` (G1.4; after Claude Code has created `production`)

```text
You are adding two branch rulesets to my GitHub repository ZenFinanceHub/clearpass-app. I am signed in to GitHub in this Chrome as the owner. I am the only person who works on this repository.

SAFETY: Create exactly the two rulesets below. Don't change any other setting, ruleset, secret, environment, collaborator, webhook, deploy key or Actions setting. If a page asks you to confirm anything else, cancel it.

Before you start: open https://github.com/ZenFinanceHub/clearpass-app/branches and confirm a branch named "production" exists. Report its latest commit's short hash. If it doesn't exist, STOP.

Ruleset 1. Open https://github.com/ZenFinanceHub/clearpass-app/settings/rules → New ruleset → New branch ruleset.
- Ruleset name: main protection
- Enforcement status: Active
- Bypass list: Add bypass → role "Repository admin" → set mode to "For pull requests only".
- Target branches: Add target → Include default branch (main)
- Branch rules (tick ONLY these):
  [x] Restrict deletions
  [x] Block force pushes
  [x] Require a pull request before merging, with:
        Required approvals: 0
        Dismiss stale pull request approvals when new commits are pushed: ON
        Require review from Code Owners: ON
        Require approval of the most recent reviewable push: ON
        Require conversation resolution before merging: OFF
        Allowed merge methods: leave the default
  (Leave "Require status checks to pass" unticked for now; it's added later.)
- Click Create.

Ruleset 2. Click New ruleset → New branch ruleset.
- Ruleset name: production protection
- Enforcement status: Active
- Bypass list, two entries, each set to "Always allow":
    1. Role "Repository admin".
    2. "Deploy keys". If the bypass picker offers no "Deploy keys" option, STOP and tell me. Don't substitute anything else.
- Target branches: Add target → Include by pattern → type: production
- Branch rules (tick ONLY these):
  [x] Restrict updates
  [x] Restrict deletions
  [x] Block force pushes
  (Do NOT tick "Require a pull request before merging".)
- Click Create.

Re-open both rulesets and report every setting exactly as saved: name, enforcement, bypass entries with their modes, target, each rule and its options. Confirm nothing else was changed.
```

Note: "Require review from Code Owners" only bites once `.github/CODEOWNERS` (from #119) is on `main`. With 0 required approvals, normal PRs need no review; only PRs touching `.github/` need yours.

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

### Prompt 4 — Required CI checks, plus an environment check (G1.11; after #109 and #119 have merged and you've run the setup script)

```text
In my GitHub repository ZenFinanceHub/clearpass-app, edit TWO existing rulesets and check (read-only) one environment. I am signed in to GitHub in this Chrome as the owner.

SAFETY: Edit only the rulesets named "main protection" and "production protection", and only as described. The environment check is read-only. Change nothing else.

Part A. For EACH of the two rulesets:
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
4. Save. Re-open it and report the full saved settings (all rules and the bypass list).

Part B (read-only). Open https://github.com/ZenFinanceHub/clearpass-app/settings/environments → "production-release". Report:
- Required reviewers (names).
- Whether "Prevent self-review" is on.
- Whether "Allow administrators to bypass configured protection rules" is on (it should be OFF).
- Deployment branches and tags (it should allow only "main").
- Environment secret NAMES (it should list RELEASE_DEPLOY_KEY). Never reveal any value.
Then open https://github.com/ZenFinanceHub/clearpass-app/settings/keys and report the deploy keys by title and whether each has write access. Expect one titled "release-gate" with write access.

Report Parts A and B, and confirm nothing else changed.
```

### Prompt 5 — Machine user for Claude Code (G1.12)

Creating an account involves email verification and a captcha, so **you do steps 1–2 yourself**. Chrome can help with 3–5.

1. In a **private browser window**, sign up at https://github.com/signup for a new account, e.g. `clearpass-bot`.
   - Use an address you control, e.g. a `+bot` alias of your email.
   - Turn on two-factor authentication.
   - GitHub's terms allow one free machine account per person.
2. Stay signed in as the bot in that private window.

```text
You are giving a machine-user account limited access to my repository. In this normal Chrome window I am signed in to GitHub as the OWNER (ZenFinanceHub).

SAFETY: Only send the one invitation described. Don't change any other setting, collaborator, ruleset, environment, secret or key.

1. Open https://github.com/ZenFinanceHub/clearpass-app/settings/access
2. Click "Add people". Enter the machine-user name I give you here: <BOT USERNAME>. Select exactly that account and send the invitation. On a personal repository this gives collaborator (write) access. It must NOT be made an owner or admin.
3. Report: the account invited, the access level shown, and the full list of people with access afterwards.
```

3. In the private window (signed in as the bot), open https://github.com/ZenFinanceHub/clearpass-app/invitations and accept.
4. In the terminal (Claude Code): `! gh auth logout --hostname github.com --user ZenFinanceHub`
5. Then `! gh auth login --hostname github.com --git-protocol https --web`. When the device page opens, complete it **in the private window signed in as the bot**.
6. Tell Claude Code it's done. It checks `gh api user` returns the bot and that the bot has no admin rights. Your normal browser stays signed in as you, for approving releases.

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
