create table public.notes (
  id bigint generated always as identity primary key,
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

-- RLS is required on tables in exposed schemas. No policies yet, so the
-- Data API returns no rows until access policies are added.
alter table public.notes enable row level security;
