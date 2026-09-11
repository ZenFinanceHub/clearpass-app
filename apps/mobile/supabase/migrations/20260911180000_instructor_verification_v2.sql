-- APPLIED 2026-09-11 via Supabase SQL Editor
--
-- Verification v2. Replaces the manual-only design from the previous
-- migration (20260911150000_instructor_verification.sql, still applied and
-- still the schema for instructor_verification_requests/instructor_
-- verifications — this migration only adds to it, nothing here drops or
-- rewrites those objects) with: instant self-declared auto-verification
-- (POST /api/instructor/verification — see proxy.js) unless the licence
-- number is already on another account, plus a payout-proof requirement
-- (an ADI certificate or trainee licence photo, checked by Claude) before
-- an instructor's first payout. admin.verify_instructor/reject_instructor
-- from the previous migration are unchanged and still the only way to
-- resolve a 'pending' (needs-review) request.

-- ── admin.revoke_instructor(uid, reason) ────────────────────────────────
-- select admin.revoke_instructor('<uuid>', 'reason');
-- Undoes a verification — for when self-declared auto-verification (or an
-- earlier admin.verify_instructor call) turns out to have been wrong.
-- Deletes the instructor_verifications row outright (not a status flag —
-- every other check in the app treats "a row exists" as the entire
-- definition of verified, so nothing else needs to know this ever
-- happened) and marks the request 'rejected' so the dashboard explains why.
-- Only clears the Pro grant on user_progress if it's still instructor-
-- sourced (merge via jsonb concatenation, not a full progress rewrite —
-- same reasoning as protect_user_progress_entitlement_keys: a learner's
-- mock history/XP/streaks live in the same JSONB blob and must survive
-- untouched) — a learner who separately paid or was comped after being
-- revoked keeps that entitlement.
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

create or replace function admin.revoke_instructor(uid uuid, reason text)
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

  delete from public.instructor_verifications where user_id = uid;

  update public.instructor_verification_requests
  set status = 'rejected', review_note = reason, reviewed_at = now()
  where user_id = uid;

  update public.user_progress
  set progress = progress || jsonb_build_object('isPro', false, 'proExpiresAt', null, 'proSource', null)
  where id = uid
    and progress->>'proSource' = 'instructor';

  return format('Revoked instructor: %s (%s) — %s', coalesce(v_display_name, 'no name yet'), uid, reason);
end;
$$;

revoke execute on function admin.revoke_instructor(uuid, text) from public, anon, authenticated;

-- ── Payout proof: storage + table + review functions ────────────────────
--
-- Private bucket — public = false, no storage.objects policies at all.
-- Same convention as every service-role-only table in this project:
-- service_role bypasses RLS/storage policy checks entirely, and every
-- read/write goes through the service role key (POST/GET
-- /api/instructor/payout-proof in proxy.js), never a client-side Supabase
-- Storage call — so there is nothing here for a policy to grant to
-- anon/authenticated in the first place.
insert into storage.buckets (id, name, public)
values ('instructor-documents', 'instructor-documents', false)
on conflict (id) do nothing;

-- One proof per instructor. extracted is Claude's raw parsed JSON
-- (document_type/licence_number/holder_name/expiry_date/confidence) kept
-- for audit — never the image itself, never posted to Slack, never
-- returned by GET /api/instructor/payout-proof (which only ever returns
-- status + review_note).
create table if not exists instructor_payout_proofs (
  user_id       uuid primary key references profiles(id) on delete cascade,
  storage_path  text not null,
  mime_type     text not null,
  status        text not null check (status in ('pending_review', 'approved', 'rejected')),
  extracted     jsonb,
  check_reason  text,
  auto_approved boolean not null default false,
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  review_note   text
);

alter table instructor_payout_proofs enable row level security;
-- No RLS policies at all — same convention as instructor_verification_
-- requests: service_role/postgres only, both server endpoints go through
-- the service role key, never the caller's own session.

-- select admin.approve_payout_proof('<uuid>');
create or replace function admin.approve_payout_proof(uid uuid)
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

  update public.instructor_payout_proofs
  set status = 'approved', reviewed_at = now(), review_note = null
  where user_id = uid;

  return format('Payout proof approved: %s (%s)', coalesce(v_display_name, 'no name yet'), uid);
end;
$$;

revoke execute on function admin.approve_payout_proof(uuid) from public, anon, authenticated;

-- select admin.reject_payout_proof('<uuid>', 'reason');
create or replace function admin.reject_payout_proof(uid uuid, reason text)
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

  update public.instructor_payout_proofs
  set status = 'rejected', review_note = reason, reviewed_at = now()
  where user_id = uid;

  return format('Payout proof rejected: %s (%s) — %s', coalesce(v_display_name, 'no name yet'), uid, reason);
end;
$$;

revoke execute on function admin.reject_payout_proof(uuid, text) from public, anon, authenticated;
