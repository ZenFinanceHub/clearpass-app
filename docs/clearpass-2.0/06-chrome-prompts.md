# ClearPass 2.0 — Prompts for Claude in Chrome

For Craig. Each prompt is self-contained: paste one into Claude in Chrome, let it finish, then paste its report back to Claude Code. They're ordered by when they become safe to run.

**Rules built into every prompt:** no secret values are copied into chat or reports (variable *names* and public URLs only); nothing that costs money is confirmed without your say-so; no production setting is changed except where the prompt says so.

| Prompt | What it does | Safe to run | Cost |
|---|---|---|---|
| **C1** | Read-only check: Vercel env var names, build settings, protection; Supabase organisations and plans; GitHub Actions settings (and applies the three hardening changes); Railway deploy trigger and variable names (an 8-character Stripe key prefix only) | **Now** | $0 |
| **A14** | RevenueCat read-only check of the 3 in-app Pro holders. **Kept outside the repo** (contains user IDs) | Now | $0 |
| **C1b** | Adds the two non-secret `APP_ENV=production` variables to the Vercel **Production** scope (A12) | Only once you approve merging #108 | $0 |
| **C2** | Creates the hosted staging Supabase project | After C1, once you've approved the cost it reports | $0 or ~$10/month (C1 tells us which) |
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

## C1b — Declare production explicitly in Vercel (only once you approve merging #108)

```text
In Vercel, make exactly two changes and nothing else. Do not redeploy, and do not change or reveal any other variable.

1. Project "clearpass-app" → Settings → Environment Variables → Add:
   Key: EXPO_PUBLIC_APP_ENV   Value: production   Environments: Production ONLY (untick Preview and Development).
2. Project "clearpass-instructor-web" → Settings → Environment Variables → Add:
   Key: NEXT_PUBLIC_APP_ENV   Value: production   Environments: Production ONLY.
3. If a variable with that key already exists in either project, do not change it; report its environments instead.
4. Do not trigger a redeploy. The variables take effect on the next production deploy.

Report: for each project, the key, the environments ticked, and confirmation that nothing else changed.
```

---

## C2 — Create the hosted staging Supabase project (after approving the cost)

```text
You are helping me create a STAGING database for my app ClearPass in Supabase. It must be completely separate from production.

Rules:
- Create the project ONLY in the organisation I name here: <ORGANISATION NAME>. If that organisation contains a project whose reference starts "secavejb", STOP and tell me. Production must not share an organisation with staging.
- If the screen shows any charge other than the one I approved (<"$0, Free plan" or "about $10/month Micro compute">), STOP before confirming and tell me.
- The database password: when you reach the password field, STOP and ask me to type or generate it myself. Do not read it, copy it or include it in any message.
- Never copy or report the service_role key, any "secret" key, the JWT secret or the database connection string password.

Steps:
1. In <ORGANISATION NAME>, click New project. Name: clearpass-staging. Region: the same region as the production project (check it read-only from the project list; do not open production). Compute: smallest available.
2. Pause for me to set the database password, then create the project and wait until it is healthy.
3. Project Settings → API (or API Keys). Report:
   - the Project URL (public);
   - the anon / publishable key (it is designed to be public).
   Do NOT report the service_role or secret key.
4. Project Settings → Database → Connection string → "Session pooler" (port 5432). Report the connection string with the password still shown as the literal placeholder [YOUR-PASSWORD]. If the page shows the real password inside it, do not report it; tell me instead.
5. Authentication → URL Configuration: report the current Site URL. Do not change it.

Report: organisation, region, project URL, anon key, the session-pooler template (placeholder only), the monthly cost shown, and anything unexpected.
```

After C2, you create `~/.config/clearpass/staging-db.env` yourself (setup guide §1 step 2) and tell Claude Code. It then applies the schema and seeds synthetic accounts on staging only.
