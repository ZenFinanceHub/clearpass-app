-- Read-only. Run in the Supabase SQL editor or via an approved read-only connection.
--
-- Daily limit -> upgrade prompt -> paywall -> purchase funnel by platform,
-- for people who hit the daily free limit in the window. Each later step
-- counts distinct actors who reached it at or after their first limit hit
-- in the window. Genuine only, and comp accounts
-- (user_progress.progress->>'proSource' = 'comp') are excluded because they
-- never needed to buy. Stripe purchases complete on the web checkout page, so
-- for rail = 'stripe' purchase_started is the last step the app records;
-- confirm payment from Stripe / user_progress, not from this table.

with params as (
  select (now() - interval '30 days') as since
),
excluded_users as (
  select p.id as user_id
  from public.profiles p
  where p.exclude_from_stats
  -- or p.account_class <> 'genuine'   -- once profiles.account_class exists
  union
  select up.id
  from public.user_progress up
  where up.progress->>'proSource' = 'comp'
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
    coalesce(fe.user_id::text, ao.user_id::text, 'anon:' || fe.anon_id) as actor
  from public.funnel_events fe
  left join anon_owner ao on ao.anon_id = fe.anon_id
  cross join params
  where fe.created_at >= params.since
    and fe.event in ('daily_limit_hit', 'paywall_prompt_viewed', 'paywall_prompt_tapped',
                     'paywall_viewed', 'purchase_started', 'purchase_succeeded')
    and not exists (select 1 from excluded_users x where x.user_id = coalesce(fe.user_id, ao.user_id))
    and not exists (select 1 from excluded_anon xa where xa.anon_id = fe.anon_id)
),
limit_hit as (
  select actor, min(created_at) as first_hit, (array_agg(platform order by created_at))[1] as platform
  from ev
  where event = 'daily_limit_hit'
  group by actor
),
reached as (
  select l.platform, l.actor,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'paywall_prompt_viewed' and e.props->>'reason' = 'daily_limit') as prompt_viewed,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'paywall_prompt_tapped' and e.props->>'reason' = 'daily_limit') as prompt_tapped,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'paywall_viewed')     as paywall_viewed,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'purchase_started')   as purchase_started,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'purchase_succeeded') as purchase_succeeded
  from limit_hit l
)
select
  platform,
  count(*)                                   as daily_limit_hit,
  count(*) filter (where prompt_viewed)      as limit_prompt_viewed,
  count(*) filter (where prompt_tapped)      as limit_prompt_tapped,
  count(*) filter (where paywall_viewed)     as paywall_viewed,
  count(*) filter (where purchase_started)   as purchase_started,
  count(*) filter (where purchase_succeeded) as purchase_succeeded_iap,
  round(100.0 * count(*) filter (where purchase_started) / nullif(count(*), 0), 1) as limit_to_purchase_start_pct
from reached
group by rollup (platform)
order by platform nulls last;
