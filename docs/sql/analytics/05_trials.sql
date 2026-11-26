-- Read-only. Run in the Supabase SQL editor or via an approved read-only connection.
--
-- Store free-trial funnel: trials started, converted to paid, cancelled, and
-- the conversion rate, by week the trial started and store platform (with a
-- per-week total row).
--
-- Sources (see docs/analytics/event-taxonomy.md):
--   * server markers written by the RevenueCat webhook (PR #118), once per
--     RevenueCat event: iap_trial_started, iap_trial_converted,
--     iap_trial_cancelled. These are the store-verified numbers.
--   * the app's purchase_succeeded with props.trialDays > 0, shown alongside
--     as app_trial_starts: it also covers trials from before #118 was
--     deployed, which have no server markers (and so no conversion data).
--
-- Who counts: profiles.exclude_from_stats = false, and never sandbox / App
-- Review / TestFlight testers (an iap_sandbox_purchase marker or a current
-- 'iap_sandbox' grant), unless they now hold a genuine unexpired paid grant.
-- Sandbox trials never get trial markers anyway; the exclusion also keeps
-- their app-side purchase_succeeded out of app_trial_starts.
--
-- A trial's outcome is matched per learner: converted = an
-- iap_trial_converted at or after their first trial start; cancelled = an
-- iap_trial_cancelled at or after it and no conversion (a learner who
-- cancelled, then re-enabled auto-renew and converted, counts as converted).
-- open = neither yet. conversion_pct = converted / started;
-- decided_conversion_pct = converted / (converted + cancelled), which is the
-- fairer number while recent trials are still open.

with params as (
  select (now() - interval '90 days') as since
),
excluded_users as (
  select p.id as user_id
  from public.profiles p
  where p.exclude_from_stats
  union
  select x.user_id from (
    select fe.user_id from public.funnel_events fe
     where fe.event = 'iap_sandbox_purchase' and fe.user_id is not null
    union
    select up.id from public.user_progress up where up.progress->>'proSource' = 'iap_sandbox'
  ) x
  where not exists (
    select 1 from public.user_progress rp
     where rp.id = x.user_id
       and (rp.progress->>'isPro')::boolean is true
       and rp.progress->>'proSource' in ('stripe', 'seat', 'iap')
       and rp.progress->>'proExpiresAt' > to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
),
excluded_anon as (
  select distinct fe.anon_id
  from public.funnel_events fe
  join excluded_users x on x.user_id = fe.user_id
),
anon_owner as (
  select anon_id, (array_agg(user_id order by created_at))[1] as user_id
  from public.funnel_events
  where user_id is not null
  group by anon_id
),
ev as (
  select
    fe.event,
    fe.platform,
    fe.props,
    fe.created_at,
    coalesce(fe.user_id, ao.user_id)                                  as user_id,
    coalesce(fe.user_id::text, ao.user_id::text, 'anon:' || fe.anon_id) as actor
  from public.funnel_events fe
  left join anon_owner ao on ao.anon_id = fe.anon_id
  cross join params
  where fe.created_at >= params.since
    and fe.event in ('iap_trial_started', 'iap_trial_converted', 'iap_trial_cancelled', 'purchase_succeeded')
    and not exists (select 1 from excluded_users x where x.user_id = coalesce(fe.user_id, ao.user_id))
    and not exists (select 1 from excluded_anon xa where xa.anon_id = fe.anon_id)
),
server_starts as (
  select actor, min(created_at) as started_at, (array_agg(platform order by created_at))[1] as platform
  from ev
  where event = 'iap_trial_started'
  group by actor
),
outcomes as (
  select s.actor, s.started_at, s.platform,
    exists (select 1 from ev e where e.actor = s.actor and e.created_at >= s.started_at
            and e.event = 'iap_trial_converted') as converted,
    exists (select 1 from ev e where e.actor = s.actor and e.created_at >= s.started_at
            and e.event = 'iap_trial_cancelled') as cancelled
  from server_starts s
),
app_starts as (
  select actor, min(created_at) as started_at, (array_agg(platform order by created_at))[1] as platform
  from ev
  where event = 'purchase_succeeded'
    and coalesce(case when (props->>'trialDays') ~ '^[0-9]+$' then (props->>'trialDays')::int end, 0) > 0
  group by actor
),
by_week as (
  select date_trunc('week', started_at) as week, platform, 'server' as src, converted, cancelled from outcomes
  union all
  select date_trunc('week', started_at), platform, 'app', false, false from app_starts
)
select
  week,
  platform,
  count(*) filter (where src = 'app')                                   as app_trial_starts,
  count(*) filter (where src = 'server')                                as trials_started,
  count(*) filter (where src = 'server' and converted)                  as trials_converted,
  count(*) filter (where src = 'server' and cancelled and not converted) as trials_cancelled,
  count(*) filter (where src = 'server' and not converted and not cancelled) as trials_open,
  round(100.0 * count(*) filter (where src = 'server' and converted)
        / nullif(count(*) filter (where src = 'server'), 0), 1)         as conversion_pct,
  round(100.0 * count(*) filter (where src = 'server' and converted)
        / nullif(count(*) filter (where src = 'server' and (converted or cancelled)), 0), 1) as decided_conversion_pct
from by_week
group by grouping sets ((week, platform), (week))
order by week desc, platform nulls last;
