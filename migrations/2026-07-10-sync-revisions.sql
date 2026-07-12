-- WebCollect V1.1.0 revisioned sync migration.
-- HARD GATE: export cards, categories, user_preferences and workspace_snapshots
-- before running this file. Run it only after the user confirms the exports.
-- This migration is additive and idempotent; it does not delete or rewrite user data.

alter table public.categories
  add column if not exists sync_revision bigint not null default 0,
  add column if not exists sync_device_id text not null default 'legacy';

alter table public.cards
  add column if not exists sync_revision bigint not null default 0,
  add column if not exists sync_device_id text not null default 'legacy';

alter table public.user_preferences
  add column if not exists sync_revision bigint not null default 0,
  add column if not exists sync_device_id text not null default 'legacy';

create table if not exists public.workspace_tombstones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('card', 'category')),
  entity_id text not null,
  deleted_at timestamptz not null,
  sync_revision bigint not null,
  sync_device_id text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint workspace_tombstones_user_entity_unique unique (user_id, entity_type, entity_id)
);

-- Preserve compatibility if an earlier test deployment created this column as UUID.
alter table public.workspace_tombstones
  alter column entity_id type text using entity_id::text;

create table if not exists public.workspace_versions (
  user_id uuid primary key references public.users(id) on delete cascade,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.workspace_versions (user_id, version)
select id, 0 from public.users
on conflict (user_id) do nothing;

create index if not exists workspace_tombstones_user_id_idx
  on public.workspace_tombstones(user_id);

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.bump_workspace_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_user_id := old.user_id;
  else
    affected_user_id := new.user_id;
  end if;

  insert into public.workspace_versions (user_id, version, updated_at)
  values (affected_user_id, 1, now())
  on conflict (user_id) do update
  set version = public.workspace_versions.version + 1,
      updated_at = now();

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.bump_workspace_version() from public, anon, authenticated;

drop trigger if exists categories_bump_workspace_version on public.categories;
create trigger categories_bump_workspace_version
after insert or update or delete on public.categories
for each row execute function public.bump_workspace_version();

drop trigger if exists cards_bump_workspace_version on public.cards;
create trigger cards_bump_workspace_version
after insert or update or delete on public.cards
for each row execute function public.bump_workspace_version();

drop trigger if exists user_preferences_bump_workspace_version on public.user_preferences;
create trigger user_preferences_bump_workspace_version
after insert or update or delete on public.user_preferences
for each row execute function public.bump_workspace_version();

drop trigger if exists workspace_tombstones_bump_workspace_version on public.workspace_tombstones;
create trigger workspace_tombstones_bump_workspace_version
after insert or update or delete on public.workspace_tombstones
for each row execute function public.bump_workspace_version();

alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.cards enable row level security;
alter table public.user_preferences enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.workspace_tombstones enable row level security;
alter table public.workspace_versions enable row level security;

grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.cards to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.workspace_snapshots to authenticated;
grant select, insert, update, delete on public.workspace_tombstones to authenticated;
grant select on public.workspace_versions to authenticated;

revoke all on public.users from anon;
revoke all on public.categories from anon;
revoke all on public.cards from anon;
revoke all on public.user_preferences from anon;
revoke all on public.workspace_snapshots from anon;
revoke all on public.workspace_tombstones from anon;
revoke all on public.workspace_versions from anon;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists users_delete_own on public.users;
create policy users_delete_own on public.users
for delete to authenticated
using ((select auth.uid()) = id);

drop policy if exists categories_owner_all on public.categories;
create policy categories_owner_all on public.categories
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists cards_owner_all on public.cards;
create policy cards_owner_all on public.cards
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists user_preferences_owner_all on public.user_preferences;
create policy user_preferences_owner_all on public.user_preferences
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists workspace_snapshots_owner_all on public.workspace_snapshots;
create policy workspace_snapshots_owner_all on public.workspace_snapshots
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists workspace_tombstones_owner_all on public.workspace_tombstones;
create policy workspace_tombstones_owner_all on public.workspace_tombstones
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists workspace_versions_owner_select on public.workspace_versions;
create policy workspace_versions_owner_select on public.workspace_versions
for select to authenticated
using ((select auth.uid()) = user_id);
