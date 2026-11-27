# ClearPass 2.0 — Existing → Proposed Navigation Mapping

Status: **Draft for approval** · 2026-11-25. This is a prerequisite for any navigation change [APPROVED]. Labels: [APPROVED] = from the brief, [REC] = recommendation.

## Principles

1. **No URL is removed.** Every current path keeps resolving. It either renders the same screen or redirects to its new home with the same query parameters. [REC]
2. **Route aliases stay.** These include `/aitutor`, `/roadsigns`, `/hazard`, `/progress`, `/highwaycode`, `/leaderboard` and the hidden `(tabs)/*` screens. Some of these are used by external links, the marketing site and the store.
3. **No change to these routes:** auth callbacks, deep-link handling (`src/deepLinks.ts`: `confirm-parent`, `referral`, `auth/callback`, `start`), Stripe return URLs (`/payment-success`, `/connect-return`, `/connect-refresh`), the instructor route guard, or public routes (`privacy-policy`, `terms`, `legal`, `contact`, `confirm-parent`, `paywall`).
4. The **mock test and hazard exit guards** (`_layout.tsx:68-78`) move with their screens, so they still fire on tab presses.
5. The redesigned tab bar sits behind the `ui_v2` flag until release. While the flag is off, the old navigation is untouched. [REC]

## Tab structure

| | Current (visible tabs) | Proposed [APPROVED] |
|---|---|---|
| 1 | Home | **Home** |
| 2 | Practice | **Learn** |
| 3 | Mock Test | **Tests** |
| 4 | Hazard | **Progress** |
| 5 | Settings | **Profile** |

Currently hidden tabs (`learn`, `tutor`, `highwaycode`, `roadsigns`, `progress`, `leaderboard`) become either a visible tab or a hub entry.

## Route-by-route mapping (learner app, `apps/mobile/app`)

| Existing route | Current entry points | Proposed location | URL behaviour | Notes |
|---|---|---|---|---|
| `/(tabs)/home` | Tab 1, post-auth landing | **Home** tab (Daily Coach) | unchanged | `RoadmapPath` retained |
| `/(tabs)/practice` | Tab 2, Home tiles | **Learn** › Practice questions; also launched from Home's recommendation | unchanged path; the tab highlight becomes Learn | Modes kept: topic, mixed, weak spots, bookmarked, spaced repetition, speed, battle |
| `/(tabs)/practice?mode=bookmarked` | Study hub | **Learn** › Bookmarked [REC] | unchanged | |
| Weak Spots (practice mode) | Practice screen | **Learn** › Weak Spots [APPROVED] | unchanged | |
| Speed Round (practice mode) | Practice screen | **Learn** › Speed Round [APPROVED] | unchanged | |
| Battle Mode (practice mode) | Practice screen | **Learn** › Battle Mode [APPROVED: must stay discoverable] | unchanged | Free/Pro gating unchanged (audit: ungated today; any change needs approval, D11) |
| `/challenge` | Home "Challenge a friend" | **Learn** › Challenge a friend, and Progress › Leaderboards [REC] | unchanged | |
| `/(tabs)/learn` (Study hub) | Home "Progress & More" | Replaced by the **Learn** tab hub | `/(tabs)/learn` renders the new Learn hub | |
| `/(tabs)/roadsigns`, `/roadsigns` | Home tile, Study hub | **Learn** › Road signs; Home quick access | unchanged | |
| `/(tabs)/highwaycode`, `/highwaycode` | Home tile, Study hub | **Learn** › Highway Code | unchanged | |
| `/(tabs)/tutor`, `/aitutor` | Pip FAB, Study hub, nudges, Settings | **Learn** › Ask Pip; Home quick access; contextual Pip cards; results "Ask Pip about this" | unchanged | The FAB is removed only after these entries ship [APPROVED] |
| `/study-plan` (rule-based) | Study hub | **Home** daily plan ("See full plan") and **Learn** › Study plan | unchanged | |
| `/studyplan` (AI plan) | **none, orphaned** | **Learn** › Study plan › "Personalise with Pip (AI)" [REC] | unchanged | Must become discoverable [APPROVED]. Uses the existing shared AI quota |
| `/(tabs)/mock` | Tab 3 | **Tests** › Full mock / Quick mock | unchanged | Exit guard retained |
| `/(tabs)/hazard`, `/hazard` | Tab 4 | **Tests** › Hazard perception; Home quick access (native only) | unchanged | Web: "available in the app" card [REC] |
| Previous test results (inside mock/progress) | Progress screen | **Tests** › Your recent results | new view of existing `mockTestHistory` / `hazardPerceptionHistory` | No new data |
| `/(tabs)/progress`, `/progress` | Home "Progress & More", Study hub | **Progress** tab | unchanged | Readiness, topic mastery, achievements, streaks |
| `/(tabs)/leaderboard`, `/leaderboard` | Study hub | **Progress** › Leaderboards | unchanged | Fix "this week" label |
| `/(tabs)/settings` | Tab 5 | **Profile** tab | `/(tabs)/settings` renders Profile (or redirects to `/(tabs)/profile` [REC: keep the file name to avoid churn]) | |
| `/paywall` | Banners, limits, Settings "Manage" | Unchanged route; entered from Profile › Subscription (free), limits and upsells | unchanged | Public route, kept |
| Subscription management | Settings "Manage" → paywall (bug) | **Profile** › My subscription → store management (native), info screen (web) | new sub-screen | No entitlement change |
| `/payment-success` | Stripe redirect | unchanged | unchanged | Stripe URL in `proxy.js:921` |
| `/linked-instructors` | Settings | **Profile** › Instructor connections | unchanged | |
| Referral code (inside Settings) | Settings | **Profile** › Referrals | unchanged | `referral` deep link unchanged |
| Test date (`/auth/testdate`, Settings edit) | Onboarding, Home "Change date" | **Profile** › My test; Home countdown "Change" | unchanged | |
| Accessibility (inside Settings) | Settings | **Profile** › Accessibility | unchanged | Adds Reduced Motion [APPROVED via mockup] |
| `/testday` | Home banner, Settings | **Home**, shown in the final days before the test date; **Profile** › My test | unchanged | |
| `/ipassed` | Home CTA, Settings | **Profile** › My test › "I passed / resit"; Home on or after the test date [REC] | unchanged | |
| `/(tabs)/...` Pip FAB overlay | Global | **Removed** after replacements ship [APPROVED] | — | |
| `/`, `/onboarding`, `/landing`, `/taster` | Cold start, web | Onboarding (redesign, Phase 5) | unchanged | One onboarding-state key (Phase 0 fix) |
| `/auth/*` (signup, signin, choose-account-type, testdate, reminders, forgot/reset-password, callback) | Auth funnel | unchanged paths; restyled in Phase 5 | **unchanged** | `auth/callback` must never move |
| `/instructor` | Instructor accounts | Instructor dashboard (Phase 6). Instructors keep their own surface, not the learner tabs | unchanged | Route guard unchanged |
| `/connect-return`, `/connect-refresh` | Stripe Connect | unchanged | **unchanged** | |
| `/confirm-parent` | Email link | unchanged | **unchanged** | |
| `/privacy-policy`, `/terms`, `/legal`, `/contact` | Settings, web footer | **Profile** › About & legal | **unchanged** | Linked from `apps/web` |
| `/screenshot-mode` | none (dev) | Dev/staging builds only [REC, Phase 0] | blocked in production | |

## External links that must keep working (verified by grep, 2026-11-25)

| Link source | Target |
|---|---|
| `apps/web/index.html:304` | `/paywall` |
| `apps/web/instructors.html` | `/contact`, `/privacy-policy`, `/terms`, `getclearpass.co.uk/start`, `/signup` |
| `server/proxy.js` | `/payment-success`, `/confirm-parent`, `/connect-return`, `/connect-refresh`, `clearpass://` |
| `server/lib/lifecycleEmails.js:33` | `getclearpass.co.uk/dashboard` (instructor portal) |
| Universal / App Links | `applinks:getclearpass.co.uk`, `/start` |

Push notifications don't currently deep-link to screens (no response-listener routing found), so they need no mapping.

## Verification (Phase 2 exit criteria) [REC]

An automated test visits **every** route in this table on web (stubbed backend) and asserts each one renders or redirects as specified. It also checks every hub entry reaches its destination. Deep links are checked on Android with `adb shell am start -d` and on iOS with `xcrun simctl openurl`.
