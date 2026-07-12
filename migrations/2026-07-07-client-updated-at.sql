-- Preserve client-provided row timestamps during sync.
-- Run after exporting public.cards and public.categories as CSV backups.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only fill a server timestamp when the client did not provide a new value.
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
