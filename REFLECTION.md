# Reflection

## Planning and Architecture Decisions

Status: planning only. Nothing described here has been implemented yet. Details are in [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

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

### Outstanding technical checks
1. Write the migration that revokes `rls_auto_enable()` execution, and verify with the advisor and a new-table test (not yet done).
2. Make the new-table migrations revoke the default extra privileges before granting (not yet done).
3. Confirm that the review command is acceptable to the course, and install it before use.
4. Compare shadcn/ui, GitHub Primer and Material UI and record the decision.
