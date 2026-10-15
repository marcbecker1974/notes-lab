-- ONE-OFF, OWNER-APPROVED CLEANUP of ALL remaining Feature 7 test data (Turing Sprint 2, M9).
-- NOT a migration: it is tied to this project's data and must never be replayed by `db push`.
-- The owner confirmed on 2026-10-15 that ALL remaining application data is disposable test data,
-- including the records of the Google-authenticated account.
--
-- INERT BY DEFAULT: `v_approved` below is false, so running this file as it is only raises an
-- exception and changes nothing. Run it ONLY after the owner's explicit approval at execution
-- time, from a throwaway COPY with `v_approved` set to true; never commit that copy:
--
--   cp supabase/maintenance/cleanup_feature7_test_data.sql /tmp/cleanup-feature7-approved.sql
--   (edit the copy: v_approved ... := true)
--   npx supabase db query --linked -f /tmp/cleanup-feature7-approved.sql
--
-- WHAT IT DELETES (inventory of 2026-10-15, backed up and verified in
-- ~/notes-lab-backups/20261015T151306Z/):
--   notes 300, 301, 302; collection 109; tags 114, 115, 118, 119; and the two note_tags links of
--   note 300 (300:118 and 300:119). The intended result: all four application tables are empty.
--
-- SAFETY (ONE DO statement, so it is atomic: any failure rolls everything back):
--   * Locks the four tables against writers (share row exclusive), 5 s timeout.
--   * The live tables must be byte-identical to the verified backup (MD5 of every table over its
--     rows as JSON, ordered by primary key) AND have exactly the approved ids, links, collection
--     assignment and owners: the records of the Google account (note 300, collection 109, tags 118
--     and 119) share one owner whose provider is google; notes 301 and 302 belong to two different
--     email/password accounts and pair up by owner with tags 114 and 115. Any difference, including
--     a record added or edited after the backup, ABORTS the cleanup with nothing deleted.
--   * Deletes by the exact approved ids and pairs, children first, and checks the exact counts.
--   * Afterwards all four tables must be empty.
--   * NEVER touches auth.*: it only counts auth.users and auth.identities before and after and
--     aborts if either changed. No policy, grant, schema or sequence is touched.
--   * Error messages name the problem only; they never contain row contents.

do $$
declare
  v_approved constant boolean := false;  -- set to true ONLY in an approved throwaway copy
  v_users_before bigint;
  v_users_after bigint;
  v_identities_before bigint;
  v_identities_after bigint;
  v_n bigint;
begin
  if not v_approved then
    raise exception 'cleanup NOT approved: this script is inert until the owner explicitly approves its execution';
  end if;

  perform set_config('lock_timeout', '5s', true);
  perform set_config('TimeZone', 'UTC', true);
  lock table public.note_tags, public.notes, public.collections, public.tags
    in share row exclusive mode;

  select count(*) into v_users_before from auth.users;
  select count(*) into v_identities_before from auth.identities;

  -- A. Byte-exact baseline: the MD5 values are those of the verified backup manifest.
  if (select md5(coalesce(string_agg(row_to_json(t)::text, E'\n' order by t.id), ''))
        from public.notes t) <> '292620849dc592c591e6fa6d636d0cc1' then
    raise exception 'cleanup aborted: notes differ from the approved baseline';
  end if;
  if (select md5(coalesce(string_agg(row_to_json(t)::text, E'\n' order by t.id), ''))
        from public.collections t) <> '182cdd6e854f67421cd1fb63b135917b' then
    raise exception 'cleanup aborted: collections differ from the approved baseline';
  end if;
  if (select md5(coalesce(string_agg(row_to_json(t)::text, E'\n' order by t.id), ''))
        from public.tags t) <> 'f65f79e18fb384b545d021152456101d' then
    raise exception 'cleanup aborted: tags differ from the approved baseline';
  end if;
  if (select md5(coalesce(string_agg(row_to_json(t)::text, E'\n' order by t.note_id, t.tag_id), ''))
        from public.note_tags t) <> 'eddd22ae06d7faf9f64e02f0680c5771' then
    raise exception 'cleanup aborted: note_tags differ from the approved baseline';
  end if;

  -- B. Independent, readable checks of the exact ids, links and relationships.
  if (select array_agg(id order by id) from public.notes)
       is distinct from array[300, 301, 302]::bigint[] then
    raise exception 'cleanup aborted: notes ids differ from the approved scope';
  end if;
  if (select array_agg(id order by id) from public.collections)
       is distinct from array[109]::bigint[] then
    raise exception 'cleanup aborted: collections ids differ from the approved scope';
  end if;
  if (select array_agg(id order by id) from public.tags)
       is distinct from array[114, 115, 118, 119]::bigint[] then
    raise exception 'cleanup aborted: tags ids differ from the approved scope';
  end if;
  if (select array_agg(note_id::text || ':' || tag_id::text order by note_id, tag_id) from public.note_tags)
       is distinct from array['300:118', '300:119']::text[] then
    raise exception 'cleanup aborted: note_tags pairs differ from the approved scope';
  end if;
  if not exists (select 1 from public.notes where id = 300 and collection_id = 109)
     or exists (select 1 from public.notes where id in (301, 302) and collection_id is not null) then
    raise exception 'cleanup aborted: the collection assignments differ from the approved scope';
  end if;

  -- C. Owners: one Google account owns note 300, collection 109 and tags 118 and 119; two
  --    different email/password accounts own notes 301 and 302 and tags 114 and 115 respectively.
  if (select count(distinct x.user_id) from (
        select user_id from public.notes where id = 300
        union all select user_id from public.collections where id = 109
        union all select user_id from public.tags where id in (118, 119)) x) <> 1 then
    raise exception 'cleanup aborted: the Google-account records do not share one owner';
  end if;
  if (select count(*) from public.notes n join public.tags t on t.user_id = n.user_id
       where (n.id, t.id) in ((301, 114), (302, 115))) <> 2
     or (select count(distinct user_id) from public.notes) <> 3 then
    raise exception 'cleanup aborted: the owners differ from the approved scope';
  end if;
  if (select count(*) from public.notes n join auth.users u on u.id = n.user_id
       where n.id = 300 and u.raw_app_meta_data->>'provider' = 'google') <> 1
     or (select count(*) from public.notes n join auth.users u on u.id = n.user_id
          where n.id in (301, 302) and u.raw_app_meta_data->>'provider' = 'email') <> 2 then
    raise exception 'cleanup aborted: an owner has an unexpected sign-in provider';
  end if;

  -- D. Delete exactly the approved records, children first, and check the exact counts.
  delete from public.note_tags where (note_id, tag_id) in ((300, 118), (300, 119));
  get diagnostics v_n = row_count;
  if v_n <> 2 then raise exception 'cleanup aborted: expected to delete exactly 2 note_tags rows'; end if;

  delete from public.notes where id in (300, 301, 302);
  get diagnostics v_n = row_count;
  if v_n <> 3 then raise exception 'cleanup aborted: expected to delete exactly 3 notes'; end if;

  delete from public.collections where id = 109;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'cleanup aborted: expected to delete exactly 1 collection'; end if;

  delete from public.tags where id in (114, 115, 118, 119);
  get diagnostics v_n = row_count;
  if v_n <> 4 then raise exception 'cleanup aborted: expected to delete exactly 4 tags'; end if;

  -- E. Everything is gone, and the accounts are untouched.
  if exists (select 1 from public.notes) or exists (select 1 from public.collections)
     or exists (select 1 from public.tags) or exists (select 1 from public.note_tags) then
    raise exception 'cleanup aborted: rows remain after the deletion';
  end if;
  select count(*) into v_users_after from auth.users;
  select count(*) into v_identities_after from auth.identities;
  if v_users_after <> v_users_before or v_identities_after <> v_identities_before then
    raise exception 'cleanup aborted: auth.users or auth.identities changed';
  end if;
end
$$;

-- Result (read-only): after an approved run all four counts are 0; after an inert or aborted run
-- they show the unchanged data. The Auth counts must stay 3 and 3.
select
  (select count(*) from public.notes) as notes,
  (select count(*) from public.collections) as collections,
  (select count(*) from public.tags) as tags,
  (select count(*) from public.note_tags) as note_tags,
  (select count(*) from auth.users) as auth_users,
  (select count(*) from auth.identities) as auth_identities;
