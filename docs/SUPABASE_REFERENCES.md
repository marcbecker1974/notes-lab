Source: https://supabase.com/docs/reference/javascript/select
Source: https://supabase.com/docs/reference/javascript/insert
Source: https://supabase.com/docs/reference/javascript/update
Source: https://supabase.com/docs/reference/javascript/delete
Source: https://supabase.com/docs/reference/javascript/upsert
Source: https://supabase.com/docs/guides/database/joins-and-nesting
Source: https://supabase.com/docs/guides/database/postgres/row-level-security
Source: https://docs.postgrest.org/en/stable/references/errors.html
Source: https://www.postgresql.org/docs/17/sql-createtrigger.html
Source: https://www.postgresql.org/docs/17/sql-createeventtrigger.html

# Supabase References

Official documentation used by Notes Lab, following the Search, Paste, Cite workflow: each section gives the source, a short example copied from the official page (marked "official"), a plain-language purpose, and how it applies to Notes Lab (marked "Notes Lab"). Pages were read on 2026-10-13; summaries paraphrase them. Where a page does not say something, this file says so rather than assuming. Check the source pages if anything here looks out of date.

All examples use the `{ data, error }` return shape: every supabase-js call resolves to an object with `data` and `error`, and the error has `message`, `code`, `details` and `hint`. Check `error` first.

## 1. `select()`: reading rows and related rows

Source: https://supabase.com/docs/reference/javascript/select

Official:

```js
const { data, error } = await supabase
  .from('characters')
  .select('name')
```

```js
const { data, error } = await supabase
  .from('orchestral_sections')
  .select(`
    name,
    instruments (
      name
    )
  `)
```

- Purpose: `select()` with a comma-separated column list returns only those columns; a nested `table (columns)` fetches related rows in the same request. `select('*', { count: 'exact', head: true })` returns only a count.
- Disambiguation: alias an embed (`alias:table(...)`) and name the foreign key when more than one relationship exists.

Notes Lab:

```ts
.from("notes")
.select("id, title, body, collection_id, created_at, updated_at, note_tags(tag_id)")
.order("updated_at", { ascending: false })
```

Used by `listNotes()` in `lib/notes-db.ts`: explicit columns (no `*`) and one request that returns each note with the ids of its tags (R1, R9, R10).

## 2. Relational queries (foreign keys, join tables)

Source: https://supabase.com/docs/guides/database/joins-and-nesting

Official:

```js
const { data, error } = await supabase.from('teams').select(`
  id,
  team_name,
  users ( id, name )
`)
```

- Purpose: the page states that "The APIs will automatically detect relationships based on the foreign keys" and that many-to-many joins are detected, so the join table does not need to be named in the query.
- It also says that when two foreign keys point to the same table you must define the join explicitly.

Notes Lab:
- `note_tags` has foreign keys to `notes` and `tags` (R5), so `notes` can embed `note_tags(tag_id)`, as in section 1. Without the foreign keys, the nested select would fail, so they are part of the schema migration.
- `tags` could also be embedded through the join table (`tags ( id, name )`). We embed only `tag_id` and resolve tag objects from `listTags()` in memory, so each tag is loaded once.

## 3. `insert()`: creating rows

Source: https://supabase.com/docs/reference/javascript/insert

Official:

```js
const { data, error } = await supabase
  .from('countries')
  .insert({ id: 1, name: 'Mordor' })
  .select()
```

- Purpose: `insert()` takes one object or an array. The page states: "By default, inserted rows are not returned. To return it, chain the call with `.select()`." It does not mention `.single()` or Row Level Security for inserts.
- Note: `.single()` is not covered on this page. We use it after `.select()` so the call returns one row instead of an array; PostgREST answers with `PGRST116` when `single()` gets zero or several rows (section 7).

Notes Lab:

```ts
.from("collections").insert({ name }).select("id, name, created_at").single()
```

Used by `createNote()`, `createCollection()` and the "create" half of `addTagToNote()`. The row returned by the database (with `id`, `created_at`, defaults and trigger-set values) goes straight into local state (R7, R9). With anonymous access, an INSERT also needs the temporary INSERT policy and grant (section 6).

## 4. `update()`: changing rows

Source: https://supabase.com/docs/reference/javascript/update

Official:

```js
const { data, error } = await supabase
  .from('instruments')
  .update({ name: 'piano' })
  .eq('id', 1)
  .select()
```

- Purpose: `update()` changes the rows that match the filters. The page states: "By default, updated rows are not returned. To return it, chain the call with `.select()` after filters." It does not state that a filter is mandatory, so we always add `.eq('id', …)` by convention, not because the page requires it.

Notes Lab:

```ts
.from("notes").update({ collection_id: collectionId }).eq("id", id).select(NOTE_COLUMNS).single()
```

Used by `updateNote()` and `setNoteCollection()` (R8). The `updated_at` column is **not** sent: a PostgreSQL trigger sets it (section 8), so the returned row carries the new value.

## 5. `delete()` and `upsert()`

Sources:
- https://supabase.com/docs/reference/javascript/delete
- https://supabase.com/docs/reference/javascript/upsert

Official (delete):

```js
const response = await supabase
  .from('countries')
  .delete()
  .eq('id', 1)
```

Official (upsert):

```js
const { data, error } = await supabase
  .from('users')
  .upsert({ username: 'supabot' }, { onConflict: 'username' })
```

- Purpose (delete): removes the matching rows. Deleted rows are not returned unless `.select()` is chained after the filters. The page does not describe filter or RLS requirements.
- Purpose (upsert): inserts a row or acts on an existing row that conflicts on the `onConflict` columns. The page names the `ignoreDuplicates` option but gives no example and states no RLS or permission requirement. We rely on `ignoreDuplicates` only as described by the page's option name, and the smoke test checks the real behaviour.

Notes Lab:

```ts
.from("note_tags").delete().eq("note_id", noteId).eq("tag_id", tagId)
.from("note_tags").upsert({ note_id, tag_id }, { onConflict: "note_id,tag_id", ignoreDuplicates: true })
```

`removeTagFromNote()` and `addTagToNote()` (R9). Deleting a note or a tag removes its `note_tags` rows through `ON DELETE CASCADE` in the schema, not in application code. Deleting a collection sets `notes.collection_id` to null (`ON DELETE SET NULL`), which moves its notes to "Uncollected" (R4, R6).

## 6. Row Level Security and grants

Source: https://supabase.com/docs/guides/database/postgres/row-level-security

- Enable RLS on every table in an exposed schema. Without RLS, any role with a grant can read and write the table. With RLS enabled and no policies, API access is blocked.
- Adding policies does **not** remove existing grants. Revoke what is not needed and grant back only what each role needs:

```sql
revoke all on table public.reports from anon, authenticated;
grant select, insert, update, delete on table public.reports to authenticated;
```

- Write one policy per operation (`select`, `insert`, `update`, `delete`) and always name the role with `to`:

```sql
create policy "Profiles are viewable by everyone"
on profiles for select
to authenticated, anon
using ( true );
```

- `anon` is an unauthenticated request and `authenticated` is a signed-in one. A `to anon … using (true)` policy exposes every reachable row to any visitor.
- `auth.uid()` returns `null` for unauthenticated requests, so `auth.uid() = user_id` quietly evaluates to false. Wrap it as `(select auth.uid())` so Postgres evaluates it once per statement.
- A secret (`service_role`) key bypasses RLS. Keep it server-side and out of the browser.

Notes Lab:
- *Historical (Mid-Sprint):* the temporary anonymous-access migration started with `revoke all` on the four tables (removing the default `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`), granted only `select, insert, update, delete`, and created one `TEMP anon <operation> <table>` policy per operation, each naming `to anon, authenticated`. Feature 7 dropped those policies and the grants.
- **Feature 7:** the owner policies use `(select auth.uid()) = user_id`, one per operation, `to authenticated` (see ARCHITECTURE.md, section 4b). Behaviours relied on, each confirmed by the two-account tests (`REFLECTION.md`) rather than assumed from this page alone: an `update` needs a `select` policy as well; foreign-key checks bypass RLS, so a policy must check that referenced rows belong to the caller; column-level `grant insert (…)` / `grant update (…)` keeps columns such as `user_id` out of clients' reach; an attempt to write a `generated always` identity column fails with SQLSTATE `428C9`, not `42501`.
- Session checks on the server use `supabase.auth.getClaims()` (`lib/auth/require-user.ts`, `lib/supabase/proxy.ts`), as in the Supabase Next.js starter and the installed `@supabase/ssr` 0.12.7. Anonymous sign-ins carry the `authenticated` role, so the app also rejects claims with `is_anonymous`. Source to re-check if this looks out of date: https://supabase.com/docs/guides/auth/server-side/nextjs
- No secret key is used anywhere in the project.

## 7. Error handling (PostgREST)

Source: https://docs.postgrest.org/en/stable/references/errors.html

- PostgREST forwards PostgreSQL errors as a JSON body with `message`, `code`, `details` and `hint`; the HTTP status comes from the SQLSTATE code. Errors raised by PostgREST itself use the same shape with a `PGRST` code prefix.
- `PGRST116`: a request that expects one row (`single()`) got zero or several (HTTP 406).
- SQLSTATE mapping relevant to us: `23505` unique violation (409), `23503` foreign key violation (409), `42501` insufficient privilege (403 when signed in, otherwise 401). `23514` (check violation) is not listed on the page; it falls under other errors and is passed through, which the smoke test will confirm.

Notes Lab:
`lib/notes-db.ts` maps `23505` to "already exists", `23503` and `PGRST116` to "no longer exists", `23514` to "too long or empty" and `42501` to "not allowed" (without naming roles), and throws one `NotesDbError` carrying the original error as `cause`.

## 8. Triggers and function privileges (PostgreSQL)

Sources:
- https://www.postgresql.org/docs/17/sql-createtrigger.html
- https://www.postgresql.org/docs/17/sql-createeventtrigger.html

- CREATE TRIGGER: "To create or replace a trigger on a table, the user must have the `TRIGGER` privilege on the table. The user must also have `EXECUTE` privilege on the trigger function." The page does not say whether privileges are checked again when the trigger fires, or whose privileges the function runs with.
- CREATE EVENT TRIGGER: "Only superusers can create event triggers." The page does not address `EXECUTE` privilege or the executing role at all.

Notes Lab:
- The `updated_at` trigger function is `SECURITY INVOKER` with a fixed empty `search_path`, and has `EXECUTE` revoked from `public`. The pages do not say whether firing re-checks `EXECUTE`, so this was tested: an anonymous update still changes `updated_at` (rollback rehearsal and REST smoke test, see `REFLECTION.md`).
- For `rls_auto_enable()`, the event-trigger page does not say whether `EXECUTE` is checked when the trigger fires. Because of that gap, the hardening (`revoke execute … from public, anon, authenticated`) is **deferred**: it could silently stop automatic RLS on dashboard-created tables if the privilege is re-checked at firing time, and nothing in Notes Lab calls the function. The two security advisor warnings for it remain open and accepted for the MVP. Our own tables enable RLS explicitly, so they do not depend on the event trigger. See `REFLECTION.md`.
