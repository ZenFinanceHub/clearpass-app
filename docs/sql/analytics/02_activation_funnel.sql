-- Read-only. Run in the Supabase SQL editor or via an approved read-only connection.
--
-- Activation funnel by platform for people who completed signup in the
-- window: signup -> onboarding completed -> first question answered ->
-- first session completed -> practice results viewed. Each step counts
-- distinct actors who reached it at any time (pre-signup taster answers
-- count, via the install's anon_id). Platform = platform of the signup.
-- Genuine only: excludes profiles.exclude_from_stats and their anon installs.

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
    fe.event,
    fe.platform,
    fe.created_at,
    coalesce(fe.user_id::text, ao.user_id::text, 'anon:' || fe.anon_id) as actor
  from public.funnel_events fe
  left join anon_owner ao on ao.anon_id = fe.anon_id
  where fe.event in ('signup_started', 'signup_completed', 'onboarding_completed',
                     'first_question_answered', 'first_session_completed', 'practice_results_viewed')
    and not exists (select 1 from excluded_users x where x.user_id = coalesce(fe.user_id, ao.user_id))
    and not exists (select 1 from excluded_anon xa where xa.anon_id = fe.anon_id)
),
signups as (
  select actor, min(created_at) as signed_up_at, (array_agg(platform order by created_at))[1] as platform
  from ev
  where event = 'signup_completed'
  group by actor
  having min(created_at) >= (select since from params)
),
reached as (
  select s.platform, s.actor,
    true as signup_completed,
    exists (select 1 from ev e where e.actor = s.actor and e.event = 'onboarding_completed')    as onboarding_completed,
    exists (select 1 from ev e where e.actor = s.actor and e.event = 'first_question_answered') as first_question_answered,
    exists (select 1 from ev e where e.actor = s.actor and e.event = 'first_session_completed') as first_session_completed,
    exists (select 1 from ev e where e.actor = s.actor and e.event = 'practice_results_viewed') as practice_results_viewed
  from signups s
)
select
  platform,
  count(*)                                              as signup_completed,
  count(*) filter (where onboarding_completed)          as onboarding_completed,
  count(*) filter (where first_question_answered)       as first_question_answered,
  count(*) filter (where first_session_completed)       as first_session_completed,
  count(*) filter (where practice_results_viewed)       as practice_results_viewed,
  round(100.0 * count(*) filter (where first_session_completed) / nullif(count(*), 0), 1) as activated_pct
from reached
group by rollup (platform)
order by platform nulls last;

-- Top of funnel (people who saw signup in the window, signed up or not):
-- replace the final select above with
-- select platform, count(distinct actor) from ev, params
-- where event = 'signup_started' and created_at >= params.since group by platform;
