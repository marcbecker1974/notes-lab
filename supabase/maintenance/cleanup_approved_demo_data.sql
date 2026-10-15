-- ONE-OFF, OWNER-APPROVED DATA CLEANUP for Feature 7 (Turing Sprint 2). NOT a migration:
-- it is tied to this project's current data, so it must never be replayed by `db push`.
--
-- INERT BY DEFAULT. `v_approved` below is false, so running this file as it is only raises
-- an exception and changes nothing. It may be run ONLY after the owner's explicit approval at
-- execution time: run a throwaway COPY with `v_approved` set to true, never commit that copy.
--
--   cp supabase/maintenance/cleanup_approved_demo_data.sql /tmp/cleanup-approved.sql
--   (edit the copy: v_approved ... := true)
--   npx supabase db query --linked -f /tmp/cleanup-approved.sql
--
-- WHAT IT DELETES (the approved baseline of 2026-10-15, backed up in
-- ~/notes-lab-backups/20261015T124028Z/): 10 notes (ids 1, 2, 3, 10-14, 288, 289),
-- 3 collections (1-3), 4 tags (1-4) and 9 note_tags links (10:1, 11:1, 11:3, 12:1, 12:2,
-- 13:3, 14:4, 288:4, 289:4).
--
-- SAFETY (the deletion is ONE DO statement, so it is atomic: any failure rolls everything back):
--   * Locks the four tables against writers (share row exclusive), so nothing can change
--     between the checks and the deletes; times out after 5 s instead of waiting.
--   * The live tables must be byte-identical to the backup (MD5 of every table over its
--     rows as JSON, ordered by primary key), AND have exactly the approved ids, links and
--     owners. Any difference, including a record added after the baseline, ABORTS the
--     cleanup: nothing is deleted and the owner must decide again.
--   * Deletes only by the exact approved ids/pairs and checks the exact row counts.
--   * Never touches auth.* (it only counts auth.users before and after), never assigns an
--     owner, never changes sequences, schema, policies or grants.
--   * Error messages name the table only; they never contain row contents.

do $$
declare
  v_approved constant boolean := false;  -- set to true ONLY in an approved throwaway copy
  v_users_before bigint;
  v_users_after bigint;
  v_n bigint;
begin
  if not v_approved then
    raise exception 'cleanup NOT approved: this script is inert until the owner explicitly approves its execution';
  end if;

  perform set_config('lock_timeout', '5s', true);
  perform set_config('TimeZone', 'UTC', true);  -- the baseline MD5 values were made in UTC (timestamps as +00:00)
  lock table public.note_tags, public.notes, public.collections, public.tags
    in share row exclusive mode;

  select count(*) into v_users_before from auth.users;

  -- A. Byte-exact baseline: the MD5 values are those recorded in the verified backup manifest.
  if (select md5(coalesce(string_agg(row_to_json(t)::text, E'\n' order by t.id), ''))
        from public.notes t) <> '8e7c781eb369498b30d43f0a7628ffc4' then
    raise exception 'cleanup aborted: notes differ from the approved baseline';
  end if;
  if (select md5(coalesce(string_agg(row_to_json(t)::text, E'\n' order by t.id), ''))
        from public.collections t) <> '66c6a7c4ad0d8a721a1f8a0459b58690' then
    raise exception 'cleanup aborted: collections differ from the approved baseline';
  end if;
  if (select md5(coalesce(string_agg(row_to_json(t)::text, E'\n' order by t.id), ''))
        from public.tags t) <> '33542fe7e1d4df0018546ed87acf3e14' then
    raise exception 'cleanup aborted: tags differ from the approved baseline';
  end if;
  if (select md5(coalesce(string_agg(row_to_json(t)::text, E'\n' order by t.note_id, t.tag_id), ''))
        from public.note_tags t) <> '2780b53a38208ae049f4746581cc8b87' then
    raise exception 'cleanup aborted: note_tags differ from the approved baseline';
  end if;

  -- B. Independent, readable checks of the exact ids, links and owners.
  if (select array_agg(id order by id) from public.notes)
       is distinct from array[1,2,3,10,11,12,13,14,288,289]::bigint[] then
    raise exception 'cleanup aborted: notes ids differ from the approved baseline';
  end if;
  if (select array_agg(id order by id) from public.collections)
       is distinct from array[1,2,3]::bigint[] then
    raise exception 'cleanup aborted: collections ids differ from the approved baseline';
  end if;
  if (select array_agg(id order by id) from public.tags)
       is distinct from array[1,2,3,4]::bigint[] then
    raise exception 'cleanup aborted: tags ids differ from the approved baseline';
  end if;
  if (select array_agg(note_id::text || ':' || tag_id::text order by note_id, tag_id) from public.note_tags)
       is distinct from array['10:1','11:1','11:3','12:1','12:2','13:3','14:4','288:4','289:4']::text[] then
    raise exception 'cleanup aborted: note_tags pairs differ from the approved baseline';
  end if;
  -- Ownership: only note 289 has an owner; nothing is reassigned, whatever the owner is.
  if (select count(*) from public.notes where user_id is not null) <> 1
     or not exists (select 1 from public.notes where id = 289 and user_id is not null)
     or exists (select 1 from public.collections where user_id is not null)
     or exists (select 1 from public.tags where user_id is not null) then
    raise exception 'cleanup aborted: ownership differs from the approved baseline';
  end if;

  -- C. Delete exactly the approved records, children first, and check the exact counts.
  delete from public.note_tags
   where (note_id, tag_id) in ((10,1),(11,1),(11,3),(12,1),(12,2),(13,3),(14,4),(288,4),(289,4));
  get diagnostics v_n = row_count;
  if v_n <> 9 then raise exception 'cleanup aborted: expected to delete exactly 9 note_tags rows'; end if;

  delete from public.notes where id = any (array[1,2,3,10,11,12,13,14,288,289]::bigint[]);
  get diagnostics v_n = row_count;
  if v_n <> 10 then raise exception 'cleanup aborted: expected to delete exactly 10 notes'; end if;

  delete from public.collections where id = any (array[1,2,3]::bigint[]);
  get diagnostics v_n = row_count;
  if v_n <> 3 then raise exception 'cleanup aborted: expected to delete exactly 3 collections'; end if;

  delete from public.tags where id = any (array[1,2,3,4]::bigint[]);
  get diagnostics v_n = row_count;
  if v_n <> 4 then raise exception 'cleanup aborted: expected to delete exactly 4 tags'; end if;

  -- D. Nothing may remain, and the accounts must be untouched.
  if exists (select 1 from public.notes) or exists (select 1 from public.collections)
     or exists (select 1 from public.tags) or exists (select 1 from public.note_tags) then
    raise exception 'cleanup aborted: rows remain after the deletion';
  end if;
  select count(*) into v_users_after from auth.users;
  if v_users_after <> v_users_before then
    raise exception 'cleanup aborted: auth.users changed';
  end if;
end
$$;

-- Result (read-only): after an approved run all four counts are 0; after an inert or
-- aborted run they show the unchanged data.
select
  (select count(*) from public.notes) as notes,
  (select count(*) from public.collections) as collections,
  (select count(*) from public.tags) as tags,
  (select count(*) from public.note_tags) as note_tags,
  (select count(*) from auth.users) as auth_users;
