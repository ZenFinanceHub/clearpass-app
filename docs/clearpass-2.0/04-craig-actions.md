# ClearPass 2.0 — Actions and Decisions for Craig

Last updated 2026-11-25 (rev 2, after Craig's plan approval). Step-by-step instructions are in `05-setup-guide.md`.

## A. Actions (things only Craig can do)

| # | Action | Needed for | Blocking? | Status |
|---|---|---|---|---|
| **A0** | **URGENT: stop Vercel PR previews from using production.** Vercel builds a preview for every PR branch (seen on #106–#110), and the app hardcodes production Supabase, so previews read and write the production DB (sign-ins, progress sync, `funnel_events`). Until staging Preview env vars exist (A1), in Vercel open **clearpass-app → Settings → Git → Ignored Build Step**, choose **"Only build production"** (or the custom command `[ "$VERCEL_ENV" != "production" ]`, which skips non-production builds), and do the same for **clearpass-instructor-web**. `clearpass-web` is static and harmless. Also confirm **Deployment Protection** is on for previews. Until then, please don't open PR preview links | All PRs | **Yes, for preview safety** | ⬜ |
| A1 | Create the **hosted staging Supabase project** and enter its keys into Vercel Preview, EAS `preview` and Railway staging (guide §1–§3) | P0-4 hosted part; hosted review of M1 | Blocks hosted staging only. Local development continues | ⬜ |
| A2 | **Enable GitHub Actions** (guide §4) | P0-1 CI | — | ✅ Already enabled; CI ran green on #109. Optional: apply the §4 hardening settings and make `ci` a required check |
| A3 | **Stripe test mode and RevenueCat sandbox** set up for staging (guide §5–§6) | P5-4, P7 purchase testing | Phase 5 testing | ⬜ (approved to prepare) |
| A4 | ~~Unpushed commits~~ **Decided: preserve.** Programme branches start from `origin/main`; local `main` is left untouched | — | — | ✅ |
| A5 | Approve the PR #79 / #19 recommendations below | Before P3-2 | No | ⬜ |
| A6 | Confirm the analytics privacy stance (events carry no content or PII; platform plus anonymous install id only) and whether the privacy policy needs a line about product analytics | P0-3 merge | Before P0-3 merges | ⬜ |
| A7 | (Optional) Supply higher-resolution original Pip files if they exist. Otherwise Pip is used at existing sizes, up to ~240px @3x | P2-1 hero sizes | No | ⬜ |
| A8 | Device and accessibility test time in Phase 7 (iOS and Android devices; VoiceOver and TalkBack) | P7 | Phase 7 | ⬜ |
| A9 | Review batches: one per phase, plus M0.5 and M1 | All | — | ⬜ |
| A10 | Approve **production release** of the P0-2 bug fixes (OTA and web) once reviewed | P0-2 release | — | ⬜ |
| A11 | Approve the **Railway deploy** of the Ask Pip allowance endpoint (P5-2) once reviewed and tested | P5-3 | — | ⬜ |

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
| F1 | **Sandbox (test) purchases grant real Pro in production and count as paying.** The RevenueCat webhook never checks `environment` (sandbox vs production). This affects TestFlight and App Review purchases, and it skews the "paying" figures in the audit | `server/lib/revenuecatWebhook.js:38` grants; `:429` is the only filter (PR #108 investigation) | (a) A **separate RevenueCat project for staging** (no code change; guide §6). (b) Production **ignores or flags sandbox events**: a small server change, needing approval and a Railway deploy. Decide whether App Review sandbox purchases *should* unlock Pro. They usually should, so prefer **flagging** (e.g. `proSource:'iap_sandbox'` excluded from stats) over ignoring | Decision + approval for (b) |
| F2 | **`/api/send-weekly-parent-emails` allows requests when `CRON_SECRET` is unset.** Production presumably sets it, so the live risk is low, but it fails open | `proxy.js:2359` (PR #108) | Switch it to the existing `requireCronAuth` (fail closed). A tiny server PR, needing a Railway deploy and approval | Approval |
| F3 | **Schema drift.** Production has objects missing from `schema.sql`: `profiles.account_class` and the `update_aggregate_stats` RPC. Local and staging replay therefore differ from production | PR #108 replay; live table listing | A docs/schema-only PR that adds them to `schema.sql` (no production change), derived from a read-only schema dump | Approval to read production schema (read-only) |
| F4 | **Past test dates are accepted** in onboarding | P0-1 marked the e2e check `fixme` | Fix in P5-1 (onboarding) | — (planned) |
| F5 | **`/aitutor` redirects to `/` on web** (on `main` too) | P0-2 verification | Investigate in P2-2 when Ask Pip entry points are rebuilt | — (planned) |
| F6 | **Tab bar labels clipped** at 390px on web | Audit screenshots; P0-2 screenshots | Fixed by the new tab bar in P1-2/P2-2 | — (planned) |

## Things Claude Code will not do without explicit approval

- Merge PRs. Deploy to Vercel, Railway, OTA or the stores. Run migrations or write to the production DB.
- Change prices, products, entitlements, AI limits or models, readiness, Pip artwork or the road artwork.
- Make real purchases, or connect any preview or test to production.
- Close PRs #79 or #19.
