-- Temporary exercise is over: remove the todo table (its trigger and indexes go with it).
drop table public.todo;

-- only used by the todo trigger
drop function public.set_updated_at();
