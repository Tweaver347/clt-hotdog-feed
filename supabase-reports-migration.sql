-- CLT Hot Dog Feed: anonymous photo-report system
-- Run this once in Supabase Dashboard > SQL Editor.
-- Reports do not automatically hide or delete photos. Review them in Table Editor > reports.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  device_hash text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint reports_device_hash_format check (device_hash ~ '^[a-f0-9]{64}$'),
  constraint reports_reason_values check (
    reason in ('inappropriate', 'consent', 'spam', 'wrong_location', 'other')
  ),
  constraint reports_one_per_browser unique (photo_id, device_hash)
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_photo_id_idx on public.reports (photo_id);

alter table public.reports enable row level security;

grant insert on public.reports to anon, authenticated;
revoke select, update, delete on public.reports from anon, authenticated;

drop policy if exists "Public can submit one anonymous report" on public.reports;
create policy "Public can submit one anonymous report"
on public.reports for insert
to anon, authenticated
with check (
  device_hash ~ '^[a-f0-9]{64}$'
  and reason in ('inappropriate', 'consent', 'spam', 'wrong_location', 'other')
  and exists (select 1 from public.photos where photos.id = photo_id)
);

-- Verification: should return the reports table and its row count.
select 'reports' as table_name, count(*) as current_reports from public.reports;
