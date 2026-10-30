-- Private Wikipedia library: pgvector, pages and documents (chunks + embeddings), match_documents.
--
-- Follows the Supabase guides "Vector columns" and "Semantic search" and the embedding
-- rules in CLAUDE.md: openai/text-embedding-3-small, so the column is vector(1536).
-- Changing the model or the dimension later means dropping and re-embedding all documents.
--
--   pages      one row per saved Wikipedia page (title, URL, last-fetched time), owned by a user
--   documents  one row per chunk of a page, with its embedding; owner and source page
--              deleting a page deletes its chunks (on delete cascade)
--
-- Owner-only like notes (Feature 7) and chat (CHAT-3): user_id comes from the database
-- default auth.uid(), anon gets nothing, every policy names its role and checks the owner.
-- A chunk's owner must be the owner of its page: enforced by a composite foreign key
-- (foreign-key checks bypass RLS, so the key itself carries the rule) and by the insert policy.
-- Nothing existing is changed.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Official way to enable pgvector on Supabase: into the extensions schema.
create extension if not exists vector with schema extensions;

create table public.pages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  url text not null check (url ~ '^https://[a-z0-9-]+(\.m)?\.wikipedia\.org/' and char_length(url) <= 2000),
  last_fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, url),
  -- target of the composite foreign key from documents
  unique (id, user_id)
);

create table public.documents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page_id bigint not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) between 1 and 20000),
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (page_id, chunk_index),
  -- the chunk's owner is the page's owner; deleting the page deletes its chunks
  foreign key (page_id, user_id) references public.pages (id, user_id) on delete cascade
);

-- Cosine similarity (<=>) is the safe default for OpenAI embeddings. HNSW suits read-heavy
-- semantic search. pages(user_id) is covered by unique (user_id, url); the cascade from
-- pages uses unique (page_id, chunk_index); documents(user_id) gets its own index for RLS.
create index documents_embedding_idx on public.documents
  using hnsw (embedding extensions.vector_cosine_ops);
create index documents_user_id_idx on public.documents (user_id);

alter table public.pages enable row level security;
alter table public.documents enable row level security;

-- Default privileges give anon/authenticated more than we want on a new table.
revoke all on table public.pages, public.documents from anon, authenticated;

-- Pages: add, re-fetch (title and time), remove. Chunks are replaced by delete + insert,
-- which is also how a re-embedding run works; there is no UPDATE on documents.
grant select on public.pages, public.documents to authenticated;
grant insert (title, url, last_fetched_at) on public.pages to authenticated;
grant update (title, last_fetched_at) on public.pages to authenticated;
grant delete on public.pages, public.documents to authenticated;
grant insert (page_id, chunk_index, content, embedding) on public.documents to authenticated;

create policy "owner select pages" on public.pages
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner insert pages" on public.pages
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owner update pages" on public.pages
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner delete pages" on public.pages
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner select documents" on public.documents
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner insert documents" on public.documents
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.pages p
      where p.id = documents.page_id and p.user_id = (select auth.uid())
    )
  );

create policy "owner delete documents" on public.documents
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Semantic search over the signed-in user's own chunks, best match first.
--   match_threshold  minimum cosine similarity, 1 = identical, -1 = opposite (default 0)
--   match_count      result limit, capped at 200 as in the Supabase guide (default 10)
-- security invoker: RLS applies as the caller. The explicit auth.uid() filter is a second
-- layer. `order by` uses the distance operator directly so the HNSW index can be used.
-- search_path includes extensions because the <=> operator lives there.
create or replace function public.match_documents (
  query_embedding extensions.vector(1536),
  match_threshold float default 0,
  match_count int default 10
)
returns table (
  id bigint,
  page_id bigint,
  chunk_index integer,
  content text,
  page_title text,
  page_url text,
  similarity float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    d.id,
    d.page_id,
    d.chunk_index,
    d.content,
    p.title as page_title,
    p.url as page_url,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  join public.pages p on p.id = d.page_id and p.user_id = d.user_id
  where d.user_id = (select auth.uid())
    and d.embedding <=> query_embedding <= 1 - match_threshold
  order by d.embedding <=> query_embedding asc
  limit least(greatest(match_count, 0), 200);
$$;

-- Functions are executable by PUBLIC by default: only signed-in users may call this one.
revoke execute on function public.match_documents (extensions.vector, float, int) from public, anon;
grant execute on function public.match_documents (extensions.vector, float, int) to authenticated;
