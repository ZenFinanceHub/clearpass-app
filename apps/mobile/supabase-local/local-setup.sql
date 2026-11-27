-- LOCAL STACK ONLY. Applied by `npm run db:local:reset` after schema.sql and
-- the migrations. Creates what production has but the repo's SQL doesn't:
-- the storage buckets the app reads. Never applied to production or staging
-- by any script.

-- Public question images (packages/content links to
-- .../storage/v1/object/public/question-images/<file>).
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

-- Hazard perception clips: private; read policy "Pro users can read hazard
-- videos" comes from migration 20260907150521 (src/hazardVideos.ts signs URLs).
insert into storage.buckets (id, name, public)
values ('hazard-videos', 'hazard-videos', false)
on conflict (id) do nothing;

-- instructor-documents is created by migration 20260911180000.

notify pgrst, 'reload schema';
