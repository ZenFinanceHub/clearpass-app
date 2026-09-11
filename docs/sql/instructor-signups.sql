-- Instructor signups report — read-only, aggregate only.
-- Scope: profiles.account_type = 'instructor' created on or after 2026-09-11
-- (the day instructor_signups/manual verification shipped). Paste into the
-- Supabase SQL Editor and run each section separately, or all at once —
-- every statement here is a plain SELECT, nothing here writes anything.
--
-- Verification status (section 5) is instructor_verification_requests.
-- status, EXCEPT that a row in instructor_verifications always wins and
-- reads as 'verified' regardless of the request's own status — same
-- precedence as GET /api/instructor/verification (see
-- resolveVerificationStatus in lib/instructorVerification.js), because a
-- grandfathered or manually comp'd instructor can have a verification with
-- no request row at all.

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
  case
    when v.user_id is not null then 'verified'
    when r.status is not null then r.status
    else 'none'
  end as verification_status,
  count(*) as signups
from profiles p
left join instructor_verifications v on v.user_id = p.id
left join instructor_verification_requests r on r.user_id = p.id
where p.account_type = 'instructor'
  and p.created_at >= '2026-09-11'
group by 1
order by 1;
