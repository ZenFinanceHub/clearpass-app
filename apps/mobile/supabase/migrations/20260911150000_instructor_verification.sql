-- APPLIED 2026-09-11 via Supabase SQL Editor
--
-- Manual instructor verification. Decision: evidence is an ADI or trainee
-- (PDI) licence number only, flexible format, qualified and trainee
-- instructors both qualify. Verification is manual, by Craig, via the two
-- admin.* functions below — there is no automated check of a licence
-- number against DVSA or any register.
--
-- instructor_verification_requests is what an instructor submits (POST
-- /api/instructor/verification — see proxy.js) and what GET
-- /api/instructor/verification reads back to show status in the dashboard.
-- It is NOT what grant-instructor-pro or the payout/Connect gates check —
-- those still key off instructor_verifications (the existing, separate,
-- already-applied table: a row there is the actual grant of trust). This
-- table is the request/audit trail; instructor_verifications is the
-- decision. admin.verify_instructor() is the only thing that writes to
-- both, together, so they can't drift.
create table if not exists instructor_verification_requests (
  user_id                    uuid primary key references profiles(id) on delete cascade,
  licence_type               text not null check (licence_type in ('adi', 'pdi')),
  licence_number             text not null,
  licence_number_normalised  text not null,
  status                     text not null check (status in ('pending', 'verified', 'rejected')) default 'pending',
  submitted_at               timestamptz not null default now(),
  reviewed_at                timestamptz,
  review_note                text
);

-- Lets admin.verify_instructor's duplicate-number warning (see proxy.js's
-- POST /api/instructor/verification) run as an indexed lookup rather than a
-- sequential scan as this table grows.
create index if not exists instructor_verification_requests_licence_number_normalised_idx
  on instructor_verification_requests (licence_number_normalised);

alter table instructor_verification_requests enable row level security;
-- No RLS policies at all — same convention as instructor_verifications and
-- stripe_webhook_events: service_role/postgres only. The two server
-- endpoints that read/write this table both go through the service role
-- key (see verifyAuth + getSupabaseAdmin in proxy.js), never the caller's
-- own session.

-- No backfill — every current instructor account is a test account (see
-- the instructor_signups migration), not a real verification request.

-- ── admin schema ─────────────────────────────────────────────────────────
-- Not exposed via the API: Supabase's PostgREST only serves schemas listed
-- under Settings → API → Exposed schemas, which is 'public' (and
-- 'graphql_public') by default — 'admin' is never in that list, so nothing
-- here is reachable over the anon/service REST API regardless of key. The
-- revokes below are defence in depth on top of that, for any direct
-- Postgres connection (e.g. the SQL Editor itself runs as postgres, which
-- owns everything and isn't affected by these revokes; this only matters if
-- anon/authenticated ever gained a direct connection some other way).
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- select admin.verify_instructor('<uuid>');
-- Only path that ever writes instructor_verifications from this feature.
-- Raises (aborting the whole statement, nothing written) unless the
-- profile is account_type = 'instructor' — verifying a learner, or a uuid
-- with no profile at all, is always a mistake, not a valid grant.
-- on conflict do nothing on the instructor_verifications insert: re-running
-- this for an already-verified instructor (including the 5 grandfathered
-- test accounts, which were inserted directly, not through this function)
-- is a safe no-op, not an error.
create or replace function admin.verify_instructor(uid uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_account_type   text;
  v_display_name   text;
  v_licence_type   text;
  v_licence_number text;
begin
  select account_type, display_name into v_account_type, v_display_name
  from public.profiles
  where id = uid;

  if v_account_type is distinct from 'instructor' then
    raise exception 'profile % is not account_type=instructor (got %)', uid, coalesce(v_account_type, 'null (no profile)');
  end if;

  select licence_type, licence_number into v_licence_type, v_licence_number
  from public.instructor_verification_requests
  where user_id = uid;

  insert into public.instructor_verifications (user_id, note)
  values (
    uid,
    format('Verified via %s licence %s', coalesce(upper(v_licence_type), 'unknown'), coalesce(v_licence_number, 'unknown'))
  )
  on conflict (user_id) do nothing;

  update public.instructor_verification_requests
  set status = 'verified', reviewed_at = now()
  where user_id = uid;

  return format('Verified instructor: %s (%s)', coalesce(v_display_name, 'no name yet'), uid);
end;
$$;

revoke execute on function admin.verify_instructor(uuid) from public, anon, authenticated;

-- select admin.reject_instructor('<uuid>', 'reason');
-- Never touches instructor_verifications — rejecting a request must never
-- be able to revoke an entitlement that was granted some other way (e.g. a
-- past manual comp, or a re-submission after an earlier approval).
create or replace function admin.reject_instructor(uid uuid, reason text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_display_name text;
begin
  select display_name into v_display_name
  from public.profiles
  where id = uid;

  update public.instructor_verification_requests
  set status = 'rejected', review_note = reason, reviewed_at = now()
  where user_id = uid;

  return format('Rejected instructor: %s (%s) — %s', coalesce(v_display_name, 'no name yet'), uid, reason);
end;
$$;

revoke execute on function admin.reject_instructor(uuid, text) from public, anon, authenticated;
