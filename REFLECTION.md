# Reflection

## Planning and Architecture Decisions

Status of this first section: it records the planning decisions made before implementation. Later sections record what was actually implemented and verified. Details are in [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Why PROJECT_BRIEF.md was introduced
- **Rationale:** to fix the agreed scope (mandatory vs. optional features, exclusions, acceptance criteria) in one place before building, so later decisions can be checked against it.
- **Trade-off:** it costs time before any code exists, and the list of the 12 Turing College requirements is not yet in it. The brief states that any gap found must be added.

### Why ARCHITECTURE.md was introduced
- **Rationale:** to record the system design, schema, security approach and future auth migration separately from scope, so the approved design is reviewable before implementation.
- **Trade-off:** a second document to keep in sync with the brief and, later, with the code.

### Why the existing notes-lab project was reused
- **Rationale:** it already provides Next.js, Tailwind, shadcn components, both Supabase clients, a linked Supabase project and a migration workflow, so the MVP needs no new services or dependencies.
- **Trade-off:** it carries unused starter code (auth pages, `/protected`, tutorial components) and `package.json` pins Next.js and Supabase packages to `latest`. We chose to leave the unused code untouched to keep the diff small.

### Why Supabase PostgreSQL
- **Rationale:** it is already set up and linked, it fits the required stack, and the relational model (notes, collections, tags, a `note_tags` join table) maps directly onto the data.
- **Trade-off:** the database is in the cloud while the app runs locally, and the browser talks to it directly, so security depends on RLS policies rather than on a private backend.

### Why authentication was postponed
- **Rationale:** the project scope excludes it and Turing College does not require it, so the MVP stays focused on the mandatory features.
- **Trade-off:** write access must then be granted to the `anon` role, which is a real exposure (see the temporary access decision below). Earlier in planning, a single-owner login was recommended as the safer option; the scope decision overrode it.

### Why the schema is prepared for future authentication
- **Rationale:** a nullable `user_id` (default `auth.uid()`) on `notes`, `collections` and `tags`, and a unique constraint on tags that treats nulls as equal, make the later change a backfill plus a policy swap with no change to application logic.
- **Trade-off:** slightly more schema now for a feature that is not being built. The `nulls not distinct` constraint requires Postgres 15 or later.

### Why a centralised database access module
- **Rationale:** `lib/notes-db.ts` is the only code that talks to Supabase for notes data. It never reads or writes `user_id` and has no role or auth logic, so removing anonymous access later does not touch components.
- **Trade-off:** one more layer, and discipline is required to keep components from calling Supabase directly.

### Why temporary anonymous access is acceptable only with non-sensitive test data
- **Rationale:** with no auth, the app cannot write without granting the `anon` role access. The publishable key is in the browser bundle, so anyone with the project URL and key could read, change or delete rows. This is tolerable only if the data has no value, the app stays on localhost and the policies are isolated in one removable migration.
- **Trade-off:** the exposure is accepted, not removed. Size limits only cap the size of writes. If the key leaks, or the app is deployed, the risk becomes real.

### Client-side data layer
- **Rationale:** loading the data once and filtering and searching in memory is the simplest way to get instant live search and AND tag filtering for a small single-user journal.
- **Trade-off:** the whole dataset loads into the browser, so this stops being suitable at thousands of notes.

### Decisions after the official requirements arrived (2026-10-13)
- **Three-column layout kept, with notes in the sidebar:** the requirements place notes and tags in the sidebar (R6, R9), so the left column shows collections with their notes, the middle shows the filtered list, and both use a shared note-card component. Trade-off: the sidebar and the middle list overlap, so both read from one in-memory state.
- **`updated_at` via a PostgreSQL trigger:** correct for any client and keeps application code out of it. Trade-off: one more database object to maintain.
- **`collections.user_id` stays nullable:** keeps the schema compatible with later authentication. Trade-off: the table has one column beyond the three the course names.
- **Note count badges as the optional task:** the course-preferred option, built in its own feature branch. Colour-coded tags and renaming collections are demoted.
- **Cited references:** `docs/SUPABASE_REFERENCES.md` records the supabase-js `select()` and Row Level Security pages, with source URLs. The RLS guide's point that policies do not remove existing grants shaped the plan for the temporary anon migration.
- **Review plan:** `/code-review` is the proposed command for E8; it has not been run. No GitHub remote exists yet.

### Completed technical checks
- **Postgres version:** the linked project reports Postgres 17.11, both in `supabase/.temp/postgres-version` and from `show server_version` on the live database, so `unique nulls not distinct` (Postgres 15+) is supported.
- **`.gitignore`:** `supabase/.temp/` is now ignored.

### Verification results (2026-10-13, read-only)

**Lint (`npm run lint`).** It exits with errors: 13,265 problems (13,201 errors, 64 warnings).
- Nearly all (13,264) come from the generated `.next/` build output, which `eslint .` scans because `eslint.config.mjs` has no ignore list. This is a tooling configuration issue, not a source-code issue.
- Linting only the source (`app`, `components`, `lib`, `proxy.ts`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`) gives 1 error: `tailwind.config.ts:62`, `@typescript-eslint/no-require-imports` (a `require()` call).
- Not fixed: the instruction was to report only. The installed `next` is 16.4.0 and `eslint-config-next` is 15.3.1, but lint runs without a configuration failure.

**Live RLS policies and grants (read-only queries through `supabase db query --linked`).**
- Migrations: all 8 local migrations are applied on the remote.
- Tables: only `public.notes` exists (the todo table was dropped). RLS is enabled, not forced. It has 3 rows.
- Policies: exactly the two documented `SELECT` policies, `Authenticated users can view notes` (`authenticated`, `true`) and `Notes are viewable by everyone` (`public`, `true`). There are no insert, update or delete policies.
- Columns: `id`, `title`, `body`, `created_at`. `updated_at`, `collection_id` and `user_id` do not exist yet, and there are no triggers.
- **Difference from our documentation:** `anon` and `authenticated` hold `REFERENCES, SELECT, TRIGGER, TRUNCATE` on `notes`, not only `SELECT` as the migration and `docs/ARCHITECTURE.md` say. Writes are still denied because `INSERT`, `UPDATE` and `DELETE` are not granted. Whether `TRUNCATE` is reachable through the Data API was not tested. The extra privileges are consistent with the RLS guide's warning that existing grants must be revoked explicitly, so the temporary anon migration should `revoke all` before granting.
- **Not previously known:** the security advisor reports two warnings for `public.rls_auto_enable()`, a `SECURITY DEFINER` function that `anon` and `authenticated` can call through `/rest/v1/rpc/rls_auto_enable`. The database also has an `ensure_rls` event trigger that uses this function. Where the function comes from, and whether to revoke its `EXECUTE`, is not yet decided.

**GitHub repository.**
- Git is configured for Marc Becker on branch `main` with one commit and no remote.
- `gh` is logged in as `marcbecker1974` (token scopes include `repo`).
- The account has three repositories (`cold-Lead-Intake`, `Cold-Lead-Intake-OLD`, `todo-app`) and none named `notes-lab`, so no suitable repository exists yet and nothing has been created.

**Third-party review command.**
- `/full-review` is in the `comprehensive-review` plugin (v1.3.1) and `/refactor-clean` is in the `code-refactoring` plugin (v1.2.1), both in the `claude-code-workflows` marketplace of `wshobson/agents`. The original `wshobson/commands` repository is archived and points there.
- Neither is installed locally: the plugin and marketplace lists have no match for `wshobson` or `comprehensive-review`.
- `/full-review` reviews a target with several agents and writes its working files to `.full-review/`, pausing for approval between phases. `/refactor-clean` refactors code rather than reviewing a diff. Neither has been run.

### Follow-up results (2026-10-13, read-only; no database changes)

**Lint fixed (tooling change, to be committed separately from the planning docs).**
- `eslint.config.mjs` now ignores `.next/**`, `out/**`, `build/**` and `next-env.d.ts`.
- `tailwind.config.ts` imports `tailwindcss-animate` with an ES `import` instead of `require()`.
- Result: `npm run lint` exits 0 with no problems, and `npx tsc --noEmit` also passes. `git diff --stat` shows only these two files changed (4 insertions, 1 deletion).

**Grants.** The extra `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` privileges on `notes` come from Supabase's default privileges for tables created by `postgres`, not from our migrations. New tables will get them too, so the new migrations must revoke them (documented in `docs/ARCHITECTURE.md`, section 5).

**`public.rls_auto_enable()`.**
- **Definition:** a plpgsql function returning `event_trigger`, `SECURITY DEFINER`, `search_path` fixed to `pg_catalog`, owned by `postgres`. It loops over `pg_event_trigger_ddl_commands()` and, for `CREATE TABLE`, `CREATE TABLE AS` and `SELECT INTO` in the `public` schema, runs `alter table … enable row level security`. Errors are caught and logged.
- **Use:** the event trigger `ensure_rls` (`ddl_command_end`, enabled, owned by `postgres`) calls it. No table trigger uses it, and its only dependency is that event trigger.
- **Permissions:** its ACL is empty (`null`), so the default `PUBLIC` execute applies. `anon`, `authenticated`, `authenticator`, `service_role`, `postgres` and `supabase_admin` all can execute it. This is what the two security advisor warnings report. I did not call the function, so I have not confirmed what an RPC call to it returns; Postgres normally refuses to run an event-trigger function outside an event trigger, which would mean low practical risk, but this is unverified.
- **Recommendation:** in a later migration, run `revoke execute on function public.rls_auto_enable() from public, anon, authenticated;`. Revoking from `anon` and `authenticated` alone would not work, because they inherit `PUBLIC`. I would not move or drop the function, since it is part of Supabase's "enable RLS automatically" setting and the event trigger depends on it.
- **Verify afterwards:** (1) re-run `supabase db advisors --linked --type security` and expect the two warnings to be gone; (2) confirm the `ensure_rls` event trigger still enables RLS on a new table. Event-trigger functions are generally not checked for `EXECUTE` privilege when they fire, but this should be tested on a local or branch database before relying on it. Our new tables enable RLS explicitly, so the trigger does not carry the app's security either way.

**UI component library.** Deliberately left undecided. shadcn/ui, GitHub Primer and Material UI are to be compared before the Notes UI is implemented. The repo already contains shadcn-style primitives from the starter template (`components/ui`, Radix), but that is not a decision.

### Final pre-Phase-C migration review (2026-10-13, read-only; nothing applied)

Review of the three remaining migrations (schema, seed, temporary anon access) against the live Postgres 17.11 database, using read-only queries and the official docs. No migration was executed, and no SQL parser has run on the files yet.

**Results.**
- **Syntax, order and version:** reads clean; objects are created before they are referenced. `unique … nulls not distinct` is supported (Postgres 15+). The expression index uses only immutable functions. The `default auth.uid() references auth.users` pattern was already used by an applied migration. Nothing is confirmed by execution.
- **Existing data:** the 3 notes (titles up to 13 characters, bodies up to 28, none blank) satisfy the new check constraints. No new name collides with an existing object.
- **Identity sequences:** no sequence grant is included. The PostgreSQL docs read do not say whether an identity insert by `anon` needs sequence privileges; I expect it does not, but this is **unverified**. The rehearsal tests it through `collections` and `tags`.
- **`updated_at` trigger under `anon`:** the function is `SECURITY INVOKER` and only sets `new.updated_at`. The docs do not say whether `EXECUTE` is re-checked when the trigger fires, so this is **unverified** and tested in the rehearsal.
- **Scope:** grants and the 16 policies name only `notes`, `collections`, `tags` and `note_tags`. No `all tables`, `all sequences` or `alter default privileges`.
- **Seed:** inserts only, no `UPDATE`, `DELETE` or `ON CONFLICT`; existing ids 1–3 untouched. A name collision would abort the whole file through the unique indexes rather than overwrite anything.
- **Low residual risks:** `anon` can set `user_id` explicitly (the foreign key rejects non-existent users, and none exist yet); the CLI is believed to apply each migration file atomically, but this is unconfirmed.

**Why the `rls_auto_enable()` hardening migration was deferred (decision: Marc Becker, after my recommendation).**
- No application code calls the function, and it protects nothing in Notes Lab because the new tables enable RLS explicitly.
- Practical risk is probably low: the function uses `pg_event_trigger_ddl_commands()`, which only works inside an event trigger (not tested).
- The revoke has its own unverified risk: if `EXECUTE` is re-checked when the event trigger fires, the revoke could silently stop automatic RLS on tables created through the dashboard.
- The file `…_harden_rls_auto_enable.sql` was created, never applied or committed, and then deleted from the branch.
- **Trade-off:** the security advisor warnings stay.

**Remaining Supabase security advisor warnings (as last read, before any new migration).** Two warnings for `public.rls_auto_enable()`: it is `SECURITY DEFINER` and executable by `anon` and by `authenticated` through the default `PUBLIC` privilege (callable at `/rest/v1/rpc/rls_auto_enable`). They are known and accepted for the MVP. The advisor will be re-run after the migrations are applied to check that no new warnings appear.

**Transaction probe (2026-10-13).** `supabase db query --linked` posts to the write-capable `/v1/projects/{ref}/database/query` endpoint (not `/read-only`) and runs as `postgres`. Three probes with `begin` … `rollback` showed: (1) statements share one session (a temp table persisted across statements); (2) `rollback` undid a `create table` plus insert in `public`; (3) a failing statement (`1/0`) returned HTTP 400 and left nothing behind. Afterwards no probe objects, no idle transactions, and `notes` unchanged. Not shown: how the server ends an aborted transaction (closed connection or explicit rollback); the result is the same.

**Rollback rehearsal of the three migrations (2026-10-13): PASSED, nothing persisted.** One file: `begin`, `set local lock_timeout 3s / statement_timeout 15s / idle_in_transaction_session_timeout 30s`, the three migrations verbatim, checks T0–T4, `rollback` (no `COMMIT` anywhere). The file returned its final `REHEARSAL PASSED` row, which is only reached if every check passed; the CLI prints only that last result, so the checks are reported as a group, not individually.
- T0 preconditions and 8 notes after the seed; T1 RLS on 4 tables, 16 policies, trigger present, `anon`/`authenticated` hold only `SELECT, INSERT, UPDATE, DELETE`, no `TRUNCATE` for `anon`, seed counts 3/4/7, originals' `updated_at` backfilled; T3 as `anon`: inserts into `collections` and `tags` (identity columns, no sequence grant) worked, and updating a disposable note changed `updated_at` to `now()` while `created_at` stayed; T4 the 3 original notes unchanged. This answers two open points: **`anon` needs no sequence grant for identity inserts**, and **the `updated_at` trigger fires under `anon`** with `EXECUTE` revoked from `public`.
- **Before/after snapshots (`state.sql`):** identical (8 applied migrations, notes columns `id,title,body,created_at`, same notes fingerprint, 3 rows, the 2 original policies, no trigger, no new tables, no idle transactions, no `TEMP` policies) **except `notes_id_seq`: 3 → 9.** That is the expected non-transactional sequence change: 5 seed notes plus 1 disposable note. The next real note will get id 10; ids 4–9 are an unused gap. Nothing else differed.
- Not tested by the rehearsal: behaviour of the REST API (PostgREST schema cache, publishable key), `anon` update/delete of other tables, a concurrent `/notes` request during the lock, and whether `db push` records the history entries identically.

### Phase C: migrations applied to the live database (2026-10-13)

On branch `feature/db-schema-and-helper`, `migration list --linked` showed 8 applied and 3 pending; `db push --linked --dry-run` listed exactly `…094205_add_collections_tags_schema`, `…094206_seed_sample_journal_data`, `…094208_temp_anon_access`, in that order. `db push --linked` then applied all three without errors. Read-only verification afterwards:
- **Migrations:** 11 applied (the 8 old plus the 3 new); nothing unexpected.
- **Tables and RLS:** `notes`, `collections`, `tags`, `note_tags` exist, RLS enabled (not forced) on all four.
- **Columns:** `notes` gained `collection_id`, `updated_at` (not null, default `now()`) and `user_id` (default `auth.uid()`); `collections` and `tags` have `user_id`, `tags.color` is nullable.
- **Constraints and indexes:** primary keys, foreign keys (`user_id`, `collection_id`, both `note_tags` keys), `notes_title_length`, `notes_body_length`, name and colour checks; unique case-insensitive name indexes on `collections` and `tags`, plus the three planned indexes.
- **Trigger:** `notes_set_updated_at` (before update, enabled) calls `set_updated_at()`, which is `SECURITY INVOKER` with an empty `search_path` and `EXECUTE` for `postgres` only.
- **Policies:** exactly 16, all `TEMP anon <op> <table>` for roles `anon, authenticated`; the two old `notes` select policies are gone.
- **Grants:** `anon` and `authenticated` hold only `SELECT, INSERT, UPDATE, DELETE` on the four tables. `service_role` still holds Supabase's default `REFERENCES, TRIGGER, TRUNCATE` (not touched, never used by the app). `anon` has no sequence privileges and no `CREATE` on `public`, confirming identity inserts need none.
- **Original notes:** ids 1–3 are unchanged (same fingerprint as before the migrations); `updated_at = created_at`, `collection_id` and `user_id` null.
- **Sample data:** 5 new notes (ids 10–14, after the 6 values burned by the rehearsal), 3 collections, 4 tags, 7 note-tag links; the collection assignments and links match the seed (`Agents and tool use` uncollected, `AI Agents` empty).
- **Security advisor (`db advisors --linked --type security`):** exactly the two known warnings for `public.rls_auto_enable()` (executable by `anon` and by `authenticated`). No new warnings from the new tables or policies. Accepted, hardening deferred (see above).
- **Method note:** my first verification query showed no trigger only because of a filter on `regclass` text; a direct query confirmed it. Two earlier verify queries also failed on `text || "char"` casts before any result was read. Neither touched data.
- The REST smoke test followed (next section).

### REST smoke test with the publishable key (2026-10-13): 31/31 PASS

A throwaway Node script (kept outside the repo, in the session scratchpad) used `@supabase/supabase-js` with only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.local` (nothing printed; no secret key involved). It did not use `lib/notes-db.ts`, which does not exist yet. All records were disposable (`ZZ-SMOKE-<timestamp>` names).
- **Reads:** notes with embedded `note_tags(tag_id)` (8 notes, 7 links, one request), collections (3), tags (4).
- **Round trip:** created a collection, tag and note; assigned the note to the collection; added a tag with `upsert(..., { ignoreDuplicates: true })` (repeating it caused no error and left one row); removed the tag; updated the note, and `updated_at` advanced (11:35:13.5 → 11:35:15.1, set by the trigger, not sent by the client) while `created_at` stayed; deleted note, tag and collection (`.delete().select()` returned the deleted row each time).
- **Error codes as mapped in `docs/SUPABASE_REFERENCES.md`:** duplicate collection name with different case and spaces and duplicate tag name with different case → `23505`; note with a nonexistent collection and `note_tags` with a nonexistent tag → `23503`; empty title, whitespace-only title, 201-character title, 20,001-character body, 51-character collection name and an invalid tag colour → `23514` (so `23514` reaches the client as a check violation, as predicted); `single()` with no row → `PGRST116`. A title of exactly 200 characters is accepted.
- **Cascades:** deleting a note removes its `note_tags` rows; deleting a tag removes its `note_tags` rows (note kept); deleting a collection leaves its note with `collection_id = null`.
- **Cleanup and integrity:** no `ZZ-SMOKE` rows or test notes remained (checked through the API and directly in SQL); the 8 notes (ids 1–3, 10–14) are identical in id, title, body, timestamps and collection to before the run; counts are 8 notes, 3 collections, 4 tags, 7 links.
- **Side effect:** identity sequences advanced (`notes_id_seq` 14 → 24, `collections_id_seq` 7, `tags_id_seq` 8). The next real ids will be higher with gaps; harmless.
- **No unexpected behaviour.** The test only shows that this works for `anon`; it does not test concurrency or `authenticated` users. Insert, update and delete by `anon` work, as expected for the temporary anonymous access, and the data stays publicly writable until that migration is replaced.

### `lib/notes-db.ts` implemented (2026-10-13)

The module follows `docs/ARCHITECTURE.md` section 4 and the database access rules in `CLAUDE.md`. It is not used by any UI yet.
- **API:** `listNotes`, `createNote`, `updateNote`, `setNoteCollection`, `deleteNote`; `listCollections`, `createCollection`, `deleteCollection`; `listTags`, `addTagToNote`, `removeTagFromNote`. Collection rename and tag colour are left out (optional in the plan).
- **Types:** `Note`, `Collection`, `Tag` in camelCase without `user_id`; row types stay internal and are mapped at the boundary. Hand-written, not generated.
- **One client seam:** a private `getClient()` calls the existing browser client's `createClient()` on every call (no client at module scope). Swapping in an authenticated or server client later means editing that function. Because it uses the browser client, the module is meant for client components.
- **One request per read:** `listNotes` embeds `note_tags(tag_id)` and uses explicit column lists (no `select('*')`). The same select, including the embed, is used on insert and update so every write returns a complete `Note` (see the open point below).
- **Errors:** every call goes through one helper `run()`, which turns returned and thrown errors (for example a network failure) into `NotesDbError` with `kind`, `operation`, a user-safe `message` and the original as `cause`. Mapping, taken from the smoke test: `23505` → duplicate, `23503` and `PGRST116` → not found, `23514` → invalid, `42501` → forbidden, anything else → unknown. Messages never mention roles, `anon` or SQL.
- **Validation before the request:** titles and names are trimmed and checked against exported limits (`NOTE_TITLE_MAX` 200, `NOTE_BODY_MAX` 20000, `NAME_MAX` 50) that mirror the check constraints, so users get a friendly message; the database stays the final authority. The body is stored as typed (not trimmed). A `null` body is returned as `""`.
- **Deletes check the result:** `deleteNote` and `deleteCollection` select the deleted row and throw "not found" if nothing was deleted, because a delete that RLS or a missing row turns into zero rows would otherwise look like success. `removeTagFromNote` does not check, so removing a link that is already gone succeeds (idempotent).
- **`addTagToNote`:** finds the tag case-insensitively with `ilike` (LIKE wildcards in the name are escaped), creates it if missing, retries the lookup if a concurrent request created it first (`23505`), then links with `upsert(..., { ignoreDuplicates: true })`, which the smoke test showed is idempotent. It is not one database transaction: if the link step fails, a newly created tag stays as an unused tag. Accepted for a small single-user app.
- **Not in the module:** filtering, search, AND-tag filtering and count badges (in memory in the UI), anything about `user_id`, roles or auth.
- **Verification:** `npm run lint` and `npx tsc --noEmit` pass with no output; `npm run build` succeeds with all routes as before. A grep shows `.from(` only in `lib/notes-db.ts`, the known `app/notes/page.tsx` (to be replaced in the UI feature) and the starter's tutorial code strings. Existing pages are unchanged.
- **Runtime test (below):** the earlier open point about the embed in returned rows is now verified.

#### Runtime test of the module (2026-10-13): 33/33 PASS

A temporary script outside the repo (session scratchpad) ran an exact copy of `lib/notes-db.ts` (only the client import line differed, checked with `diff`) against the live database with the publishable key, using `ZZ-RT-<timestamp>` records. It was deleted afterwards; nothing was added to the repo.
- **Reads:** `listNotes` returns 8 camelCase notes, newest `updatedAt` first, 7 tag ids embedded, no `user_id`; `listCollections` returns 3, `listTags` 4.
- **Writes return complete notes:** the `note_tags(tag_id)` embed **works in the returned row of insert and update** (`createNote`, `updateNote`, `setNoteCollection` all returned correct `tagIds`), which settles the earlier doubt.
- **CRUD:** `createCollection` (trims); `createNote` (trims the title, defaults body `""` and collection `null`); `updateNote` (`updatedAt` advanced by the trigger, `createdAt` unchanged, a body-only patch keeps the title); `setNoteCollection` (move, to null, back); `addTagToNote` (creates the tag, reuses it for other case or spacing, no duplicate link, two concurrent calls with a new name both succeed with the same tag, `a_b` and `aXb` stay separate tags so the `ilike` wildcard escaping works); `removeTagFromNote` (repeat is not an error, the tag stays); `deleteCollection` (note kept, collection null); `deleteNote` (no `note_tags` rows left).
- **Errors:** every error case threw `NotesDbError` with the expected `kind` (`duplicate`, `validation`, `not_found`), `operation` set, `cause` kept for database errors, and a message with no mention of anon, Postgres, constraints or SQL. Covered: duplicate collection, empty and over-long names, titles and bodies, nonexistent collection, note and tag targets, empty patch.
- **Observed limitation (as documented):** `addTagToNote` on a nonexistent note first creates the tag and then fails on the link, which leaves an unused tag; the cleanup sweep removed it. The UI always passes an existing note, so this is accepted.
- **Cleanup and integrity:** no `ZZ-RT` rows remained (checked through the module and directly in SQL); the 8 notes (ids 1–3, 10–14) and their fingerprint are unchanged; counts are 8 notes, 3 collections, 4 tags, 7 links. The module has no tag delete, so the test script removed its test tags with its own client. Sequences advanced again (harmless gaps).
- **Re-run after removing the test code:** `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.
- **Still untested:** use from real React components (first done by the UI feature) and `authenticated` users.

### PR #1 review with `/code-review` (2026-10-13)

PR: https://github.com/marcbecker1974/notes-lab/pull/1 (`feature/db-schema-and-helper` into `main`, four commits). I ran the `/code-review` skill against it; it returned 10 findings. **Caveat for E8:** `/code-review` ships with Claude Code, so it may not count as the course's "third-party slash command". The third-party candidates (`/full-review`, `/refactor-clean`) are not installed, and installing a third-party marketplace needs Marc's decision. This review therefore has not been confirmed as satisfying E8, and the PR is not merged.

I checked each finding against the code and the live database before acting:

| # | Finding | Verdict and action |
|---|---|---|
| 1 | Over-broad grants: UPDATE on `collections`, `tags`, `note_tags` that the module does not use | **Valid, accepted for now.** Collection rename and tag colour are planned optional features, and the temporary access is deliberately full CRUD. Narrowing needs a new migration (applied migrations are not edited); consider it with the auth migration. |
| 2 | Schema migration lacks `revoke all` for the new tables | **Partly valid, accepted.** The revoke is in the temp migration, applied right after in the same push, and the rule in CLAUDE.md says "in the migration that grants access". The coupling is real: applying only migration 1 would leave default privileges. Not changed (applied). |
| 3 | `ilike` lookup vs `lower(btrim(name))` index may disagree on some Unicode folding | **Plausible, not reproduced, deferred.** Worst case: a duplicate error for an exotic name. |
| 4 | `addTagToNote` is not atomic and can leave an orphan tag | **Valid, already documented and accepted.** |
| 5 | `listNotes` order is nondeterministic for rows with equal `updated_at` (seed rows share a timestamp) | **Valid. Fixed:** added `id` descending as a tie-break. Verified: seed notes list as 14, 13, 12, 11, 10. |
| 6 | Client length checks count UTF-16 units, the database counts characters | **Valid. Fixed:** lengths now count code points. Verified: 20,000 emoji pass, 20,001 are rejected; a 200-emoji title passes, 201 fails. |
| 7 | `run()` casts `null` to `T` | **Valid but low risk.** Internal only; every call site is typed for its query. Not changed. |
| 8 | Fake `PGRST116` object used for "nothing deleted" | **Valid. Fixed:** a small `notFound()` helper throws the error directly and no fake `cause` is stored. |
| 9 | Seed joins by title and name | **Not applicable.** One-shot seed, already applied on a database I checked for collisions; a re-run would abort on the unique indexes. |
| 10 | `revoke execute … from public` leaves EXECUTE for `anon`/`authenticated`/`service_role` on `set_updated_at()` | **Incorrect.** The live ACL is `{postgres=X/postgres}` and `has_function_privilege` is false for all three roles. |

**Fixes (one commit, `lib/notes-db.ts` only):** findings 5, 6 and 8. Re-verified: lint, `tsc` and build pass; a read-only run of the changed behaviour passed (order, emoji limits, not-found errors) and created no rows (counts still 8 notes, 3 collections, 4 tags, 7 links). The full 33-check runtime test was not repeated.

**What the review showed about the process:** the reviewer found real defects in code I had verified end to end (ordering, Unicode length), and one claim that was wrong on the facts (finding 10). Checking each finding against the database before changing anything kept the fixes small.

### Third-party review of PR #1 with `/full-review` (E8) and fresh-session review (E9), 2026-10-13

**Install and command.** Following the `wshobson/agents` README, I ran `claude plugin marketplace add wshobson/agents` and `claude plugin install comprehensive-review@claude-code-workflows` (plugin v1.3.1, user scope). Before installing I read `plugins/comprehensive-review/commands/full-review.md`: a prompt-only orchestrator with no network, delete or push commands. I added `.full-review/` to `.gitignore` first, because the command writes its working files there.
- **First attempt did not run the plugin.** A headless run with `/full-review …` printed that the command was not available and produced a manual single-pass review instead. I do **not** count it as the third-party command run. Its findings overlapped with the plugin run (the `*` wildcard, grants, `user_id`, docs wording).
- **Valid run.** A fresh headless process with `/comprehensive-review:full-review` (flag `--security-focus`; the two checkpoints auto-approved because the process was non-interactive) ran all five phases with specialist sub-agents (quality, architecture, security, performance, testing, documentation, best practices, CI/CD) and wrote `.full-review/00-scope.md` to `05-final-report.md`. Result: 0 Critical, 7 High, 19 Medium, 30 Low after de-duplication. These files are local (ignored by Git); the findings and decisions are recorded here. Reviewer-side limits: no database queries, and some reviewers' `git diff` secret scans were blocked.

**Verification of findings against the code and the live system before changing anything.**

| Finding (plugin ID) | Check | Result and action |
|---|---|---|
| `*` is a wildcard in the PostgREST `ilike` used by `findTagByName` (Q1; four reviewers) | Read-only query with the publishable key | **Confirmed by execution:** `ilike 'r*'` returned `rag`, `ilike '*'` returned all four tags, and `r\\*` returned none (no escape). Adding a tag named `r*` would have attached `rag`. **Fixed:** the lookup now compares in memory (lower-cased, trimmed) over the tag list, which also mirrors the unique index and removes the Unicode-folding mismatch. Regression test below. |
| `npm run dev` listens on all interfaces; "localhost only" is misleading (S1) | Ran the default `next dev` and checked the listener | **Confirmed:** listener `*:3000` and a "Network: http://192.168.x.x:3000" line (the DevOps reviewer's claim that it binds to localhost was wrong). **Fixed:** `"dev": "next dev -H 127.0.0.1"`; the docs now say "localhost only" limits the app, not the Supabase Data API, which stays reachable with the key. |
| Nothing stops a server module from importing the browser-only module (A4; also the fresh review) | Read the Next.js docs and `types/global.d.ts` | `client-only` is resolved by the compiler. **Fixed:** `import "client-only"` added to `lib/notes-db.ts`; lint, tsc and build pass. Not exercised by a server import. |
| `ARCHITECTURE.md` still described the pre-migration project; wrong tag-uniqueness wording; incomplete auth plan (D1–D5) | Read the file | **Valid. Fixed:** status, component table, current state (11 migrations, 16 policies, grants), policy section, kill-switch text, and a new checklist in section 6 (both-parent ownership checks, `authenticated` holding the TEMP grants, reviewed backfill, column privileges for `user_id`/`created_at`). `CLAUDE.md`: known `app/notes/page.tsx` exception, "name each table explicitly" instead of "one table at a time", note about the starter's earlier select grant. |
| `user_id`, `created_at` writable by callers; unused UPDATE/DELETE grants (S2, S5) | Matches the temp migration and the earlier `/code-review` finding | **Valid, accepted for now.** Fix needs a new migration (column grants, dropping unused grants); to be decided with the auth migration. `updated_at` is always overwritten by the trigger. |
| Lists silently truncate at the Data API row cap (P1) | Not run; the project's `max_rows` setting is unknown (no `supabase/config.toml`) | **Accepted, documented** in `ARCHITECTURE.md`. Sample data is far below 1000 rows; paging or a loud failure is a backlog item. |
| `set_updated_at()` EXECUTE revoke may be cosmetic (N11; fresh review #5) | `proacl` and `has_function_privilege` queried earlier | **Incorrect:** ACL is `{postgres=X/postgres}`; `anon`, `authenticated` and `service_role` cannot execute it. |
| No tests, CI, `config.toml`, pinned versions, generated types (T1–T8, C1, N1–N4) | Matches the repo | **Valid process gaps, not fixed in this PR** (new dependencies or tooling need Marc's decision per `CLAUDE.md`). Manual verification results are recorded here; automated tests and CI are backlog. |
| `updated_at` semantics (A7/P2; fresh review #4): moving a note or deleting its collection bumps `updated_at`, so notes jump to the top | Follows from a `before update` trigger without a `when` clause (not run) | **Plausible, deferred;** decide before the notes UI (a `when (old.title is distinct from new.title or old.body is distinct from new.body)` trigger would change it, via a new migration). |
| Low-priority items (duplicated code, doc comments, README, `.gitignore` `.env*` pattern, others) | Not individually checked | Left in the backlog; none affects correctness today. |

**Fixes committed:** tag lookup and `client-only` in `lib/notes-db.ts`; `dev` script; `.gitignore` (`.full-review/`); docs (`ARCHITECTURE.md`, `CLAUDE.md`). Verified: `npm run lint`, `npx tsc --noEmit` and `npm run build` pass. A disposable-data regression test of the changed `addTagToNote` path (copy of the module, same Supabase project, all rows removed afterwards) passed 7/7: `r*` creates its own tag instead of attaching `rag`; `  RAG ` reuses `rag`; repeating `r*` reuses it; `%` is literal; concurrent same new name succeeds with one tag; the note holds 5 distinct tag ids; cleanup left 4 tags, 8 notes and 7 links. The full 33-check test was not repeated.

**Accepted risks (unchanged):** temporary open anonymous (and `authenticated`) CRUD with the publishable key, including mass deletion and database filling; writable `user_id` and `created_at`; unused grants; the two `rls_auto_enable()` advisor warnings; unpaged lists; non-atomic `addTagToNote` (can leave an unused tag); seed data in a migration; no automated tests or CI yet; `updated_at` bumps on collection changes; some phase-3 and phase-4 findings left in the backlog.

**Fresh-session review (E9).** After the earlier `/code-review`, I started a separate headless Claude Code process (`claude -p`, no shared context) with only the instruction to review PR #1 via `gh pr diff 1` and `CLAUDE.md`, and explicitly not to read `REFLECTION.md` or `.full-review/`. It read the migrations and module, reported 10 findings and verified none of them by running code. Independently of the other reviews it found the over-broad grants, writable `user_id`, truncation at 1000 rows, the `ilike` versus index mismatch, the missing `client-only` guard and the orphan-tag path. New to it: collection moves and deletes bump `updated_at` (deferred, above), `\u0000` in a body is not caught client-side (the user sees the generic error; low), and a repeated claim that the `EXECUTE` revoke is cosmetic (incorrect, above). Note that this fresh session was started by me in a headless process, not opened by hand; if the course needs a separately opened interactive session, that is still open.

### Feature 2: notes UI on `feature/notes-ui` (2026-10-13)

**Decisions (Marc, after the plan review).** shadcn/ui + Tailwind; explicit Save button with a dirty indicator; "Save and switch / Discard changes / Cancel" when leaving a note with unsaved changes; collection deletion with confirmation; notes shown in both the sidebar and the middle list; collection creation in the sidebar only; tag colours out of scope; `updated_at` unchanged (every update bumps it, including collection moves, which settles the open item from the PR #1 review); the selected note stays active when its list position changes. The three-column desktop layout was reviewed visually on a large display and approved, then refined: 240 / 360 / remaining columns, editor content centred and limited to 900px, larger title, 400px minimum body height.

**Responsive decisions.** Wide desktop (1200px and up) keeps three columns. At 768 to 1199px the collections sidebar is collapsible: hidden by default, opened with a toggle in the list header as a 260px overlay (closes on Escape, backdrop click, or choosing a collection or note). Below 768px the columns stack with the sidebar always visible; a dedicated mobile design is accepted as out of scope for the MVP.

**Implementation.** `lib/notes-view.ts` (pure filter, AND-tag, search, order), `components/notes/use-notes-data.ts` (the only UI importer of `lib/notes-db.ts`), and the sidebar, list, editor and card components. `app/notes/page.tsx` is now a thin shell, so the starter's direct query is gone (R1.3). No database or `notes-db.ts` changes.

**Real finding: the shadcn CLI added unapproved dependencies.** `npx shadcn@latest add ...` (CLI 4.21.4) wrote components that import `cn` from a new npm package named `cn` (instead of `@/lib/utils`) and used the umbrella `radix-ui` package, adding both to `package.json` without asking. It was stopped, `package.json` and the lockfile were restored, and the components were written by hand against `@/lib/utils` with only the five approved packages. `CLAUDE.md` now says not to run the CLI unattended.

**`package-lock.json` audit.** Compared with `main`: 51 packages added, 0 removed, 0 version changes, all under `@radix-ui/` and all resolved from `registry.npmjs.org`. Besides the five approved direct packages it contains their transitive dependencies (`react-dialog`, `react-visually-hidden`, `number`, and nested copies of `primitive`, `react-context`, `react-primitive`, `react-slot` and others). The large line diff (about 1180 added, 154 removed) is npm re-nesting existing entries, not upgrades. `package.json` gains exactly the five approved lines. Necessary: yes.

**Verification.** `npm run lint`, `npx tsc --noEmit` and `npm run build` pass. Headless Chrome (playwright-core installed outside the repo, system Chrome) against the live database with disposable rows: **27/27** workflow checks (R7 empty-name rejection and collection creation, note create, edit, save and reload persistence, tags add and remove, two-tag AND filter, search combined with tags, all empty states, collection moves with the selection staying active, the three-way unsaved-changes dialog, note and collection deletion, no console errors) and **17/17** responsive checks (widths 1400, 1199, 1000 and 600, toggle, close button, Escape, backdrop, choosing a view, tag filter from the overlay, resizing across the breakpoint). Test-script mistakes (ambiguous selectors) aborted two early runs and left test rows, which were removed with SQL; the responsive re-run of the 27-check suite then left two unused test tags (see below).

**Accepted exception to the R1.1 grep.** `components/tutorial/fetch-data-steps.tsx` (starter tutorial code) still calls `supabase.from('notes').select()`. It is imported only by `app/protected/page.tsx`, a starter page that `CLAUDE.md` says stays untouched and unused and that requires a login. It is not part of the notes app. Not changed; an R1.1 grep over `components/` will list it, so this is documented here and in `CLAUDE.md`.

**Final error-handling verification (33/33 PASS after one fix).** Controlled failures with headless Chrome against the running app; disposable `ZZ` notes only.
- *Load error.* The initial requests were aborted (network failure) and then answered with an HTTP 500 carrying a fake "internal secret detail" message. Both show the page-level error alert with the generic "Something went wrong. Please try again." and a "Try again" button; no list or editor is rendered, the demo banner stays, and no raw error text, SQLSTATE or server detail leaks. After the failure was removed, "Try again" loaded all 8 notes and the error state disappeared.
- *`not_found` recovery.* A disposable note was created and selected in the UI, then deleted directly in the database (behind the UI's back), and the next action was attempted from the UI: save, move to another collection, add a tag, and delete. In every case the user sees "That item no longer exists. Refresh and try again.", the list and sidebar re-sync (the note is gone, 8 notes), the editor returns to "No note selected", no card stays highlighted, no "Unsaved changes" indicator remains, and another note can be selected immediately afterwards.
- *Defect found and fixed:* when adding a tag to a vanished note, the message was shown only inside the tag editor, which is unmounted by the re-sync, so the user saw the note disappear with no explanation (1 of 33 checks failed). `attempt()` in `components/notes/notes-app.tsx` now also shows the `not_found` message in the page-level alert. The re-run passed 33/33.
- *Note on the selection state:* the stale `selectedNoteId` is kept in state, but the editor and highlight derive from a lookup by id, so nothing invalid is shown; identity ids are never reused, so it cannot attach to a different note.
- *Not simulated:* an HTTP error during a later (non-initial) write other than `not_found` uses the same page-level alert path; it was exercised only through `not_found`.

**Test-data cleanup (2026-10-13, approved).** Verified read-only first: exactly `zzt1` (id 24, created 13:25:31 by the responsive re-run) and `zzt2` (id 25), both without links and the only `zz`-named rows in notes, collections or tags. Deleted only those two with a guarded statement (`where (id, name) in ((24,'zzt1'),(25,'zzt2')) and no note_tags`). Afterwards: 8 notes, 3 collections, 4 tags (`prompting`, `rag`, `evaluation`, `agents`) and 7 note-tag links, no `ZZ` rows. Sequence gaps from tests remain.

**Remaining MVP limitations (accepted).** No tag deletion or renaming in the UI (unused tags accumulate; the module has no delete-tag function). No permanent automated test suite: the browser checks were run by scripts that are not in the repo. Dark mode not tested. The mobile layout (below 768px) stays stacked, with no dedicated design. Lists are unpaged, so the documented Data API row cap (default 1000) applies. Not tested on a real touch device. The earlier accepted risks (open anonymous access, writable `user_id`, non-atomic `addTagToNote`) are unchanged.

### PR #2 reviews: `/code-review`, `/comprehensive-review:full-review` and a fresh session (2026-10-13)

**How they were run.** (1) Built-in `/code-review 2` (forked agent, PR diff). (2) The installed third-party plugin, headless: `claude -p "/comprehensive-review:full-review ..." --security-focus` with review-only permissions; the earlier PR #1 report directory was moved aside first so the run started clean (83 raw findings: 0 Critical, 1 High, 28 Medium, 54 Low, roughly 55 distinct; reports in the git-ignored `.full-review/`; its own `npm audit`, `tsc` and `lint` were blocked by its sandbox, so I ran them: `npm audit --omit=dev` reports 0 vulnerabilities). (3) A fresh-session review, a separate headless `claude -p` process with no shared context, told only to review `gh pr diff 2`, read `CLAUDE.md`, and not read `REFLECTION.md` or `.full-review/`; it was given the focus list but no earlier findings. Each reviewer was asked to focus on CRUD correctness, filtering and search, collection assignment, unsaved-changes protection, error recovery, the responsive sidebar, the data-access architecture and security. All three agreed that the AND filter, search, collection filtering, empty states and the data-access rules are correct and that no secret or XSS path exists.

**Confirmed defects (fixed in a separate commit; each re-tested, 12/12 new browser checks, and the 27, 17 and 33 check suites re-run):**

| Finding | Found by | Verification | Fix |
|---|---|---|---|
| Text typed while a save is in flight is replaced by the saved text and the editor says "All changes saved"; a late response could also overwrite another note's draft | all three | Read `save()`; reproduced by delaying the PATCH 1.5s and typing | The draft is replaced only if it still equals what was sent |
| After deleting a collection, a failed refetch leaves its notes pointing at the deleted collection (they vanish from Uncollected and the collection Select goes blank) | all three | Read `removeCollection`; reproduced by aborting the GETs after the DELETE | Notes are patched to Uncollected locally first; the refetch only corrects `updated_at` |
| Unsaved edits are lost on reload, tab close or Back | all three | Read the code (guard covered only in-app switching) | `beforeunload` handler while dirty; a real reload prompted, a clean page did not |
| A collection view whose collection vanished stays selected; "New note" then repeats a foreign-key `not_found` | fresh session | Reproduced by deleting the collection in the database and saving | The view falls back to "All notes" when its collection no longer exists |
| A new note is created and selected but hidden by an active tag filter or search | fresh session, plugin | Reproduced with a tag filter and a non-matching query | Creating a note clears the search and tag filters |
| Escape also closes the sidebar overlay when it was meant for the delete dialog; the overlay closes behind the unsaved-changes dialog even when cancelled, and stays open when the already-selected note is clicked | `/code-review`, plugin, fresh session | Reproduced Escape; read `selectNote` | Escape ignored while a dialog is open or when default-prevented; the overlay closes only once the switch proceeds (and when the current note is clicked) |
| The Delete buttons stay clickable during a slow delete, so a second click produces a spurious "no longer exists" | `/code-review` | Read the code; checked the button state during a delayed DELETE | Note Delete and collection-delete buttons are disabled while a delete runs |
| `next start` binds all interfaces, undermining the "localhost only" precondition of the accepted anon risk | plugin | Same cause as the `next dev` finding in PR #1 | `"start": "next start -H 127.0.0.1"` |
| Docs overstated or omitted: local-state update, tag changes not bumping `updated_at`, unsaved-changes limits, "only `use-notes-data.ts` imports the module" (components also import constants and `NotesDbError`) | plugin, fresh session | Read the docs | `ARCHITECTURE.md` and `CLAUDE.md` corrected; the Radix packages are named in `CLAUDE.md` |

**Reviewer claims not accepted as defects.** `/code-review` "memoisation is pointless because the hook returns a new object" is true but a micro-cost with no failure; left. "`newNote` can leave `creating` stuck": `act` catches everything and `open` cannot throw, so not reachable. The `maxLength={NAME_MAX * 2}` on name inputs is deliberate (it counts UTF-16 units, the server counts code points; the real limit is enforced with a friendly message). `/code-review` quoted the limit as 30; it is 50.

**Accepted or deferred (not fixed here).** No automated tests or CI (the plugin's one High finding: `lib/notes-view.ts` is the natural first target; needs approval for a test dependency such as vitest). Lost updates across two tabs (`updateNote` matches on `id` only). A refresh can apply an older snapshot over a newer local change (low, narrow window). Sidebar overlay has no focus trap, `role="dialog"` or `inert`. `notes-app.tsx` is large and should be split before `feature/note-count-badges`. Per-keystroke re-render and filter cost, unbounded `listNotes`, `addTagToNote` round trips, `latest` version ranges and `eslint-config-next` 15 against Next 16, security headers, `app/error.tsx`, `.gitignore` missing `.env.development` and `.env.production`, no `supabase/config.toml`. A tag add that fails after creating the tag leaves the tag out of local state until reload.

### Outstanding technical checks
1. ~~Run the rollback rehearsal~~ (done, passed). ~~Apply the migrations~~ (done). ~~REST smoke test~~ (done, 31/31). ~~`lib/notes-db.ts` implemented and runtime-tested~~ (33/33). ~~Notes UI feature~~ built and visually approved on `feature/notes-ui` (next: commit, PR, review, merge).
2. Revisit hardening `rls_auto_enable()` later (for example before deployment or when auth is added), after testing on a branch database whether `EXECUTE` is checked when the event trigger fires.
3. ~~Third-party review command~~ (`/comprehensive-review:full-review` installed and run on PR #1) and ~~fresh-session review~~ (headless, separate context) are done. Remaining: confirm with the course that both count, then merge PR #1.
4. ~~Compare shadcn/ui, GitHub Primer and Material UI~~ decided: shadcn/ui + Tailwind (Feature 2 above).
5. ~~Delete the two leftover test tags~~ (done); decide later whether to add tag deletion.
(The earlier item "make the new-table migrations revoke default privileges" is done and applied in the temporary anon migration.)
