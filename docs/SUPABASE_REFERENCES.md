Source: https://supabase.com/docs/reference/javascript/select
Source: https://supabase.com/docs/guides/database/postgres/row-level-security

# Supabase References

Official Supabase documentation used by Notes Lab. Both pages were read on 2026-10-13; the summaries below paraphrase them. Check the source pages if anything here looks out of date.

## 1. supabase-js `select()` (JavaScript reference)

Source: https://supabase.com/docs/reference/javascript/select

- Every call resolves to `{ data, error }`. Check `error` first. The error has `message`, `code`, `details` and `hint`.
- `select()` with no argument returns all columns; `select('name')` returns the listed columns. Use explicit column lists rather than `*`.
- Related tables are fetched in the same request with nested syntax, for example `select('name, instruments (name)')`, and the result contains them as nested arrays or objects. The page also documents reaching a related table through a join table (many-to-many) with the same syntax.
- Disambiguating relationships: alias an embed with `alias:table(...)`, and name a foreign key constraint (`table!constraint_name`) when more than one relationship exists.
- Filtering on related tables uses the dotted form (`.eq('related.column', value)`); `!inner` restricts results to rows with a match. `table(count)` returns the number of related rows.
- `select('*', { count: 'exact', head: true })` returns only a count.

**How Notes Lab uses it:** `lib/notes-db.ts` loads notes with their tag links in one request through embedding (`notes` with `note_tags`), using explicit columns and one shared error-handling path.

## 2. Row Level Security (database guide)

Source: https://supabase.com/docs/guides/database/postgres/row-level-security

- Enable RLS on every table in an exposed schema. Without RLS, any role with a grant can read and write the table. With RLS enabled and no policies, API access is blocked.
- Adding policies does **not** remove existing grants. Revoke what is not needed and grant back only what each role needs (`revoke all … from anon, authenticated; grant … to …`).
- Write one policy per operation (`select`, `insert`, `update`, `delete`) and always name the role with `to`.
- `anon` is an unauthenticated request and `authenticated` is a signed-in one. A `to anon … using (true)` policy exposes every reachable row to any visitor.
- `auth.uid()` returns `null` for unauthenticated requests, so `auth.uid() = user_id` quietly evaluates to false. The page suggests an explicit `auth.uid() IS NOT NULL` check.
- Wrap `auth.uid()` in `(select auth.uid())` so Postgres can cache the result once per statement.
- A secret (`service_role`) key bypasses RLS. Keep it server-side and out of the browser. It bypasses RLS only when the request carries no user access token.

**How Notes Lab uses it:**
- The temporary anonymous-access migration needs explicit `grant`s as well as policies for `anon`, and is documented as a deliberate exception (see ARCHITECTURE.md, section 5).
- The future owner policies use `(select auth.uid()) = user_id` (see ARCHITECTURE.md, section 6).
- No secret key is used anywhere in the project.
