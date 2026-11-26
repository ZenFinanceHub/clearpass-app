# ClearPass 2.0 — Prompts for Claude in Chrome

For Craig. Each prompt is self-contained: paste one into Claude in Chrome, let it finish, then paste its report back to Claude Code. They're ordered by when they become safe to run.

**Rules built into every prompt:** no secret values are copied into chat or reports (variable *names* and public URLs only); nothing that costs money is confirmed without your say-so; no production setting is changed except where the prompt says so.

| Prompt | What it does | Safe to run | Cost |
|---|---|---|---|
| **C1** | Read-only check: Vercel env var names per scope and build-command overrides; Supabase organisations and plans; GitHub Actions settings (and applies the read-only hardening) | **Now** | $0 |
| **C2** | Creates the hosted staging Supabase project | After C1, once you've approved the cost it reports | $0 or ~$10/month (C1 tells us which) |
| C3 | Railway staging environment and Vercel/EAS Preview variables | After C2 and the staging schema is applied (Claude Code does that from the credentials file) | ~$1–5/month |
| C4 | Stripe sandbox products and webhooks, RevenueCat staging project | After C3 (webhooks need the staging Railway URL) | $0 |

C3 and C4 are written when their prerequisites exist, because they need values that don't exist yet.

---

## C1 — Read-only infrastructure check (safe now)

```text
You are helping me audit infrastructure settings for my app ClearPass. This is a READ-ONLY check except for step 3c. Do not change any other setting, do not create, delete or redeploy anything, and do not start any paid plan or trial.

NEVER copy, type, screenshot-describe or report the VALUE of any environment variable, key, token, password or secret. Report variable NAMES only. If a value is shown on screen, ignore it.

1. Vercel (vercel.com), projects "clearpass-app" and "clearpass-instructor-web":
   a. Settings → Environment Variables. For each project, list every variable NAME and which environments it applies to (Production / Preview / Development). Flag any name that does NOT start with EXPO_PUBLIC_ or NEXT_PUBLIC_ and applies to Preview or Development.
   b. Settings → Build and Deployment (or General → Build & Development Settings). Report whether "Build Command" has the Override toggle ON and, if so, the command text (commands are not secrets). Report the Root Directory.
   c. Settings → Git → Ignored Build Step: confirm it still says "Only build production" for both projects.
   d. Deployments: confirm there are still zero Preview deployments.

2. Supabase (supabase.com/dashboard):
   a. List every organisation I belong to, its plan (Free / Pro / Team) and the projects in it (name and region only).
   b. Say which organisation contains the project whose reference starts "secavejb" (production; it is shared with another product, Zen Footy). Do not open its settings.
   c. For each organisation, report how many active projects it has and whether the Free plan's two-active-project limit would allow one more.
   d. Do NOT create a project.

3. GitHub repository ZenFinanceHub/clearpass-app:
   a. Settings → Actions → General. Report the current values of: "Actions permissions", "Fork pull request workflows from outside collaborators", "Workflow permissions", and "Allow GitHub Actions to create and approve pull requests".
   b. Settings → Branches (or Rules → Rulesets). Report any rules on "main". Do not add any.
   c. Then change ONLY these, and save:
      - "Fork pull request workflows from outside collaborators" → "Require approval for all external contributors" (wording may vary; choose the strictest approval option).
      - "Workflow permissions" → "Read repository contents and packages permissions".
      - "Allow GitHub Actions to create and approve pull requests" → unchecked.
      Report before/after for each.

Finish with a short report in three sections (Vercel, Supabase, GitHub). Include anything that looked unexpected.
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
