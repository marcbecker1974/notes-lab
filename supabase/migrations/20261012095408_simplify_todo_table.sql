-- Temporary exercise: decouple todo from auth.users.
drop policy "Users can view their own todos" on public.todo;
drop policy "Users can insert their own todos" on public.todo;
drop policy "Users can update their own todos" on public.todo;
drop policy "Users can delete their own todos" on public.todo;

-- also drops todo_user_id_idx and the foreign key
alter table public.todo drop column user_id;
