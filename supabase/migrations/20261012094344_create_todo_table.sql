create table public.todo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  description text,
  is_complete boolean not null default false,
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index todo_user_id_idx on public.todo (user_id);

-- keep updated_at current on every update
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

create trigger todo_set_updated_at
before update on public.todo
for each row execute function public.set_updated_at();

-- Row Level Security: each user only sees and manages their own todos
alter table public.todo enable row level security;

create policy "Users can view their own todos"
on public.todo for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own todos"
on public.todo for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own todos"
on public.todo for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own todos"
on public.todo for delete
to authenticated
using ((select auth.uid()) = user_id);
