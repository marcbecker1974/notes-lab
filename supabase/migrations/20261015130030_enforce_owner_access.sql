-- Feature 7 (Turing Sprint 2, S2-R3): per-user data ownership and secure RLS.
--
-- This migration CLOSES the temporary demo access of 20261013094208_temp_anon_access.sql:
--   * every row in notes, collections and tags must have an owner (user_id NOT NULL;
--     the default auth.uid() stays, so the database fills the owner on insert);
--   * the 16 `TEMP anon ...` policies are dropped and the anon/authenticated grants revoked;
--   * owner-only policies (to authenticated) replace them, one per operation;
--   * cross-user references are rejected by the policies (a note may only point to the
--     user's own collection; a note_tags row needs the user's own note AND own tag);
--   * clients can no longer write ownership or system-managed fields (user_id, id,
--     created_at, updated_at): only the columns the app sends are granted.
--
-- It fails closed. The guard below aborts the whole migration if any row has no owner
-- or if a cross-owner reference exists, so run the approved data cleanup first
-- (supabase/maintenance/cleanup_approved_demo_data.sql). It does not restore anonymous
-- access under any circumstances; fix problems forward with a new migration.
--
-- Note: `to authenticated` also covers Supabase anonymous sign-ins, if they are enabled in the
-- dashboard (they carry the authenticated role). Such a user would only ever see and create
-- their own isolated rows; the server-side route check already rejects anonymous claims.
--
-- Not changed: auth.*, public.rls_auto_enable(), set_updated_at(), the trigger, constraints,
-- indexes, sequences, service_role privileges, default privileges.

-- Fail fast instead of waiting for locks (transaction-local; ignored outside a transaction).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Keep writers out while the guard and the changes run (the ALTERs need this anyway).
lock table public.notes, public.collections, public.tags, public.note_tags in share mode;

-- 1. Guard: nothing may be unowned or reference another owner's rows.
do $$
begin
  if exists (select 1 from public.notes where user_id is null)
     or exists (select 1 from public.collections where user_id is null)
     or exists (select 1 from public.tags where user_id is null) then
    raise exception 'owner access migration aborted: rows without an owner exist; run the approved cleanup first';
  end if;

  if exists (
       select 1 from public.notes n
       join public.collections c on c.id = n.collection_id
       where c.user_id <> n.user_id)
     or exists (
       select 1 from public.note_tags nt
       join public.notes n on n.id = nt.note_id
       join public.tags t on t.id = nt.tag_id
       where n.user_id <> t.user_id) then
    raise exception 'owner access migration aborted: cross-owner references exist';
  end if;
end
$$;

-- 2. Ownership is mandatory (the default auth.uid() is untouched).
alter table public.notes alter column user_id set not null;
alter table public.collections alter column user_id set not null;
alter table public.tags alter column user_id set not null;

-- 3. Remove the temporary access: policies first, then every grant of anon and authenticated.
drop policy "TEMP anon select notes" on public.notes;
drop policy "TEMP anon insert notes" on public.notes;
drop policy "TEMP anon update notes" on public.notes;
drop policy "TEMP anon delete notes" on public.notes;
drop policy "TEMP anon select collections" on public.collections;
drop policy "TEMP anon insert collections" on public.collections;
drop policy "TEMP anon update collections" on public.collections;
drop policy "TEMP anon delete collections" on public.collections;
drop policy "TEMP anon select tags" on public.tags;
drop policy "TEMP anon insert tags" on public.tags;
drop policy "TEMP anon update tags" on public.tags;
drop policy "TEMP anon delete tags" on public.tags;
drop policy "TEMP anon select note_tags" on public.note_tags;
drop policy "TEMP anon insert note_tags" on public.note_tags;
drop policy "TEMP anon update note_tags" on public.note_tags;
drop policy "TEMP anon delete note_tags" on public.note_tags;

revoke all on table public.notes, public.collections, public.tags, public.note_tags
  from anon, authenticated;

-- 4. Row Level Security stays enabled on every table (explicit, idempotent).
alter table public.notes enable row level security;
alter table public.collections enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;

-- 5. Privileges: only what the app uses, only for signed-in users. anon gets nothing.
--    Column lists keep user_id, id, created_at and updated_at out of reach of clients
--    (updated_at is set by the trigger; user_id by the auth.uid() default). Tags are
--    never deleted by the app, so there is no DELETE grant on tags; note_tags rows are
--    only inserted and deleted.
grant select on public.notes, public.collections, public.tags, public.note_tags to authenticated;

grant insert (title, body, collection_id) on public.notes to authenticated;
grant update (title, body, collection_id) on public.notes to authenticated;
grant delete on public.notes to authenticated;

grant insert (name, color) on public.collections to authenticated;
grant update (color) on public.collections to authenticated;
grant delete on public.collections to authenticated;

grant insert (name, color) on public.tags to authenticated;
grant update (color) on public.tags to authenticated;

grant insert (note_id, tag_id) on public.note_tags to authenticated;
grant delete on public.note_tags to authenticated;

-- 6. Policies: owner only, role named with `to`, auth.uid() wrapped in a select so Postgres
--    evaluates it once per statement. An UPDATE needs a SELECT policy (present).

-- notes ------------------------------------------------------------------------------
create policy "owner select notes" on public.notes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner insert notes" on public.notes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      notes.collection_id is null
      or exists (
        select 1 from public.collections c
        where c.id = notes.collection_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "owner update notes" on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      notes.collection_id is null
      or exists (
        select 1 from public.collections c
        where c.id = notes.collection_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "owner delete notes" on public.notes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- collections ------------------------------------------------------------------------
create policy "owner select collections" on public.collections
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner insert collections" on public.collections
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owner update collections" on public.collections
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner delete collections" on public.collections
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- tags (no delete policy: the app never deletes tags) ----------------------------------
create policy "owner select tags" on public.tags
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner insert tags" on public.tags
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owner update tags" on public.tags
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- note_tags: no user_id column, so ownership comes from the parents. A link needs the
-- user's own note AND the user's own tag (foreign-key checks bypass RLS, so this is what
-- stops cross-user links). No update policy or grant: links are only added and removed.
create policy "owner select note_tags" on public.note_tags
  for select to authenticated
  using (
    exists (
      select 1 from public.notes n
      where n.id = note_tags.note_id and n.user_id = (select auth.uid())
    )
  );

create policy "owner insert note_tags" on public.note_tags
  for insert to authenticated
  with check (
    exists (
      select 1 from public.notes n
      where n.id = note_tags.note_id and n.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.tags t
      where t.id = note_tags.tag_id and t.user_id = (select auth.uid())
    )
  );

create policy "owner delete note_tags" on public.note_tags
  for delete to authenticated
  using (
    exists (
      select 1 from public.notes n
      where n.id = note_tags.note_id and n.user_id = (select auth.uid())
    )
  );

-- 7. Make PostgREST pick up the new privileges and policies at once.
notify pgrst, 'reload schema';
