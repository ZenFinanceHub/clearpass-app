-- Read-only. Run in the Supabase SQL editor or via an approved read-only connection.
-- Returns user ids and aggregate fields only (no emails or names).
--
-- Store FREE TRIALS via RevenueCat. Since fix/f1b-trials-not-paying the webhook:
--   * grants a PRODUCTION trial (event period_type = 'TRIAL') as
--     user_progress.progress->>'proSource' = 'iap_trial' — same isPro and
--     proExpiresAt as before, never counted as paying;
--   * moves it to 'iap' (paying) on conversion (RENEWAL with
--     is_trial_conversion, or the first paid RENEWAL over 'iap_trial');
--   * writes durable funnel_events markers, once per RevenueCat event id:
--       iap_trial_started    INITIAL_PURCHASE, period_type TRIAL
--       iap_trial_converted  RENEWAL, is_trial_conversion (or first paid renewal)
--       iap_trial_cancelled  CANCELLATION, period_type TRIAL (auto-renew off;
--                            Pro stays until the trial end date)
--     with anon_id 'revenuecat:<event id>' and props {source, rc_event_id,
--     rc_event_type, environment, store, product_id, period_type,
--     is_trial_conversion, cancel_reason}.
-- SANDBOX trials stay 'iap_sandbox' and get no trial markers.
--
-- IMPORTANT: rows written BEFORE this fix was deployed say plain 'iap'
-- whatever the period — the database never stored period_type. For those
-- rows the facts verified by the owner in RevenueCat govern, not the
-- "likely" column below (as of 2026-11-26: one learner converted from a
-- 3-day trial to a paid monthly plan; one learner is in a 3-day trial,
-- cancelled, with Pro until the trial ends). Do not edit those rows.

-- 1. Current RevenueCat grants and how they are classified for reporting.
--    reporting_class is what lib/dailyStats.js does with the row today:
--      paying           — 'iap', active
--      trial            — 'iap_trial', active
--      sandbox          — 'iap_sandbox', active
--      lapsed           — any of them, expiry in the past (free learner)
--    likely_from_app_event is a HINT for pre-fix 'iap' rows only: the
--    app's own latest purchase_succeeded event carries props.trialDays (the
--    offered trial length, null when there was none). If that purchase was
--    a trial and is still inside its trial window, the row is probably
--    still a trial; if past it, RevenueCat decides converted vs cancelled.
--    Also the pre-rollback check: any row with reporting_class 'trial'
--    means a plain redeploy of an older server is NOT safe (see PR).
with latest_purchase as (
  select distinct on (fe.user_id)
         fe.user_id,
         fe.created_at,
         case when (fe.props->>'trialDays') ~ '^[0-9]+$' then (fe.props->>'trialDays')::int end as trial_days
  from public.funnel_events fe
  where fe.event = 'purchase_succeeded' and fe.user_id is not null
  order by fe.user_id, fe.created_at desc
),
markers as (
  select fe.user_id,
         count(*) filter (where fe.event = 'iap_trial_started')   as trial_started,
         count(*) filter (where fe.event = 'iap_trial_converted') as trial_converted,
         count(*) filter (where fe.event = 'iap_trial_cancelled') as trial_cancelled
  from public.funnel_events fe
  where fe.event in ('iap_trial_started', 'iap_trial_converted', 'iap_trial_cancelled')
    and fe.user_id is not null
  group by fe.user_id
)
select up.id                                  as user_id,
       up.progress->>'proSource'              as pro_source,
       up.progress->>'isPro'                  as is_pro,
       up.progress->>'proExpiresAt'           as pro_expires_at,
       p.exclude_from_stats,
       case
         when (up.progress->>'isPro')::boolean is not true
           or coalesce(up.progress->>'proExpiresAt', '') <= to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
           then 'lapsed'
         when up.progress->>'proSource' = 'iap'         then 'paying'
         when up.progress->>'proSource' = 'iap_trial'   then 'trial'
         when up.progress->>'proSource' = 'iap_sandbox' then 'sandbox'
       end                                    as reporting_class,
       coalesce(m.trial_started, 0)           as trial_started_markers,
       coalesce(m.trial_converted, 0)         as trial_converted_markers,
       coalesce(m.trial_cancelled, 0)         as trial_cancelled_markers,
       lp.created_at                          as last_purchase_succeeded_at,
       lp.trial_days                          as last_purchase_trial_days,
       case
         when up.progress->>'proSource' <> 'iap'            then null
         when m.user_id is not null                          then 'see markers (post-fix)'
         when lp.user_id is null                             then 'no app purchase event: check RevenueCat'
         when coalesce(lp.trial_days, 0) = 0                 then 'paid at purchase (no trial offered)'
         when lp.created_at + make_interval(days => lp.trial_days) > now()
                                                             then 'probably still in trial: pre-fix row counted as paying'
         else 'trial ended: converted or cancelled, check RevenueCat'
       end                                    as likely_from_app_event
from public.user_progress up
left join public.profiles p    on p.id = up.id
left join latest_purchase lp   on lp.user_id = up.id
left join markers m            on m.user_id = up.id
where up.progress->>'proSource' in ('iap', 'iap_trial', 'iap_sandbox')
order by reporting_class, up.id;

-- 2. Aggregate: active RevenueCat grants by class (safe to share).
select up.progress->>'proSource' as pro_source,
       count(*) filter (where (up.progress->>'isPro')::boolean is true
                          and up.progress->>'proExpiresAt' > to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) as active,
       count(*) as total
from public.user_progress up
where up.progress->>'proSource' in ('iap', 'iap_trial', 'iap_sandbox')
group by 1
order by 1;

-- 3. Trial markers by week (aggregate), excluding exclude_from_stats accounts.
select date_trunc('week', fe.created_at)                                  as week,
       count(distinct fe.props->>'rc_event_id') filter (where fe.event = 'iap_trial_started')   as trials_started,
       count(distinct fe.props->>'rc_event_id') filter (where fe.event = 'iap_trial_converted') as trials_converted,
       count(distinct fe.props->>'rc_event_id') filter (where fe.event = 'iap_trial_cancelled') as trials_cancelled
from public.funnel_events fe
left join public.profiles p on p.id = fe.user_id
where fe.event in ('iap_trial_started', 'iap_trial_converted', 'iap_trial_cancelled')
  and coalesce(p.exclude_from_stats, false) is false
group by 1
order by 1 desc;
