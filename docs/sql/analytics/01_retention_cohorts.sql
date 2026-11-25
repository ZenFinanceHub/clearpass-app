-- Read-only. Run in the Supabase SQL editor or via an approved read-only connection.
--
-- D1 / D7 / D30 retention by weekly cohort and platform, from app_opened.
-- Cohort day = the earlier of the actor's first app_opened and their
-- signup_completed (UK local date). Retained on Dn = an app_opened on
-- exactly cohort day + n. Cohorts too young to measure show NULL.
-- Counted only: excludes profiles.exclude_from_stats and their anon installs
-- (see docs/analytics/event-taxonomy.md). Comp accounts are kept.

-- Counted = profiles.exclude_from_stats = false. Set by_class = true in
-- params to split results by profiles.account_class (genuine, internal, junk,
-- reviewer, unclassified; 'unclassified' = counted but not yet triaged;
-- 'no_account' = install that never signed up). account_class exists in
-- production but not yet in the repo schema (drift, see the taxonomy doc).

with params as (
  select (now() - interval '120 days') as since, false as by_class
),
excluded_users as (
  select p.id as user_id
  from public.profiles p
  where p.exclude_from_stats
),
excluded_anon as (
  select distinct fe.anon_id
  from public.funnel_events fe
  join excluded_users x on x.user_id = fe.user_id
),
anon_owner as (
  -- the account that signed in on each install (first one wins)
  select anon_id, (array_agg(user_id order by created_at))[1] as user_id
  from public.funnel_events
  where user_id is not null
  group by anon_id
),
ev as (
  select
    case when params.by_class then coalesce(pr.account_class, 'no_account') else 'all' end as account_class,
    fe.event,
    fe.platform,
    (fe.created_at at time zone 'Europe/London')::date as day,
    coalesce(fe.user_id::text, ao.user_id::text, 'anon:' || fe.anon_id) as actor
  from public.funnel_events fe
  left join anon_owner ao on ao.anon_id = fe.anon_id
  left join public.profiles pr on pr.id = coalesce(fe.user_id, ao.user_id)
  cross join params
  where fe.created_at >= params.since
    and fe.event in ('app_opened', 'signup_completed')
    and not exists (select 1 from excluded_users x where x.user_id = coalesce(fe.user_id, ao.user_id))
    and not exists (select 1 from excluded_anon xa where xa.anon_id = fe.anon_id)
),
cohort as (
  select
    actor,
    min(day) as cohort_day,
    (array_agg(platform order by day))[1] as platform,
    max(account_class) as account_class
  from ev
  group by actor
),
opens as (
  select distinct actor, day from ev where event = 'app_opened'
),
per_actor as (
  select
    c.actor,
    c.platform,
    c.account_class,
    c.cohort_day,
    date_trunc('week', c.cohort_day)::date as cohort_week,
    exists (select 1 from opens o where o.actor = c.actor and o.day = c.cohort_day + 1)  as d1,
    exists (select 1 from opens o where o.actor = c.actor and o.day = c.cohort_day + 7)  as d7,
    exists (select 1 from opens o where o.actor = c.actor and o.day = c.cohort_day + 30) as d30
  from cohort c
)
select
  cohort_week,
  platform,
  account_class,
  count(*) as cohort_size,
  round(100.0 * count(*) filter (where d1)  / nullif(count(*) filter (where cohort_day + 1  < current_date), 0), 1) as d1_pct,
  round(100.0 * count(*) filter (where d7)  / nullif(count(*) filter (where cohort_day + 7  < current_date), 0), 1) as d7_pct,
  round(100.0 * count(*) filter (where d30) / nullif(count(*) filter (where cohort_day + 30 < current_date), 0), 1) as d30_pct
from per_actor
group by cohort_week, platform, account_class
order by cohort_week desc, platform, account_class;
