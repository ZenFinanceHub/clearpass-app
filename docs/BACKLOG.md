# Backlog

Known work that is understood but deliberately not scheduled yet. Add an entry
rather than folding unrelated work into an unrelated commit.

---

## Comparative stats feature is silently dead

**Found:** 2026-09-02, while reconciling `schema.sql` (`aggregate_stats` has
RLS enabled with zero policies). **Confirmed, not just inferred**, by
minting a real session for a test account and hitting the actual REST
endpoint the app uses:

```
GET /rest/v1/aggregate_stats?topic=eq.Alertness&select=total_correct,total_answered
Authorization: Bearer <real authenticated user's access token>
→ 200 []
```

Empty result for a topic that has real data underneath (`Alertness`:
114 answered, confirmed via a direct service-role query) — RLS silently
filters the row out for every non-service-role caller, authenticated or
not, because the table has no SELECT policy at all.

**What it's supposed to do:** `src/analytics.ts`'s `getComparativeStats(topic,
userPct)` reads the platform-wide correct/answered totals for a topic and
returns `{ userPct, platformAvgPct, betterThan, totalAnswers }` — "you scored
better than X% of ClearPass users" — but only once a topic has 50+ answers
recorded platform-wide (`if (row.total_answered < 50) return null`).

**Where it's supposed to appear, and what a real user actually sees instead:**
- `app/(tabs)/practice.tsx:1480` — a card on the session-results screen after
  finishing a single-topic practice session: *"You scored better than X% of
  ClearPass users on {topic} / Platform average: Y%"*. Since `getComparativeStats`
  returns `null` (the empty REST result makes `.single()` throw, caught by
  the function's own try/catch), the card's containing `{comparative && ...}`
  condition is false — **the entire card doesn't render**. Not a blank
  placeholder, not a zero, not a loading spinner stuck forever — nothing.
  The rest of the results screen (achievement banners, motivational message,
  tutor nudge) renders completely normally around the missing card, so
  there's no visual gap a user would notice as "something's wrong here."
- `app/(tabs)/progress.tsx:667` — tapping a topic mastery badge shows an
  `Alert` popup with the pupil's own accuracy; a `\nPlatform average: X%`
  line is meant to be appended when stats are available. Same failure mode:
  the line is just silently omitted from the alert text.

**Not fixed here** — this is a behavior/RLS-policy decision, not a
documentation one (see `schema.sql` reconciliation entry above, which is
where this was found). `aggregate_stats` only holds aggregate, non-personal
counts (per-topic totals, no user identifiers), so a public SELECT policy
is very likely safe — but that's a call for whoever picks this up, not
assumed here.

**Also worth knowing, separate from the RLS bug:** even with RLS fixed,
most topics don't have enough volume to clear the 50-answer threshold yet —
of the two topics with any data at all, `Alertness` has 114 (would show) and
`Attitude` has 12 (would still return `null`). Fixing RLS makes the feature
*able* to work; it doesn't guarantee it shows up for every topic yet.

---

## Refunding a direct Stripe purchase never revokes Pro

**Found:** 2026-09-01, while verifying the `create-checkout-session` auth
fix (PR #47) — Craig was about to refund a real test purchase and asked
what actually happens to the grant.

`handleChargeRefunded` (`apps/mobile/server/proxy.js:248`) only handles
instructor **seat** refunds — it looks up the charge via `findSeatForRefund`
and, if no matching seat is found, does nothing. A direct subscription
purchase (`/api/create-checkout-session`, `mode: 'payment'`) has no seat to
find, so refunding one of those charges leaves `user_progress.progress`
untouched: `isPro` stays `true`, `proSource` stays `'stripe'`,
`proExpiresAt` stays set to the original grant date. Stripe shows the money
gone; the account keeps full Pro access until that date regardless.

**Not urgent at today's volume** (direct Stripe purchases are a small slice
of paying users next to IAP and seats), **but it fails open, not closed**:
every refund is free Pro for whatever's left of the grant period, with
nothing to notice or flag it. The `charge.refunded` webhook already fires
and already has a seat-shaped handler right next to where this would live —
extending it to also handle the no-matching-seat case (a direct purchase)
by revoking the grant is the natural fix, not a redesign.

**Interim mitigation:** manually clear Pro after any refund —

```sql
update public.user_progress
set progress = progress
  || jsonb_build_object('isPro', false, 'proSource', null, 'proExpiresAt', null)
where id = (select id from auth.users where email = '<refunded account email>');
```

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
**Reconciled 2026-09-02.**

`apps/mobile/supabase/schema.sql` was not a faithful description of the live
database — drifted in both directions, so a fresh environment built from it
would have differed materially from production. Closed by dumping the real
shape (types, defaults, constraints, indexes, RLS) for every affected object
via `pg_constraint`, `information_schema.columns`, `pg_indexes` and
`pg_policies` directly, and replacing the old names-only drift block with
real declarations.

**One lesson learned doing this, worth remembering for next time:**
`information_schema.table_constraints` came back completely empty for all 6
affected tables on the first pass — which would have meant "no foreign keys
anywhere," clearly wrong. `pg_constraint` gave the real, complete picture.
Same class of trap as `update_aggregate_stats`'s grants earlier the same day
(`information_schema.routine_privileges` vs `pg_proc.proacl`) — don't trust
one system view unverified when reconciling live shape against a file.

**Also caught mid-reconciliation:** the first draft of this fix wrongly
claimed `instructor_earnings.payout_id` and its `status` CHECK constraint
were undeclared — they aren't. `schema.sql` already adds both via `ALTER
TABLE` statements placed after `payouts` exists (lines ~196-198), which the
2026-08-25 note's own wording ("payout_id and status carry the payout state
that is actually read") was hinting at without saying outright. Caught by
reading the whole file before editing rather than trusting the plan drafted
from a partial read — the actual remaining drift on that table was smaller:
missing `NOT NULL` on `instructor_id`/`learner_id`, a false `ON DELETE
CASCADE` claim on `instructor_id` (live has no delete action), and an
undocumented live `amount DEFAULT 2.50` (the old flat commission figure,
superseded by `earnings.js`'s dynamic calculation — every real insert passes
`amount` explicitly, so this likely never fires, but it's a live footgun).

**Still open, on purpose:** `instructor_earnings.paid_at` stays undeclared,
deferred pending the Stripe Connect payout-flow investigation (see that
item below) — document-or-drop is easier to call once that resolves.
`hazard_attempts` stays declared as a documented, unapplied blueprint (not
deleted) with a comment at its declaration saying so plainly.

**New finding from doing this properly:** `aggregate_stats` has RLS enabled
with zero policies, which turned out to make a real feature silently dead —
confirmed, not fixed, as its own entry below ("Comparative stats feature is
silently dead").

**Caveat retained:** this Supabase project is shared with Zen Footy.
`matches`, `players`, `lineups` and `attendance` live in the same `public`
schema and belong to that product — correctly absent from `schema.sql`.

---

## Supabase advisor findings (2026-08-25)

Full `get_advisors` run (security + performance). Triaged against the 27 Sep
2026 conference timeline. **Nothing here blocks instructor signup or the
conference.** Revisit after the event.

### Security

#### `update_aggregate_stats` callable by anon (SECURITY DEFINER)

**Fixed 2026-09-02.**

Any unauthenticated caller could `POST /rest/v1/rpc/update_aggregate_stats`
with arbitrary `p_topic, p_correct, p_total` values. The function runs as its
definer, bypassing RLS. This let someone stuff fake aggregate stats but never
leaked PII or touched financial data.

First attempt (`revoke execute ... from public; grant ... to authenticated;`,
based on `information_schema.routine_privileges` showing a single `PUBLIC`
grant) was incomplete: `anon` also held a **separate, explicit** `EXECUTE`
grant invisible through `information_schema.routine_privileges` in this
project (returned empty for this function after the change — don't trust
that view here). `pg_proc.proacl` is the reliable source and is what caught
it, corroborated by a fresh `get_advisors` run still flagging both
`anon_security_definer_function_executable` and
`authenticated_security_definer_function_executable` after the first fix.

Closed with `revoke execute on function
public.update_aggregate_stats(text, integer, integer) from anon;`. Confirmed
via `pg_proc.proacl`, now `{postgres=X/postgres,authenticated=X/postgres,
service_role=X/postgres}` — no `anon` entry — and `anon_security_definer_
function_executable` no longer appears in `get_advisors` at all.

`authenticated_security_definer_function_executable` still appears, and
that's correct, not a residual gap: `aggregate_stats` has RLS enabled with
**no policies at all** (see below), so `SECURITY DEFINER` is the only reason
`authenticated` (the real caller — `analytics.ts`'s `submitSessionStats`) can
write to it at all. Switching to `SECURITY INVOKER` + a real policy to
silence this lint would mean opening direct, arbitrary write access to
`aggregate_stats` for every signed-in client instead of the one narrow,
parameterized function — a larger surface, not a smaller one. Leave it
flagged.

#### `leaderboard` view is SECURITY DEFINER (ERROR)

**Decided 2026-09-02: leave as is.** Investigated converting to `SECURITY
INVOKER` + a permissive SELECT policy, as the lint suggests. `user_progress`
has RLS but only "own row" and "own row or accepted-instructor's learner"
SELECT policies — no broad read policy. Under `security_invoker`, a normal
learner querying `leaderboard` would have the join filtered to just their own
row, breaking the top-50 feature outright. Making it work would require a new
policy broad enough to let one user's query see others' `user_progress` rows
— but RLS is row-level, not column-level, so that same policy would also let
anyone query `user_progress` directly and read every other user's full raw
`progress` JSON (mock test history, topic scores, everything), not just the
four columns the view exposes today. Either breaks the feature or leaks
substantially more than the view currently does. Leaderboard data being
intentionally public makes the underlying lint low-risk to leave as is.

**Real fix, if this ever matters:** a dedicated `leaderboard_cache` table —
just `username`/`xp`/`streak`/`readiness_score`, refreshed periodically, with
its own permissive policy — decoupled from the sensitive table entirely. A
build task, not a SQL-editor statement.

**Historical precedent for this exact call, found during `schema.sql`
reconciliation (below):** `schema.sql` itself documents that a broad
`"Anyone can read leaderboard" ON user_progress FOR SELECT USING (true)`
policy existed once, and was deliberately dropped as a security fix —
Postgres ORs permissive policies together, so it silently made every user's
full `progress` JSON readable by anyone, unauthenticated, not just the
leaderboard-safe columns (see `schema.sql` lines ~200-209 for the original
fix's own explanation). Converting the view to `SECURITY INVOKER` with a new
permissive policy would be re-introducing close to the same mistake this
codebase already made once and fixed. Strengthens, doesn't change, the
decision above.

#### 6 tables with RLS enabled but no policies

`aggregate_stats`, `explain_daily_usage`, `revenuecat_webhook_events`,
`seat_refund_flags`, `stripe_webhook_events`, `waitlist`. These are
server-side-only tables accessed via `service_role` key. RLS-on with no
policies means PostgREST returns nothing to `anon`/`authenticated`, which is
correct. No action needed unless client-side access is ever added.

#### Mutable `search_path` on 3 functions

**Fixed 2026-09-02.** `set_updated_at`, `set_progress_sharing_consent`,
`update_aggregate_stats`. Used `SET search_path = 'public'`, **not** the
empty string this entry originally suggested — none of the three bodies
schema-qualify their table references (`aggregate_stats`,
`progress_sharing_consent`, `instructor_relationships` all appear bare), so
an empty search path would have broken all three outright. A fixed
non-empty path closes the lint just as well, since the point is removing
*mutability*, not emptying it. Confirmed via `pg_proc.proconfig` and a fresh
`get_advisors` run — the `function_search_path_mutable` lint no longer
appears at all.

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

**Decided 2026-09-02: not dropping any of them, including
`challenges_share_code_idx`** (the one genuinely ClearPass-only, zero-risk
candidate). `pg_stat_user_indexes` showing `idx_scan = 0` only proves unused
*since the last stats reset* — not unused forever — and there's no benefit
at current scale that justifies acting on that weak a signal. The other five
(`players_coach_id_idx`, `matches_coach_id_idx`, `lineups_match_id_idx`,
`attendance_player_id_idx`, `attendance_session_idx`) are on tables that
belong to Zen Footy, not ClearPass, sharing this Supabase project — not a
call to make from ClearPass's side alone regardless of scan counts.
`profiles_signup_ref_idx` stays for the same original reason: too new to
judge, and the one event that would exercise it (the conference) hasn't
happened yet.

#### Auth DB connection limit

10 connections configured. Fine for current scale; revisit if the instance is
upgraded.
