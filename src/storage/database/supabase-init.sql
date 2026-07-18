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
  entity_id text not null,
  deleted_at timestamptz not null,
  sync_revision bigint not null,
  sync_device_id text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint workspace_tombstones_user_entity_unique unique (user_id, entity_type, entity_id)
);

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

revoke execute on function public.set_updated_at() from public, anon, authenticated;

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

-- V1.3.0 derived smart-search index. It is intentionally isolated from
-- workspace revisions, snapshots, tombstones and synchronization triggers.
create extension if not exists vector with schema extensions;

create table if not exists public.bookmark_search_embeddings (
  user_id uuid not null references public.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  document_source text not null default 'saved-fields'
    check (document_source in ('public-html', 'saved-fields')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  model text not null check (model = 'text-embedding-3-small'),
  embedding extensions.vector(1536) not null,
  indexed_at timestamptz not null default now(),
  index_version integer not null default 1 check (index_version > 0),
  primary key (user_id, card_id, document_source)
);

create index if not exists bookmark_search_embeddings_user_id_idx
  on public.bookmark_search_embeddings(user_id);

create index if not exists bookmark_search_embeddings_card_id_idx
  on public.bookmark_search_embeddings(card_id);

alter table public.bookmark_search_embeddings enable row level security;
revoke all on table public.bookmark_search_embeddings
  from public, anon, authenticated;
grant select, insert, update, delete on public.bookmark_search_embeddings to authenticated;

drop policy if exists bookmark_search_embeddings_select_own on public.bookmark_search_embeddings;
create policy bookmark_search_embeddings_select_own
on public.bookmark_search_embeddings for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists bookmark_search_embeddings_insert_own_card on public.bookmark_search_embeddings;
create policy bookmark_search_embeddings_insert_own_card
on public.bookmark_search_embeddings for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.cards
    where public.cards.id = public.bookmark_search_embeddings.card_id
      and public.cards.user_id = (select auth.uid())
  )
);

drop policy if exists bookmark_search_embeddings_update_own_card on public.bookmark_search_embeddings;
create policy bookmark_search_embeddings_update_own_card
on public.bookmark_search_embeddings for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.cards
    where public.cards.id = public.bookmark_search_embeddings.card_id
      and public.cards.user_id = (select auth.uid())
  )
);

drop policy if exists bookmark_search_embeddings_delete_own on public.bookmark_search_embeddings;
create policy bookmark_search_embeddings_delete_own
on public.bookmark_search_embeddings for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.match_bookmark_search_embeddings(
  query_embedding extensions.vector(1536),
  match_threshold double precision default 0.35,
  match_count integer default 20
)
returns table (card_id uuid, content_hash text, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select
      indexed.card_id,
      indexed.content_hash,
      indexed.document_source,
      1 - (indexed.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
    from public.bookmark_search_embeddings as indexed
    where indexed.user_id = (select auth.uid())
  ),
  best_per_card as (
    select distinct on (candidates.card_id)
      candidates.card_id,
      candidates.content_hash,
      candidates.similarity
    from candidates
    where candidates.similarity >= greatest(0, least(match_threshold, 1))
    order by
      candidates.card_id,
      candidates.similarity desc,
      case candidates.document_source
        when 'saved-fields' then 0
        else 1
      end,
      candidates.content_hash
  )
  select
    best_per_card.card_id,
    best_per_card.content_hash,
    best_per_card.similarity
  from best_per_card
  order by best_per_card.similarity desc, best_per_card.card_id
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_bookmark_search_embeddings(extensions.vector, double precision, integer)
  from public, anon, authenticated;
grant execute on function public.match_bookmark_search_embeddings(extensions.vector, double precision, integer)
  to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.bookmark_search_rate_limits (
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('search', 'index')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  primary key (user_id, action)
);

revoke all on private.bookmark_search_rate_limits from public, anon, authenticated;

create table if not exists private.bookmark_search_daily_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('search', 'index')),
  usage_day date not null,
  used_units bigint not null default 0 check (used_units >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, action, usage_day)
);

revoke all on private.bookmark_search_daily_usage from public, anon, authenticated;

drop function if exists public.consume_bookmark_search_quota(text);
create or replace function public.consume_bookmark_search_quota(
  requested_action text,
  requested_units integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  requesting_user uuid := (select auth.uid());
  minute_window_started_at timestamptz;
  current_request_count integer := 0;
  current_daily_units bigint := 0;
  request_limit integer;
  daily_unit_limit bigint;
  quota_day date := (pg_catalog.timezone('UTC', pg_catalog.now()))::date;
begin
  if requesting_user is null
    or requested_action not in ('search', 'index')
    or requested_units is null
    or requested_units <= 0
  then
    return false;
  end if;

  request_limit := case requested_action when 'search' then 30 else 60 end;
  daily_unit_limit := case requested_action when 'search' then 100000 else 3000000 end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requesting_user::text || ':' || requested_action, 0)
  );

  select window_started_at, request_count
  into minute_window_started_at, current_request_count
  from private.bookmark_search_rate_limits
  where user_id = requesting_user and action = requested_action;

  if not found
    or minute_window_started_at <= pg_catalog.now() - interval '1 minute'
  then
    current_request_count := 0;
  end if;

  select used_units
  into current_daily_units
  from private.bookmark_search_daily_usage as daily
  where daily.user_id = requesting_user
    and daily.action = requested_action
    and daily.usage_day = quota_day;

  if not found then
    current_daily_units := 0;
  end if;

  if current_request_count + 1 > request_limit
    or current_daily_units + requested_units::bigint > daily_unit_limit
  then
    return false;
  end if;

  insert into private.bookmark_search_rate_limits (user_id, action, window_started_at, request_count)
  values (requesting_user, requested_action, now(), 1)
  on conflict (user_id, action) do update
  set
    window_started_at = case
      when private.bookmark_search_rate_limits.window_started_at <= now() - interval '1 minute' then now()
      else private.bookmark_search_rate_limits.window_started_at
    end,
    request_count = case
      when private.bookmark_search_rate_limits.window_started_at <= now() - interval '1 minute' then 1
      else private.bookmark_search_rate_limits.request_count + 1
    end;

  insert into private.bookmark_search_daily_usage (
    user_id,
    action,
    usage_day,
    used_units,
    updated_at
  )
  values (requesting_user, requested_action, quota_day, requested_units, now())
  on conflict (user_id, action, usage_day) do update
  set
    used_units = private.bookmark_search_daily_usage.used_units + excluded.used_units,
    updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.consume_bookmark_search_quota(text, integer) from public, anon;
grant execute on function public.consume_bookmark_search_quota(text, integer) to authenticated;
