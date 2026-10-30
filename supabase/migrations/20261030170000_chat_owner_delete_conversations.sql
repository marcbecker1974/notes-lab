-- Chat lab: let a user delete THEIR OWN conversations (needed so tests, and later a
-- "delete conversation" feature, can remove exactly the data they created).
--
-- Only conversations get a DELETE grant. Messages are removed by the foreign key's
-- ON DELETE CASCADE (referential actions run as the table owner, so no grant on
-- messages is needed and clients still cannot delete or edit single messages).
-- The policy is owner-only, `to authenticated`; anon stays without any privilege.
-- Nothing else changes: no UPDATE grant, no change to notes, collections or tags.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

grant delete on public.conversations to authenticated;

create policy "owner delete conversations" on public.conversations
  for delete to authenticated
  using ((select auth.uid()) = user_id);
