-- Read-only. Run in the Supabase SQL editor or via an approved read-only connection.
--
-- Daily limit -> upgrade prompt -> paywall -> purchase funnel by platform,
-- for people who hit the daily free limit in the window. Each later step
-- counts distinct actors who reached it at or after their first limit hit
-- in the window. Counted only (exclude_from_stats = false), and comp accounts
-- (user_progress.progress->>'proSource' = 'comp') are excluded because they
-- never needed to buy. Stripe purchases complete on the web checkout page, so
-- for rail = 'stripe' purchase_started is the last step the app records;
-- confirm payment from Stripe / user_progress, not from this table.
--
-- Store purchases are split into TRIAL STARTS and PAID purchases (a trial
-- takes no money until it converts):
--   purchase_succeeded_trial  app purchase_succeeded with props.trialDays > 0
--   purchase_succeeded_paid   app purchase_succeeded with trialDays null/0
--   trial_converted           server marker iap_trial_converted (RevenueCat
--                             RENEWAL with is_trial_conversion, PR #118)
--   paid_total                paid immediately OR trial converted
-- Server markers only exist for events after #118 was deployed; earlier
-- trials show as trial starts with no conversion data here.

-- Counted = profiles.exclude_from_stats = false. Set by_class = true in
-- params to split results by profiles.account_class (genuine, internal, junk,
-- reviewer, unclassified; 'unclassified' = counted but not yet triaged;
-- 'no_account' = install that never signed up). account_class exists in
-- production but not yet in the repo schema (drift, see the taxonomy doc).

with params as (
  select (now() - interval '30 days') as since, false as by_class
),
excluded_users as (
  select p.id as user_id
  from public.profiles p
  where p.exclude_from_stats
  union
  select up.id
  from public.user_progress up
  where up.progress->>'proSource' = 'comp'
  union
  -- Sandbox / App Review / TestFlight testers (PR #113, F1): never counted as
  -- purchases, unless they now hold a genuine, unexpired paid grant.
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
    case when params.by_class then coalesce(pr.account_class, 'no_account') else 'all' end as account_class,
    fe.event,
    fe.platform,
    fe.props,
    fe.created_at,
    coalesce(fe.user_id::text, ao.user_id::text, 'anon:' || fe.anon_id) as actor
  from public.funnel_events fe
  left join anon_owner ao on ao.anon_id = fe.anon_id
  left join public.profiles pr on pr.id = coalesce(fe.user_id, ao.user_id)
  cross join params
  where fe.created_at >= params.since
    and fe.event in ('daily_limit_hit', 'paywall_prompt_viewed', 'paywall_prompt_tapped',
                     'paywall_viewed', 'purchase_started', 'purchase_succeeded',
                     'iap_trial_converted')
    and not exists (select 1 from excluded_users x where x.user_id = coalesce(fe.user_id, ao.user_id))
    and not exists (select 1 from excluded_anon xa where xa.anon_id = fe.anon_id)
),
limit_hit as (
  select actor, min(created_at) as first_hit, (array_agg(platform order by created_at))[1] as platform,
         max(account_class) as account_class
  from ev
  where event = 'daily_limit_hit'
  group by actor
),
reached as (
  select l.platform, l.account_class, l.actor,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'paywall_prompt_viewed' and e.props->>'reason' = 'daily_limit') as prompt_viewed,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'paywall_prompt_tapped' and e.props->>'reason' = 'daily_limit') as prompt_tapped,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'paywall_viewed')     as paywall_viewed,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'purchase_started')   as purchase_started,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'purchase_succeeded') as purchase_succeeded,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'purchase_succeeded'
            and coalesce(case when (e.props->>'trialDays') ~ '^[0-9]+$'
                              then (e.props->>'trialDays')::int end, 0) > 0) as purchase_trial,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'purchase_succeeded'
            and coalesce(case when (e.props->>'trialDays') ~ '^[0-9]+$'
                              then (e.props->>'trialDays')::int end, 0) = 0) as purchase_paid,
    exists (select 1 from ev e where e.actor = l.actor and e.created_at >= l.first_hit
            and e.event = 'iap_trial_converted') as trial_converted
  from limit_hit l
)
select
  account_class,
  platform,
  count(*)                                   as daily_limit_hit,
  count(*) filter (where prompt_viewed)      as limit_prompt_viewed,
  count(*) filter (where prompt_tapped)      as limit_prompt_tapped,
  count(*) filter (where paywall_viewed)     as paywall_viewed,
  count(*) filter (where purchase_started)   as purchase_started,
  count(*) filter (where purchase_succeeded) as purchase_succeeded_iap,
  count(*) filter (where purchase_trial)     as purchase_succeeded_trial,
  count(*) filter (where purchase_paid)      as purchase_succeeded_paid,
  count(*) filter (where trial_converted)    as trial_converted,
  count(*) filter (where purchase_paid or trial_converted) as paid_total,
  round(100.0 * count(*) filter (where purchase_started) / nullif(count(*), 0), 1) as limit_to_purchase_start_pct,
  round(100.0 * count(*) filter (where purchase_paid or trial_converted) / nullif(count(*), 0), 1) as limit_to_paid_pct
from reached
group by grouping sets ((account_class, platform), (account_class))
order by account_class, platform nulls last;
