-- APPLIED 2026-09-10 via Supabase SQL Editor
-- DRAFT — NOT APPLIED. Written for review only; do not run against any
-- database until the test plan in the accompanying report has been executed
-- against a staging project.
--
-- Closes a privilege-escalation gap: public.user_progress's only write
-- policy is `for all using (auth.uid() = id)` with no `with check`, so any
-- authenticated user's own client session can upsert their `progress` JSONB
-- blob with `isPro: true` (and/or proExpiresAt/proSource) and Postgres
-- accepts it — nothing distinguishes a legitimate grant from a
-- self-granted one. apps/mobile/src/storage.ts's saveUserProgress() already
-- upserts the *entire* client-side object on every save (mock test results,
-- XP, streaks, ...), so this can't be closed by restricting which columns
-- are writable — isPro/proExpiresAt/proSource live inside the same blob as
-- everything else a normal save legitimately touches.
--
-- This trigger does NOT change the RLS policy (still `auth.uid() = id`, so
-- normal saves keep working) and NEVER rejects a write — old client
-- binaries that upsert a full `progress` object, including whatever stale
-- entitlement fields were already in local state, must keep succeeding.
-- Instead, for any INSERT/UPDATE made as the `authenticated` or `anon`
-- Postgres role — the two roles PostgREST switches to for a client-session
-- request (anon-key or user-JWT) — it:
--   - on UPDATE: silently overwrites isPro/proExpiresAt/proSource on the
--     incoming row with whatever was already stored, so a client can send
--     any value for those keys and it's discarded, but every OTHER key in
--     the same upsert still lands normally.
--   - on INSERT: strips the same three keys, so a freshly-created row can
--     never originate with an entitlement already granted.
-- Every other role — service_role (Stripe/RevenueCat webhooks, the
-- expire-pro and grant-instructor-pro crons, the one-off backfill scripts —
-- see server/proxy.js and server/scripts/*.js), postgres (direct SQL editor
-- access, e.g. a manual comp grant), or any pg_cron job (which runs as
-- whichever role scheduled it, not as authenticated/anon) — passes through
-- completely unchanged.
--
-- Deliberately checks current_user, not a JWT-derived helper like
-- auth.role(): the SQL editor and any pg_cron job have no JWT at all, so
-- auth.role() would read NULL for them there, not 'service_role' — an
-- earlier draft of this trigger keyed on auth.role() = 'service_role' and
-- would have wrongly locked down both of those paths. current_user reflects
-- the actual Postgres role PostgREST (or a direct connection) is running
-- the statement as, which is what's actually being gated.
--
-- The function is intentionally SECURITY INVOKER (the default — no
-- `security definer` clause). SECURITY DEFINER would make current_user
-- resolve to the function's *owner* for the duration of the call (typically
-- `postgres`), not the actual caller, which would make the check below
-- never match and silently disable this trigger entirely.
--
-- Deliberately does not touch `profiles.account_type` or its RLS — see the
-- report this migration was drafted alongside: self-declaring
-- account_type = 'instructor' converges on free Pro via a separate daily
-- cron (POST /api/cron/grant-instructor-pro) and is a distinct gap this
-- migration does not close.

create or replace function public.protect_user_progress_entitlement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  entitlement_keys text[] := array['isPro', 'proExpiresAt', 'proSource'];
  k text;
begin
  -- Only lock down writes made as the two client-session-facing roles.
  -- Everything else (service_role, postgres, a pg_cron job's own role, ...)
  -- passes through untouched.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- tg_op is 'INSERT'/'UPDATE' (uppercase) — an earlier draft compared
  -- against lowercase literals here, which never matched, so neither
  -- branch below ever ran and this trigger was a silent no-op for every
  -- role. Caught by running it against a real Postgres, not just by it
  -- compiling: CREATE FUNCTION succeeds either way.
  if tg_op = 'UPDATE' then
    foreach k in array entitlement_keys loop
      if old.progress ? k then
        new.progress := jsonb_set(new.progress, array[k], old.progress -> k, true);
      else
        new.progress := new.progress - k;
      end if;
    end loop;
  elsif tg_op = 'INSERT' then
    foreach k in array entitlement_keys loop
      new.progress := new.progress - k;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_user_progress_entitlement_trigger on public.user_progress;

create trigger protect_user_progress_entitlement_trigger
  before insert or update on public.user_progress
  for each row
  execute function public.protect_user_progress_entitlement();
