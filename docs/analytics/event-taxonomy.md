# ClearPass analytics: event taxonomy

All product analytics go into one append-only table, `public.funnel_events`
(migration `apps/mobile/supabase/migrations/20261021090000_funnel_events.sql`),
written by the app through `logFunnelEvent()` in `apps/mobile/src/funnel.ts`.
Nothing else in the app writes to it.

Every row has:

| Column | Meaning |
|---|---|
| `event` | Event name (below). Text, 1 to 64 chars. |
| `props` | JSON object of allow-listed props (below). Under 2 KB. |
| `anon_id` | Random per-install id (AsyncStorage `@clearpass/anon_id`). Ties pre-signup events (taster, onboarding) to the account created later on the same install. |
| `user_id` | The signed-in user, or `null` before signup. |
| `platform` | `ios`, `android` or `web`. Every event carries it. |
| `created_at` | Server time of the insert. |

Source of truth for names and props: `apps/mobile/src/analyticsEvents.ts`
(`FunnelEvent`, `EVENT_PROPS`). Tests: `apps/mobile/scripts/lib/analyticsEvents.test.mjs`.

## Privacy

- **No personal data or content in props.** No question text, answers, chat
  text, emails, names, usernames, referral or instructor codes, test dates or
  any free text. Only enums, booleans and small integers.
- Enforced in code, not just by convention: `logFunnelEvent()` passes every
  props object through `sanitiseProps()` (`apps/mobile/src/analyticsEvents.ts`).
  A key not listed for that event is dropped; a string must be one of the
  listed values and at most 40 chars; numbers must be integers inside the
  listed range; booleans must be real booleans. Anything else (objects, arrays,
  `null`, free text) is dropped silently.
- Clients can insert only. RLS has no select/update/delete policies, so no app
  user can read events back (their own or anyone else's). Signed-in users can
  only insert rows with their own `user_id` or `null`; signed-out installs only
  `null`.
- Reading is done by the server with the service role (daily Slack stats,
  `apps/mobile/server/lib/funnelStats.js`) and by the read-only queries in
  `docs/sql/analytics/`.
- Craig to confirm the privacy stance (programme action A6) before release.

## Genuine vs test (query time)

Nothing is filtered on the device. Every query decides who counts:

- **Counted**: `profiles.exclude_from_stats = false`. Accounts with `true`
  (test / internal) are excluded from every metric.
- **Breakdown by `profiles.account_class`** (optional): set `by_class = true`
  in a query's `params` CTE to split results by class. Values seen in
  production: `genuine`, `internal`, `junk`, `reviewer`, `unclassified`
  (text, NOT NULL, default `'unclassified'`). `unclassified` means counted but
  not yet triaged. Pre-signup installs that never created an account show as
  `no_account`. Inclusion is still decided by `exclude_from_stats`, not by class.
- **Schema drift:** `account_class` exists in the production database but is
  not in `apps/mobile/supabase/schema.sql` or any migration (it was added
  outside the repo). Reconciling that is separate work. Do not add a
  migration for it from this doc.
- **Their pre-signup installs**: any `anon_id` that ever appears on a row with
  an excluded `user_id` is excluded too, so the founder's own taster run on a
  fresh install does not count. Same rule as `server/lib/funnelStats.js`.
- **Comp accounts**: `user_progress.progress->>'proSource' = 'comp'`. Real
  people, so kept in activation, retention and feature usage, but excluded
  from the paywall and purchase funnel (they never needed to buy).
- **Actor**: a person is `user_id` when known. Pre-signup rows are attributed
  to the account that later used the same `anon_id`; an install that never
  signed up counts as `anon:<anon_id>`.

## Events

Platforms: **all** = iOS, Android and web. File references are
`apps/mobile/...` at the time of writing.

### Existing conversion funnel (Oct 2026, unchanged)

| Event | Fires when | Props (allowed values) | Platforms | Where |
|---|---|---|---|---|
| `taster_started` | Pre-signup taster quiz opened | none | all | `app/taster.tsx:58` |
| `taster_completed` | Taster finished | `correct` int 0-100 | all | `app/taster.tsx:80` |
| `onboarding_completed` | Test date saved or skipped after signup | `testDate` boolean | all | `app/auth/testdate.tsx:109`, `:120` |
| `daily_limit_hit` | Free learner reaches today's free question limit | `at`: `session_start`, `mid_session` | all | `app/(tabs)/practice.tsx:340`, `:799` |
| `paywall_prompt_viewed` | Inline upgrade prompt shown | `reason`: `daily_limit`, `mock`, `hazard`; `route`: `stripe_checkout`, `coming_soon`, `iap` | all | `src/components/PaywallPrompt.tsx:42` |
| `paywall_prompt_tapped` | Upgrade CTA tapped | `reason`: `daily_limit`, `mock`, `hazard`, `tutor`, `mock_result`, `general`, `mock_standard_locked`; `passed` boolean | all | `src/components/PaywallPrompt.tsx:77`, `app/(tabs)/mock.tsx:360`, `:920` |
| `paywall_viewed` | Paywall screen opened | `route` (as above) | all | `app/paywall.tsx:108` |
| `plan_selected` | Plan toggled | `plan`: `monthly`, `quarterly` | all | `app/paywall.tsx:139` |
| `purchase_started` | Buy tapped | `plan`; `rail`: `stripe`, `iap`; `trialDays` int 0-365 | all (`iap` on phones) | `app/paywall.tsx:152`, `:187` |
| `purchase_succeeded` / `purchase_cancelled` / `purchase_failed` | Store purchase outcome | `plan`; `rail`; `trialDays`; `reason`: `no_package` (failed only) | iOS, Android | `app/paywall.tsx:184`, `:190` |
| `iap_sandbox_purchase` | **Server-written** (RevenueCat webhook, PR #113) when a purchase arrives with `environment=SANDBOX` (App Review, TestFlight, licence testers). Not a funnel step. A durable marker so reporting can exclude testers after their sandbox grant expires | none | server | `server/proxy.js` (#113) |
| `iap_trial_started` | **Server-written** (RevenueCat webhook, PR #118) on a PRODUCTION `INITIAL_PURCHASE` with `period_type = TRIAL`: a free trial began. Store-verified, unlike the app's `purchase_succeeded` | see "Server-written RevenueCat markers" below | server | `server/lib/revenuecatWebhook.js` (#118) |
| `iap_trial_converted` | **Server-written** (#118) on a PRODUCTION `RENEWAL` with `is_trial_conversion = true` (or the first paid renewal of a trial): the trial became a paid subscription | as below | server | as above |
| `iap_trial_cancelled` | **Server-written** (#118) on a PRODUCTION `CANCELLATION` with `period_type = TRIAL`: auto-renew turned off during the trial. Pro stays until the trial end; it will not convert unless the learner re-subscribes | as below; `cancel_reason` says why | server | as above |
| `free_mock_started` | Free quick mock begun | `mode`: `standard`, `quick` | all | `app/(tabs)/mock.tsx:365` |
| `free_mock_completed` | Free mock submitted | `passed` boolean; `correct`, `total` int 0-100 | all | `app/(tabs)/mock.tsx:518` |
| `iap_unavailable` | Store could not be configured | `mode`: `missing_api_key`, `configure_threw`, `get_offerings_threw`, `no_quarterly_package`; `source`: `boot`, `refresh` | iOS, Android | `src/purchases.ts:66` |
| `reminder_offer_viewed` / `reminder_enabled` / `reminder_declined` / `reminder_os_denied` | Daily reminder offer shown / answered | `context`: `daily_limit`, `home`, `onboarding` | iOS, Android | `src/components/ReminderOffer.tsx:74-93`, `app/auth/reminders.tsx:21-34` |

#### Trial starts vs paid purchases

The app offers free trials on store plans (`src/purchases.ts`
`trialDaysForPackage`). A store "purchase" with a trial takes no money until
the trial ends, so purchases are split at query time:

- **Trial start**: `purchase_succeeded` with `props->>'trialDays'` > 0 (app
  side), confirmed server side by `iap_trial_started`.
- **Paid purchase**: `purchase_succeeded` with `trialDays` null or 0 (paid
  immediately), or a trial that converted (`iap_trial_converted`).
- **Trial cancelled**: `iap_trial_cancelled`. That learner keeps Pro until the
  trial end date, then lapses.
- `purchase_succeeded` only records what the app saw at the time. Use the
  server markers for whether a trial actually converted. On the server,
  `user_progress.progress->>'proSource'` is `iap_trial` during a trial and
  `iap` once paid (`iap_sandbox` for testers). Only `stripe`, `seat` and
  `iap` are paying.
- Rows written before #118 was deployed say `iap` for trials too, and have no
  trial markers. See `docs/sql/trials.sql` (in PR #118).
- Queries: `docs/sql/analytics/03_limit_paywall_purchase_funnel.sql` splits
  `purchase_succeeded` into trial and paid columns, and
  `docs/sql/analytics/05_trials.sql` is the trial funnel (started, converted,
  cancelled, conversion rate).

#### Server-written RevenueCat markers

`iap_sandbox_purchase`, `iap_trial_started`, `iap_trial_converted` and
`iap_trial_cancelled` are inserted by the server (service role), not the app:

- `user_id` is the RevenueCat `app_user_id`, and `anon_id` is
  `revenuecat:<RevenueCat event id>` (so they never join to a real install).
- They are written at most once per RevenueCat event id and marker type.
- `props` (trial markers): `source` (`revenuecat_webhook`), `rc_event_id`,
  `rc_event_type`, `environment` (`PRODUCTION`), `store` (`APP_STORE`,
  `PLAY_STORE`, ...), `product_id`, `period_type`, `is_trial_conversion`
  boolean, `cancel_reason` (cancellations only). No personal data.
- `platform` is `ios` / `android` from the store (null if unknown).
- They are not funnel steps in `server/lib/funnelStats.js`. Count them by
  `rc_event_id`, and exclude `exclude_from_stats` accounts and sandbox
  testers like any other metric.

### Activation (P0-3)

| Event | Fires when | Props (allowed values) | Platforms | Where |
|---|---|---|---|---|
| `signup_started` | Signup screen shown (once per mount) | none | all | `app/auth/signup.tsx:55` |
| `signup_completed` | Account created. Email: `signUp` returned a new user (not Supabase's obfuscated reply for an existing address). Apple/Google: signed in and no profile row existed yet. | `method`: `email`, `apple`, `google`; `confirm_required` boolean (email confirmation pending, so the row has no `user_id` yet) | all | `app/auth/signup.tsx:101`, `src/socialAuth.ts:92`, `:133` |
| `onboarding_started` | Intro slides opened | none | all | `app/onboarding.tsx:77` |
| `onboarding_step_viewed` | Each onboarding step shown | `step`: `welcome`, `practice`, `progress`, `date` (intro slides), `choose_account_type`, `test_date`, `reminders` (after signup) | all (`reminders` phones only) | `app/onboarding.tsx:78`, `app/auth/choose-account-type.tsx:32`, `app/auth/testdate.tsx:96`, `app/auth/reminders.tsx:20` |
| `onboarding_completed` | (existing, above) | | | |
| `first_question_answered` | First answer ever on this install, in any mode | `source`: `taster`, `practice`, `battle`, `speed_round`, `weak_spots`, `mock` | all | `app/taster.tsx:66`, `app/(tabs)/practice.tsx:423`, `:532`, `:618`, `:730`, `app/(tabs)/mock.tsx:397` |
| `first_session_completed` | First practice session finished on this install (reached its results, or was cut off by the daily free limit) | `mode`: `practice`, `bookmarked`, `spaced_repetition`, `battle`, `speed_round`, `weak_spots`; `limit_reached` boolean | all | `app/(tabs)/practice.tsx:312` |
| `practice_results_viewed` | Practice results screen shown at the end of a session | `mode` (as above); `limit_reached` boolean (free learner at or over today's limit) | all | `app/(tabs)/practice.tsx:311` |

"First" events are once per install (AsyncStorage `@clearpass/funnel_once`,
decision in `markOnce()`). A second account on the same install does not fire
them again; reinstalling does. Queries take the earliest row per actor anyway.

The phase logic behind the practice events is the pure
`practicePhaseEvents()` in `src/analyticsEvents.ts`. Today a free learner's
session that ends on the 10th question goes straight to the daily-limit screen
rather than results, so it produces `first_session_completed{limit_reached:true}`
but no `practice_results_viewed`; if results are shown first (P0-2),
`practice_results_viewed{limit_reached:true}` follows automatically.

### Retention

| Event | Fires when | Props | Platforms | Where |
|---|---|---|---|---|
| `app_opened` | App launched or brought back to the foreground, at most once per local calendar day per install | `trigger`: `launch`, `foreground` | all | `app/_layout.tsx:381` via `useAppOpenedLogging()` in `src/funnel.ts` |

Dedupe is `shouldLogAppOpened()` (`src/analyticsEvents.ts`) with the last
logged day in AsyncStorage `@clearpass/app_opened_day`. D1/D7/D30 come from
`docs/sql/analytics/01_retention_cohorts.sql`.

### Feature usage

`feature_used{feature}`, once per screen entry (focus), never per question.

| `feature` | Fires when | Where |
|---|---|---|
| `practice` | Standard practice session starts | `app/(tabs)/practice.tsx:310` |
| `bookmarked` | Bookmarked-questions session starts | `app/(tabs)/practice.tsx:310` |
| `spaced_repetition` | Review (due questions) session starts | `app/(tabs)/practice.tsx:310` |
| `battle` | Battle mode starts | `app/(tabs)/practice.tsx:310` |
| `speed_round` | Speed round starts | `app/(tabs)/practice.tsx:310` |
| `weak_spots` | Weak-spot drill starts | `app/(tabs)/practice.tsx:310` |
| `mock_full` / `mock_quick` | Mock test starts | `app/(tabs)/mock.tsx:366` |
| `hazard` | Hazard perception screen focused (also when it shows the Pro prompt) | `app/(tabs)/hazard.tsx:238` |
| `road_signs` | Road signs screen focused | `app/(tabs)/roadsigns.tsx:1045` |
| `highway_code` | Highway Code screen focused | `app/(tabs)/highwaycode.tsx:30` |
| `ask_pip` | Ask Pip (AI tutor) screen focused | `app/(tabs)/tutor.tsx:128` |
| `study_plan` | Study plan screen focused | `app/study-plan.tsx:100` |
| `ai_study_plan` | AI study plan screen focused | `app/studyplan.tsx:156` |
| `leaderboard` | Leaderboard focused | `app/(tabs)/leaderboard.tsx:30` |
| `challenge` | Challenge a friend screen focused | `app/challenge.tsx:991` |
| `test_day` | Test day screen focused | `app/testday.tsx:587` |

Platforms: all. Hook: `src/useFeatureUsed.ts`.

### Instructors and referrals (client side only)

| Event | Fires when | Props | Platforms | Where |
|---|---|---|---|---|
| `instructor_invite_sent` | Instructor creates an email invite (insert succeeded), or copies their instructor code to give a learner | `method`: `email`, `copy_code` | all | `app/instructor.tsx:662`, `:1225`, `app/(tabs)/settings.tsx:436` |
| `referral_shared` | Referral code/link copied, or shared through the share sheet (only when the OS reports it shared) | `method`: `share`, `copy`; `surface`: `settings`, `instructor` | all | `app/(tabs)/settings.tsx:423`, `:429`, `app/instructor.tsx:1371`, `:1380` |
| `instructor_link_accepted` | Learner accepts a pending instructor request, or links by entering a code (write succeeded) | `method`: `invite`, `code` | all | `app/linked-instructors.tsx:159`, `:234` |

Server-side confirmation (for example counting accepted relationships in
`instructor_relationships`) stays a query-time job; these events only say the
action was taken in the app.

### Not firing yet

| Event | Props | Status |
|---|---|---|
| `daily_plan_viewed` | none | Defined; **fires from P2-1** (no daily plan exists yet) |
| `daily_plan_item_started` | `item`: one of the `feature_used` values | Defined; **fires from P2-1** |

## Adding an event

1. Add the name to `FunnelEvent` and its props to `EVENT_PROPS` in
   `apps/mobile/src/analyticsEvents.ts` (enums only; a prop that is not listed
   is dropped).
2. Add a test case to `scripts/lib/analyticsEvents.test.mjs`; run
   `npm run test:scripts`.
3. Call `logFunnelEvent()` (or `logFunnelEventOnce()`) at the point of action.
4. Add a row here. No migration is needed: the table accepts any event name of
   1 to 64 chars.
