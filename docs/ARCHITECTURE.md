# Architecture: Notes Lab MVP

Status: **approved design, not yet implemented.** No migrations, policies or application code described here exist yet, except where marked "existing".

Related: [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)

## 1. Guiding principles

- **Simplest thing that works:** reuse the existing Next.js project and Supabase configuration; add no new services.
- **Client-side data layer:** data is loaded once; collection selection, AND tag filtering and live search run in memory.
- **No authentication in the MVP, but auth-ready:** anonymous access lives only in temporary database policies. The schema and application code do not depend on it.
- **One data-access point:** all database access goes through `lib/notes-db.ts`.

## 2. System components and data flow

### Components

| Component | Role | Status |
|---|---|---|
| Next.js app (`/notes` route) | Three-column client UI: collections and tags / notes list / editor | `/notes` exists as a read-only list; UI to be built |
| `lib/notes-db.ts` | The only module that talks to Supabase for notes data | To be created |
| supabase-js (browser client, `lib/supabase/client.ts`) | Data API client | Existing |
| Supabase PostgreSQL (cloud) | Storage, migrations in `supabase/migrations/` | Existing project; 4 tables to be added |

**Not needed:** custom backend or API routes, auth flows, Realtime, Storage, Edge Functions, ORM, state-management library, search service, any external service. The template's `/auth/*` and `/protected` pages stay untouched and unused.

### Data flow

```
User ─► React client components (/notes) ─► lib/notes-db.ts ─► supabase-js (browser client) ─► PostgREST ─► Postgres
            ▲                                                                                              │
            └──────────────── typed rows returned, local state updated ◄───────────────────────────────────┘
```

1. `/notes` loads once: all notes (with their tag ids), collections and tags.
2. Filtering and search operate on that in-memory list: collection, then AND tag filter, then case-insensitive search over title and body. This gives instant results with no per-keystroke queries.
3. Each write goes through `notes-db.ts`, then local state is updated with the returned row.

### UI structure (decided)

Three columns, with a shared note-card component:

- **Left sidebar:** "All notes" and "Uncollected", expandable collections each listing their notes as cards with tag chips (R6, R9), the create-collection control (R7), and the tag filter. Count badges (optional task) sit on collection rows.
- **Middle:** the filtered and searchable notes list (collection selection, AND tag filter and live search combined), rendered with the same note-card component, plus the search box and the empty states.
- **Right:** the note editor (title, body, collection assignment, tags).

The sidebar tree and the middle list read from the same in-memory state, so a change in one shows in the other at once.

## 3. Database schema and relationships

```
collections (id, name, created_at, user_id)
     │ 1
     ▼ many
notes (id, title, body, collection_id → collections.id ON DELETE SET NULL,
       created_at, updated_at, user_id)
     │ 1
     ▼ many
note_tags (note_id → notes.id ON DELETE CASCADE,
           tag_id  → tags.id  ON DELETE CASCADE,  PK (note_id, tag_id))
     ▲ many
     │ 1
tags (id, name, color null, user_id)
```

- A note belongs to at most one collection; `collection_id` null means uncategorised.
- Notes and tags are many-to-many through `note_tags`.
- **AND filter:** a note matches when it has every selected tag (`selected.every(id => note.tagIds.includes(id))`).
- **Existing:** `public.notes(id, title, body, created_at)`. Its content column stays `body`. It needs `collection_id` and `updated_at` added, plus `user_id`.
- **Colour-coded tags (optional, first priority):** the nullable `tags.color` column is included from the start so no later schema change is needed.

### Auth-ready ownership design

- `user_id uuid null references auth.users(id) on delete cascade default auth.uid()` on `collections`, `notes` and `tags`.
- For anonymous callers `auth.uid()` is null, so rows are created unowned. Once someone is signed in, the database sets the owner.
- `note_tags` has no `user_id`; its future policies check ownership through the parent note.
- `tags` uniqueness: `unique nulls not distinct (user_id, name)`, so anonymous users cannot create duplicate tags. This requires Postgres 15+; the linked project reports 17.11 (`supabase/.temp/postgres-version`), so it is supported. Re-check if the project is ever recreated.
- **`updated_at` (course requirement R2), decided:** a PostgreSQL `before update` trigger on `notes` sets `updated_at = now()`, so it stays correct regardless of which client writes and `notes-db.ts` never sends it. The column defaults to `now()` on insert. The trigger function is created in the schema migration (not yet written).
- **Course table requirements, decided:** `collections` has the required `id`, `name`, `created_at` plus the nullable `user_id`. The extra column stays nullable for future authentication compatibility, so inserting a name alone works (R3).
- Indexes on `notes(collection_id)`, `note_tags(tag_id)` and the `user_id` columns.
- Size limits (abuse mitigation, see section 5): title ≤ 200 characters, body ≤ 20,000, tag and collection names ≤ 50.
- RLS is enabled on all four tables.

## 4. Centralised database access module: `lib/notes-db.ts`

- It is the **only** file allowed to call `supabase.from(...)` for notes data. Components never query Supabase directly.
- **Single client seam:** an internal `getClient()` returns the existing browser client. Changing the client later (server client, authenticated session) means editing this one function.
- **Never reads or writes `user_id`.** Exported `Note`, `Collection` and `Tag` types omit it, and select lists are explicit rather than `*`. The database default sets ownership and future RLS policies filter reads, so no query needs `.eq('user_id', …)`.
- **No role or auth references:** no anon checks, no `getUser()` calls, no signed-out branches.
- **Uniform errors:** each function returns data or throws a typed `NotesDbError` with a user-safe message, so raw Postgres messages stay out of the UI.

Planned API:

| Area | Functions |
|---|---|
| Notes | `listNotes` (with tag ids), `createNote`, `updateNote`, `deleteNote`, `setNoteCollection` |
| Collections | `listCollections`, `createCollection`, `deleteCollection` (rename optional) |
| Tags | `listTags`, `addTagToNote` (find or create the tag, then insert into `note_tags`), `removeTagFromNote` (tag colour update optional) |

## 5. Temporary anonymous access and security risks

### Current state (verified against the live database, read-only, 2026-10-13)

- All 8 local migrations are applied on the remote project (Postgres 17.11). The only table in `public` is `notes` (3 seed rows), with the columns `id`, `title`, `body`, `created_at`. It has none of the planned columns (`updated_at`, `collection_id`, `user_id`) and no triggers.
- **RLS:** enabled on `notes` (not forced).
- **Policies:** exactly two, both `SELECT` with `using (true)`: `Authenticated users can view notes` (role `authenticated`) and `Notes are viewable by everyone` (role `public`, so it covers `anon` as well). There are no insert, update or delete policies.
- **Grants:** `anon` and `authenticated` each hold `SELECT` plus `REFERENCES`, `TRIGGER` and `TRUNCATE` (and, on Postgres 17, `MAINTAIN`). The migration only grants `SELECT`; the other privileges come from Supabase's default privileges, which give `anon`, `authenticated` and `service_role` `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` on every table created by `postgres`. `INSERT`, `UPDATE` and `DELETE` are not granted, so writes are denied both by the missing grants and by the missing policies.
- Consequence: **every new table will arrive with these extra privileges**. `TRUNCATE` is not subject to RLS, so the migrations for the four new tables must `revoke all` from `anon` and `authenticated` first and then grant only the needed privileges (`select, insert, update, delete`). Whether `TRUNCATE` is reachable through the Data API has not been tested; the revoke removes the question.
- **`public.rls_auto_enable()`:** a Supabase-provided `SECURITY DEFINER` function, owned by `postgres`, used by the `ensure_rls` event trigger that enables RLS on new tables in `public`. It is executable by `anon` and `authenticated` (through the default `PUBLIC` privilege), which the security advisor flags as two warnings. See REFLECTION.md for the investigation and the recommended restriction, which belongs in a later migration.

### Planned policy approach (not yet created)

- A **dedicated migration** (e.g. `…_temp_anon_access.sql`) holds all `to anon, authenticated` CRUD policies and grants for the four tables, and nothing else. Policies are named `TEMP anon …`, and the file carries a header comment explaining why it exists and when to delete it.
- Schema and RLS-enablement migrations do not mention `anon`.
- The old "everyone" and duplicate select policies are replaced, leaving one policy set per table.
- `anon` gets nothing outside these four tables. The service-role key is never used.
- Table checks limit the size of what anonymous users can write (see section 3).
- Per the Supabase RLS guide ([docs/SUPABASE_REFERENCES.md](./SUPABASE_REFERENCES.md)), policies do not remove existing grants and access needs both a policy and a grant. The temp migration therefore starts with `revoke all` on each table from `anon` and `authenticated` (removing the default `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN`), then grants only `select, insert, update, delete`, with one policy per operation and the role named in `to`. Any new function, such as the `updated_at` trigger function, is `SECURITY INVOKER` with a fixed `search_path`, and has `EXECUTE` revoked from `public`.

### Risks accepted while anonymous access is enabled

- The publishable key ships in the browser bundle, so **anyone with the project URL and key can read, create, modify or delete any row**. RLS policies with `using (true)` provide no protection against them.
- Size limits only cap the size of writes; they do not prevent spam or deletion.
- No audit trail and no attribution of rows.
- This is acceptable **only** for localhost development with non-sensitive data. Deploying, sharing the key or publishing it would turn it into a real exposure.
- **Kill switch:** drop the temp migration's policies and revoke the anon grants. The app then becomes read-only or fully closed.

### Rules while anonymous access is on

- Use only generic, non-sensitive sample data (for example "Prompt engineering basics", "What is RAG?"). No real personal notes, names or credentials.
- Keep seed data in its own file or migration so it is easy to remove. The existing seed rows (Shopping list, Meeting notes, Ideas) are harmless but should be replaced with journal-themed samples.
- Show a small "Demo mode: data is publicly accessible, don't store private notes" banner, implemented as a single constant that is easy to delete.
- Keep `.env.local` out of Git (already covered by `.env*.local` in `.gitignore`), never put a service-role or secret key in the project, and add `supabase/.temp/` to `.gitignore` before committing.

## 6. Future authentication migration plan

1. **Enable sign-in:** create the user or enable sign-up with email confirmation. The existing `/auth/*` pages can be used.
2. **Backfill:** `update … set user_id = '<owner uuid>' where user_id is null` on `collections`, `notes` and `tags`.
3. **Constrain:** `alter column user_id set not null` on all three tables.
4. **Replace policies:**
   - Drop the `TEMP anon` policies and revoke the anon grants.
   - Add owner policies `to authenticated using ((select auth.uid()) = user_id)` with matching `with check`; the `select` wrapper lets Postgres cache the call per query.
   - For `note_tags`, check ownership through the parent note.
5. **Protect the route:** remove the `/notes` exemption in `lib/supabase/proxy.ts` so unauthenticated visitors are redirected to login.
6. **Client:** swap `getClient()` only if a server client is needed; the existing browser client already carries the session.
7. **Clean-up:** remove the demo banner and replace the test data.
8. **Verify:** two users cannot see each other's rows, and an anonymous request returns nothing.

Steps 2 to 5 are the only schema or policy changes; no component logic changes.

## 7. Requirements traceability

How this architecture supports the 12 course requirements (R) and the evaluation criteria (E) in [PROJECT_BRIEF.md](./PROJECT_BRIEF.md). "Gap" means the document needs a decision or a change before implementation.

| Req | Supported by | Status |
|---|---|---|
| R1 | `lib/notes-db.ts` as the only supabase-js access point (section 4) | Supported. The existing `app/notes/page.tsx` queries Supabase directly through the server client; it must be replaced or routed through the module. |
| R2 | `notes` table with `updated_at` (section 3) | Supported; `updated_at` is maintained by a PostgreSQL trigger (decided). |
| R3 | `collections(id, name, created_at, user_id)` | Supported; the extra `user_id` stays nullable (decided). |
| R4 | `notes.collection_id`, nullable FK, `ON DELETE SET NULL` | Supported. |
| R5 | `tags` and `note_tags` with composite PK | Supported. |
| R6 | `listNotes` plus `listCollections`, grouped in memory; "Uncollected" is `collection_id is null` | Supported. UI split decided: sidebar tree with notes, middle filtered list, shared note card. |
| R7 | `createCollection` | Supported. |
| R8 | `setNoteCollection` | Supported. |
| R9 | `addTagToNote`, `removeTagFromNote`, tag objects resolved from `listTags` for the cards | Supported. |
| R10 | In-memory AND filter over each note's tag ids | Supported. |
| R11 | In-memory search over title and body combined with the tag filter | Supported. |
| R12 | Derived from the same in-memory filters | Supported; the UI must distinguish empty collection, no search results and no tag match. |
| E1–E4 | Existing project (App Router, TypeScript, Tailwind, supabase-js, no auth, local only) | Supported. See the version note below. |
| E5 | Migrations in `supabase/migrations/` | Supported once the schema migrations are written. |
| Optional: count badges | Counts derived in memory from the loaded notes, so they update instantly on create, move and delete, with an "Uncollected" count | Supported; no extra queries or schema. |
| E6–E9, E12, E13 | Git and PR workflow (PROJECT_BRIEF section 8) | Process, not architecture. No Git remote is configured yet (approval needed before the first PR). |
| E10 | `CLAUDE.md` with the Supabase conventions and database access rules | Supported: `CLAUDE.md` created with the rules; keep it updated. |
| E11 | Cited reference in `docs/` | Supported: `docs/SUPABASE_REFERENCES.md` has source URLs at the top. |

**Version note:** `next` 16.4.0 is installed (it uses `proxy.ts`), while `package.json` pins `eslint-config-next` to 15.3.1 and Tailwind to 3.x. This is not a requirement conflict, but it is worth checking that linting works.

## 8. Technical dependencies and decisions

| Decision | Rationale | Trade-off |
|---|---|---|
| Client-side data layer with in-memory filtering and search | Simplest; instant live search; fits a small single-user journal | Whole dataset loads into the browser; stops being suitable at thousands of notes. Postgres `ilike` or full-text search can be added inside `notes-db.ts` later |
| Server Actions not used | Adds a layer with little benefit at this size | None for the MVP |
| Temporary anon policies isolated in one migration | Required because there is no auth but writes are needed; removal is a single migration | Real exposure if the key leaks (section 5) |
| `updated_at` via a PostgreSQL trigger | Correct for any client; no application code involved | One more database object to maintain |
| Three-column UI with a shared note-card component | Meets R6/R9 (notes and tags in the sidebar) and keeps the agreed layout | Sidebar tree and middle list show overlapping notes, kept in sync from one state |
| Nullable `user_id` with `default auth.uid()` | Makes the later ownership migration a backfill plus policy swap | Slightly more schema now |
| Existing auth pages kept untouched and unused | Smallest diff; ready for the future migration | Dead code in the meantime |
| PostgREST embedding for joins; counts computed in memory | No extra queries needed for note count badges | None at this scale |

Dependencies (existing in `package.json`): Next.js (`latest`, uses the `proxy.ts` convention; **read `node_modules/next/dist/docs/` before writing code**, per `AGENTS.md`), React 19, TypeScript, Tailwind CSS 3.x, `@supabase/supabase-js` and `@supabase/ssr` (`latest`), and the starter template's shadcn/Radix primitives in `components/ui`, which are present but not a decision. **The UI component library is undecided:** shadcn/ui, GitHub Primer and Material UI will be compared before the Notes UI is implemented, and the choice may add a dependency. Everything else adds no new dependencies.
