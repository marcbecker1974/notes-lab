-- ONE-OFF, OWNER-APPROVED CLEANUP of the two test tags left by the two-account RLS tests
-- (scripts/test-rls.mts, Feature 7 / M8). NOT a migration: it is tied to this project's data
-- and must never be replayed by `db push`.
--
-- WHY IT EXISTS: clients have no DELETE privilege on tags (by design: the app never deletes
-- tags), so the test run cannot remove the tag "zz-f7-shared" it creates for each test account.
--
-- INERT BY DEFAULT: `v_approved` below is false, so running this file as it is only raises an
-- exception and changes nothing. Run it ONLY after the owner's explicit approval at execution
-- time, from a throwaway COPY with `v_approved` set to true; never commit that copy:
--
--   cp supabase/maintenance/cleanup_test_tags.sql /tmp/cleanup-test-tags-approved.sql
--   (edit the copy: v_approved ... := true)
--   npx supabase db query --linked -f /tmp/cleanup-test-tags-approved.sql
--
-- WHAT IT DELETES: exactly the tags with ids 114 and 115 (name "zz-f7-shared", one per test
-- account, created 2026-10-15 14:11 UTC by the M8 test run) and nothing else.
--
-- SAFETY (ONE DO statement, so it is atomic: any failure rolls everything back):
--   * Locks tags and note_tags against writers (share row exclusive), 5 s timeout.
--   * Both rows must exist with exactly these ids and the test name, with the recorded
--     fingerprint of (id, name, user_id, created_at), created inside the test-run window,
--     with NO links in note_tags, owned by two DIFFERENT email/password accounts that exist in
--     auth.users (so never the Google journal account).
--   * If ANY other tag carries the test name or the "ZZ-F7-" prefix (a leftover of another or a
--     failed run) the cleanup aborts and the owner must decide again.
--   * Deletes by exact id, checks the exact count (2), checks that no other tag and no link
--     changed, and never touches auth.* (it only counts auth.users before and after).
--   * Error messages name the problem only; they never contain row contents.

do $$
declare
  v_approved constant boolean := false;  -- set to true ONLY in an approved throwaway copy
  v_users_before bigint;
  v_users_after bigint;
  v_tags_before bigint;
  v_links_before bigint;
  v_n bigint;
begin
  if not v_approved then
    raise exception 'cleanup NOT approved: this script is inert until the owner explicitly approves its execution';
  end if;

  perform set_config('lock_timeout', '5s', true);
  perform set_config('TimeZone', 'UTC', true);
  lock table public.tags, public.note_tags in share row exclusive mode;

  select count(*) into v_users_before from auth.users;
  select count(*) into v_tags_before from public.tags;
  select count(*) into v_links_before from public.note_tags;

  -- A. Exactly the two recorded rows.
  if (select array_agg(id order by id) from public.tags where id in (114, 115))
       is distinct from array[114, 115]::bigint[] then
    raise exception 'cleanup aborted: tags 114 and 115 are not both present';
  end if;
  if (select count(*) from public.tags where id in (114, 115) and name = 'zz-f7-shared') <> 2 then
    raise exception 'cleanup aborted: the two tags do not both carry the test name';
  end if;
  if (select md5(string_agg(row_to_json(x)::text, E'\n' order by x.id))
        from (select id, name, user_id, created_at from public.tags where id in (114, 115)) x)
       <> 'a9087bfadbed55221e0a2241fa5a5e00' then
    raise exception 'cleanup aborted: the two tags differ from the recorded fingerprint';
  end if;
  if (select count(*) from public.tags
       where id in (114, 115)
         and created_at >= '2026-10-15 14:11:00+00' and created_at < '2026-10-15 14:12:00+00') <> 2 then
    raise exception 'cleanup aborted: the tags were not created in the M8 test-run window';
  end if;

  -- B. Unused, and owned by two different email/password test accounts.
  if exists (select 1 from public.note_tags where tag_id in (114, 115)) then
    raise exception 'cleanup aborted: a link to one of the tags exists';
  end if;
  if (select count(distinct t.user_id) from public.tags t where t.id in (114, 115)) <> 2 then
    raise exception 'cleanup aborted: the two tags are not owned by two different accounts';
  end if;
  if (select count(*) from public.tags t join auth.users u on u.id = t.user_id
       where t.id in (114, 115) and u.raw_app_meta_data->>'provider' = 'email') <> 2 then
    raise exception 'cleanup aborted: an owner is not an existing email/password account';
  end if;

  -- C. Nothing else of the test may exist.
  if exists (select 1 from public.tags
              where id not in (114, 115) and (name = 'zz-f7-shared' or name like 'ZZ-F7-%')) then
    raise exception 'cleanup aborted: other test tags exist; the owner must decide again';
  end if;

  -- D. Delete exactly the two tags, and verify nothing else changed.
  delete from public.tags where id in (114, 115);
  get diagnostics v_n = row_count;
  if v_n <> 2 then raise exception 'cleanup aborted: expected to delete exactly 2 tags'; end if;
  if exists (select 1 from public.tags where id in (114, 115)) then
    raise exception 'cleanup aborted: a tag remains after the deletion';
  end if;
  if (select count(*) from public.tags) <> v_tags_before - 2 then
    raise exception 'cleanup aborted: the number of other tags changed';
  end if;
  if (select count(*) from public.note_tags) <> v_links_before then
    raise exception 'cleanup aborted: note_tags changed';
  end if;
  select count(*) into v_users_after from auth.users;
  if v_users_after <> v_users_before then
    raise exception 'cleanup aborted: auth.users changed';
  end if;
end
$$;

-- Result (read-only): after an approved run the two test tags are gone; after an inert or
-- aborted run the rows are unchanged.
select
  (select count(*) from public.tags) as tags,
  (select count(*) from public.tags where id in (114, 115)) as test_tags,
  (select count(*) from public.note_tags) as note_tags,
  (select count(*) from auth.users) as auth_users;
