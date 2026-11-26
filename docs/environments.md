# Environments: local, staging, production

Until P0-4, the app hardcoded the production Supabase URL and anon key
(`apps/mobile/src/supabase.ts`) and the production Railway URL
(`src/proxyUrl.ts`). Every local run and every Vercel preview therefore used
the **production database**, which is shared with Zen Footy. The backend is
now chosen by `EXPO_PUBLIC_APP_ENV`.

## Environment variables

| Variable | local | staging | production |
|---|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | `local` | `staging` | `production`, **declared explicitly** by every release path (below) |
| `EXPO_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:55321` (required) | staging project URL (required) | ignored: pinned in `src/appEnv.ts` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | local demo anon key (required) | staging anon key (required) | ignored: pinned |
| `EXPO_PUBLIC_API_URL` | optional, default `http://localhost:3001` | staging Railway URL (required) | ignored: `__DEV__` → `http://localhost:3001`, release → production Railway |
| `EXPO_PUBLIC_UI_V2` | `1` turns the 2.0 UI on | `1` turns it on | always off |

Where they are set:

- **local**: `npm run web:local` (from `apps/mobile/server`) sets them from the running local stack.
- **staging**: EAS `preview` environment (`eas.json` preview profile now has `"environment": "preview"`) and Vercel **Preview** scope. See the setup guide §2 and §3.1.
- **development builds** (`expo start`, dev client): `EXPO_PUBLIC_APP_ENV` must be set. Use `local`, or `production` explicitly to deliberately work against live data (the old default). An unset value now refuses to start.
- **production**: declared explicitly on every release path:
  - EAS production builds: `eas.json` production profile `env`;
  - `npm run ota:production`: `scripts/publish-ota.js` sets it, refuses a conflicting value in your shell, and runs the build-env check inside the EAS production environment before bundling;
  - Vercel production (clearpass-app): `EXPO_PUBLIC_APP_ENV=production` in the Vercel **Production** environment variables;
  - instructor-web on Vercel production: `NEXT_PUBLIC_APP_ENV=production` in its **Production** environment variables.

  **The two Vercel variables must be added before this PR merges**, otherwise the next production deploy fails the check. The live site would stay on its previous deployment, but deploys would be blocked.
- Previously, production needed nothing set. EAS production builds, `npm run ota:production` and Vercel production deployments resolve exactly the values the app hardcoded before (unit-tested in `scripts/lib/appEnv.test.mjs`).

Code: `apps/mobile/src/appEnv.ts` (pure resolver, unit-tested) and
`src/appConfig.ts` (the RN wrapper; it lists each `process.env.EXPO_PUBLIC_*`
statically, because Expo only inlines static references). `src/supabase.ts`,
`src/supabaseMagicLink.ts`, `src/proxyUrl.ts` and `explainAnswer()` read from it.

### Fail-closed rules

**At build time**, `scripts/check-build-env.js` (rules in `scripts/lib/buildEnvGuard.js`, unit-tested) runs as part of the Vercel `buildCommand` (`vercel.json`) and as the EAS `eas-build-pre-install` hook. It fails the build when:

- Vercel `VERCEL_ENV` is `preview` or `development` and `EXPO_PUBLIC_APP_ENV` is unset or `production`. **A preview with no env vars at all fails**;
- EAS `EAS_BUILD_PROFILE` is anything other than `production` or `development` and `EXPO_PUBLIC_APP_ENV` is unset or `production` (`eas.json` preview profile also pins `EXPO_PUBLIC_APP_ENV=staging`, so a preview build without staging values fails);
- a production context (Vercel production, EAS production) carries `local` or `staging`;
- `local`/`staging` is missing a value or points at production (same checks as below).

- `EXPO_PUBLIC_APP_ENV` is not set at all, in **any** context, including a developer machine or CI with no build signal. The only exception is the EAS `development` profile, whose JavaScript comes from Metro, where the startup rule below applies.

**Why the app itself still falls back to production when unset in a release bundle.** Every supported release path now declares `production` and is checked at build time. If a bundle were ever produced outside them (for example a bare `eas update`, which CLAUDE.md forbids, and which caused the 17 Sep 2026 incident), throwing at startup would crash the app for every user on that update. Falling back to production keeps it working. The build-time rule is what makes the declaration mandatory. The runtime fallback is a last-resort safety net and is unit-tested to resolve only to the pinned production values.

**At startup**, `src/appConfig.ts` throws, and the app does not start, if:

- the build is a development build (`__DEV__`) and `EXPO_PUBLIC_APP_ENV` is unset;
- `EXPO_PUBLIC_APP_ENV` is anything other than `local`, `staging`, `production` or empty;
- `local`/`staging` lacks a Supabase URL or anon key, or `staging` lacks `EXPO_PUBLIC_API_URL`;
- `local`/`staging` points at a production host (`secavejbaapapvvqbwed.supabase.co`, `clearpass-app-production.up.railway.app`) or uses the production anon key (exact match, or a JWT whose `ref` is the production project).

In production, URL/key overrides are **ignored**, so no env var can move production elsewhere. Changing a production value needs a code change in `src/appEnv.ts`, and the unit test will flag it.

`uiV2` is only ever on outside production. Turning the 2.0 UI on in production will be a deliberate, reviewed code change (Phase 7), not a flag flip.

## Local stack

Prerequisites: Docker, `psql`, and `npm install` in `apps/mobile` and `apps/mobile/server`.

From `apps/mobile/server`:

```bash
npm run db:local:start    # first run pulls the Docker images
npm run db:local:reset    # wipe, apply schema.sql + migrations + local-setup.sql, then seed
npm run server:local      # API server on :3001 against the local stack (separate terminal)
npm run web:local         # Expo web on :8120 against the local stack (separate terminal; `-- 8121` for another port)
npm run db:local:status   # URLs and local demo keys (public CLI defaults)
npm run db:local:seed     # re-seed without wiping
npm run db:local:stop     # stop the stack (data volume kept)
```

Studio runs on <http://127.0.0.1:55323> and the local mail inbox on <http://127.0.0.1:55324>.

For a native dev build, set the four `EXPO_PUBLIC_*` values printed by `db:local:status`.
For an Android emulator, use `http://10.0.2.2:55321`; for a phone on the LAN, use the machine's LAN IP.

### Why `apps/mobile/supabase-local/` and not `apps/mobile/supabase/config.toml`

- `npm run db:migrate` (production) runs `supabase db push --workdir apps/mobile`. A `config.toml` there would start being read by that production command, so it gets its own workdir.
- The CLI applies `supabase/migrations/` automatically, but those migrations only work on top of `schema.sql`, which isn't a migration. The local config disables CLI migrations and seeding. `scripts/local-stack.js` applies `schema.sql`, then each migration in filename order, then `supabase-local/local-setup.sql`, all with `ON_ERROR_STOP` against the hardcoded loopback database.
- Ports are 553xx (project `clearpass-local`), so it can run alongside another local Supabase stack, such as Zen Footy's on 543xx.

### Schema replay

`schema.sql` and all 8 migrations replay cleanly on a fresh local Postgres 17 (CLI 2.117.0) with no ordering fixes needed. Known gaps relative to production:

- `update_aggregate_stats(p_topic, p_correct, p_total)` is called by `src/analytics.ts` but not declared in `schema.sql`. Locally the RPC fails and the caller swallows the error, so comparative stats stay empty. It should be dumped from production into `schema.sql` (read-only) in a later PR.
- `hazard_clips` is empty locally, so the hazard screen shows 0 clips.
- Zen Footy's tables (`players`, `matches`, `lineups`, `attendance`) are deliberately absent.
- There is no `account_class` column. Seed accounts carry `account_class: 'internal'` in `user_metadata`, plus `profiles.exclude_from_stats = true`.

`local-setup.sql` (local only) creates the `question-images` (public) and `hazard-videos` (private) buckets. The `instructor-documents` bucket comes from migration `20260911180000`. The seed uploads one synthetic placeholder image to `question-images`.

### Question images still load from production storage

`packages/content` hardcodes about 260 image URLs as
`https://secavejbaapapvvqbwed.supabase.co/storage/v1/object/public/question-images/...`.
Any screen showing an image question makes **read-only GETs of public files**
on the production host, even in local/staging. That's a follow-up (rewrite the
host via `appConfig` at render time, or copy the images to staging). Until
then, a Playwright "no production hosts" guard needs to avoid image questions
or allow exactly that path.

## Seed accounts

`server/scripts/seed-local.js` is run by `db:local:reset` / `db:local:seed`.
It is idempotent and recreates passwords and progress each run.

Local password for all accounts: `ClearPass-local-1` (local stack only).

| Email | Purpose |
|---|---|
| `new-learner@example.invalid` | just signed up, nothing answered, test in 45 days |
| `free-learner@example.invalid` | established free learner (320 answered, 2 mocks, 6-day streak) |
| `pro-learner@example.invalid` | Pro, `proSource: 'comp'`, expires in 90 days |
| `near-test-learner@example.invalid` | test in 3 days, high readiness |
| `no-test-date-learner@example.invalid` | progress but `testDate: null` |
| `instructor@example.invalid` | instructor, code `LOCAL01` |
| `pupil-1@example.invalid`, `pupil-2@example.invalid` | linked to the instructor (accepted, consent given) |

Every account has `profiles.exclude_from_stats = true` and
`user_metadata = { account_class: 'internal', seeded_local: true, e2e: true }`.
`e2e: true` reuses `server/lib/e2e.js`, so the server never posts to Slack
for them.

**Target guard** (`server/lib/envGuard.js`, unit-tested): the seed only runs
when `SUPABASE_URL` is `127.0.0.1`/`localhost`, or a host listed in
`CLEARPASS_SEED_ALLOWED_HOSTS` (https only). Any host containing the
production project ref is refused, even if it's listed. For a non-local
target, `CLEARPASS_SEED_PASSWORD` (12+ characters) is required, because this
repo is public. The script never loads `server/.env`.

## Local API server

`npm run server:local` starts `proxy.js` with an environment built from
scratch: nothing is inherited from the shell, and `server/.env` isn't loaded.

- `CLEARPASS_SERVER_ENV=local` makes `proxy.js` skip dotenv and refuse to start unless `SUPABASE_URL` is loopback (and no `sk_live_` Stripe key is set). When it's unset, as on Railway, behaviour is unchanged.
- It sets `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (local), `PUBLIC_API_URL=http://localhost:3001`, and a random `CRON_SECRET` for each run.

How the server degrades without third-party keys (verified locally against the running server, plus code reading):

| Unset | Behaviour |
|---|---|
| `SLACK_WEBHOOK_UPDATES` | `postToSlack` logs "not set, skipping" and returns false. Callers treat this as non-fatal (`/api/cron/daily-stats` replies `posted: false`). |
| `RESEND_API_KEY` | `sendEmail` throws "RESEND_API_KEY not set". `/api/cron/weekly-email` returns 500. `/api/cron/lifecycle-emails` returns 500 unless `?dryRun=1`. Per-recipient loops catch and count failures. No email leaves the machine. |
| `ADMIN_ALERT_EMAIL` | Refund flag is recorded, and the alert email is skipped with a log line. |
| `ANTHROPIC_API_KEY` | `/api/explain` returns 500 "ANTHROPIC_API_KEY not set". This happens **after** the daily quota counter is incremented, which is harmless locally. Payout-proof document check throws and is handled as an error. |
| Stripe (`STRIPE_SECRET_KEY`, webhook secrets, price ids) | `stripe` is null. `/api/create-checkout-session` returns 500, `/api/webhook` returns 500 "Stripe not configured", and `/api/config` returns `{stripeTestMode:false, webMonthlyAvailable:false}`. |
| `REVENUECAT_WEBHOOK_SECRET` | `/api/revenuecat-webhook` returns 500 "not configured". |
| `REVENUECAT_SECRET_API_KEY` | TRANSFER falls back to local logic, and `revenuecatApi` calls throw. |
| `CRON_SECRET` | `requireCronAuth` rejects everything (fail closed). **Exception:** `POST /api/send-weekly-parent-emails` (`proxy.js:2359`) compares `req.headers['x-cron-secret'] !== process.env.CRON_SECRET`, so with `CRON_SECRET` unset, a request without the header is **authorised**. It still can't send mail without Resend, but it reads data. `server:local` always sets a random `CRON_SECRET`. Recommendation (not changed here, needs approval): switch that route to `requireCronAuth`. |
| `PUBLIC_API_URL` | Defaults to the production Railway URL. It's only used in unsubscribe links in emails, which aren't sent without Resend. `server:local` sets it to localhost. |

Expo push notifications (`exp.host`) are only sent to stored push tokens.
Seed accounts have none.

## RevenueCat sandbox events (investigation, no code change)

- `server/lib/revenuecatWebhook.js` never reads `event.environment`. There are no `SANDBOX` or `PRODUCTION` references anywhere in it or in the `/api/revenuecat-webhook` route (`proxy.js:568–648`). A sandbox `INITIAL_PURCHASE`/`RENEWAL` is handled exactly like a real one: `resolveRevenueCatUpdate` (`revenuecatWebhook.js:38–60`) grants `isPro: true, proSource: 'iap'` with the sandbox `expiration_at_ms`.
- The only filter is `isSupabaseUserId(app_user_id)` (`revenuecatWebhook.js:415–432`, check at line 429). It skips anonymous ids and the dashboard's "Send test event", not sandbox purchases.
- **If a staging build's sandbox purchase reached the production webhook** (same RevenueCat project): the `app_user_id` is a staging Supabase UUID that doesn't exist in production. `getProgress` returns null, so the patch is applied to `{}`. The upsert into `user_progress` then fails the FK to `auth.users`. `applySingleUserUpdate` deletes the dedup row and returns `{ ok: false, retry: true }`, so the route returns 500 and **RevenueCat retries** the event repeatedly, producing error noise in production logs. It wouldn't grant Pro to a production user, because UUIDs differ between projects. A `TRANSFER` touching such ids behaves the same way.
- Sandbox purchases made by a **production** build (TestFlight, licence testers) on a real production account **do** grant real Pro (`proSource: 'iap'`, short accelerated expiry) and count as `payingIap` in `lib/dailyStats.js`.
- **Recommendation:** (a) a separate RevenueCat project for staging, with its own public SDK keys in the EAS `preview` environment and its webhook pointed at the staging Railway service. Production code doesn't change. Additionally, and separately approved, (b) make the production webhook acknowledge `environment === 'SANDBOX'` events with 200 and no grant, unless the user is an internal account, so a misrouted sandbox event can neither grant Pro nor cause a retry storm. Until then, don't make sandbox purchases from staging builds.

## Known collision: `EXPO_PUBLIC_API_URL`

`src/components/support/hooks/useSupportChatNative.ts` already reads
`EXPO_PUBLIC_API_URL` as the base for the **Vercel** `/api/support` function
(`.env.example`: `https://clearpass-app.vercel.app`). In production nothing
changes: `appEnv` ignores the variable there, and the support hook reads it
directly as before. In staging, setting it to the staging Railway URL (per the
setup guide) would send the native support chat to Railway, which has no
`/api/support`. Follow-up: give the support chat its own variable
(`EXPO_PUBLIC_SUPPORT_API_URL`) before staging is used for support-chat testing.

## Pending until the hosted staging project exists (Craig: A1, A3)

- Create the staging Supabase project, Railway `staging` environment, and EAS/Vercel preview variables (setup guide §1–§3).
- A staging variant of `db:migrate` that reads `~/.config/clearpass/staging-db.env` and applies `schema.sql`, the migrations and `local-setup.sql` to staging. It can reuse `local-stack.js`'s apply order.
- Seed staging: `SUPABASE_URL=<staging> SUPABASE_SERVICE_KEY=<staging service key> CLEARPASS_SEED_ALLOWED_HOSTS=<staging host> CLEARPASS_SEED_PASSWORD=<…> node scripts/seed-local.js`. Values come from the credentials file and are never printed.
- Copy or rehost question images (see above) and hazard clips for staging.
- Stripe test mode and the RevenueCat decision above (A3).
- Until then, Vercel preview builds and EAS preview builds **fail** at the build-env check instead of resolving to production. (Vercel non-production builds are also switched off in the dashboard, action A0.)

## Instructor web (`apps/instructor-web`)

`next.config.ts` runs `lib/backendGuard.ts` at build and dev start. It refuses the production Supabase or API host unless `VERCEL_ENV=production`. On a developer machine (no `VERCEL_ENV`), `NEXT_PUBLIC_APP_ENV=production` must be set explicitly to use live data. Missing values still fail at runtime in `lib/supabase.ts`.
