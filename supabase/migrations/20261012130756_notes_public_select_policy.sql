-- Course exercise: notes are readable without signing in. RLS stays enabled.
create policy "Notes are viewable by everyone"
  on public.notes
  for select
  using (true);
