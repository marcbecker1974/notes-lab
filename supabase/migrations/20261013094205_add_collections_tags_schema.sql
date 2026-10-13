-- Notes Lab schema: collections, tags, note_tags and the new notes columns.
--
-- Additive only: no existing table, column or row is dropped or rewritten
-- (the only data change is updated_at = created_at on existing notes).
-- This migration grants nothing; access control lives in later migrations.
-- user_id is nullable and defaults to auth.uid() so ownership can be added
-- later without changing application code (see docs/ARCHITECTURE.md).

-- collections ---------------------------------------------------------------
create table public.collections (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade
);

-- case-insensitive unique names; nulls not distinct so unowned rows
-- (user_id is null) cannot hold duplicates either
create unique index collections_user_id_name_key
  on public.collections (user_id, lower(btrim(name))) nulls not distinct;

-- tags ----------------------------------------------------------------------
create table public.tags (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade
);

create unique index tags_user_id_name_key
  on public.tags (user_id, lower(btrim(name))) nulls not distinct;

-- notes: new columns and size limits ----------------------------------------
alter table public.notes
  add column collection_id bigint references public.collections (id) on delete set null,
  add column updated_at timestamptz not null default now(),
  add column user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  add constraint notes_title_length
    check (char_length(btrim(title)) >= 1 and char_length(title) <= 200),
  add constraint notes_body_length
    check (char_length(body) <= 20000);

-- existing notes keep their real timestamps (runs before the trigger exists)
update public.notes set updated_at = created_at;

-- note_tags: many-to-many join table ----------------------------------------
create table public.note_tags (
  note_id bigint not null references public.notes (id) on delete cascade,
  tag_id bigint not null references public.tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

-- indexes on foreign keys (the primary key already covers note_tags.note_id;
-- the unique indexes above lead with user_id)
create index notes_collection_id_idx on public.notes (collection_id);
create index notes_user_id_idx on public.notes (user_id);
create index note_tags_tag_id_idx on public.note_tags (tag_id);

-- keep notes.updated_at current on every update -----------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public;

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

-- Row Level Security: explicit, not relying on the ensure_rls event trigger.
-- notes already has RLS enabled.
alter table public.collections enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;
