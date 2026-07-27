-- CLT Hot Dog Feed MVP
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
-- This TEST schema publishes uploads immediately. It intentionally contains no moderation workflow.

create extension if not exists pgcrypto;

create table if not exists public.hotdogs (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  printed_number integer unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint hotdogs_code_format check (public_code ~ '^[A-Z0-9_-]{4,24}$')
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  hotdog_id uuid references public.hotdogs(id) on delete set null,
  image_path text not null unique,
  latitude double precision not null,
  longitude double precision not null,
  place_name text not null,
  location_detail text not null default 'Charlotte',
  location_source text not null default 'search',
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint photos_latitude_range check (latitude between -90 and 90),
  constraint photos_longitude_range check (longitude between -180 and 180),
  constraint photos_charlotte_test_area check (
    latitude between 34.85 and 35.55
    and longitude between -81.25 and -80.45
  ),
  constraint photos_place_name_length check (char_length(place_name) between 1 and 120),
  constraint photos_location_detail_length check (char_length(location_detail) between 1 and 160),
  constraint photos_location_source_values check (location_source in ('gps', 'search')),
  constraint photos_image_path_prefix check (image_path like 'uploads/%'),
  constraint photos_like_count_nonnegative check (like_count >= 0)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  device_hash text not null,
  created_at timestamptz not null default now(),
  constraint likes_device_hash_format check (device_hash ~ '^[a-f0-9]{64}$'),
  constraint likes_one_per_browser unique (photo_id, device_hash)
);

create index if not exists photos_created_at_idx on public.photos (created_at desc);
create index if not exists photos_like_count_idx on public.photos (like_count desc, created_at desc);
create index if not exists photos_hotdog_id_idx on public.photos (hotdog_id);
create index if not exists likes_photo_id_idx on public.likes (photo_id);

create or replace function public.increment_photo_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.photos
  set like_count = like_count + 1
  where id = new.photo_id;
  return new;
end;
$$;

drop trigger if exists increment_photo_like_count_trigger on public.likes;
create trigger increment_photo_like_count_trigger
after insert on public.likes
for each row execute function public.increment_photo_like_count();

alter table public.hotdogs enable row level security;
alter table public.photos enable row level security;
alter table public.likes enable row level security;

grant select on public.hotdogs, public.photos to anon, authenticated;
grant insert on public.photos, public.likes to anon, authenticated;

-- Re-running this file should replace policies cleanly.
drop policy if exists "Public can read active hotdogs" on public.hotdogs;
create policy "Public can read active hotdogs"
on public.hotdogs for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Public can read photos" on public.photos;
create policy "Public can read photos"
on public.photos for select
to anon, authenticated
using (true);

drop policy if exists "Public can insert test photos" on public.photos;
create policy "Public can insert test photos"
on public.photos for insert
to anon, authenticated
with check (
  image_path like 'uploads/%'
  and latitude between 34.85 and 35.55
  and longitude between -81.25 and -80.45
  and char_length(place_name) between 1 and 120
  and char_length(location_detail) between 1 and 160
  and location_source in ('gps', 'search')
  and like_count = 0
);

drop policy if exists "Public can add one-way likes" on public.likes;
create policy "Public can add one-way likes"
on public.likes for insert
to anon, authenticated
with check (
  device_hash ~ '^[a-f0-9]{64}$'
  and exists (select 1 from public.photos where photos.id = photo_id)
);

-- Public 2 MB image bucket. Browser re-encoding strips EXIF metadata before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  2000000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can upload test photos" on storage.objects;
create policy "Public can upload test photos"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'photos'
  and name like 'uploads/%'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

-- Sample keychain codes for testing. Add or replace these before printing QR stickers.
insert into public.hotdogs (public_code, printed_number)
values
  ('DEMO42', 42),
  ('QUEEN07', 7),
  ('CLTDOG9', 9)
on conflict (public_code) do update set
  printed_number = excluded.printed_number,
  is_active = true;
