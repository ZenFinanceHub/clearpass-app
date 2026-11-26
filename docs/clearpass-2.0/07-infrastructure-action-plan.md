# ClearPass 2.0 — Infrastructure Action Plan (ordered, with approval gates)

For Craig. Last updated 2026-11-26 (rev 4: technical release gate finalised. GitHub App credential, separate OS user for Claude Code, gate tests, one ordered checklist). This consolidates every remaining infrastructure step into one sequence.

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
### The technical release-approval gate (PR #119), approved in principle

**Goal:** Claude Code develops, tests, merges and updates staging on its own. **Production releases need your approval, enforced by GitHub, not just by instructions.** No recurring cost.

#### The three identities

| Identity | Used by | Can | Can't |
|---|---|---|---|
| **You** (`ZenFinanceHub`, owner) | You: browser, GitHub mobile app, and your own terminal | Everything. **The only approver** of production releases | — |
| **`clearpass-bot`** (machine user, Write access) | Claude Code only, running as a **separate Linux user** (`claude-dev`) | Branches, PRs, merging to `main` when CI passes, triggering the Release workflow, staging deploys (staging follows `main`) | Approve a release; push `production` or `release-gate-test`; push to `main` without a PR; merge `.github/` changes without your review; read or change environments, secrets, rulesets, keys or collaborators |
| **`clearpass-release`** GitHub App (owned by you, installed on this repo only) | Only the approved `push` job of `release.yml` | Fast-forward (or, for rollback, reset) `production` | Anything else. Its token is minted after your approval, lives at most 1 hour, has contents and workflows permissions on this one repository only, and is revoked when the job ends |

#### How each of your 10 requirements is met

| # | Requirement | How it's met |
|---|---|---|
| 1 | `clearpass-bot` | The name is **free right now** (GitHub API: no such user, 2026-11-26). You create it in step 12; if it's taken by then, use `clearpass-ci-bot` |
| 2 | No extra cost | Confirmed from GitHub's docs for a **public** repo on **Free**:<br>• environments, environment secrets and required reviewers are available ("only available for public repositories" on Free);<br>• Actions minutes on standard runners are free for public repos;<br>• GitHub's terms allow "no more than one free machine account";<br>• GitHub Apps cost nothing.<br>**Rulesets:** the docs page didn't state Free availability, but this repo's rulesets API responds (0 rulesets today), so they're available. Two settings the docs didn't fully confirm are **checked live by the prompts and the gate test**: "Restrict updates" with an App as bypass actor, and Code Owner review with 0 approvals |
| 3 | The bot can't change CI, the release workflow, security rules or gate files | Everything under `/.github/` (CI, `release.yml`, `CODEOWNERS`, the gate scripts) needs **your Code Owner review**, and "approval of the most recent push" stops the bot changing anything after you approve. Rulesets, environments, secrets, Apps and keys are owner-only settings (the bot isn't admin). The environment only accepts runs from `main`, so a workflow edited on another branch can't reach the credential (tested in G9) |
| 4 | The bot can't reach your admin credentials | **Claude Code moves to a separate Linux user, `claude-dev`.** Your home folder is already private (permissions 750), so `claude-dev` can't read your `gh` login, keyring, `~/.config/clearpass/db.env`, Expo session or shell variables. That user gets its own clone, its own **rootless** Docker (the normal `docker` group would give root-equivalent access to your files) and only the bot's GitHub login. **Your own terminal keeps your admin login**, because Claude Code no longer runs as you. Gate test G3 checks it |
| 5 | Narrowest release credential | A GitHub App installed on **this repository only**, permissions **Contents: write + Workflows: write**. Workflows: write is required, because GitHub refuses pushes containing workflow-file changes without it. Its key exists only as a secret of `production-release`, released only to the approved job. The token lasts at most 1 hour and is revoked at job end. It can't push `main` (no PR) |
| 6 | Approval tied to the exact commit | The release takes a full 40-character SHA, never a branch name. The approval screen shows **"the exact commit you are approving"**, the commit list and the workflow version. **Before the credential is created**, the approved job re-checks that `production` hasn't moved since you looked, that the SHA is still on `main`, and that all 7 CI checks are green. Re-running a run can't change its inputs |
| 7 | Proven, not assumed | `.github/release/verify-gate.sh` runs **as the bot** and must show PASS for:<br>• **G1–G3:** the bot's identity and rights; no owner credentials reachable;<br>• **G4–G5:** pushing, force-pushing and deleting a production-protected branch;<br>• **G6:** a direct push to `main`;<br>• **G7:** reading or changing the environment, rulesets, keys or collaborators;<br>• **G8:** **approving its own release**;<br>• **G9:** **a modified workflow on another branch reaching the key**;<br>• **G10:** merging a `CODEOWNERS` change alone.<br>Then a **positive test**: you approve a `mode: test` run, and only `release-gate-test` moves. Nothing in the test touches `production` |
| 8 | Safe emergency rollback | See "Emergency rollback" below: platform one-click rollback in seconds (no GitHub needed), then realign `production` with an approved rollback release |
| 9 | No credential exposure in the public repo | • The only secret is the App key, stored in an environment restricted to `main`. PR and fork workflows can't receive it (GitHub doesn't pass secrets to fork-triggered runs, and the branch policy blocks same-repo branches).<br>• Fork PR workflows already need approval (C1). There's no `pull_request_target`, and **a release is refused if any workflow adds one, or if any workflow other than `release.yml` references secrets**.<br>• The token is masked; inputs reach the shell only through environment variables (no script injection); third-party code is limited to two official GitHub actions, pinned by commit SHA.<br>• CI uses no secrets. Default token permission is read |
| 10 | One checklist | "Your setup checklist" below |

#### Protection settings (Prompts 1 and 5)

| | `main` | `production` and `release-gate-test` |
|---|---|---|
| Deletion | Blocked | Blocked |
| Force push | Blocked | Blocked, except the App's rollback |
| How it changes | Pull requests only. **0 required approvals.** Code Owner review is required **only for `/.github/`**. "Approval of the most recent push" is ON | **Restrict updates:** only bypass actors |
| Required checks | The 7 CI checks | The 7 CI checks |
| Bypass | Repository admin, **pull requests only** (your emergency merge of a `.github` PR) | **`clearpass-release` App: always.** **Repository admin: always** (your emergency override) |

#### Other production paths (outside GitHub), closed by the separate user
On your user account this machine also holds:
- an Expo/EAS session, which can publish OTA updates to every app user;
- `~/.config/clearpass/db.env`, which gives write access to the production database;
- a `CLOUDFLARE_API_TOKEN` in the environment.

**None of these exist for `claude-dev`**, so Claude Code can't reach production through them either. Two production actions that Claude Code used to run itself then need a home:
- **OTA updates:** recommended, a small `ota-production.yml` workflow behind the **same** approval, with the Expo token as an environment secret. Until then, OTAs are run from your user (they already need your approval, A10).
- **Production migrations:** recommended, a `migrate-production.yml` behind the same approval, applying only migrations already merged to `main`. Until then, from your user. None are queued.

These two are prepared as one follow-up PR **if you want them**. They aren't needed to start safe autonomous development.

#### Emergency rollback (seconds, no GitHub needed)
1. **Vercel**, per affected project: Deployments → the previous Production deployment → **⋯ → Instant Rollback**.
2. **Railway:** clearpass-app → Deployments → the previous successful deployment → **⋯ → Redeploy**.
3. Tell Claude Code. It starts the **Release workflow with `mode: rollback`**, targeting that same previous commit, and you approve. `production` then matches what's serving.
4. **Then click "Undo Rollback"** on each Vercel project you rolled back. Until you do, Vercel won't auto-promote later deployments.
5. **Database:** no action. Migrations are additive and separate, so older code keeps working (G1 rollback rules).
6. **Data written by the new code** (e.g. #113/#118 grants): Claude Code follows that PR's documented check before any revert.

Prompt E1 below walks Claude in Chrome through steps 1–2, confirming each click with you, if you'd rather not click through yourself.

**Normal (non-emergency) rollback:** step 3 alone. One approval, and all four platforms redeploy the earlier commit.

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

### G1 steps
See **"Your setup checklist"** below, which is the single ordered list.

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

## Your setup checklist (one ordered list)

**Rules:**
- Do one step at a time, and paste each report back to Claude Code.
- "You" steps are yours; "Claude" steps are done by Claude Code. Nothing before step 19 changes what's served in production.
- Estimated time for you: about **60–75 minutes** in total, spread over the steps.

### Part A — Release control (production unchanged)
| # | Who | Step | How |
|---|---|---|---|
| 1 | You | Give the go-ahead for Part A | Message |
| 2 | Claude | ✅ 2026-11-26 10:48 UTC: preflight passed; `production` created at `d791923`; no deployments triggered | — |
| 3 | You | ✅ 2026-11-26: rulesets created. Verified via API: main (PR, 0 approvals, Code Owner review, last-push approval, stale dismissal; admin bypass for PRs only) and production + release-gate-test (update, deletion and force-push restricted; admin bypass always). GitHub's default Copilot-PR approval setting was left on | **Prompt 1** |
| 4 | You | Vercel production branch → `production` (3 projects) | **Prompt 2** |
| 5 | Claude | Check the deployment records | — |
| 6 | You | Railway branch → `production`, Wait for CI on (quiet time) | **Prompt 3** |
| 7 | Claude | Check the deployment records; smoke test | — |

### Part B — Release gate
| # | Who | Step | How |
|---|---|---|---|
| 8 | You | Approve merging #109 (CI) and #119 (release gate). Claude merges them via the admin bypass for `.github` PRs; nothing deploys | Message |
| 9 | You | Create the `clearpass-release` GitHub App and install it on this repo only; download its private key | **Prompt 4** |
| 10 | You (terminal) | One-time setup: environment, App credentials and the test branch. The key goes from the file into GitHub, is never shown, and the file is deleted | Claude Code gives you the exact `! bash .github/release/setup-release-gate.sh <CLIENT_ID> <key-file>` line |
| 11 | You | Add the App as a bypass actor on `production`, add the 7 required checks, and confirm the environment | **Prompt 5** |

### Part C — Claude Code's own identity and user
| # | Who | Step | How |
|---|---|---|---|
| 12 | You | Create the `clearpass-bot` account (private window; 2FA on) | Manual: https://github.com/signup |
| 13 | You | Invite the bot as collaborator; accept as the bot | **Prompt 6**, plus one click in the private window |
| 14 | You (terminal) | Create the `claude-dev` Linux user with rootless Docker, its toolchain and a clone | "Separate user setup" below. Claude Code provides it as one script to read, then run |
| 15 | You (terminal, as `claude-dev`) | Log `claude-dev`'s GitHub CLI in **as the bot** (private window), and log `claude-dev`'s Claude Code in to your Claude account | `gh auth login --web`, then `claude` → `/login` |
| 16 | Claude (as `claude-dev`) | Run the gate tests | `bash .github/release/verify-gate.sh`. All PASS. Ignore the approval email for "gate self-approval probe"; the script cancels it |
| 17 | Claude, then you | **Positive test:** Claude starts a `mode: test` release; you approve it in GitHub; only `release-gate-test` moves | GitHub email or mobile app |

### Part D — First real release and normal running
| # | Who | Step | How |
|---|---|---|---|
| 18 | You | Confirm switching to autonomous merges (Claude merges CI-green PRs to `main` without asking) | Message |
| 19 | Claude, then you | **Validation release** of the #109/#119 merge commit: you approve; Railway waits for CI; all four platforms reach `success`; smoke PASS | GitHub approval |
| 20 | You | Vercel secret clean-up (any time) | **Prompt 7:** `06-chrome-prompts.md` § C5 |
| 21 | Claude, then you | Releases in the tracker's order, **one approval each**: #106/#112 → #111 → #113 + #118 → #116 (after the Stripe key-prefix check) → #117 | GitHub approval |
| 22 | You | Just before the #108 release: the A12 variables plus turning off the build override | **Prompt 8:** `06-chrome-prompts.md` § C1b |
| 23 | Claude, then you | #108 → #110 → #107 → #79 → #114/#115/#120 (one approval each) | GitHub approval |
| 24 | You | When you want hosted staging (≈ $10–15/month): approve it, then run C2 and R3 (Prompts 9–10). S1, RC1 and V1 follow | Message, then prompts |

### Separate user setup (step 14; Claude Code provides it as one script to read before running)
```bash
sudo apt-get install -y uidmap                          # needed for rootless Docker
sudo adduser --disabled-password --gecos "" claude-dev  # no password login; you switch with sudo
sudo loginctl enable-linger claude-dev                  # lets its rootless Docker run
sudo -iu claude-dev bash -lc 'dockerd-rootless-setuptool.sh install'
sudo -iu claude-dev bash -lc 'curl -fsSL https://mise.run | sh && ~/.local/bin/mise use -g node@22'
sudo -iu claude-dev bash -lc 'curl -fsSL https://claude.ai/install.sh | bash'
sudo -iu claude-dev bash -lc 'git clone https://github.com/ZenFinanceHub/clearpass-app.git ~/clearpass'
# Then:  sudo -iu claude-dev   →   cd ~/clearpass && claude
```
- `claude-dev` is **not** added to `sudo` or `docker`.
- `gh` must be installed system-wide; Claude Code checks this before giving you the final script.
- **Afterwards you start Claude Code as `claude-dev`; your own account stays as it is.**
- Claude Code copies over its project memory notes (no credentials) and re-seeds the local Docker database (synthetic data only).

## Prompts

### Prompt 1 — Rulesets for `main` and `production` (step 3)

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
- Bypass list: Add bypass → role "Repository admin" → "Always allow". (The release App is added later, in Prompt 5, once it exists.)
- Target branches: Add target → Include by pattern → type: production. Then Add target → Include by pattern → type: release-gate-test.
- Branch rules (tick ONLY these):
  [x] Restrict updates
  [x] Restrict deletions
  [x] Block force pushes
  (Do NOT tick "Require a pull request before merging".)
- Click Create.

Re-open both rulesets and report every setting exactly as saved: name, enforcement, bypass entries with their modes, target, each rule and its options. Confirm nothing else was changed.
```

Note: "Require review from Code Owners" only bites once `.github/CODEOWNERS` (from #119) is on `main`. With 0 required approvals, normal PRs need no review; only PRs touching `.github/` need yours.

### Prompt 2 — Vercel production branch → `production` (step 4)

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

### Prompt 3 — Railway branch → `production`, Wait for CI on (step 6; at a quiet time)

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

### Prompt 4 — Create the `clearpass-release` GitHub App (step 9)

```text
You are creating a private GitHub App owned by my personal account and installing it on ONE repository. I am signed in to GitHub in this Chrome as the owner (ZenFinanceHub).

SAFETY:
- Create exactly one App, with exactly the permissions listed. Grant nothing else.
- Install it ONLY on the repository ZenFinanceHub/clearpass-app ("Only select repositories"). Never on all repositories.
- Do not change any other setting, App, OAuth app, repository, ruleset, secret or collaborator.
- The private key download is a file. Never open it, read it, copy its contents, or paste it anywhere.

1. Open https://github.com/settings/apps/new
2. Fill in:
   - GitHub App name: clearpass-release   (if taken, use clearpass-release-gate and tell me)
   - Homepage URL: https://github.com/ZenFinanceHub/clearpass-app
   - Callback URL: leave empty. Leave "Request user authorization (OAuth) during installation" UNticked. Leave "Enable Device Flow" UNticked.
   - Setup URL: empty. Webhook: UNtick "Active" (no webhook).
   - Repository permissions: set ONLY these two; leave every other permission at "No access":
       Contents: Read and write
       Workflows: Read and write
     ("Metadata: Read-only" is added automatically. That's expected.)
   - Organization permissions: none. Account permissions: none.
   - Subscribe to events: none.
   - "Where can this GitHub App be installed?": Only on this account.
3. Click "Create GitHub App".
4. On the App's settings page, report: the App name, the App ID and the Client ID (starts with "Iv"). These are not secrets.
5. Scroll to "Private keys" → "Generate a private key". A .pem file downloads. Report ONLY the downloaded file's name. Do not open it.
6. Left menu → "Install App" → Install on my account (ZenFinanceHub) → "Only select repositories" → select ONLY clearpass-app → Install.
7. Report the installation's repository access and the permissions shown on the installation page.

Final report: App name, App ID, Client ID, the private key file name (not its contents), the installed repositories, the permissions. And: "No other settings were changed and the key file was not opened."
```

### Prompt 5 — App bypass, required checks and environment confirmation (step 11)

```text
In my GitHub repository ZenFinanceHub/clearpass-app, update two existing rulesets and check one environment. I am signed in as the owner in this Chrome.

SAFETY: Edit only the rulesets "main protection" and "production protection", exactly as described. The environment and App checks are read-only. Change nothing else.

Part A. Open https://github.com/ZenFinanceHub/clearpass-app/settings/rules → "production protection".
1. Bypass list → Add bypass → choose the GitHub App "clearpass-release" (or the name I give you) → "Always allow". Keep the existing "Repository admin – Always allow" entry. If an App can't be added, STOP and report what the picker offers.
2. Confirm the targets include BOTH "production" and "release-gate-test".
3. Tick "Require status checks to pass" (leave "Require branches to be up to date" OFF) and add these 7 checks from the GitHub Actions suggestions:
     Typecheck (apps/mobile)
     Typecheck (apps/instructor-web)
     Unit tests (packages/core, packages/content)
     Unit tests (apps/mobile/server)
     Unit tests (apps/mobile scripts)
     Unit tests (apps/instructor-web)
     E2E (Playwright, stubbed backend)
   (Not "Native fingerprint (informational)" or any Vercel check.)
4. Save.

Part B. "main protection": add the same 7 required checks the same way ("up to date" OFF). Don't change its bypass list. Save.

Part C (read-only). https://github.com/ZenFinanceHub/clearpass-app/settings/environments → production-release. Report:
- required reviewers;
- "Prevent self-review" (on/off);
- "Allow administrators to bypass configured protection rules" (should be OFF);
- deployment branches (should be only "main");
- environment secret NAMES (expect RELEASE_APP_PRIVATE_KEY);
- environment variable names and values (expect RELEASE_APP_CLIENT_ID; its value is not secret).
Never reveal secret values.

Part D (read-only). https://github.com/settings/installations → clearpass-release → Configure: report the repository access and permissions.

Report all four parts with every saved setting, and confirm nothing else changed.
```

### Prompt 6 — Invite the machine user (step 13)

**First, yourself:** in a **private window**, create the account at https://github.com/signup. Use the name `clearpass-bot` (or `clearpass-ci-bot` if taken), an email you control (e.g. a `+bot` alias), and turn on **two-factor authentication**. Stay signed in there.

**Then, in your normal Chrome (signed in as you):**
```text
You are giving a machine-user account collaborator access to my repository. In this Chrome I am signed in to GitHub as the OWNER (ZenFinanceHub).

SAFETY: Send only the one invitation described. Don't change any other setting, collaborator, ruleset, environment, secret, App or key.

1. Open https://github.com/ZenFinanceHub/clearpass-app/settings/access
2. Click "Add people". Enter exactly: <BOT USERNAME>. Select exactly that account and send the invitation. On a personal repository this grants collaborator (write) access, which is correct. It must not be an owner.
3. Report: the account invited, the access level shown, and the full list of people with access afterwards.
```
**Then:** in the private window, as the bot, open https://github.com/ZenFinanceHub/clearpass-app/invitations and click **Accept**.

### Prompt E1 — Emergency rollback assistant (only when needed)

```text
EMERGENCY ROLLBACK for my app ClearPass. I am signed in to Vercel and Railway in this Chrome. I will tell you which platforms to roll back and the commit to go back to: <COMMIT> (short hash).

SAFETY: Roll back ONLY the projects I name. Don't change settings, variables, domains or branches. Don't delete anything. Ask me to confirm before each rollback click.

For each Vercel project I name (clearpass-app / clearpass-instructor-web / clearpass-web):
1. https://vercel.com/zenfinancehubs-projects/<project>/deployments
2. Find the most recent Production deployment at commit <COMMIT> with status Ready. Show me its time and commit, and ask me to confirm.
3. On my confirmation: ⋯ → Instant Rollback → confirm. Wait until the Production domain shows it as Current. Report.
(Do NOT click "Undo Rollback". I'll do that later, once the fixed release is live.)

If I name Railway:
1. https://railway.com/dashboard → ClearPass → production → clearpass-app → Deployments.
2. Find the most recent successful deployment at commit <COMMIT>. Show me its time and commit, and ask me to confirm.
3. On my confirmation: ⋯ → Redeploy. Wait until it is Active. Report.

Final report: per platform, the commit now serving and the time.
```

### Prompt 10 — R3: Railway staging environment (run after G4 approval and after C2; Claude Code fills the marked values first)

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
