-- Adds "remove like" support to the existing CLT Hot Dog Feed database.
-- Run this entire file once in Supabase Dashboard > SQL Editor > New query.

create or replace function public.decrement_photo_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.photos
  set like_count = greatest(like_count - 1, 0)
  where id = old.photo_id;
  return old;
end;
$$;

drop trigger if exists decrement_photo_like_count_trigger on public.likes;
create trigger decrement_photo_like_count_trigger
after delete on public.likes
for each row execute function public.decrement_photo_like_count();

create or replace function public.remove_photo_like(
  p_photo_id uuid,
  p_device_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer;
begin
  if p_device_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid anonymous device identifier.';
  end if;

  delete from public.likes
  where photo_id = p_photo_id
    and device_hash = p_device_hash;

  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

revoke all on function public.remove_photo_like(uuid, text) from public;
grant execute on function public.remove_photo_like(uuid, text) to anon, authenticated;
