-- DRAFT — NOT APPLIED. Written for review only; run manually via the
-- Supabase SQL Editor once reviewed.
--
-- Tracks how each instructor account was created (web signup vs the mobile
-- app's self-declared choose-account-type screen) and whether it's been
-- announced to Slack yet. Two producers:
--   - POST /api/instructor/complete-signup inserts source: 'web' with the
--     campaign ref carried over from step 1's user_metadata.signup_ref
--     (see proxy.js — the same ref that's been stamped onto profiles.
--     signup_ref since that endpoint existed; this table just also gets a
--     copy so it can be read without joining back to auth.users).
--   - POST /api/cron/grant-instructor-pro (now every 15 minutes, was daily)
--     backfills source: 'app' for any account_type = 'instructor' profile
--     with no row here yet — the app's own signup insert
--     (choose-account-type.tsx) is a plain client-side write with the anon
--     key and has no reason to know about this table.
--
-- notified_at is set once the "New instructor signup" Slack post for that
-- row has actually gone out, by the same grant-instructor-pro run — kept as
-- a separate step (not set at insert time) so a Slack outage never blocks
-- either producer above, and a crashed/retried run can't double-post: it
-- only ever selects rows where notified_at is still null.
--
-- No RLS policies at all — same convention as instructor_verifications and
-- stripe_webhook_events: service_role/postgres only, no client-side access
-- of any kind.
create table if not exists instructor_signups (
  user_id      uuid primary key references profiles(id) on delete cascade,
  source       text not null check (source in ('web', 'app')),
  campaign_ref text,
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table instructor_signups enable row level security;

-- Backfill: every instructor account live today (2026-09-11) is Craig's own
-- test account, not a real signup — source is deliberately 'app' for all of
-- them regardless of which flow each actually went through (three of the
-- five are, in fact, web signups by auth.users.user_metadata.
-- instructor_signup_intent — see the read-only investigation this migration
-- was drafted alongside), and notified_at is stamped immediately so none of
-- them trigger the "New instructor signup" Slack alert once the 15-minute
-- job starts running.
insert into instructor_signups (user_id, source, notified_at)
select id, 'app', now()
from profiles
where account_type = 'instructor'
on conflict (user_id) do nothing;
