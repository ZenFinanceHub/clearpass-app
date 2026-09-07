-- Enforce Pro entitlement for hazard perception content at the database and
-- storage layer. Previously:
--   - storage.objects allowed any authenticated user (Pro or not) to mint a
--     signed URL for any file in the hazard-videos bucket.
--   - public.hazard_clips granted SELECT to the `public` role (including
--     fully anonymous requests using only the anon key), exposing every
--     clip's storage_path to anyone.
--
-- Pro status is public.user_progress.progress->>'isPro' (boolean), the same
-- field apps/mobile/src/subscription.ts's isPremium() already checks
-- client-side — this migration enforces that same definition server-side.
--
-- The free-tier clip-browsing preview in the app (titles, count, grid) does
-- not depend on storage_path being public — it only needs row access to
-- hazard_clips, which stays available to any signed-in user. Actual video
-- access (storage.objects) now requires Pro.

drop policy if exists "Authenticated users can read hazard videos" on storage.objects;

create policy "Pro users can read hazard videos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'hazard-videos'
  and exists (
    select 1 from public.user_progress up
    where up.id = auth.uid()
      and (up.progress ->> 'isPro')::boolean is true
  )
);

drop policy if exists "Public read active clips" on public.hazard_clips;

create policy "Authenticated users can read active clips"
on public.hazard_clips
for select
to authenticated
using (is_active = true);
