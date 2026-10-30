-- Chat lab, stage 3: per-user chat persistence (CHAT-3).
--
-- Two new tables, owner-only like notes (Feature 7):
--   conversations  one row per chat; owner set by the database default auth.uid()
--   messages       one row per chat message, ordered by id
-- Nothing existing is changed. anon gets nothing. Clients can only read their own rows and
-- append: there is no UPDATE and no DELETE grant (a later feature can add them).
-- The grants follow the project convention: `revoke all` per new table first, then only
-- the columns the app sends (user_id, id and created_at stay out of reach of clients).
--
-- A message must point at the user's OWN conversation. Foreign-key checks bypass RLS, so
-- the insert policy checks it explicitly.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.conversations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 100),
  created_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);

create index conversations_user_id_id_idx on public.conversations (user_id, id desc);
create index messages_conversation_id_id_idx on public.messages (conversation_id, id);
create index messages_user_id_idx on public.messages (user_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Default privileges give anon/authenticated more than we want on a new table.
revoke all on table public.conversations, public.messages from anon, authenticated;

grant select on public.conversations, public.messages to authenticated;
grant insert (title) on public.conversations to authenticated;
grant insert (conversation_id, role, content) on public.messages to authenticated;

create policy "owner select conversations" on public.conversations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner insert conversations" on public.conversations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owner select messages" on public.messages
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner insert messages" on public.messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = (select auth.uid())
    )
  );
