# ClearPass 2.0 — Prompts for Claude in Chrome

For Craig. Each prompt is self-contained: paste one into Claude in Chrome, let it finish, then paste its report back to Claude Code. They're ordered by when they become safe to run.

**Rules built into every prompt:** no secret values are copied into chat or reports (variable *names* and public URLs only); nothing that costs money is confirmed without your say-so; no production setting is changed except where the prompt says so.

| Prompt | What it does | Safe to run | Cost |
|---|---|---|---|
| **C1** | Read-only check: Vercel env var names, build settings, protection; Supabase organisations and plans; GitHub Actions settings (and applies the three hardening changes); Railway deploy trigger and variable names (an 8-character Stripe key prefix only) | **Now** | $0 |
| **A14** | RevenueCat read-only check of the 3 in-app Pro holders. **Kept outside the repo** (contains user IDs) | Now | $0 |
| ✅ C1 | Done 2026-11-26 (Railway part pending login → R1) | — | — |
| ✅ A14 | Done 2026-11-26 | — | — |
| **C1b** | A12: the two `APP_ENV=production` Production variables, plus **turning off the learner build-command override** | When you approve merging #108 | $0 |
| **C5** | Delete the unused `STRIPE_SECRET_KEY` from clearpass-app; limit `SLACK_WEBHOOK_CLEARPASS` to Production | When approved | $0 |
| **C7** | Branch protection ruleset on `main` (PR plus 7 CI checks, no reviewer) | After #109 merges, when approved | $0 |
| **R1** | Railway read-only check (deploy trigger, variable names, Stripe key prefix) | After you log in to Railway | $0 |
| **C2** | Creates `clearpass-staging` in the **Clear Pass** organisation (Pro) | When you approve the cost | **~$10/month** |
| C3 | Railway staging environment and Vercel/EAS Preview variables | After C2 and the staging schema is applied (Claude Code does that from the credentials file) | ~$1–5/month |
| C4 | Stripe sandbox products and webhooks, RevenueCat staging project | After C3 (webhooks need the staging Railway URL) | $0 |

C3 and C4 are written when their prerequisites exist, because they need values that don't exist yet.

---

## C1 — Infrastructure and security check (safe now; rev 2 adds read-only Railway checks for the server deploys)

```text
You are helping me audit the infrastructure of my app, ClearPass. Work in my already-signed-in Chrome. Open each site in a new tab.

=== SAFETY RULES (apply to every step) ===
- READ-ONLY everywhere, with ONE exception: the three GitHub Actions settings in Part 3, step 3.3. Change nothing else.
- Do not create, delete, redeploy, promote, roll back, pause or restart anything. Do not start a paid plan, trial or upgrade. Do not invite or remove anyone.
- NEVER copy, type, read aloud or report the VALUE of any environment variable, API key, token, password, connection string or secret. Report variable NAMES only. If a value is visible on screen, ignore it. Do not click "reveal", "show" or "copy" on any secret.
- The only exception to the "no values" rule is Part 4, step 4.3: report just the first 8 characters of one Stripe key (e.g. "rk_live_"). Nothing more.
- Do not open the settings of the production Supabase project (reference starting "secavejb"); it is shared with another product.
- If a page asks you to confirm a change that isn't in Part 3 step 3.3, cancel it.
- If something looks wrong or unexpected, stop that part, note it, and continue with the next part.

=== PART 1: VERCEL (https://vercel.com/dashboard) ===
Do this for BOTH projects: "clearpass-app" and "clearpass-instructor-web". Leave "clearpass-web" alone.

1.1 Project → Settings → Environment Variables.
    List every variable NAME with the environments it applies to (Production / Preview / Development).
    Flag any name that does NOT start with EXPO_PUBLIC_ or NEXT_PUBLIC_ and applies to Preview or Development.
    Also say whether EXPO_PUBLIC_APP_ENV (clearpass-app) or NEXT_PUBLIC_APP_ENV (clearpass-instructor-web) exists yet. Don't add it.
1.2 Project → Settings → Build and Deployment (or "General" → "Build & Development Settings"):
    - Framework Preset.
    - Build Command: is the Override toggle ON? If so, copy the command text (commands are not secrets).
    - Output Directory and Install Command, with their override state.
    - Root Directory.
1.3 Project → Settings → Git:
    - Connected repository and Production Branch.
    - Ignored Build Step: confirm it still says "Only build production".
1.4 Project → Settings → Deployment Protection: state the Vercel Authentication setting and which deployments it covers.
1.5 Project → Deployments: confirm there are zero Preview deployments, and give the date of the latest Production deployment.

=== PART 2: SUPABASE (https://supabase.com/dashboard/organizations) ===
2.1 List every organisation I belong to: name, plan (Free / Pro / Team / Enterprise), and its projects (name, region, status). Don't open project settings.
2.2 Say which organisation contains the project whose reference starts "secavejb" (production). Don't open that project.
2.3 For each organisation: how many active (not paused) projects it has, and whether the Free plan's two-active-project limit would allow one more. If the organisation is on Pro, read Organization → Billing → Usage (read-only) and report the compute line items. Report the figures shown, not card details.
2.4 Do NOT create a project.

=== PART 3: GITHUB (repository ZenFinanceHub/clearpass-app) ===
3.1 https://github.com/ZenFinanceHub/clearpass-app/settings/actions
    Report the current value of:
    - "Actions permissions"
    - "Fork pull request workflows from outside collaborators"
    - "Workflow permissions"
    - "Allow GitHub Actions to create and approve pull requests"
3.2 https://github.com/ZenFinanceHub/clearpass-app/settings/branches and https://github.com/ZenFinanceHub/clearpass-app/settings/rules
    Report any branch protection rules or rulesets that apply to "main". Do not add or edit any.
3.3 THE ONLY CHANGES ALLOWED in this whole task, all on https://github.com/ZenFinanceHub/clearpass-app/settings/actions:
    a. "Fork pull request workflows from outside collaborators" → choose the strictest approval option ("Require approval for all external contributors" or the closest wording).
    b. "Workflow permissions" → "Read repository contents and packages permissions" (read-only).
    c. "Allow GitHub Actions to create and approve pull requests" → unchecked.
    Click Save for each section that has its own Save button. Reload the page and confirm the saved values.
3.4 https://github.com/ZenFinanceHub/clearpass-app/settings/secrets/actions: list secret NAMES only (repository and environment secrets), if any.

=== PART 4: RAILWAY (https://railway.com/dashboard), read-only, needed before the server deploys ===
4.1 Open the ClearPass project. List its environments, and its services (names only).
4.2 For the production server service → Settings:
    - The source (GitHub repo and branch).
    - Whether automatic deploys on push are enabled, and for which branch.
    - Any "Wait for CI" or check-suite setting.
4.3 Same service → Variables. Report:
    - Whether CRON_SECRET exists (name only, yes/no).
    - Whether STRIPE_SECRET_KEY exists. If it does, report ONLY its first 8 characters (e.g. "rk_live_" or "sk_live_"). Do not report anything beyond the 8th character.
    - Whether any of these exist (names only, yes/no): REVENUECAT_PROJECT_ID, REVENUECAT_PRO_ENTITLEMENT_ID, CLEARPASS_SERVER_ENV, REVENUECAT_WEBHOOK_SECRET, REVENUECAT_SECRET_API_KEY.
    - If CLEARPASS_SERVER_ENV exists, its value (it is not a secret: one of local / staging / production).
    - The full list of variable NAMES.
4.4 Do not edit, add or delete variables, and do not redeploy.

=== REPORT FORMAT ===
Reply with exactly these sections:

## Vercel
### clearpass-app
- Env vars: table | Name | Production | Preview | Development | Flag |
- Build settings: …
- Git / Ignored Build Step: …
- Deployment Protection: …
- Deployments: …
### clearpass-instructor-web
(same structure)

## Supabase
| Organisation | Plan | Projects (name, region, status) | Active count | Room for a free project? | Contains production? |
Plus any billing usage figures read in 2.3.

## GitHub
| Setting | Before | After |
Branch rules on main: …
Actions secret names: …

## Railway
- Environments and services: …
- Deploy trigger: branch / auto-deploy on / wait for CI
- CRON_SECRET present: yes/no
- STRIPE_SECRET_KEY prefix (8 chars): …
- RevenueCat / server env variables present: …
- All variable names: …

## Anything unexpected
Bullets, or "None".

Confirm at the end: "No values were revealed or copied, and the only changes made were the three GitHub Actions settings."
```

---

## C1b — Vercel production configuration for #108 (prepare only; run when you approve merging #108)

```text
You are making a small, pre-approved configuration change in Vercel for my app ClearPass. Work in my signed-in Chrome.

SAFETY: Make ONLY the changes listed below. Do not redeploy, promote, roll back or delete deployments. Do not reveal, copy or report the value of any existing variable. If any page asks you to confirm something not listed here, cancel it.

Team: https://vercel.com/zenfinancehubs-projects

1. https://vercel.com/zenfinancehubs-projects/clearpass-app/settings/environment-variables
   Add: Key EXPO_PUBLIC_APP_ENV, Value production, Environments: Production ONLY (untick Preview and Development). Save.
2. https://vercel.com/zenfinancehubs-projects/clearpass-instructor-web/settings/environment-variables
   Add: Key NEXT_PUBLIC_APP_ENV, Value production, Environments: Production ONLY. Save.
   If either key already exists, do not change it. Report its environments instead.
3. clearpass-app → Settings → Build and Deployment (https://vercel.com/zenfinancehubs-projects/clearpass-app/settings/build-and-deployment):
   - Report the current Build Command and whether its Override toggle is ON.
   - Turn the Build Command Override OFF, so the repository's vercel.json command is the only source. Save.
   - Do not change Install Command, Output Directory or Root Directory. Report their values and override states.
4. Do NOT trigger a redeploy. These take effect on the next production deployment.

Report: for each project, the variable added and its environments; the Build Command override state before and after; and confirmation that nothing else changed.
```

The order matters. Run C1b, then merge #108. The first production build afterwards should log `[check-build-env] OK (Vercel production)`; Claude Code checks this in the deployment log. If that build fails, the live site stays on the previous deployment.

Why the override must go: Vercel's docs say `vercel.json`'s `buildCommand` overrides the dashboard setting. Today both say `npx expo export --platform web`, so nothing is bypassed yet. The docs don't describe how the dashboard "Override" toggle interacts with that, though. Switching the override off removes the ambiguity, so the guarded command in `vercel.json` (from #108) is the only one.

---

## C5 — Vercel secret clean-up (prepare only; run when approved)

```text
You are removing unused or over-scoped secrets from a Vercel project for my app ClearPass. Work in my signed-in Chrome.

SAFETY: Do NOT reveal, copy or report any value. Do not redeploy. Change only what is listed. If a page asks you to confirm anything else, cancel it.

Open https://vercel.com/zenfinancehubs-projects/clearpass-app/settings/environment-variables

1. STRIPE_SECRET_KEY: delete it from ALL environments in this project (Production and Preview, and Development if present). This app's code never reads it; the payment server on Railway keeps its own copy, which is NOT touched.
2. SLACK_WEBHOOK_CLEARPASS (it may appear with a slightly different spelling): edit it so it applies to Production ONLY. Untick Preview and Development and keep Production. If the UI can't edit scopes, report that and stop; don't delete it.
3. Report the full list of variable NAMES and their environments after the change.
4. Do not trigger a redeploy. Removal takes effect on the next deployment.

Report: before/after scopes for both variables, the final list of names and environments, and confirmation that no values were viewed and nothing else changed.
```

---

## C2 — Create the hosted staging Supabase project (rev 2: Clear Pass organisation; prepare only, run when approved)

```text
You are helping me create a STAGING database for my app ClearPass in Supabase. It must be a completely separate project from production.

Rules:
- Create the project ONLY in the organisation named "Clear Pass" (on the Pro plan). If you can't find exactly that organisation, STOP and tell me.
- Expected additional cost: about $10/month (smallest/Micro compute). If the confirmation screen shows a different compute size, a higher monthly cost, an add-on or a plan change, STOP before confirming and tell me what it shows.
- Do not open, change or pause any existing project. Production's reference starts "secavejb": leave it alone, but you may read its region from the project list.
- The database password: when you reach the password field, STOP and ask me to type or generate it myself. Do not read it, copy it or include it in any message.
- Never copy or report the service_role key, any "secret" key, the JWT secret, or a connection string containing a real password.

Steps:
1. https://supabase.com/dashboard/organizations → "Clear Pass" → New project.
   Name: clearpass-staging. Region: the same as the production project. Compute: the smallest available (Micro).
2. Pause for me to set the database password. Then create the project and wait until its status is healthy.
3. Project Settings → API Keys (or API). Report:
   - the Project URL (public);
   - the anon / publishable key (designed to be public).
   Do NOT report the service_role or secret key.
4. Project Settings → Database → Connection string → "Session pooler" (port 5432). Report the string with the password left as the literal placeholder [YOUR-PASSWORD]. If the page shows a real password in it, don't report it; tell me instead.
5. Authentication → URL Configuration: report the Site URL. Don't change it.
6. Organisation → Billing: report the new project's compute line item and the monthly estimate shown.

Report: organisation, region, project URL, anon key, session-pooler template (placeholder only), the compute size and monthly cost shown, and anything unexpected.
```

After C2, you create `~/.config/clearpass/staging-db.env` yourself (setup guide §1 step 2) and tell Claude Code. It then applies `schema.sql` (from #112), the migrations and synthetic seed accounts to staging only.

---

## C7 — GitHub branch protection for main (prepare only; run AFTER #109 has merged)

**Run this only after #109 is merged.** Required checks must already exist on `main`; otherwise no PR can ever satisfy them.

```text
You are adding branch protection to the main branch of my GitHub repository ZenFinanceHub/clearpass-app. Work in my signed-in Chrome.

SAFETY: Create exactly one ruleset as described. Don't edit other settings, rulesets, secrets, collaborators or Actions settings. If a page asks you to confirm anything else, cancel it.

1. Open https://github.com/ZenFinanceHub/clearpass-app/settings/rules → New ruleset → New branch ruleset.
2. Ruleset name: main protection. Enforcement status: Active.
3. Bypass list: leave EMPTY.
4. Target branches: Add target → Include default branch (main).
5. Rules (tick only these):
   - Restrict deletions.
   - Block force pushes.
   - Require a pull request before merging, with:
     - Required approvals: 0;
     - Dismiss stale approvals, Require review from Code Owners, Require approval of the most recent push, and Require conversation resolution: all OFF.
   - Require status checks to pass, with "Require branches to be up to date before merging" OFF. Add these checks, choosing the ones from GitHub Actions; type each name and pick it from the suggestions:
       Typecheck (apps/mobile)
       Typecheck (apps/instructor-web)
       Unit tests (packages/core, packages/content)
       Unit tests (apps/mobile/server)
       Unit tests (apps/mobile scripts)
       Unit tests (apps/instructor-web)
       E2E (Playwright, stubbed backend)
     Do NOT add "Native fingerprint (informational)" or any "Vercel" check.
6. Leave everything else unticked. Click Create.
7. Re-open the ruleset and report every setting as saved.

Report: the ruleset as saved (name, enforcement, bypass list, target, each rule and its options, the list of required checks), and confirmation that nothing else changed.
```

What this does:
- Every change to `main` must arrive through a PR whose 7 CI checks pass.
- No human approval is needed, so you can still merge your own PRs.
- Force-pushes and deleting `main` are blocked.
- The empty bypass list means even admins go through PRs. In an emergency you can switch the ruleset to "Disabled" in the same screen.
- "Up to date before merging" is off, to avoid a forced rebase before every merge. CI still runs on each PR's own merge result.

---

## R1 — Railway read-only check (standalone; run after logging in to Railway)

```text
You are auditing the Railway hosting for my app ClearPass. I am already logged in to Railway in this Chrome. THIS TASK IS STRICTLY READ-ONLY.

SAFETY:
- Do not deploy, redeploy, restart, roll back, rename, delete or pause anything. Do not add, edit or delete variables, domains, volumes or environments. Do not change plans or billing.
- NEVER reveal, copy or report the VALUE of any variable. Do not click "reveal", the eye icon or "copy" on any variable. Variable NAMES are fine.
- One exception: for STRIPE_SECRET_KEY, report ONLY its first 8 characters (e.g. "rk_live_" or "sk_live_"), read from what the UI shows without revealing more. If the UI only shows a masked value, use the raw editor only if it doesn't save anything, and close it without saving. If you can't see the prefix without revealing the whole value, report "not visible" instead.
- If any page asks you to confirm an action, cancel it.

1. https://railway.com/dashboard → the ClearPass project.
   List its environments (e.g. production) and the services in each (names only).
2. Production server service → Settings:
   a. Source: the GitHub repository, branch and root directory.
   b. Whether automatic deploys on push are enabled, and for which branch.
   c. Whether "Wait for CI" (check suites) is enabled.
   d. Any watch paths configured.
   e. Builder (Nixpacks / Railpack / Dockerfile) and the start command.
   f. Public domain(s).
3. Same service → Deployments: the date of the latest successful deployment, the commit it shows (short hash and message), and whether it was triggered by a GitHub push or manually.
4. Same service → Variables. Report:
   - The full list of variable NAMES.
   - CRON_SECRET present: yes/no.
   - STRIPE_SECRET_KEY present: yes/no, and its first 8 characters only (see the exception above).
   - Present yes/no: REVENUECAT_PROJECT_ID, REVENUECAT_PRO_ENTITLEMENT_ID, CLEARPASS_SERVER_ENV, REVENUECAT_WEBHOOK_SECRET, REVENUECAT_SECRET_API_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET (or similarly named).
   - If CLEARPASS_SERVER_ENV exists, its value. It is not a secret.
   - Any shared variables or references to other services (names only).
5. Project → Settings → Usage / Billing (read-only): the plan and this month's usage figure. No card details.

REPORT FORMAT:
## Project
Environments and services.
## Production server
Source / auto-deploy / wait for CI / watch paths / builder / start command / domains.
## Latest deployment
Date, commit, trigger.
## Variables
Full list of names; then the yes/no list; the 8-character Stripe prefix.
## Plan and usage
## Anything unexpected

Confirm at the end: "Read-only. No values were revealed and nothing was changed."
```
