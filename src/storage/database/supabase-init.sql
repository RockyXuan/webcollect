-- WebCollect Supabase schema bootstrap.
-- Run this once in Supabase Dashboard > SQL Editor for the project used by the extension.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key,
  email text not null,
  display_name text default '',
  avatar_url text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  icon text default 'Folder',
  color text default '#888888',
  parent_id uuid references public.categories(id) on delete cascade,
  is_parent boolean default false,
  "order" integer default 0,
  sync_revision bigint not null default 0,
  sync_device_id text not null default 'legacy',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  url text not null,
  title text default '',
  short_desc text default '',
  full_desc text default '',
  note text default '',
  abbreviation text default '',
  image_url text default '',
  "order" integer default 0,
  sync_revision bigint not null default 0,
  sync_device_id text not null default 'legacy',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  sync_revision bigint not null default 0,
  sync_device_id text not null default 'legacy',
  updated_at timestamptz not null default now(),
  constraint user_preferences_user_id_key_unique unique (user_id, key)
);

create table if not exists public.workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('manual', 'system')),
  label text not null default '',
  reason text not null default '',
  source text not null default '',
  day_key text,
  snapshot_created_at timestamptz not null default now(),
  snapshot_created_at_ms bigint not null,
  counts jsonb not null,
  assessment jsonb not null,
  section_names jsonb not null default '[]'::jsonb,
  sample_category_names jsonb not null default '[]'::jsonb,
  sample_card_titles jsonb not null default '[]'::jsonb,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint workspace_snapshots_user_kind_day_unique unique (user_id, kind, day_key)
);

create table if not exists public.workspace_tombstones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('card', 'category')),
  entity_id uuid not null,
  deleted_at timestamptz not null,
  sync_revision bigint not null,
  sync_device_id text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint workspace_tombstones_user_entity_unique unique (user_id, entity_type, entity_id)
);

create table if not exists public.workspace_versions (
  user_id uuid primary key references public.users(id) on delete cascade,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.workspace_versions (user_id, version)
select id, 0 from public.users
on conflict (user_id) do nothing;

create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists cards_user_id_idx on public.cards(user_id);
create index if not exists cards_category_id_idx on public.cards(category_id);
create index if not exists user_preferences_user_id_idx on public.user_preferences(user_id);
create index if not exists workspace_snapshots_user_kind_created_idx on public.workspace_snapshots(user_id, kind, snapshot_created_at desc);
create index if not exists workspace_tombstones_user_id_idx on public.workspace_tombstones(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
before update on public.cards
for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists workspace_snapshots_set_updated_at on public.workspace_snapshots;
create trigger workspace_snapshots_set_updated_at
before update on public.workspace_snapshots
for each row execute function public.set_updated_at();

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

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
for insert with check (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists users_delete_own on public.users;
create policy users_delete_own on public.users
for delete using (auth.uid() = id);

drop policy if exists categories_owner_all on public.categories;
create policy categories_owner_all on public.categories
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cards_owner_all on public.cards;
create policy cards_owner_all on public.cards
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_preferences_owner_all on public.user_preferences;
create policy user_preferences_owner_all on public.user_preferences
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists workspace_snapshots_owner_all on public.workspace_snapshots;
create policy workspace_snapshots_owner_all on public.workspace_snapshots
for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists workspace_tombstones_owner_all on public.workspace_tombstones;
create policy workspace_tombstones_owner_all on public.workspace_tombstones
for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists workspace_versions_owner_select on public.workspace_versions;
create policy workspace_versions_owner_select on public.workspace_versions
for select using ((select auth.uid()) = user_id);
