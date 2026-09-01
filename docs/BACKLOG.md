# Backlog

Known work that is understood but deliberately not scheduled yet. Add an entry
rather than folding unrelated work into an unrelated commit.

---

## `instructor.tsx` has a complete-looking referral/earnings/payout flow — in tension with "Stripe Connect is blocked"

**Found:** 2026-09-01, while checking whether `apps/web/instructors.html`'s
claims matched what the product actually does (they did, against the mobile
app's `/instructor` screen, not the web dashboard — see git history for that
review).

`apps/mobile/app/instructor.tsx`'s `ReferralSection`, `EarningsSection`, and
`PayoutHistorySection` (roughly lines 710–913) are not residue — they're a
complete-looking wired feature: a referral link, running earnings totals
(total/pending/converted), a "Request Payout" button with a £10 minimum, and
Stripe Connect onboarding handling. The backend side is equally complete, not
stubbed: `POST /api/instructor/connect/onboarding-link`
(`apps/mobile/server/proxy.js:1056`) and `POST /api/instructor/payout-request`
(`:1120`), plus a signed Connect webhook handler (`:441`,
`STRIPE_CONNECT_WEBHOOK_SECRET`) with real Stripe transfer logic and
`instructor_connect_accounts` bookkeeping.

This sits in tension with the working assumption used this session to remove
the EARNINGS section and calculator from `apps/web/instructors.html` — that
Stripe Connect payout is blocked and undeliverable before the conference.

**Needs investigating, not yet resolved.** Two possibilities, not
distinguished yet:
- The payout rail actually works end-to-end and "blocked" was wrong, or
- Stripe Connect account approval (a Stripe-side business step, separate from
  this code) is what's actually blocked, and an instructor who taps "Request
  Payout" today hits a failure the code can't prevent.

**Not a conference blocker** — conference signups go through the seat-purchase
model, not referral earnings.

---

## Instructor status is self-declared and unverified

**Found:** 2026-08-25, while reviewing the new instructor signup endpoint.

`profiles.account_type = 'instructor'` is entirely self-declared. Nothing in the
system checks that the person is a driving instructor: no ADI badge number, no
manual approval, no verification of any kind.

It is not just a label. [`/api/cron/grant-instructor-pro`](../apps/mobile/server/proxy.js)
selects every profile with `account_type = 'instructor'` and writes
`{ isPro: true, proExpiresAt: null, proSource: 'instructor' }` — **permanent,
non-expiring Pro**. `shouldApplyProGrant` starts `if (!currentSource) return true`,
so a fresh account always qualifies. Claiming to be an instructor is therefore
sufficient to receive free Pro forever.

This has been acceptable so far because instructors arrived through personal
contact — the population was small and known. It becomes a real exposure the
moment instructor signup is public and promoted at scale, which is exactly what
the 27 Sep 2026 conference work does.

**Not a conference blocker.** The verified-email split in
`/api/instructor/signup` → `/api/instructor/complete-signup` means an attacker
must at least control the mailbox they sign up with, which makes this a
manual-effort-per-account problem rather than a scripted one. That is enough for
one trade show.

**Revisit before instructor signup is promoted anywhere beyond the conference.**

Likely shape of a fix: capture an ADI badge number at signup and verify it.
Open questions that need answering first — whether a third-party or DVSA lookup
is actually available programmatically, and what to do about PDIs (trainee
instructors), who may not hold a badge number yet and are a legitimate audience
for the product. A manual approval queue may be the pragmatic interim step.

**Related, and part of why this matters:** permanent grants are hard to walk
back. Because `proExpiresAt` is `null` rather than a date, a wrongly-granted Pro
account does not lapse on its own — revoking it means finding and rewriting
those rows deliberately. A dated grant that needs renewal would fail safe; this
one fails open. See also the rate-limiting item below — with no per-endpoint
limits anywhere in `proxy.js`, there is nothing slowing down repeated attempts
either.

---

## `proxy.js` has no rate limiting, and six endpoints take no auth at all

**Found:** 2026-08-25, while reviewing the new instructor signup endpoint.

`grep` for `rate-limit|rateLimit|express-rate|throttle|slowDown` across
`apps/mobile/server/proxy.js` and its `package.json` returns **zero matches**.
There is no rate limiting anywhere in the proxy. CORS is not a substitute — the
`corsOptions` allowlist only constrains browsers; `curl` and any server-side
caller ignore it.

`POST /api/instructor/signup` and `POST /api/instructor/complete-signup` now
carry a small in-memory limiter (`rateLimit()` in `proxy.js`), added as defence
in depth. It is per-process, resets on deploy, and does not hold across multiple
Railway instances. It is **not** what makes those endpoints safe — the
verified-email split is. Nothing else in the file is limited at all.

Endpoints reachable with no authentication, secret, or signature of any kind:

| Endpoint | Note |
|---|---|
| `POST /api/create-checkout-session` | **Most severe** — creates Stripe sessions, trusts `req.body.userId` with no verification the caller controls that account |
| `POST /api/send-challenge-notification` | Sends push notifications to other users; trusts `challenger_username` as free text |
| `POST /api/waitlist` | Inserts rows |
| `POST /api/instructor/signup` | Intentionally public; powerless by design (step 1 of 2) |
| `GET /api/config` | Read-only |
| `GET /api/stats` | Read-only |

For the avoidance of doubt, these were checked and **are** guarded, despite not
using `verifyAuth`: `/api/delete-account` (verifies a token from the body via
`auth.getUser`), `/api/seats/:token` and `/api/confirm-parent` (bearer-token
style — the secret is the token in the URL), `/api/send-weekly-parent-emails`
(checks `x-cron-secret` against `CRON_SECRET` inline, same secret the
`/api/cron/*` routes use via `requireCronAuth`, just not through that shared
helper), the Stripe and RevenueCat webhooks (signature / shared secret), and
every `/api/cron/*` route (`CRON_SECRET`).

Not fixed now: only the two instructor endpoints were in scope for the
conference work, and changing the auth posture of the others needs its own
review of who calls them.

---

## `schema.sql` cannot recreate the live database

**Found:** 2026-08-25, while verifying `profiles.signup_ref` (commit `c197b53`)
against the live project via a full `information_schema.columns` dump.

`apps/mobile/supabase/schema.sql` is not a faithful description of the live
database. It has drifted in both directions, so a fresh environment built from
it would differ materially from production.

**Live and actively used by application code, but not declared in `schema.sql`:**

| Table | Used by |
|---|---|
| `aggregate_stats` | `src/analytics.ts` |
| `challenges` (18 cols) | `app/challenge.tsx`, `app/(tabs)/home.tsx` |
| `parent_email_subscriptions` | `app/(tabs)/settings.tsx`, `server/proxy.js` |
| `pass_stories` | `app/ipassed.tsx`, `app/(tabs)/progress.tsx` |
| `waitlist` | `server/proxy.js` `POST /api/waitlist` |

**Live but undeclared, and unused by any code:**

- `instructor_earnings.paid_at` — residue from the Stripe Connect payout work
  that was blocked partway. Referenced in zero source files; `payout_id` and
  `status` carry the payout state that is actually read. Decide whether to
  document it or drop it.

**Declared in `schema.sql` but absent from the live database:**

- `hazard_attempts` — declared with two RLS policies, never applied, and
  referenced by no code. Hazard attempts are not being persisted to this table.
  Decide whether to apply it or delete the declaration.

**Already reconciled** (in `c197b53`, documented in the file itself):
`profiles.display_name` was live-only drift; it is now recorded as such, marked
explicitly as *not* a migration that file ever applied.

### Why this is not closed yet

Closing it needs the real shape of each object — types, defaults, constraints,
indexes and RLS policies — not just column names. Only names were captured, and
writing speculative `CREATE TABLE` statements from names alone would produce a
file that looks authoritative while silently disagreeing with production. That
is worse than an acknowledged gap, so `schema.sql` carries a
`KNOWN UNRECONCILED DRIFT` block recording what is missing as a map rather than
as runnable DDL.

It was kept out of the `signup_ref` commit on purpose: it is a separate piece of
work deserving its own review, and it is not on the 27 Sep 2026 conference
critical path.

### To close

Dump the full shape for the affected objects, then replace the drift block in
`schema.sql` with real declarations:

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('aggregate_stats','challenges','parent_email_subscriptions',
                     'pass_stories','waitlist','instructor_earnings')
ORDER BY table_name, ordinal_position;
```

Plus constraints, indexes and `pg_policies` for the same tables.

**Caveat:** this Supabase project is shared with Zen Footy. `matches`, `players`,
`lineups` and `attendance` live in the same `public` schema and belong to that
product — they are correctly absent from `schema.sql` and must not be added.
Filter them out of any introspection diff.

---

## Supabase advisor findings (2026-08-25)

Full `get_advisors` run (security + performance). Triaged against the 27 Sep
2026 conference timeline. **Nothing here blocks instructor signup or the
conference.** Revisit after the event.

### Security

#### `update_aggregate_stats` callable by anon (SECURITY DEFINER)

Any unauthenticated caller can `POST /rest/v1/rpc/update_aggregate_stats` with
arbitrary `p_topic, p_correct, p_total` values. The function runs as its
definer, bypassing RLS. This lets someone stuff fake aggregate stats but does
not leak PII or touch financial data.

**Fix options (pick one when revisiting):**
- Revoke `EXECUTE` from `anon` (stats are only written from authenticated quiz
  submissions anyway).
- Switch the function to `SECURITY INVOKER` and let the RLS on `aggregate_stats`
  handle access (currently has RLS enabled but no policies — would need one).

Also has mutable `search_path` (minor).

#### `leaderboard` view is SECURITY DEFINER (ERROR)

Runs as the view creator, not the querying user. Leaderboard data is
intentionally public, so the practical risk is low. To silence the lint, convert
to `SECURITY INVOKER` and add a permissive SELECT policy on the underlying
tables.

#### 6 tables with RLS enabled but no policies

`aggregate_stats`, `explain_daily_usage`, `revenuecat_webhook_events`,
`seat_refund_flags`, `stripe_webhook_events`, `waitlist`. These are
server-side-only tables accessed via `service_role` key. RLS-on with no
policies means PostgREST returns nothing to `anon`/`authenticated`, which is
correct. No action needed unless client-side access is ever added.

#### Mutable `search_path` on 3 functions

`set_updated_at`, `set_progress_sharing_consent`, `update_aggregate_stats`.
Fix by adding `SET search_path = ''` to each function definition.

#### Leaked password protection disabled

One-click toggle in Supabase Dashboard > Auth > Settings. Checks passwords
against HaveIBeenPwned. Low effort, low urgency.

### Performance

#### Unindexed foreign keys (14)

Tables: `instructor_earnings` (3), `instructor_lesson_notes` (2),
`instructor_seats` (1), `lineups` (2), `pass_stories` (1), `payouts` (1),
`progress_sharing_consent` (1), `seat_refund_flags` (3). Will matter at scale
when DELETE cascades or JOIN plans hit these. Not a concern at current volume.

#### `auth_rls_initplan` — RLS policies re-evaluating `auth.uid()` per row (~35)

Affects `profiles`, `user_progress`, `instructor_relationships`,
`instructor_lesson_notes`, `challenges`, `pass_stories`, `instructor_earnings`,
`parent_email_subscriptions`, `players`, `matches`, `lineups`, `attendance`,
`instructor_connect_accounts`, `payouts`, `instructor_seats`,
`progress_sharing_consent`. Fix by wrapping `auth.uid()` in a subselect so
Postgres evaluates it once per statement.

#### Duplicate permissive policies (~50)

Multiple permissive SELECT/INSERT/UPDATE/DELETE policies on the same
table+role. Affected tables: `challenges`, `instructor_earnings`,
`instructor_lesson_notes`, `instructor_relationships`, `pass_stories`,
`profiles`, `user_progress`. These OR together, so access is the union of all
policies — functionally correct but wasteful and confusing. Consolidate into
single policies per action.

#### Unused indexes (7)

`challenges_share_code_idx`, `players_coach_id_idx`, `matches_coach_id_idx`,
`lineups_match_id_idx`, `attendance_player_id_idx`, `attendance_session_idx`,
`profiles_signup_ref_idx`. Drop after confirming they are genuinely unused
(note: `profiles_signup_ref_idx` was just added — may simply not have been
queried yet).

#### Auth DB connection limit

10 connections configured. Fine for current scale; revisit if the instance is
upgraded.
