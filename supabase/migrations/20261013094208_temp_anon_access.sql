-- TEMPORARY anonymous access for the no-authentication MVP.
--
-- This is the ONLY migration that grants access to the anon role. The app has
-- no login, so the browser (publishable key) must be able to read and write
-- the four application tables. Anyone holding the project URL and publishable
-- key can read, change or delete these rows: use non-sensitive data only and
-- keep the app on localhost (see docs/ARCHITECTURE.md section 5).
--
-- To close anonymous access (for example when authentication is added), add a
-- NEW migration that drops every policy named "TEMP anon ..." below and runs
-- `revoke all` on these tables from anon, authenticated (then grants only what
-- the owner policies need, see docs/ARCHITECTURE.md section 6). Do not edit
-- this file once it is applied.

-- Remove the default extra privileges (TRUNCATE, REFERENCES, TRIGGER,
-- MAINTAIN) that Supabase grants on new tables, then grant exactly what the
-- app needs. Policies alone do not remove grants.
revoke all on table
  public.notes, public.collections, public.tags, public.note_tags
from anon, authenticated;

grant select, insert, update, delete on table
  public.notes, public.collections, public.tags, public.note_tags
to anon, authenticated;

-- Replace the two exercise policies on notes with the per-operation set below.
drop policy "Authenticated users can view notes" on public.notes;
drop policy "Notes are viewable by everyone" on public.notes;

-- notes ---------------------------------------------------------------------
create policy "TEMP anon select notes" on public.notes
  for select to anon, authenticated using (true);
create policy "TEMP anon insert notes" on public.notes
  for insert to anon, authenticated with check (true);
create policy "TEMP anon update notes" on public.notes
  for update to anon, authenticated using (true) with check (true);
create policy "TEMP anon delete notes" on public.notes
  for delete to anon, authenticated using (true);

-- collections ---------------------------------------------------------------
create policy "TEMP anon select collections" on public.collections
  for select to anon, authenticated using (true);
create policy "TEMP anon insert collections" on public.collections
  for insert to anon, authenticated with check (true);
create policy "TEMP anon update collections" on public.collections
  for update to anon, authenticated using (true) with check (true);
create policy "TEMP anon delete collections" on public.collections
  for delete to anon, authenticated using (true);

-- tags ----------------------------------------------------------------------
create policy "TEMP anon select tags" on public.tags
  for select to anon, authenticated using (true);
create policy "TEMP anon insert tags" on public.tags
  for insert to anon, authenticated with check (true);
create policy "TEMP anon update tags" on public.tags
  for update to anon, authenticated using (true) with check (true);
create policy "TEMP anon delete tags" on public.tags
  for delete to anon, authenticated using (true);

-- note_tags -----------------------------------------------------------------
create policy "TEMP anon select note_tags" on public.note_tags
  for select to anon, authenticated using (true);
create policy "TEMP anon insert note_tags" on public.note_tags
  for insert to anon, authenticated with check (true);
create policy "TEMP anon update note_tags" on public.note_tags
  for update to anon, authenticated using (true) with check (true);
create policy "TEMP anon delete note_tags" on public.note_tags
  for delete to anon, authenticated using (true);
