-- Lifecycle emails (ClearPass only). Two new tables, nothing existing changed.
--
-- email_log: one row per lifecycle email sent to a user, written by
-- POST /api/cron/lifecycle-emails before it sends (and removed again if the
-- send fails), so no step is ever sent twice. The primary key is the
-- dedupe: a second insert for the same (user, email) is a no-op.
--
-- email_preferences: a user's opt-out from marketing/lifecycle email, set by
-- the unsubscribe link (POST /api/email/unsubscribe). Read by the lifecycle
-- and weekly progress email crons. A tick on the signup screen is carried in
-- auth user_metadata.marketing_opt_out instead (no row needed for that).
--
-- Service role only: RLS on with no policies, same convention as
-- instructor_signups and stripe_webhook_events.

create table if not exists public.email_log (
  user_id    uuid not null references auth.users (id) on delete cascade,
  email_key  text not null check (char_length(email_key) between 1 and 64),
  resend_id  text,
  sent_at    timestamptz not null default now(),
  primary key (user_id, email_key)
);

create index if not exists email_log_sent_at_idx on public.email_log (sent_at);

alter table public.email_log enable row level security;

create table if not exists public.email_preferences (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  marketing_opt_out  boolean not null default false,
  updated_at         timestamptz not null default now()
);

alter table public.email_preferences enable row level security;
