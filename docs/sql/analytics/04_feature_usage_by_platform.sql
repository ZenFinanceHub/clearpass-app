-- Read-only. Run in the Supabase SQL editor or via an approved read-only connection.
--
-- Feature usage by platform from feature_used (one row per screen entry or
-- mode start). People = distinct actors; entries = total events. Last 7 and
-- 30 days. Genuine only: excludes profiles.exclude_from_stats and their anon
-- installs. Comp accounts are kept.

with params as (
  select (now() - interval '30 days') as since
),
excluded_users as (
  select p.id as user_id
  from public.profiles p
  where p.exclude_from_stats
  -- or p.account_class <> 'genuine'   -- once profiles.account_class exists
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
    fe.platform,
    fe.props->>'feature' as feature,
    fe.created_at,
    coalesce(fe.user_id::text, ao.user_id::text, 'anon:' || fe.anon_id) as actor
  from public.funnel_events fe
  left join anon_owner ao on ao.anon_id = fe.anon_id
  cross join params
  where fe.event = 'feature_used'
    and fe.created_at >= params.since
    and not exists (select 1 from excluded_users x where x.user_id = coalesce(fe.user_id, ao.user_id))
    and not exists (select 1 from excluded_anon xa where xa.anon_id = fe.anon_id)
)
select
  feature,
  platform,
  count(distinct actor) filter (where created_at >= now() - interval '7 days') as people_7d,
  count(*)              filter (where created_at >= now() - interval '7 days') as entries_7d,
  count(distinct actor)                                                         as people_30d,
  count(*)                                                                      as entries_30d
from ev
group by feature, platform
order by people_30d desc, feature, platform;
