-- Instructor signups report — read-only, aggregate only.
-- Scope: profiles.account_type = 'instructor' created on or after 2026-09-11
-- (the day instructor_signups/manual verification shipped). Paste into the
-- Supabase SQL Editor and run each section separately, or all at once —
-- every statement here is a plain SELECT, nothing here writes anything.
--
-- Verification status is currently binary: instructor_verifications has no
-- concept of 'pending' or 'rejected', only "a row exists" (verified) or "no
-- row" (none) — see the instructor_verifications migration. Those two
-- buckets are included below so this query keeps working unchanged if a
-- real status column is added later; until then they will always read 0.

-- ── 1. Total instructor signups since 2026-09-11 ───────────────────────────
select count(*) as total_since_2026_09_11
from profiles
where account_type = 'instructor'
  and created_at >= '2026-09-11';

-- ── 2. Signups in the last 7 days ───────────────────────────────────────────
select count(*) as last_7_days
from profiles
where account_type = 'instructor'
  and created_at >= '2026-09-11'
  and created_at >= now() - interval '7 days';

-- ── 3. Count per week ────────────────────────────────────────────────────────
select
  date_trunc('week', created_at) as week_starting,
  count(*) as signups
from profiles
where account_type = 'instructor'
  and created_at >= '2026-09-11'
group by 1
order by 1;

-- ── 4. Breakdown by source and campaign_ref ─────────────────────────────────
-- instructor_signups.source/campaign_ref (see that table's migration);
-- left join so an instructor profile with no tracking row yet (a gap, not
-- expected once grant-instructor-pro's backfill has run) still shows up
-- under source = null rather than being silently dropped.
select
  coalesce(s.source, '(untracked)') as source,
  coalesce(s.campaign_ref, '(none)') as campaign_ref,
  count(*) as signups
from profiles p
left join instructor_signups s on s.user_id = p.id
where p.account_type = 'instructor'
  and p.created_at >= '2026-09-11'
group by 1, 2
order by signups desc;

-- ── 5. Breakdown by verification status ─────────────────────────────────────
select
  case when v.user_id is not null then 'verified' else 'none' end as verification_status,
  count(*) as signups
from profiles p
left join instructor_verifications v on v.user_id = p.id
where p.account_type = 'instructor'
  and p.created_at >= '2026-09-11'
group by 1

union all

-- 'pending' and 'rejected' don't exist in the schema yet — included as
-- explicit zero rows so the shape of this report doesn't change later.
select 'pending' as verification_status, 0 as signups
union all
select 'rejected' as verification_status, 0 as signups
order by verification_status;
