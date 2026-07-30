-- Allow the unlisted moderator page to upload optional announcement images.
-- Images are stored in the existing public `photos` bucket under announcements/.

drop policy if exists "Unlisted moderator can upload announcement images" on storage.objects;

create policy "Unlisted moderator can upload announcement images"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'photos'
  and name like 'announcements/%'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);
