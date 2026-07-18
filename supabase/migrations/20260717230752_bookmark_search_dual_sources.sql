begin;

-- Keep public-page embeddings and saved-field embeddings independent so a
-- reduced-capability client never overwrites a richer vector from another
-- client. Pre-migration rows contain a legacy mixture of saved fields and
-- public HTML, so they cannot be relabelled safely. Embeddings are disposable
-- derived data: remove only these rows and let consented clients rebuild them.
alter table public.bookmark_search_embeddings
  add column if not exists document_source text;

delete from public.bookmark_search_embeddings;

update public.bookmark_search_embeddings
set document_source = 'saved-fields'
where document_source is null;

alter table public.bookmark_search_embeddings
  alter column document_source set default 'saved-fields',
  alter column document_source set not null;

alter table public.bookmark_search_embeddings
  drop constraint if exists bookmark_search_embeddings_document_source_check;

alter table public.bookmark_search_embeddings
  add constraint bookmark_search_embeddings_document_source_check
  check (document_source in ('public-html', 'saved-fields'))
  not valid;

alter table public.bookmark_search_embeddings
  validate constraint bookmark_search_embeddings_document_source_check;

alter table public.bookmark_search_embeddings
  drop constraint bookmark_search_embeddings_pkey;

alter table public.bookmark_search_embeddings
  add constraint bookmark_search_embeddings_pkey
  primary key (user_id, card_id, document_source);

-- The primary key starts with user_id, so it cannot efficiently support the
-- card foreign-key cascade or the per-card reconciliation path by itself.
create index if not exists bookmark_search_embeddings_card_id_idx
  on public.bookmark_search_embeddings(card_id);

alter table public.bookmark_search_embeddings enable row level security;
revoke all on table public.bookmark_search_embeddings
  from public, anon, authenticated;
grant select, insert, update, delete on table public.bookmark_search_embeddings
  to authenticated;

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

notify pgrst, 'reload schema';

commit;
