# ClearPass 2.0 — Daily Coach: Implementation Tracker

Status: **Approved plan (rev 2, consolidated)** · last updated 2026-11-25 · Spec: `01-design-spec.md` · Navigation: `02-navigation-mapping.md` · Decisions: `04-craig-actions.md` · Setup: `05-setup-guide.md`

**Status legend:** ⬜ not started · 🟦 in progress · 🟨 in review (PR open) · ✅ merged · 🚀 released · ⏸ blocked

**Release path legend:**
- **OTA:** JS only, shipped with `npm run ota:production` to 1.1.3 binaries.
- **WEB:** Vercel deploy.
- **SRV:** Railway deploy.
- **NATIVE:** EAS store build and store review.
- **DB:** migration, needs approval.
- **NONE:** tests, CI or docs only.

**Nothing is merged, deployed, migrated or released without Craig's approval.**

---

## Rev 2 changes (2026-11-25, after Craig's review)

- Consolidated from ~53 PRs into **24 PRs**, grouped by coherent outcome. Each PR keeps separate, reviewable commits.
- Reviews are batched per phase.
- Re-estimated active development effort, now shown separately from elapsed time and time waiting for approval.
- Added a **static Home preview** (milestone M0.5) built on stubbed data with no backend, so it doesn't depend on staging credentials.

## Repository status

- `main` = `origin/main` @ `d791923`. Local `main` holds 2 **unpushed** marketing-video commits (`4c08d4b`, `d3417de`). These are **preserved**: all programme branches start from `origin/main`, and nothing rewrites local `main`.
- Open PRs, reviewed in `04-craig-actions.md` §PR review:
  - **#79:** recommend merge.
  - **#19:** recommend close as superseded.
  - Neither will be actioned without approval.
- No code changes since the audit. No CI. No staging. Playwright defaults to the production URL.

## Global constraints [APPROVED]

- No rewrites.
- No lost functionality.
- No production DB changes, deploys or releases without approval.
- No changes to prices, products, entitlements, readiness calculations, AI limits or models.
- No changes to Pip artwork or the PR #105 road artwork or animation.
- No real purchases.
- No secrets in source or docs.
- No previews connected to production.
- No unapproved destructive migrations.

**`ui_v2` flag [APPROVED]:**
- Every visual change from Phase 1 onward renders only when `ui_v2` is on.
- The flag is a **build-time env value per environment**: on in local, CI and staging, off in production.
- It controls **presentation only**:
  - no stored data changes shape;
  - new data is additive, device-local keys;
  - old and new UI read the same progress data.
- Rollback is a flag-off update shipped through the normal `npm run ota:production` path, or the flag left off.
- The flag is removed after release (Phase 7).

---

## Progress log, 2026-11-26

- **A0 complete** (Craig): Vercel non-production builds off for clearpass-app and clearpass-instructor-web; 59 historical previews deleted; Vercel Authentication confirmed on.
- **#108 hardened to fail closed** (commit `b783a9b`):
  - Development builds refuse to start without `EXPO_PUBLIC_APP_ENV`.
  - A build-env check runs in the Vercel `buildCommand` and as the EAS `eas-build-pre-install` hook. Vercel preview/development and EAS non-production builds fail unless they are wired to complete, non-production staging values. This includes when no env vars are set at all.
  - instructor-web `next.config.ts` refuses production hosts outside Vercel production.
  - Production paths are unchanged.
  - Tests: mobile scripts 18 + 39 pass, instructor-web guard 7 pass. A `next build` with preview plus production values was refused; with Vercel production it loaded.
  - **Consequence for local development:** `npx expo start` now needs `EXPO_PUBLIC_APP_ENV=local` (or `production` explicitly).
- **Credential review:** no rotation needed (see `04-craig-actions.md` §R). One read-only confirmation is pending via Chrome prompt C1.
- **F1–F3 approved and in development** as three separate PRs: F2 cron auth, F1 sandbox-purchase flagging, F3 schema reconciliation (from a read-only, structure-only export).
- **Explicit environment declaration** added to #108 (commit `626a35c`):
  - Every build must declare `EXPO_PUBLIC_APP_ENV`, production included.
  - EAS production declares it in `eas.json`. `ota:production` declares it and runs the check inside the EAS production environment.
  - Vercel production needs the two non-secret variables first (A12, Chrome prompt C1b).
  - In a release bundle the app itself keeps its pinned-production fallback, deliberately: crashing every user is worse than a degraded update.
  - Tests: scripts 20 + 39 pass; instructor-web guard 7 pass.
- **M0.5 reviewed (Craig plus ChatGPT): direction approved.** Retained: palette, typography, Pip, road animation, learner states, light/dark, five tabs.
  - **Refinement round (M0.6) in progress on #114/#115:**
    - mobile density, so the next step is visible without scrolling at 390×844, 375×667 and 412×915;
    - a single Daily Coach card (Pip plus next step) whose CTA opens the recommended topic directly;
    - a desktop left sidebar (mobile keeps bottom tabs);
    - an indigo/gold Go Pro card with personalised copy and only verified benefits, never shown to Pro;
    - readiness/milestone clarity, with a journey-start state instead of an assessed-looking 0% (presentation only);
    - road-sign accuracy: **report only**, no artwork change;
    - finishing details: ticks not strikethroughs, zero-streak copy, Pro badge by name, real-shape skeletons, error/retry, reduced motion, free goals within free limits, long names, small screens, large text, contrast;
    - a placement plan for all existing Home features.
  - **Deliverables:** before/after comparisons and real viewport screenshots.
  - **The design system isn't locked until this round is reviewed.**
  - ✅ **M0.6 delivered (2026-11-26):** #114 `3b8c477`; #115 `90d389e` plus merge `ecdbaaa`.
    - **Tests:** scripts 8 + 58 pass; tsc 0 errors. With the flag off, a production-like build is unchanged.
    - **Fold:** the Daily Coach button is above the fold at 390×844, 375×667 and 412×915 for new, established and Pro. Exceptions, which reflow without clipping: 320 px wide with a long name (1 px below) and Large Text with 1.3× text (20 px below).
    - **Topic CTA:** opens `/(tabs)/practice?topic=<category>` directly (flag-gated; the free limit still applies; never discards a quiz in progress).
    - **Already wired in the real v2 Home:** celebrations, streak toasts, challenge invites, pull-to-refresh. **Planned for M1:** QOTD, nudges, reminder offer, scheduled mocks.
    - **Still not done:** the desktop sidebar is in the preview only until P2-2, and the in-app reduced-motion toggle doesn't exist yet (the OS setting is honoured).
  - **Deliverables:** gallery v2 (private artifact) and `~/clearpass-daily-coach-home-preview-v2.zip`.
- **#108:** the seed now sets `profiles.account_class='internal'` where the column exists (verified locally with and without it).
- **M0.5 delivered:** a static Home preview, drafts **#114** (design foundation and components) and **#115** (Daily Coach Home).
  - **Screenshots:** 5 learner states × mobile/desktop × light/dark, on a private gallery page.
  - **Tests:** scripts 8 + 52 pass; tsc 0 errors (main has 1). `RoadmapPath.tsx` and `assets/` are unchanged.
  - **Dependency added:** `@expo-google-fonts/inter` (JS and assets only, OTA-safe).
  - **Finding:** Metro's cache can carry `EXPO_PUBLIC_*` values between exports. A production OTA built after a preview export could ship `uiV2` on. **Fixed in #114** by adding `--clear` to the `ota:production` export. That conflicts textually with #108's `otaCommands.js` change; trivial to resolve.
  - **Still to do for M1:** carry over the current Home extras (celebrations, QOTD, nudges, reminder offer, scheduled mocks, challenge invites, pull-to-refresh); see the real Home against local Supabase; P2-2 five-tab navigator (including a desktop navigation layout); the remaining P1-2 components; an in-app Reduced Motion toggle.
- **2026-11-26 checks:**
  - **A14 (RevenueCat):** all 3 in-app holders are genuine production purchases, so nothing is reclassified. One is an active cancelled trial, wrongly counted as paying. Correct paying = 2 of 54 = **3.7%** (reported 5.6%).
  - **Trials fix:** being built as a delta PR on #113, plus #107 queries.
  - **C1:** see `04-craig-actions.md` §I.
    - `STRIPE_SECRET_KEY` on Vercel is unused and never reached a client build (the live bundle was checked), so the plan is to delete it, with no rotation needed.
    - The learner build-command override goes off in C1b.
    - Branch protection C7 and Railway R1 are prepared; C2 is revised for the Clear Pass org at ~$10/month.
- **Estimate to the working Home (M1), active effort, after M0.6 sign-off:**
  - M0.6 itself: ~1–1.5 d (in progress).
  - Carrying over the existing Home features with contextual placement: 1.5–2 d.
  - The real 5-tab navigator with the desktop sidebar (P2-2): 1.5–2 d.
  - The remaining P1-2 components: ~1 d.
  - The real Home against the local Supabase stack, plus e2e: 0.5–1 d. Needs #108 and #109 merged, or stacked branches until then.
  - **≈ 5–7 active days after M0.6 sign-off. Elapsed ~1.5–2.5 weeks**, depending on review turnaround. Infrastructure actions don't block it; hosted staging (C2) only affects *hosted* review of M1, and local review works without it.
- **F2 → PR #111, F1 → PR #113** (details in `04-craig-actions.md` table F). #107's funnel query now excludes sandbox testers (validated with EXPLAIN only on production).
- **Approved 2026-11-26** (development only):
  - final review of #111/#113, plus a consolidated merge and deploy order;
  - read-only test-purchase investigation (`04-craig-actions.md` §T);
  - Stripe live/test-mode validation PR;
  - RevenueCat IDs moved to env config.
  None of these block the Home preview.
- **F3 → PR #112** (schema-only; `schema.sql` only).
  - **Drift found:** 32 differences, including the missing `update_aggregate_stats` and `account_class`, the reshaped `hazard_clips` and `instructor_relationships`, and missing indexes, views and buckets.
  - **The repo was wrong in places:**
    - A replayed database rejected consent withdrawal.
    - It gave anonymous users read access to hazard clips, which production doesn't.
  - **Verification:** a fresh replay of `schema.sql` plus 8 migrations ran with 0 errors, and a re-diff against production shows 0 differences. No rows were exported, and the raw dump was deleted.
  - **Follow-up on #108:** once #112 merges, `seed-local.js` and the docs need updating (they say `account_class` doesn't exist), and the bucket setup in `local-setup.sql` becomes redundant.
- **Phase 1/2 started on local synthetic data:** P1-1 tokens/fonts/theme/`ui_v2` flag, the P1-2 subset Home needs, and the P2-1 Home with a fixture-driven preview route (M0.5). Branches start from `origin/main`; nothing depends on staging.

## Milestone tracker (2026-11-26)

| Milestone | Status | What's left |
|---|---|---|
| M0 Phase 0 safety | 🟨 PRs open: #107, #108, #109, #110 | Your review, then merges and releases per the sequence below |
| Security fixes | 🟨 PRs open: #111, #113, **#118 (trials, stacked on #113)**, #116, #117; plus #112 schema | Your review, then merges and releases |
| M0.5 static Home preview | ✅ Approved | — |
| M0.6 refined Home | 🟨 Delivered (gallery v2, ZIP v2) | **Your sign-off locks the design system.** Decision D20 (road-sign artwork) |
| M1 working Home and five tabs | 🟦 In development (stacked on #115): remaining Home features, the P2-2 navigator with desktop sidebar, and the real Home verified against local Supabase | ~5–7 active days from now. Needs M0.6 sign-off for visuals. Merging needs #108 and #109 first |
| Hosted staging | ⏸ Prepared (`07-infrastructure-action-plan.md` G4) | Cost approval, ≈ $10–15/month |
| Phases 3–7 | ⬜ | After M1 |

**Current blockers** (nothing blocks local development):
1. **Release control (G1)** isn't in place, so any merge deploys production. Every merge therefore waits for G1 or is treated as a release.
2. **#108** needs C1b (A12 plus turning the build override off) before it merges.
3. **Required CI on `main`** needs #109 merged, then C7b.
4. **Hosted review of M1** needs staging (G4). A local review is possible without it.
5. **Road-sign correction** needs D20.

## Recommended merge and release sequence (2026-11-26, rev 3)

**Model:** after G1 (`07-infrastructure-action-plan.md`), **merge ≠ deploy**.
- Merges land on `main` with PR plus CI.
- A **release** fast-forwards `production` to an approved `main` commit. That deploys Vercel (3 projects) and Railway together, and needs your approval each time.
- **Until G1 is done, every merge is a production deployment** on Railway (no CI gate) and all three Vercel projects. Don't merge anything before G1.

**Verified so far:**
- Server: #111/#113/#107/#108/#109/#112 merged together pass 371/371.
- #118: 390/390 server tests, 136 core tests.
- #116: 342. #117: 337.
- Only textual conflict: #110 ↔ #107 (`taster.tsx`).

| # | Step | Prerequisite | CI required | Release effect (when `production` moves) | Post-release check | Rollback |
|---|---|---|---|---|---|---|
| 0 | **G1** (`07-…` G1.1–G1.8): verify all four platforms at `d791923`; create `production`; Prompt 1 C7a, Prompt 2 P1-V, Prompt 3 P1-R | Your approval | — | Railway may redeploy the same commit | Deployment records at `d791923`; smoke PASS | Revert the settings in the dashboards |
| 1 | Merge **#109** CI (now also runs on `production` pushes, `f043c4e`), then the **validation release** | G1 | Its own run | CI files only. Confirms Railway Wait for CI and the four-platform coordination | All four at the new commit; smoke PASS | Revert PR |
| 2 | **C7b:** required checks | #109 merged | — | — | — | Edit the ruleset |
| 3 | Merge **#106** docs, **#112** schema | C7b | 7 checks | None (no migration) | — | Revert PR |
| 4 | Merge **#111**; release | R1 ✅ (`CRON_SECRET` exists) | 7 checks | Railway: the parent-email endpoint fails closed | `smoke:instructor` PASS; next cron run | Railway redeploys the previous deployment, then revert |
| 5 | Merge **#113**, then **#118**; release together | Step 4 soaked | 7 checks | Railway: sandbox and trials classified; stats corrected | Smoke PASS; next Slack stats show trial lines and paying = genuine | **#113/#118 procedure:** check for active `iap_sandbox`/`iap_trial` rows. If any, revert but keep both priority entries |
| 6 | Merge **#116**; release | **Verify the Stripe key prefix** (masked in R1). Use Railway's raw editor without saving, or the Stripe dashboard's key list | 7 checks | Railway: test-mode Stripe events ignored in production | Smoke PASS; the next real Stripe event is processed | Redeploy previous |
| 7 | Merge **#117**; release | R1 ✅ (no RevenueCat ID variables; `CLEARPASS_SERVER_ENV` absent) | 7 checks | None in production (IDs pinned) | Smoke PASS | Redeploy previous |
| 8 | **C1b**, then merge **#108**; release | C1b done | 7 checks | Web builds must declare their env | Build log shows `[check-build-env] OK (Vercel production)`; site loads | Vercel Instant Rollback, then revert |
| 9 | Merge **#110**; release (web). **OTA separately (A10)** | — | 7 checks | Web bug fixes live | Web spot check | Instant Rollback, then revert |
| 10 | Rebase **#107** on #110 (`taster.tsx`), merge, release | A6 privacy stance | 7 checks | New analytics events flow | Read-only queries | Revert (rows harmless) |
| 11 | Merge **#79**, release | — | 7 checks | Sign-image fallback | Road-signs views | Revert |
| 12 | Merge **#114 → #115 → M1 PRs**, release | M0.6/M1 sign-off | 7 checks | **No visible change** (`ui_v2` is off in production) | Production unchanged | Revert |

Steps 4–7 can each soak for a day. After any server release, Claude Code runs `npm run smoke:instructor` and reports PASS or FAIL.

**Metrics after the A14 reconciliation** (54 counted learners, read-only; fixed going forward by #118):

| Measure | Value |
|---|---|
| Genuine paying learners | **2** (1 recurring monthly subscriber via the App Store or Play Store, 1 one-off Stripe web pass) |
| Conversion (paying ÷ learners) | **3.7%** (reported today: 5.6%, because it counts a trial) |
| Recurring subscribers | 1 |
| Active trials | 1 (cancelled; Pro until 27 Nov) |
| Trials started → converted | 2 → 1 |
| Cancelled but still active | 1 (an internal-classified account; real £7.99 quarterly) |
| Granted Pro (not paying) | 1 counted instructor (plus 5 instructors and 2 complimentary accounts, excluded) |

## Consolidated PR plan

**Effort columns:**
- **Active:** focused development days for implementation, self-testing and fixing review comments.
- **Wait:** time blocked on Craig (credentials, approvals, device time). Wait time isn't counted in Active.

### Phase 0 — Safety and foundations (4 PRs, active 4–5 d)

| PR | Title | Contents | Release | Active | Needs from Craig | Status |
|---|---|---|---|---|---|---|
| **P0-1** | Test safety and CI | **Network guard:** Playwright default → local web export, a shared stub harness, and a test that **fails on any production host**. Existing e2e specs moved onto the harness. **GitHub Actions:** tsc (mobile and instructor-web), core vitest, server node tests, scripts tests, instructor-web vitest, and a stubbed Playwright smoke run. | NONE | 1.5–2 d | Actions enabled (A2, approved) | 🟨 #109 (CI green) |
| **P0-2** | Live bug fixes | Separate commits for:<br>• one onboarding-state key, with fallback reads of both old keys;<br>• free learners see results and review at the daily limit (entitlement unchanged);<br>• Pip FAB no longer covers page titles and is hidden on hazard playback and `/aitutor`;<br>• the unused 0-byte dyslexia `.ttf` removed, with the working `.otf` fonts verified;<br>• `/screenshot-mode` blocked in production builds.<br>Tests for each. | OTA + WEB | 1–1.5 d | Production release needs separate approval | 🟨 #110 |
| **P0-3** | Analytics foundation | Event taxonomy plus the new events, written via the existing `funnel_events` table (no migration). `app_opened` once per day. Read-only retention and funnel SQL kept in the repo. No content or PII. | OTA + WEB | 1 d | Confirm the privacy stance (A6) | 🟨 #107 |
| **P0-4** | Local and staging environments (adds `appEnv` config; local stack in `apps/mobile/supabase-local/`) | Local Supabase in Docker, replaying `schema.sql` and migrations. Environment config so local, staging and production are selected by env var. Seed and reset scripts for synthetic accounts, all `exclude_from_stats`. Staging docs. The hosted staging wiring lands when A1/A3 arrive, as a follow-up commit on the same PR or a small config PR. | NONE | 1–1.5 d (+0.5 d when credentials arrive) | A1, A3 | 🟨 #108 (local part; fail-closed hardening added 2026-11-26) |

**Phase 0 progress log (2026-11-25):**
- **Merge order:** #109 (CI) first, so the other PRs get CI runs; then #108, #110 and #107. Rebase each after the previous one merges. #110 and #107 both touch `practice.tsx` in small, separate places.
- **TypeScript baseline on `main`:** a clean CI install gives 1 error, `app/_layout.tsx:409` (`suppressHydrationWarning` on `View`). Some local installs show 3–17, depending on installed dependency versions. The CI step is report-only until this is fixed; the fix is folded into P1-1.
- **Device verification pending** (no device attached): P0-2 fixes 2–4 on iOS and Android. Hazard e2e specs are skipped on web (the web build shows "mobile app only").
- **New findings, logged in `04-craig-actions.md` (F1–F6):** sandbox purchases grant real Pro in production; a cron endpoint is unauthenticated when `CRON_SECRET` is unset; schema drift between production and `schema.sql`; past test dates are accepted; `/aitutor` redirects to `/` on web; tab labels are clipped on web at 390px (the last fits into P1-2).

### Phase 1 + 2 — Design foundation, Home and navigation (4 PRs, active 7–9 d) ★ M1

| PR | Title | Contents | Release | Active | Status |
|---|---|---|---|---|---|
| **P1-1** | Design foundation | Semantic light and dark tokens, with a test that enforces AA contrast for every pair. Inter loaded at runtime (OTA-safe). Type scale. `ThemeProvider` with in-app dark mode, the existing setting. In-app Reduced Motion combined with the OS setting. The `ui_v2` flag. Old theme modules become aliases. | OTA + WEB | 2 d | 🟨 draft #114 (with the P1-2 Home subset) |
| **P1-2** | Core components | Text, Button, Card, ListRow, Badge, Input (with label and error), ScreenHeader, IconButton, ProgressBar, Icon (Ionicons). 44/48pt targets, roles and labels. A dev/staging component gallery with screenshot tests. Wraps existing `ScaleButton`, `SkeletonBox` and `AnswerOptions` rather than duplicating them. | OTA + WEB | 1.5–2 d | 🟦 Home subset in #114; ListRow, Input, IconButton and the gallery remain |
| **P2-1** | Daily Coach Home | Recommendation engine in `packages/core` (pure, unit-tested; readiness untouched). Daily plan and daily goal, stored locally. `PipCard` with the rule-based message library (existing poses only). New Home following the approved hierarchy, with the **existing `RoadmapPath` unchanged**. States: new, established, free, Pro, no test date, offline, loading. Desktop width handled. | OTA + WEB | 2.5–3 d | 🟨 draft #115 (stacked on #114). Preview done; real Home wired behind `uiV2` but not yet seen against local Supabase |
| **P2-2** | Five-tab navigation | Home, Learn, Tests, Progress, Profile. Hubs link to the **existing** screens. Settings content moved into Profile. Every route alias and redirect follows `02-navigation-mapping.md`, with an e2e route-coverage test. Battle, Challenge, the AI study plan and Bookmarks made discoverable. Ask Pip entry points added. **PipFab removed.** | OTA + WEB | 1.5–2 d | ⬜ |
| — | (P0-2 and P0-1 must be merged first) | | | | |

### Phase 3 — Learning experience (3 PRs, active 5–7 d)

| PR | Title | Contents | Release | Active |
|---|---|---|---|---|
| **P3-1** | Practice loop | Learn hub final. Topic picker. Question presentation (with image alt text). Accessible feedback and explanations. Pip tips. Results and review of incorrect answers. Next activity. `AnswerOptions` changes are regression-tested in mock too. | OTA + WEB | 2.5–3 d |
| **P3-2** | Road signs and Highway Code | Restyle browse, quiz, flashcards and reader (after #79). | OTA + WEB | 1.5–2 d |
| **P3-3** | Speed Round, Weak Spots, Battle and Challenge | Restyle and integrate into the hub. Gating unchanged; post-purchase copy fixed (D11). | OTA + WEB | 1–2 d |

### Phase 4 — Tests and progress (3 PRs, active 5–6 d)

| PR | Title | Contents | Release | Active |
|---|---|---|---|---|
| **P4-1** | Tests hub and mock tests | Hub (real Quick-mock values; hazard card says "available in the app" on web). Mock intro, questions, overview and result. Exit guard and timer preserved. Results history. | OTA + WEB | 2–2.5 d |
| **P4-2** | Hazard perception | Restyle intro, results and timeline. **Scoring untouched.** Device test on iOS and Android. | OTA | 1.5 d |
| **P4-3** | Progress | Readiness presented per D9 (presentation only). Mastery, achievements, streaks, leaderboard (label fix, error state). Detailed road progression. | OTA + WEB | 1.5–2 d |

### Phase 5 — Onboarding and commercial (4 PRs, active 5–6 d)

| PR | Title | Contents | Release | Active |
|---|---|---|---|---|
| **P5-1** | Onboarding and auth | Four steps or fewer, test date optional, resumable. Labelled auth inputs. 8+ character password for new passwords (D13). Onboarding events. | OTA + WEB | 1.5–2 d |
| **P5-2** | Ask Pip allowance endpoint | Additive, read-only `GET`. **No change to limits or models.** Server tests. Deploy needs approval, followed by the instructor smoke test. | **SRV** | 0.5 d |
| **P5-3** | Ask Pip UI | Chat restyle, suggested questions, remaining allowance (from P5-2), accessible controls, loading and error states. No feedback buttons. | OTA + WEB | 1–1.5 d |
| **P5-4** | Pro upgrade and subscription | Outcome-led paywall with **monthly first**, the same products, prices and disclosures, restore and "continue free". My subscription screen (store management on native, info screen on web). Transparent free-limit counters. `plan_selected` on all platforms and placement taxonomy. Sandbox and test-mode e2e. | OTA + WEB | 2 d |

### Phase 6 — Remaining experience (3 PRs, active 5–6 d)

| PR | Title | Contents | Release | Active |
|---|---|---|---|---|
| **P6-1** | Profile, settings and accessibility | Profile sections. Every accessibility setting applied on every screen, with a coverage test. Account deletion honours the server response. | OTA + WEB | 2 d |
| **P6-2** | Instructor experience | App dashboard: the **existing 3 tiers**, no invented stats, invites and referrals unchanged. Tokens applied to `apps/instructor-web`. | OTA + WEB (+ portal deploy) | 2 d |
| **P6-3** | Remaining screens and polish | Test Day, I Passed, linked instructors, legal, contact, taster, landing copy. Desktop and dark-mode sweep. Deletion of dead styles and duplicate components. | OTA + WEB | 1.5–2 d |

### Phase 7 — Release preparation (2 PRs + test campaign, active 4–5 d)

| PR | Title | Contents | Release | Active |
|---|---|---|---|---|
| **P7-1** | Regression and accessibility suites | Full stubbed web e2e. Maestro flows (Android). iOS simulator runs. axe. Purchase sandbox scripts. | NONE | 2 d |
| **P7-2** | Release: flag on and remove legacy | OTA compatibility check (fingerprint against 1.1.3). Flag on per environment. Release notes and rollback runbook. Legacy UI removed in a follow-up once stable. | OTA/WEB (+NATIVE only if D14 requires) | 1.5–2 d |
| — | Test campaign (Craig's devices) | VoiceOver and TalkBack walkthroughs, sandbox purchases, device spot checks | — | Craig's time |

### Totals

| | PRs | Active dev (days) |
|---|---|---|
| Phase 0 | 4 | 4–5 |
| Phases 1+2 | 4 | 7–9 |
| Phase 3 | 3 | 5–7 |
| Phase 4 | 3 | 5–6 |
| Phase 5 | 4 | 5–6 |
| Phase 6 | 3 | 5–6 |
| Phase 7 | 2 | 4–5 |
| **Total** | **23** | **35–44** |

The table lists **23 implementation PRs**. With the docs PR, the programme is **24 PRs**.

### Why the estimate fell from 58–78 to 35–44 days, and where it can't go lower

- **Fewer PRs** removes about 30 × (branching, PR write-up, CI wait, review-fix round) ≈ 8–12 days of overhead.
- **Components first.** Accessibility, dark mode, dyslexia and large-text support live in the P1-2 primitives, so later screens inherit them rather than each implementing them. This saves about 6–10 days across Phases 3–6.
- **Parallel work** after P2-2: Phases 3, 4 and 5 (and P6-2) touch separate screens and can be built at the same time in separate worktrees. This cuts **elapsed** time, not active effort.
- **Not reduced, deliberately:** Phase 0 safety (the guard, CI, local DB), Phase 7 device and accessibility testing, and sandbox purchase testing. Cutting any of these to hit a number would compromise isolation or release safety. The 35-day floor assumes the large screens (`practice` 2.8k lines, `instructor` 2.2k) restyle without needing structural refactors. If they do need them, Phases 3 and 6 grow by 2–4 days.

## Milestones and targets

| Milestone | Definition | Active dev from start | Realistic? |
|---|---|---|---|
| **M0.5 — Static Home preview** | Daily Coach Home rendered from the real app code on **stubbed data**, with no backend at all. Uses PR #105 road artwork, original Pip assets and the 5-tab bar (visual only). Delivered as 390px and 1440px screenshots plus a local run command. **No hosted preview until staging exists**, because a hosted preview built today would carry production env vars. | **~3 d** (P1-1 minimal tokens, a subset of P1-2, the P2-1 layout with a stub recommendation) | ✅ Within the 2–4 day target |
| **M1 — Working Daily Coach Home** | Real Home and 5-tab navigation behind `ui_v2`, running against **local Supabase** with seeded accounts, on web and an Android/iOS dev build. Real recommendation engine, all states. | **~9–11 d** (P0-1, P0-2, P0-4 local part, P1-1, P1-2, P2-1, P2-2) | ⚠️ 10 days is achievable; 7 is not without cutting the Phase 0 guard and CI, which isn't recommended. **Reviewing it on hosted staging** additionally needs A1 |
| M2 — Learning loop | Phases 3 and 4 | +~8–10 d (parallel) | |
| M3 — Commercial | Phase 5 including sandbox purchases | parallel with M2 | needs A3 |
| M4 — Release candidate | Phases 6 and 7, sign-off | ~35–44 d total | |

### Elapsed time (calendar), separated

| Component | Estimate | Notes |
|---|---|---|
| Active development | 35–44 days | Can be compressed in calendar terms by parallel work after M1 (to roughly 25–32 working days elapsed) |
| Waiting on credentials | 0–5 days | A1 (Supabase staging), A3 (Stripe test mode and RevenueCat sandbox). Phase 0 continues without them |
| Waiting on reviews | ~7 review batches × 1–3 days = **7–21 days** | One batch per phase plus M0.5 and M1. The largest variable |
| Craig's device and accessibility testing | 2–4 days | Phase 7 |
| Store review (only if D14 = store build) | 1–7 days | Not needed for OTA-only |
| **Overall calendar** | **≈ 7–11 weeks** | Depends mainly on review turnaround |

## Dependencies and parallelism

```
P0-1 ─┬─► P1-1 ─► P1-2 ─► P2-1 ─► P2-2 ─┬─► P3-1..3 ─┐
P0-2 ─┤   (M0.5 static preview off P1-1/P1-2/P2-1)  ├─► P4-1..3 ─┼─► P7-1 ─► P7-2
P0-3  │ (independent)                               ├─► P5-1,3,4 ┤
P0-4 ─┘ (M1 local run)          P5-2 (server, any time after approval)
                                P6-2 instructor after P1-2 ──────────┤
                                P6-1, P6-3 after P2-2 ───────────────┘
```

- **Independent now:** P0-1, P0-2, P0-3 and the local part of P0-4. P5-2 can be built at any time.
- **Sequential spine:** P1-1 → P1-2 → P2-1 → P2-2.
- **Parallel after P2-2:** Phases 3, 4, 5 and 6.
- **External dependencies:**
  - A1 for hosted staging review.
  - A3 for purchase testing.
  - Approval for the P5-2 deploy.
  - Phase 7 device time.

## Risks and blockers

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | **No staging today.** Previews and e2e default to production | High / High | P0-1 blocks redesign work; a guard test fails on any production host |
| R2 | Very large screen files (`practice` 2.8k, `instructor` 2.2k, `home`, `settings`, `roadsigns` ~1.6–1.9k lines) | High / Med | Extract sub-components first (behaviour-preserving PRs with tests), then restyle |
| R3 | Shared components (`AnswerOptions`, `PaywallPrompt`, `CelebrationModal`, theme) affect several screens at once | Med / Med | Regression e2e across all consumers before merging |
| R4 | Progress sync is last-write-wins on one JSON blob; new fields (daily goal, onboarding step) could clash across devices | Med / Med | Keep new state device-local unless approved; add any synced fields additively |
| R5 | OTA reach: only 1.1.3 binaries receive updates (`appVersion` policy); older installs stay on the old UI | Certain / Low–Med | Accept; or store-build 1.2.0 with a forced-update prompt (D14) |
| R6 | Flagged code paths double the UI surface temporarily | Med / Low | Phase 6 deletion sweep; flag removed after release |
| R7 | Purchase flows (RevenueCat/Stripe) regress during the paywall restyle | Low / **High** | No logic change; sandbox e2e; Craig approves P5-4 separately |
| R8 | Hazard playback is WebView/device-specific | Med / Med | Device tests in P4-2; scoring untouched |
| R9 | Pip artwork resolution limits for hero-size use (largest @3x ≈ 240px) | Med / Low | Use within limits; request higher-res originals (A7), never redraw |
| R10 | Mockup assumptions conflict with reality (Pip design, Quick mock values, instructor tiers, bell, logo) | Certain / Low | Documented in spec §3, §6; decisions D1–D10 |
| R11 | Small user base makes conversion and retention changes statistically unmeasurable for months | Certain / Med | Instrument now (P0-3); judge on qualitative testing plus leading indicators |
| R12 | Supabase project is shared with Zen Footy | — / High if mishandled | No production DB changes in this programme without approval; staging isolates development |
| R13 | Accessibility settings coverage requires touching every screen | High / Med | Settings enforced in primitives (P1-1/P1-2), so migrated screens inherit them automatically |

## Staging and automated testing approach [REC]

**Environments:**

| Env | Backend | Web | Mobile | Payments |
|---|---|---|---|---|
| Local | Local Supabase (Docker, `supabase start`, replay `schema.sql` + migrations) **or** staging | `expo start --web` | Dev client (`development` profile) | Stubbed |
| Staging | Separate Supabase project (D12) + Railway staging service + staging Anthropic key with a low spend cap | Vercel **Preview** env vars → staging | EAS `preview` channel (internal distribution) | Stripe **test mode**, RevenueCat **sandbox** |
| Production | Unchanged | Vercel Production | `production` channel via `npm run ota:production` | Live (no testing) |

**Test layers:**
1. **Unit** (vitest / node:test): tokens contrast, recommendation engine, entitlement and readiness (unchanged; existing tests stay green), onboarding state, nav mapping table.
2. **Web e2e** (Playwright, stubbed network, CI): route coverage, critical journeys (onboarding → first practice → results; free limit → results → paywall; mock; Ask Pip with a stubbed reply; Profile settings), screenshot comparisons for primitives and key screens at 390/1440, axe accessibility scan. **Hard fail on any production host.**
3. **Staging e2e** (Playwright against the staging backend, manual trigger): real auth and sync with seeded accounts.
4. **Native** (Maestro on Android emulator/device locally; iOS simulator): onboarding, practice, mock exit guard, hazard playback, purchase sheet up to sandbox confirmation.
5. **Server**: existing `node --test` suite. `npm run smoke:instructor` after any approved Railway deploy (per `CLAUDE.md`).

## Analytics plan (P0-3 + P5-4) [APPROVED events; REC naming]

| Requirement | Event(s) | Notes |
|---|---|---|
| Registration started / completed | `signup_started`, `signup_completed` | |
| Onboarding started / completed | `onboarding_started`, `onboarding_step_viewed{step}`, `onboarding_completed` (exists) | |
| First question answered | `first_question_answered` | once per account (local flag + server de-duplication in the query) |
| First practice session completed | `first_session_completed` | |
| Daily plan viewed / started | `daily_plan_viewed`, `daily_plan_item_started{item}` | |
| Practice results viewed | `practice_results_viewed{mode, limit_reached}` | |
| Daily free limit | `daily_limit_hit` (exists) | |
| Paywall viewed | `paywall_viewed{placement}` (exists; add placement) | |
| Purchase started / completed | `purchase_started`, `purchase_succeeded` (exist) | |
| Feature usage | `feature_used{feature}`, enumerated features | no content |
| D1 / D7 / D30 retention | `app_opened` (max 1/day/actor) | retention computed by read-only SQL |
| Instructor invites / referrals | `instructor_invite_sent`, `instructor_invite_accepted`, `referral_shared` | server-side where the action happens |

Every event carries `platform` (already captured: web/ios/android). Genuine vs test is derived at query time from `profiles.exclude_from_stats` / `account_class`; comp accounts from `progress.proSource = 'comp'`. **No question text, answers, chat content, emails or names in `props`.** [REC] Consider moving off `funnel_events` RLS-insert-from-client only if abuse appears; no change now.
