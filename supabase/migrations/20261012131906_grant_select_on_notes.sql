-- Newly created tables are not exposed to the Data API automatically.
-- Row visibility is still controlled by the RLS policies on this table.
grant select on public.notes to anon, authenticated;
