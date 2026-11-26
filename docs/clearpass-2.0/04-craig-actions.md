# ClearPass 2.0 — Actions and Decisions for Craig

Last updated 2026-11-26 (rev 5, #111/#113 direction approved; test-purchase investigation; Stripe livemode and RevenueCat config approved). Step-by-step instructions are in `05-setup-guide.md`.

## A. Actions (things only Craig can do)

| # | Action | Needed for | Blocking? | Status |
|---|---|---|---|---|
| A0 | Stop Vercel PR previews from using production | All PRs | — | ✅ **Done 2026-11-26 by Craig (via Claude in Chrome).** clearpass-app and clearpass-instructor-web set to "Only build production". Standard Protection with Vercel Authentication was already on for both. All 59 historical previews deleted (30 + 29); zero remain. Both production sites still public. No env vars, DB settings or credentials changed; clearpass-web untouched; no cost. Defence in depth added in PR #108: preview builds now **fail** unless wired to staging |
| A1 | Run Chrome prompt **C1** (Craig is running it now; no rotation until its results are in) (read-only check, `06-chrome-prompts.md`), approve the staging cost it reports, then **C2** to create the **hosted staging Supabase project** and enter its keys into Vercel Preview, EAS `preview` and Railway staging (guide §1–§3) | P0-4 hosted part; hosted review of M1 | Blocks hosted staging only. Local development continues | ⬜ |
| A2 | **Enable GitHub Actions** (guide §4) | P0-1 CI | — | ✅ Already enabled; CI ran green on #109. Optional: apply the §4 hardening settings and make `ci` a required check |
| A3 | **Stripe test mode and RevenueCat sandbox** set up for staging (guide §5–§6) | P5-4, P7 purchase testing | Phase 5 testing | ⬜ (approved to prepare) |
| A4 | ~~Unpushed commits~~ **Decided: preserve.** Programme branches start from `origin/main`; local `main` is left untouched | — | — | ✅ |
| A5 | Approve the PR #79 / #19 recommendations below | Before P3-2 | No | ⬜ |
| A6 | Confirm the analytics privacy stance (events carry no content or PII; platform plus anonymous install id only) and whether the privacy policy needs a line about product analytics | P0-3 merge | Before P0-3 merges | ⬜ |
| A7 | (Optional) Supply higher-resolution original Pip files if they exist. Otherwise Pip is used at existing sizes, up to ~240px @3x | P2-1 hero sizes | No | ⬜ |
| A8 | Device and accessibility test time in Phase 7 (iOS and Android devices; VoiceOver and TalkBack) | P7 | Phase 7 | ⬜ |
| A9 | Review batches: one per phase, plus M0.5 and M1 | All | — | ✅ **M0.5 reviewed (direction approved 2026-11-26).** ⬜ **M0.6 refinement review** next: before/after and viewport screenshots |
| A10 | Approve **production release** of the P0-2 bug fixes (OTA and web) once reviewed | P0-2 release | — | ⬜ |
| A12 | **Before #108 merges:** add `EXPO_PUBLIC_APP_ENV=production` to clearpass-app and `NEXT_PUBLIC_APP_ENV=production` to clearpass-instructor-web, **Production scope only**, in Vercel. Chrome prompt **C1b**. Neither value is secret. Without them, the next production deploy fails its check: the site stays up on the previous deployment, but deploys are blocked | #108 merge | Blocks the #108 merge only | ⬜ |
| A13 | Approve the **Railway deploys** of the F1 and F2 server fixes once reviewed | F1, F2 release | — | ⬜ |
| A14 | Run Chrome prompt **C5** (RevenueCat, read-only check of 3 in-app Pro holders). The prompt is kept **outside the repo** because it contains user IDs | Test-purchase findings | Blocks the F1 backfill decision only | ⬜ |
| A11 | Approve the **Railway deploy** of the Ask Pip allowance endpoint (P5-2) once reviewed and tested | P5-3 | — | ⬜ |

## R. Credential review after A0 (2026-11-26)

**Recommendation: no rotation is required.** Nothing privileged was ever in a preview deployment. One read-only check (C1 step 1a) is needed to close this out.

| Credential | Where it appeared | Type | Rotate? |
|---|---|---|---|
| Supabase anon key (production) | Every web bundle, preview and production; also in the public repo since launch | **Public client key** by design; access is enforced by RLS | **No.** Rotating it would force an app release and change nothing. RLS is the control |
| Supabase URL, Railway API URL | Bundles and the repo | Public addresses | No |
| RevenueCat SDK keys (`appl_`, `goog_`) | Native bundles (`EXPO_PUBLIC_*`) | **Public SDK keys**; can't grant entitlements | No |
| Sentry DSN | Bundles | **Public**; ingestion only | No |
| Supabase service-role key, Stripe secret key, Stripe and RevenueCat webhook secrets, Anthropic, Resend, `CRON_SECRET` | Railway only. Neither client app references them: searched `apps/mobile/src`, `app/` and `apps/instructor-web` on `main` | **Privileged secrets** | **No**, unless C1 finds any of them set in a Vercel project. Even then they were only in the build environment, never in served files (no code reads them), and previews required Vercel login. The fix would be to remove them from Vercel, then rotate as a precaution |

What the previews *did* do was let a logged-in team member use production data through a preview URL. That was a data-isolation problem, not a credential leak. A0 and PR #108 close it.

## M0.5 review decisions (2026-11-26)

| Topic | Decision |
|---|---|
| Direction | ✅ Approved: palette, typography, Pip, road, states, light/dark, five tabs |
| Desktop | Permanent left sidebar with the 5 destinations; two-column content. Mobile keeps the bottom tabs |
| Go Pro | Deep indigo and gold; personalised; verified benefits only; hazard availability by platform explained; never for Pro; no pricing, entitlement or paywall changes |
| Readiness | Presentation only. Journey-start state for low data. The algorithm needs approval |
| Road-sign artwork | Check accuracy and **report before changing** (the arrow-in-red-circle sign) |
| Existing Home features | All kept in M1, shown contextually so the screen isn't overcrowded |

## D. Decisions

| # | Decision | Outcome |
|---|---|---|
| D1 | Pip character | ✅ **Exact existing Pip assets only.** Mockups are layout references, not character or brand specifications |
| D2 | Logo / wordmark | ✅ **Existing official branding preserved.** No new logo mark is introduced. Header uses the existing app icon plus the text wordmark "ClearPass" |
| D3 | Notification centre / bell | ✅ **Not in this programme** |
| D4 | Marketing site (`apps/web`) | Out of scope unless raised later |
| D5 | Paywall plan order | ✅ **Monthly first** (PR #102). No per-month line |
| D6 | Ask Pip allowance endpoint | ✅ **Develop.** Testing and deploy need separate approval (A11) |
| D7 | Ask Pip feedback buttons | ✅ **Not in this programme** |
| D8 | Hazard perception on web | Default: "available in the app" card |
| D9 | Readiness consolidation | ✅ **Calculations preserved.** Presentation-only proposal in P4-3 |
| D10 | Instructor readiness tiers | ✅ **Existing three tiers** (Test Ready ≥80, Getting There ≥50, Needs Work) |
| D11 | Battle, Speed Round and Weak Spots gating | ✅ **Entitlements preserved** (no gating change). Default: fix the post-purchase copy that implies Battle is Pro-only |
| D12 | Staging form | ✅ **Local Supabase in Docker plus a separate hosted staging project** |
| D13 | Password rule | Default: 8+ for **new** passwords (existing accounts unaffected). Confirm before P5-1 |
| D14 | Release vehicle | ✅ **Prioritise the existing in-app dark mode. Native system-theme integration is deferred** if it complicates release, so OTA to 1.1.3 remains possible. Final call at Phase 7 |
| D15 | Ship bug fixes early | ✅ Develop and test; **production release needs separate approval** (A10) |
| D16 | "I Passed" placement | Default: Profile, plus Home on or after the test date |
| D17 | Quick Mock | ✅ **Real format retained:** 25 questions, 28 minutes, pass mark 22 |
| D18 | Gold accent | ✅ Contrast restrictions accepted: decoration or dark text only |
| D19 | `ui_v2` flag | ✅ Approved. Presentation-only, build-time per environment, no incompatible data changes. Rollback = flag off |

## PR review (2026-11-25): recommendations, not actioned

### #79 — "fix: fall back to SVG rendering when a sign's image fails to load"

**Recommendation: merge** (after approval), ideally released with the P0-2 bug fixes.

- 1 file, +14/−6, mergeable with `main`, open since 5 Sep.
- Adds `imageFailed` state and an `onError` handler to `SignVisual`, so a sign image that fails to load falls back to the **existing** SVG rendering instead of an empty space.
- Adds `key={sign.id}` at the 4 call sites, so the failure state resets per sign.
- **Small, correct, and the fallback is real code that already exists.** Low risk.
- It touches `roadsigns.tsx`, which P3-2 later restyles, so merging first avoids a rebase.
- Before merging: rebase onto `main`, check the four views on web, and run a device spot check.

### #19 — "Instructor free-Pro conditional access system"

**Recommendation: close as superseded.** Keep the branch; don't delete it.

- 9 files, +1,673. **Conflicts** with `main`. Open since 8 Jul.
- It would make instructors' free Pro **conditional** (quarterly referral targets, lapse and re-qualify), add an `instructor_pro_quarters` table and an `instructor_since` column (a **production schema change**), and add a new cron with warning emails.
- Since then, `main` has gone a different way: instructors get unconditional, non-expiring free Pro (`server/lib/entitlement.js:72-76`, `proSource: 'instructor'`), plus paid seats and referral payouts (PRs #103/#104). The PR also references `proSource === 'stripe'`, which is a legacy source.
- Merging it would **change entitlements and the database**, both outside this programme's approved scope.
- If conditional instructor Pro is still wanted as a business policy, it should be re-specified against today's model as a separate project. The PR's plan doc (`docs/superpowers/plans/2026-07-08-instructor-free-pro.md`, on the branch) is a useful starting point.

## F. Findings from Phase 0 work (2026-11-25), needing a decision

| # | Finding | Evidence | Recommendation | Needs |
|---|---|---|---|---|
| F1 | **Sandbox (test) purchases grant real Pro in production and count as paying.** The RevenueCat webhook never checks `environment` (sandbox vs production). This affects TestFlight and App Review purchases, and it skews the "paying" figures in the audit | `server/lib/revenuecatWebhook.js:38` grants; `:429` is the only filter (PR #108 investigation) | (a) A **separate RevenueCat project for staging** (no code change; guide §6). (b) Production **ignores or flags sandbox events**: a small server change, needing approval and a Railway deploy. Decide whether App Review sandbox purchases *should* unlock Pro. They usually should, so prefer **flagging** (e.g. `proSource:'iap_sandbox'` excluded from stats) over ignoring | ✅ **Approved 2026-11-26: both.** Staging gets its own RevenueCat project; production flags sandbox purchases (access kept for App Review) and excludes them from revenue, conversion and paying-subscriber reporting. Genuine entitlements and restore are unchanged. 🟨 **PR #111**. Missing, empty or wrong secret → 401, checked before any DB access. The scheduled caller already sends the right header. 8 new tests; server suite 331/331. Deploy needs A13 |
| F2 | **`/api/send-weekly-parent-emails` allows requests when `CRON_SECRET` is unset.** Production presumably sets it, so the live risk is low, but it fails open | `proxy.js:2359` (PR #108) | Switch it to the existing `requireCronAuth` (fail closed). A tiny server PR, needing a Railway deploy and approval | ✅ **Approved 2026-11-26.** Missing or invalid `CRON_SECRET` is refused. Regression tests cover missing, incorrect and valid credentials. In development. Deploy needs A13 |
| F3 | **Schema drift.** Production has objects missing from `schema.sql`: `profiles.account_class` and the `update_aggregate_stats` RPC. Local and staging replay therefore differ from production | PR #108 replay; live table listing | A docs/schema-only PR that adds them to `schema.sql` (no production change), derived from a read-only schema dump | ✅ **Approved 2026-11-26:** a read-only, structure-only export (no rows, no personal data), then a separate schema-only PR covering functions, policies, triggers and permissions. 🟨 **PR #112**: a replay matches production's ClearPass structure with 0 differences. Open questions for Craig: whether `referral_code` should be unique (production has no unique constraint); dropping the two 2026-09 archive tables later; documenting `account_class` values |
| F4 | **Past test dates are accepted** in onboarding | P0-1 marked the e2e check `fixme` | Fix in P5-1 (onboarding) | — (planned) |
| F5 | **`/aitutor` redirects to `/` on web** (on `main` too) | P0-2 verification | Investigate in P2-2 when Ask Pip entry points are rebuilt | — (planned) |
| F6 | **Tab bar labels clipped** at 390px on web | Audit screenshots; P0-2 screenshots | Fixed by the new tab bar in P1-2/P2-2 | — (planned) |

## F1–F3 status

All three were approved on 2026-11-26 (see table F). They are being developed as three separate PRs. Nothing is deployed or migrated.

## T. Historical in-app Pro holders (read-only investigation, 2026-11-26)

Labelled H1–H3; user IDs aren't in this public repo. From production (read-only, no personal data):

| | Store | Excluded from stats already | Purchase event | Current expiry | Provisional reading |
|---|---|---|---|---|---|
| H1 | — | **Yes** (`internal`) | none logged | 8 Dec | Internal/team account. Not in any reported figure, so no impact either way |
| H2 | Android | No | 8 Nov | 11 Dec | A ~monthly expiry. Sandbox subscriptions renew within minutes and lapse within hours, so this **looks like a genuine subscriber** |
| H3 | iOS | No | 24 Nov | **27 Nov (3 days)** | Neither a monthly nor a sandbox pattern. **Looks like a 3-day free trial**, which is counted as paying today. Possibly a sandbox purchase |

**Reported figures today:** 3 paying learners out of 54 counted learners, i.e. **5.6% conversion** (1 Stripe web purchase, plus H2 and H3).
- If H3 is a trial or a test: **2 / 54 = 3.7%**.
- If H2 were also a test: 1 / 54 = 1.9%.

**Separate finding: trials count as paying.** The webhook ignores RevenueCat's `period_type`, so anyone in a free trial is reported as a paying customer until the trial ends. Entitlement during the trial is correct; only the reporting is wrong. Proposed fix (needs approval): record trial status and report "in trial" separately from "paying".

Confirmation needs the RevenueCat dashboard (A14 / C5). The server's RevenueCat key is only on Railway, and the Railway CLI isn't logged in here. **No production records will be changed until Craig has reviewed the findings.**

## Things Claude Code will not do without explicit approval

- Merge PRs. Deploy to Vercel, Railway, OTA or the stores. Run migrations or write to the production DB.
- Change prices, products, entitlements, AI limits or models, readiness, Pip artwork or the road artwork.
- Make real purchases, or connect any preview or test to production.
- Close PRs #79 or #19.
