-- Conversion funnel events (ClearPass only). Append-only log written by the
-- app: paywall views, purchase attempts, daily-limit hits, free mock usage,
-- taster completion. Read only by the server (service role) for the daily
-- Slack stats; clients can insert their own rows and read nothing back.
--
-- anon_id is a random per-install id kept in AsyncStorage, so events from
-- before signup (the taster) can be tied to the account created after it.

create table if not exists public.funnel_events (
  id          bigserial primary key,
  user_id     uuid references auth.users (id) on delete cascade,
  anon_id     text not null check (char_length(anon_id) between 8 and 64),
  event       text not null check (char_length(event) between 1 and 64),
  props       jsonb not null default '{}'::jsonb check (pg_column_size(props) < 2048),
  platform    text check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now()
);

create index if not exists funnel_events_created_at_idx on public.funnel_events (created_at);
create index if not exists funnel_events_event_created_at_idx on public.funnel_events (event, created_at);

alter table public.funnel_events enable row level security;

-- Signed-in users may only write rows for themselves; signed-out installs
-- (taster, onboarding) may only write rows with no user attached.
drop policy if exists funnel_events_insert_own on public.funnel_events;
create policy funnel_events_insert_own on public.funnel_events
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists funnel_events_insert_anon on public.funnel_events;
create policy funnel_events_insert_anon on public.funnel_events
  for insert to anon
  with check (user_id is null);

-- No select/update/delete policies: clients cannot read or change events.
