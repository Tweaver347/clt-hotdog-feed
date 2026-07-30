-- CLT Hot Dog Feed moderation + announcements migration
-- Run once in Supabase Dashboard > SQL Editor.
-- This intentionally uses the anon role because the moderator page is protected
-- only by its unlisted URL, per the event release requirements.

create extension if not exists pgcrypto;

alter table public.photos
  add column if not exists status text not null default 'visible';

alter table public.photos
  drop constraint if exists photos_status_values;

alter table public.photos
  add constraint photos_status_values
  check (status in ('visible', 'hidden', 'deleted'));

create index if not exists photos_status_created_at_idx
  on public.photos (status, created_at desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_length check (char_length(title) between 1 and 100),
  constraint announcements_body_length check (char_length(body) between 1 and 600),
  constraint announcements_time_order check (expires_at > starts_at)
);

create index if not exists announcements_active_window_idx
  on public.announcements (starts_at, expires_at, updated_at desc);

create or replace function public.set_announcement_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_announcement_updated_at_trigger on public.announcements;
create trigger set_announcement_updated_at_trigger
before update on public.announcements
for each row execute function public.set_announcement_updated_at();

alter table public.announcements enable row level security;

-- Existing tables may already have RLS enabled; these statements are safe.
alter table public.photos enable row level security;
alter table public.reports enable row level security;

grant select, update on public.photos to anon, authenticated;
grant select on public.reports to anon, authenticated;
grant select, insert, update, delete on public.announcements to anon, authenticated;

-- Keep the existing public photo select policy so the moderator console can read
-- both visible and hidden rows. The public website adds status=visible to every
-- photo query before it reaches Supabase.

drop policy if exists "Unlisted moderator can change photo status" on public.photos;
create policy "Unlisted moderator can change photo status"
on public.photos for update
to anon, authenticated
using (true)
with check (status in ('visible', 'hidden', 'deleted'));

drop policy if exists "Unlisted moderator can read reports" on public.reports;
create policy "Unlisted moderator can read reports"
on public.reports for select
to anon, authenticated
using (true);

drop policy if exists "Public can read active announcements" on public.announcements;
create policy "Public can read active announcements"
on public.announcements for select
to anon, authenticated
using (true);

drop policy if exists "Unlisted moderator can create announcements" on public.announcements;
create policy "Unlisted moderator can create announcements"
on public.announcements for insert
to anon, authenticated
with check (
  char_length(title) between 1 and 100
  and char_length(body) between 1 and 600
  and expires_at > starts_at
);

drop policy if exists "Unlisted moderator can update announcements" on public.announcements;
create policy "Unlisted moderator can update announcements"
on public.announcements for update
to anon, authenticated
using (true)
with check (
  char_length(title) between 1 and 100
  and char_length(body) between 1 and 600
  and expires_at > starts_at
);

drop policy if exists "Unlisted moderator can delete announcements" on public.announcements;
create policy "Unlisted moderator can delete announcements"
on public.announcements for delete
to anon, authenticated
using (true);

-- Keep the table to one row without triggering Supabase's safe-update guard.
-- The explicit predicate is required; an unqualified DELETE is rejected.
create or replace function public.keep_single_announcement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.announcements
  where id is not null;
  return new;
end;
$$;

drop trigger if exists keep_single_announcement_trigger on public.announcements;
create trigger keep_single_announcement_trigger
before insert on public.announcements
for each statement execute function public.keep_single_announcement();
