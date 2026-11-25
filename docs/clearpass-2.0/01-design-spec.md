# ClearPass 2.0 — Daily Coach: Design Specification

Status: **Draft for approval** · Created 2026-11-25 · Owner: Craig · Implementer: Claude Code

Sources: Craig's programme brief (2026-11-25), approved mockups (`ClearPass-01-Home.png`, `-02-Core-Screens.png`, `-03-Remaining-Screens.png`, held outside the repo), and the audit pack (`/home/craig/clearpass-audit-pack/`, not in the repo).

**Labels used throughout:**
- **[APPROVED]** — a requirement from Craig's brief. Not open to reinterpretation.
- **[REC]** — Claude Code's recommendation. Needs Craig's sign-off; see `04-craig-actions.md`.
- **[CONFLICT]** — the mockup and the written requirements disagree. The written requirement wins, per the brief.

Precedence: written requirements > existing functionality and brand assets > mockups.

---

## 1. Objectives [APPROVED]

Turn ClearPass from a set of revision tools into a guided daily learning experience. The goals are:
- better first-session activation;
- intuitive navigation;
- one clear recommended next activity;
- better engagement and retention;
- better conversion;
- a consistent, professional identity;
- better accessibility;
- no loss of functionality or user data.

This is an improvement programme, not a rewrite.

## 2. Brand tokens

### 2.1 Approved palette [APPROVED], validated against WCAG 2.2 AA

Ratios were computed on 2026-11-25. Text needs 4.5:1 (3:1 for large text, meaning 18.66px bold or 24px and above). Meaningful non-text UI needs 3:1.

| Token | Hex | Verified use | Ratio |
|---|---|---|---|
| Primary indigo | `#4F46E5` | White text on it; as text on white or `#F7F8FC` | 6.29 / 6.29 / 5.92 ✅ |
| Deep indigo | `#312E81` | White text on it | 11.42 ✅ |
| Secondary teal | `#0F766E` | White text on it; as text on white | 5.47 / 5.47 ✅ |
| Accent gold | `#F59E0B` | **Decoration only, or with dark text on it** (`#111827` 8.26, `#312E81` 5.32) | ⚠️ White on gold 2.15 ❌; gold text on white 2.15 ❌; gold as a meaningful icon/border on white fails 3:1 ❌ |
| Success | `#047857` | White text on it; as text on white; on `#D1FAE5` | 5.48 / 5.48 / 4.84 ✅ |
| Error | `#B91C1C` | White text on it; as text on white; on `#FEE2E2` | 6.47 / 6.47 / 5.30 ✅ |
| Primary text | `#111827` | On white / `#F7F8FC` | 17.74 / 16.72 ✅ |
| Light background | `#F7F8FC` | — | — |
| Card | `#FFFFFF` | — | — |

**Rules that follow from this:**
- **Gold is never used for text, or as the only signal of meaning, on light backgrounds.** Streak and Pro badges use gold *fills* with `#111827` text, or gold decoration next to a text label.
- Secondary text stays at `#6B7280` (4.56 on `#F7F8FC`, which passes but has no margin to spare). `#9CA3AF` is **banned for text**; it fails at 2.54.
- The current error red `#EF4444` (3.76) and success green `#10B981` (2.54) **fail** and are replaced by `#B91C1C` / `#047857`.

### 2.2 Semantic tokens [REC]

Components refer to roles, never to hex values. Proposed roles:
- **Surfaces:** `bg.canvas`, `bg.card`, `bg.subtle`.
- **Text:** `text.primary`, `text.secondary`, `text.onPrimary`, `text.link`.
- **Brand:** `brand.primary`, `brand.deep`, `brand.secondary`, `accent.gold`.
- **Status:** `status.success|error|warning|info` and a matching `.bg` for each.
- **Lines and focus:** `border.default`, `focus.ring`.
- **Charts:** `chart.*` for the mastery bars.

The light and dark sets are both generated from one file. A unit test asserts every defined foreground/background pair meets its required ratio, so CI blocks any regression.

### 2.3 Dark-mode palette [REC]

Proposed values:

| Role | Hex | Contrast |
|---|---|---|
| Canvas | `#0A0A0F` | — |
| Card | `#1F2937` | — |
| Text | `#F9FAFB` | — |
| Secondary text | `#D1D5DB` | 9.96 on card |
| Primary | `#818CF8` | 6.62 on canvas |
| Teal | `#2DD4BF` | — |
| Success | `#34D399` | 9.23 |
| Error | `#F87171` | 6.41 |

Text on dark-mode primary buttons must be **dark** (`#0A0A0F`, 6.62), not white; white on `#818CF8` fails at 2.98.

### 2.4 Typography [APPROVED: Inter, subject to compatibility]

[REC]:
- Load Inter at runtime with `expo-font` `useFonts`, the same way OpenDyslexic is loaded today in `app/_layout.tsx:221`. This is **OTA-safe**: the font files ship in the JS update and no native config change is needed.
- Use 4 weights (400/500/600/700).
- Type scale:
  - Display 28/34
  - Title 22/28
  - Heading 18/24
  - Body 16/24
  - Body-small 14/20
  - Caption 12/16, never used for essential information
- The scale responds to the OS font scale (capped multiplier), to the in-app Large Text setting, and to the Dyslexia font setting. OpenDyslexic replaces Inter wholesale when dyslexia mode is on.

### 2.5 Shape, spacing and elevation [REC]

- **Spacing:** 4-pt scale (4, 8, 12, 16, 20, 24, 32, 40).
- **Radii:**
  - Cards: 16
  - Controls: 12
  - Pills/badges: 999
  - Tab active indicator: 12

  These match the mockups' rounded cards and the instructor portal's existing `--radius-card:16px`.
- **Elevation:** 2 levels only (card, raised). Prefer borders over shadows on web.
- **Touch targets:** at least 44×44pt (iOS) / 48dp (Android), with `hitSlop` where the visual element is smaller.

### 2.6 Iconography [REC]

- Replace emoji used as UI icons with `@expo/vector-icons` (Ionicons), which is already installed.
- Emoji may remain inside *copy* (for example in a Pip message), but never as the only label of a control.
- Icons that are the only label of a control must have an accessibility label.

## 3. Pip

### 3.1 Requirements [APPROVED]

- Pip stays the **existing hedgehog**. Use only the original assets and expressions: `apps/mobile/assets/pip/`, with poses celebrating, encouraging, neutral, sleepy, streak, teaching and thinking, plus fab, each at @1x/@2x/@3x.
- Do not recreate Pip, add clothing, or alter his glasses or character design.
- Pip becomes a contextual learning companion throughout the app.
- Remove the floating Pip button once replacement access routes exist.
- Use existing progress data and **predefined messages** where AI is unnecessary.

### 3.2 Conflicts with the mockups [CONFLICT]

| Mockup shows | Resolution |
|---|---|
| A robot/astronaut character as "Pip" (Home mockup) | Not used. Existing Pip pose instead. |
| A brown, realistic hedgehog **with glasses, a green "P" shirt and an L-plate** (all other mockups) | Not used. The existing Pip is a stylised **blue** hedgehog with an orange face, **no glasses and no clothing** (`assets/pip/pip-teaching@2x.png`). The brief's mention of "his glasses" doesn't match the current artwork; Craig to confirm (`04-craig-actions.md` D1). |
| Pip in a large hero illustration (onboarding, results, Ask Pip) | Use the existing poses at a larger size. If a pose isn't available at the needed resolution (largest today is @3x ≈ 240px), flag it rather than upscale or redraw. |

### 3.3 Pip message system [REC]

- A local, rule-based message library selects `{pose, message}` from progress state. Examples: streak at risk, weak topic, mock passed, test in 7 days, first session, returning after a gap.
- No AI calls.
- Deterministic, with unit tests, and copy kept in one file for review.
- Messages respect reduced motion: no animated entrance when reduce-motion is on.

## 4. Road to Test Ready [APPROVED]

- Preserve the **existing driver's-view road and car artwork**, including the 25 Nov 2026 redesign (PR #105, `src/components/RoadmapPath.tsx`).
- [CONFLICT] **Do not** use the mockups' winding green-hills illustrated road.
- Keep the visual car progression and the milestone celebrations. Respect reduced motion. (Today `RoadmapPath.tsx:73-77` already honours the OS setting. The approved in-app Reduced Motion toggle must also gate it.)
- Prominent on Home, with more detail inside Progress.
- **Do not change the readiness calculation** without separate approval.
- [REC] The mockup's "68% / Your journey so far" header is allowed only if it shows a value the app **already** computes. Today the roadmap shows "N/4 passed" and a "% ready" gauge. No new percentage is introduced.

## 5. Navigation [APPROVED]

The five learner tabs are **Home · Learn · Tests · Progress · Profile**. Contents of each tab are as specified in the brief. The full mapping is in `02-navigation-mapping.md`.

Requirements:
- Every existing feature, including Battle Mode and the AI study plan, stays discoverable.
- Deep links, auth callbacks and existing journeys are preserved.

**Header [CONFLICT/REC]:** the mockups show a check-mark "ClearPass" logo, a notification bell and a profile icon.
- No standalone logo file exists in the repo (audit `05`), and the check-mark mark is new brand artwork. Decision D2.
- No notification centre exists, so a bell with nothing behind it would be a dead end. [REC] Omit the bell until a notification inbox is approved (D3).
- The profile icon duplicates the Profile tab. [REC] Omit it on mobile and keep it on desktop.

## 6. Screen concepts

### 6.1 Home — Daily Coach [APPROVED hierarchy]

1. Greeting and test countdown.
2. Road to Test Ready.
3. Contextual Pip encouragement.
4. **One** prominent recommended activity.
5. Quick access: Mock Tests, Hazards, Road Signs, Ask Pip.
6. Daily goals and streaks.

Recommendations adapt to progress, subscription, platform and test date. Functionality the current platform can't offer is never recommended; for example, hazard perception is never recommended on web, where it isn't available.

[REC] The recommendation engine is a pure function in `packages/core`. Inputs: progress, entitlement, platform, test date and now. Output: a single next activity plus a short daily plan of 3 items. It is unit-tested and changes no data.
- The **daily goal** (for example "2 of 3 completed") is new. It is derived locally from today's activity against the daily plan; no new server data is needed.
- The quick-access tile for hazard perception is hidden on web. Alternatively it could show "Available in the app" (D8).
- Learners without a test date get a "Set a test date (optional)" prompt, and no countdown.
- The "I Passed my Theory Test!" call to action moves to Profile and appears on Home only on or after the test date. This avoids the audit finding of it dominating Home.

### 6.2 Learn hub [APPROVED contents]

The hub lists:
- Practice questions
- Topic revision
- Road signs
- Highway Code
- Speed Round
- Weak Spots
- Ask Pip

[REC] It also lists **Battle Mode / Challenge a friend**, **Bookmarked questions** and the **Study plan**, to meet the discoverability requirement.

### 6.3 Practice and results [APPROVED]

- Question progress, readable options, accessible feedback, explanations and contextual Pip tips.
- Results include a review of incorrect answers and a next-activity recommendation.
- **Free learners see and review results for questions already answered.** This is the fix for the audit's finding at `practice.tsx:773-782`.
- [REC] Feedback is never colour-only: it uses an icon plus the text "Correct" / "Incorrect" and an announcement to screen readers.
- [CONFLICT] The mockup's "4m 32s time taken" may be shown only if the session already measures it.

### 6.4 Tests hub [APPROVED contents]

- Full mock (50 questions, 57 minutes, pass mark 43)
- Quick mock
- Hazard perception
- Previous results

[CONFLICT] The mockup says Quick mock is "10 questions · 5 minutes". The real values are **25 questions · 28 minutes · pass mark 22** (`mock.tsx:57-59`). The real values are shown.

[REC] The hazard card on web shows "Available in the iOS and Android app", with no start button.

### 6.5 Progress [APPROVED contents]

- Readiness
- Topic mastery
- Achievements
- Streaks
- Leaderboards
- Detailed progress

[REC] Proposal to consolidate readiness indicators. **Presentation only; no calculation change** (D9):
- Keep **one headline number**, the existing `readinessScore` that drives the roadmap.
- Show pass probability and topic mastery as *explanations* underneath, with labels saying what each measures.
- Any merge of calculations needs separate approval.

Fix the leaderboard "this week" mislabel (copy change only).

### 6.6 Pro upgrade [APPROVED]

- Outcome-focused, with clear benefits.
- **Existing prices and products unchanged:** £2.99 / 1 month and £7.99 / 3 months on all platforms; RevenueCat on native, one-off Stripe payment on web.
- Accurate renewal and billing disclosures, kept from `purchaseGate.ts` `getSubscriptionDisclosure`.
- Restore purchases on iOS and Android.
- Clear dismissal ("Continue with free plan") back to the free experience.

Conflicts and recommendations:
- [CONFLICT] The mockup pre-selects **3 months** and lists it first. PR #102 (4 Nov) deliberately put **monthly first**. Decision D5; the default is to keep monthly first.
- [CONFLICT] The mockup says "£2.66 per month". That's allowed only if it's computed from store prices, and it must comply with App Store price-display rules (D5).
- [REC] Benefit copy must match real entitlements. The mockup's "Personalised revision guidance" must be checked against real entitlements before it is used. Study plans are available to free users today, with AI plans drawing on the shared 10-request lifetime free quota.

### 6.7 Ask Pip [APPROVED]

- Friendly chat, suggested questions, a **transparent remaining allowance**, accessible controls, and loading/error states.
- Do not change limits or models. Today the limits are free: 10 lifetime, shared; Pro: 20 per day.

Dependency [REC]: the server reports usage only when the limit has been hit (HTTP 429, `proxy.js:~805`). Showing a remaining count needs a **small, additive, read-only server change** (a usage endpoint or response header) and a **Railway deploy**. Approval D6.

[CONFLICT] Thumbs up/down feedback in the mockup is new data collection. It's omitted unless approved (D7).

### 6.8 Onboarding [APPROVED]

- Short.
- Personalised using existing supported data: test date, and the existing reminder opt-in on native.
- No barriers before the first practice.
- Supports learners without a booked test.
- Resumable after interruption.

[REC] Consolidate onto one onboarding-state key. This fixes the audit's `onboarding_complete` vs `hasSeenOnboarding` mismatch. Persist the onboarding step so it can resume.

### 6.9 Profile and accessibility [APPROVED contents]

Account, subscription, test date, accessibility, instructor connections, referrals and settings.
- [REC] "My subscription" opens the platform's real management screen: the App Store / Play subscription page on native, and an explanatory screen on web, where purchases are one-off. Today it opens the paywall.
- [REC] Accessibility settings:
  - existing: dyslexia font, large text, high contrast, text-to-speech, word spacing, cream background, dark mode, sound;
  - new: an **in-app Reduced Motion toggle**, as in the mockup, combined with the OS setting.
- Every setting must apply on **every** screen. The audit found coverage of about 13 files.

### 6.10 Instructor dashboard [APPROVED]

- A clear learner overview with meaningful pupil progress.
- Keep the existing invitation and referral functionality.
- Accessible learner details.

[CONFLICT] **No invented statistics or classifications.** The mockup's elements are handled like this:

| Mockup element | Supported by existing data? | Resolution |
|---|---|---|
| Learner count | Yes | Show |
| Average readiness | Computable from shared `readinessScore` | Show only for pupils who share progress |
| "+6% this week" | **No.** No readiness history is stored. | Omit |
| "Test ready / On track / Needs support / At risk" (4 tiers) | **No.** The existing app uses 3 tiers from `readinessScore`: **Test Ready ≥80, Getting There ≥50, Needs Work** (`instructor.tsx:358`). | Use the existing 3 tiers (D10) |
| Recent activity feed | Partly: `lastStudied` and mock history | Show only events derivable from shared data |

## 7. Accessibility baseline [APPROVED: WCAG 2.2 AA]

[REC] Definition of done for every redesigned screen:
- token-validated contrast;
- labelled controls with correct roles and states;
- feedback announced to screen readers;
- images that convey meaning have alt text (including question and sign images);
- correct focus order and a visible focus ring on web;
- 44/48pt targets;
- works at 200% OS text size without clipping essential content;
- honours Reduced Motion, Dyslexia font, Large Text and Dark mode;
- no information carried by colour alone.

## 8. Non-negotiables [APPROVED]

These are reproduced in the tracker's global constraints:
- no unnecessary rewrite;
- no loss of functionality;
- no production DB changes, deploys, pricing, product, entitlement or readiness-algorithm changes without approval;
- no changes to Pip artwork or replacement of the road artwork;
- no real purchases;
- no secrets in source or docs;
- no unapproved destructive migrations;
- no previews connected to production;
- small, reviewable PRs, each with an OTA-vs-native verdict.
