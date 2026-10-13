-- Notes have no owner column, so any signed-in user can read all notes.
create policy "Authenticated users can view notes"
  on public.notes for select
  to authenticated
  using (true);
