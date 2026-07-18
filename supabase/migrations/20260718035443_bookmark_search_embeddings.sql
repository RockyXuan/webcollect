begin;

-- V1.3.0 derived smart-search index. It is intentionally isolated from
-- workspace revisions, snapshots, tombstones and synchronization triggers.
create extension if not exists vector with schema extensions;

create table if not exists public.bookmark_search_embeddings (
  user_id uuid not null references public.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  model text not null check (model = 'text-embedding-3-small'),
  embedding extensions.vector(1536) not null,
  indexed_at timestamptz not null default now(),
  index_version integer not null default 1 check (index_version > 0),
  primary key (user_id, card_id)
);

create index if not exists bookmark_search_embeddings_user_id_idx
  on public.bookmark_search_embeddings(user_id);

alter table public.bookmark_search_embeddings enable row level security;

grant select, insert, update, delete on public.bookmark_search_embeddings to authenticated;
revoke all on public.bookmark_search_embeddings from anon;

drop policy if exists bookmark_search_embeddings_select_own on public.bookmark_search_embeddings;
create policy bookmark_search_embeddings_select_own
on public.bookmark_search_embeddings
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists bookmark_search_embeddings_insert_own_card on public.bookmark_search_embeddings;
create policy bookmark_search_embeddings_insert_own_card
on public.bookmark_search_embeddings
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.cards
    where public.cards.id = public.bookmark_search_embeddings.card_id
      and public.cards.user_id = (select auth.uid())
  )
);

drop policy if exists bookmark_search_embeddings_update_own_card on public.bookmark_search_embeddings;
create policy bookmark_search_embeddings_update_own_card
on public.bookmark_search_embeddings
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.cards
    where public.cards.id = public.bookmark_search_embeddings.card_id
      and public.cards.user_id = (select auth.uid())
  )
);

drop policy if exists bookmark_search_embeddings_delete_own on public.bookmark_search_embeddings;
create policy bookmark_search_embeddings_delete_own
on public.bookmark_search_embeddings
for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.match_bookmark_search_embeddings(
  query_embedding extensions.vector(1536),
  match_threshold double precision default 0.35,
  match_count integer default 20
)
returns table (
  card_id uuid,
  content_hash text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    indexed.card_id,
    indexed.content_hash,
    1 - (indexed.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.bookmark_search_embeddings as indexed
  where indexed.user_id = (select auth.uid())
    and 1 - (indexed.embedding OPERATOR(extensions.<=>) query_embedding) >= greatest(0, least(match_threshold, 1))
  order by indexed.embedding OPERATOR(extensions.<=>) query_embedding
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_bookmark_search_embeddings(extensions.vector, double precision, integer)
  from public, anon;
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

  insert into private.bookmark_search_rate_limits (
    user_id,
    action,
    window_started_at,
    request_count
  )
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

commit;
