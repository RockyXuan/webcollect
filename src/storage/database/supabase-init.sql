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
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  constraint user_preferences_user_id_key_unique unique (user_id, key)
);

create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists cards_user_id_idx on public.cards(user_id);
create index if not exists cards_category_id_idx on public.cards(category_id);
create index if not exists user_preferences_user_id_idx on public.user_preferences(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
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

alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.cards enable row level security;
alter table public.user_preferences enable row level security;

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
