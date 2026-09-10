-- APPLIED 2026-09-10 via Supabase SQL Editor
--
-- account_type = 'instructor' is self-declared client-side at signup (see
-- app/auth/choose-account-type.tsx — a plain two-button screen, no
-- verification of any kind) and, until now, was the ONLY condition
-- POST /api/cron/grant-instructor-pro checked before handing out permanent,
-- non-expiring free Pro. Any signed-up user could tap "I'm an instructor"
-- and collect it on the next daily cron run, with no devtools required.
--
-- This table is the manual verification record: a row only exists here
-- once someone (Craig, today — manually, until there's a real verification
-- flow) has actually confirmed the account belongs to a real instructor.
-- grant-instructor-pro now requires both account_type = 'instructor' AND a
-- row here before granting.
--
-- No RLS policies at all — same convention as stripe_webhook_events /
-- revenuecat_webhook_events (see schema.sql): service_role and postgres
-- (direct SQL editor access, which is how this table is expected to be
-- written to for now) can read and write; no authenticated/anon access of
-- any kind, so a learner's own session can never insert their own
-- "verification".
create table if not exists instructor_verifications (
  user_id     uuid primary key references profiles(id) on delete cascade,
  verified_at timestamptz not null default now(),
  note        text
);

alter table instructor_verifications enable row level security;
-- No policies: no client-side access of any kind, service role only.
