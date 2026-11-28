-- Read-only. Run in the Supabase SQL editor or via an approved read-only connection.
-- Returns user ids and aggregate fields only (no emails or names).
--
-- Store SANDBOX purchases (TestFlight, App Store review, Google Play licence
-- testers) via RevenueCat. Since fix/f1-flag-sandbox-purchases the webhook:
--   * grants them as user_progress.progress->>'proSource' = 'iap_sandbox'
--     (still Pro, never counted as paying), and
--   * writes a funnel_events row event = 'iap_sandbox_purchase' per SANDBOX
--     INITIAL_PURCHASE (props.environment = 'SANDBOX', props.rc_event_id),
--     a durable marker that outlives the short-lived sandbox subscription.
--
-- Rule for any revenue / paying / conversion query: a "sandbox tester" is a
-- user with an iap_sandbox_purchase marker OR proSource = 'iap_sandbox',
-- UNLESS they currently hold a real active paid grant (iap/stripe/seat with
-- a future proExpiresAt). Exclude sandbox testers wherever exclude_from_stats
-- accounts are excluded. Paying sources are exactly 'stripe', 'seat', 'iap'.

-- 1. Sandbox testers (same definition as lib/funnelStats.js sandboxTesterUserIds).
with real_payers as (
  select up.id
  from public.user_progress up
  where (up.progress->>'isPro')::boolean is true
    and up.progress->>'proSource' in ('stripe', 'seat', 'iap')
    and (up.progress->>'proExpiresAt') > to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
),
sandbox_testers as (
  select fe.user_id from public.funnel_events fe
  where fe.event = 'iap_sandbox_purchase' and fe.user_id is not null
  union
  select up.id from public.user_progress up
  where up.progress->>'proSource' = 'iap_sandbox'
)
select st.user_id,
       exists (select 1 from real_payers rp where rp.id = st.user_id) as now_real_payer
from sandbox_testers st
order by now_real_payer, st.user_id;

-- 2. HISTORICAL candidates: purchases recorded before the fix were stored as
-- plain 'iap' whatever their environment. revenuecat_webhook_events only
-- keeps (event_id, event_type, processed_at) — no app_user_id and no
-- environment — so the database alone CANNOT tell sandbox from production
-- for old rows. This lists every user whose current grant is 'iap', with
-- the context that helps triage; the environment itself must be confirmed
-- in RevenueCat (see the backfill option in the PR description).
select up.id                                    as user_id,
       up.progress->>'isPro'                    as is_pro,
       up.progress->>'proExpiresAt'             as pro_expires_at,
       up.updated_at,
       p.exclude_from_stats,
       p.account_type,
       (select min(fe.created_at) from public.funnel_events fe
         where fe.user_id = up.id and fe.event = 'purchase_succeeded') as first_purchase_succeeded_at,
       (select string_agg(distinct fe.platform, ',') from public.funnel_events fe
         where fe.user_id = up.id and fe.event = 'purchase_succeeded') as purchase_platforms
from public.user_progress up
left join public.profiles p on p.id = up.id
where up.progress->>'proSource' = 'iap'
order by up.updated_at desc;

-- 3. Sandbox marker volume by week and store (aggregate).
select date_trunc('week', created_at) as week,
       props->>'store'                as store,
       count(*)                       as sandbox_purchases,
       count(distinct user_id)        as sandbox_users
from public.funnel_events
where event = 'iap_sandbox_purchase'
group by 1, 2
order by 1 desc, 2;
