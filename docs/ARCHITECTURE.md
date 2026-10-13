# Architecture: Notes Lab MVP

Status: **database schema, temporary access policies, `lib/notes-db.ts` and the three-column notes UI are implemented (2026-10-13); the notes UI is on `feature/notes-ui` until its PR is merged.** `REFLECTION.md` records what was verified.

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
| Next.js app (`/notes` route) | `app/notes/page.tsx` is a thin server shell; `components/notes/` is the three-column client UI (sidebar / notes list / editor) built with shadcn/ui | Implemented |
| `components/notes/use-notes-data.ts` | Loads notes, collections and tags once, calls `lib/notes-db.ts` and patches state with the returned rows; the only UI file that imports the module | Implemented |
| `lib/notes-view.ts` | Pure in-memory view logic: collection view, AND tag filter, live search, ordering (no Supabase) | Implemented |
| `lib/notes-db.ts` | The only module that talks to Supabase for notes data | Implemented and used by the UI |
| supabase-js (browser client, `lib/supabase/client.ts`) | Data API client | Existing |
| Supabase PostgreSQL (cloud) | Storage, migrations in `supabase/migrations/` | Existing project; 4 tables applied (migrations `…094205`, `…094206`, `…094208`) |

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

### Implemented behaviour and responsive layout (decided 2026-10-13)

- **Wide desktop (1200px and up):** three columns of 240px (sidebar), 360px (notes list) and the remaining width (editor). Each column scrolls on its own. Editor content is centred and limited to 900px.
- **Medium (768 to 1199px):** the collections sidebar is collapsible so the list and editor keep the width. It is hidden by default and opened with a toggle button in the notes-list header; it then appears as a 260px overlay with a close button. It also closes on Escape, a backdrop click, or when a collection or note is chosen. The list stays 360px.
- **Below 768px:** the columns simply stack, with the sidebar always visible and no toggle. A dedicated mobile design is **not** part of the MVP (accepted).
- **Editing:** explicit Save button with an "Unsaved changes" indicator. Switching notes with unsaved changes asks "Save and switch", "Discard changes" or "Cancel". The selected note stays selected when saving changes its list position (selection is by id).
- **`updated_at`:** every note update, including moving a note between collections, bumps `updated_at` (the trigger has no `when` clause); the list is re-sorted locally by `updatedAt` then `id`, descending. Deleting a collection reloads the notes so their new `updated_at` values show.
- **Deleting:** notes and collections are deleted after a confirmation dialog; deleting a collection keeps its notes (they become Uncollected).
- **Not in this feature:** tag colours, tag deletion, collection renaming, count badges (next branch).

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
- `tags` uniqueness: unique indexes on `(user_id, lower(btrim(name))) nulls not distinct` for both `tags` and `collections`, so anonymous users cannot create duplicates that differ only by case or surrounding spaces. This requires Postgres 15+; the linked project reports 17.11 (`supabase/.temp/postgres-version`), so it is supported. Re-check if the project is ever recreated.
- **`updated_at` (course requirement R2), decided:** a PostgreSQL `before update` trigger on `notes` sets `updated_at = now()`, so it stays correct regardless of which client writes and `notes-db.ts` never sends it. The column defaults to `now()` on insert. The trigger function `set_updated_at()` is created in the schema migration.
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

### Current state (applied and verified against the live database, 2026-10-13)

- 11 migrations are applied (Postgres 17.11). `public` holds `notes`, `collections`, `tags` and `note_tags`, all with RLS enabled (not forced).
- **Policies:** exactly 16, named `TEMP anon <operation> <table>`, one per operation and table, each `to anon, authenticated` with `using (true)` / `with check (true)`. The two older `notes` select policies were dropped.
- **Grants:** `anon` and `authenticated` hold only `SELECT, INSERT, UPDATE, DELETE` on the four tables and no sequence privileges. Supabase's default privileges (`TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN` for `anon`, `authenticated` and `service_role` on every new table created by `postgres`) were revoked for `anon` and `authenticated` by the temp migration. `TRUNCATE` is not subject to RLS, so **every new table needs its own `revoke all` first** (see `CLAUDE.md`).
- **`public.rls_auto_enable()`:** a Supabase-provided `SECURITY DEFINER` function, owned by `postgres`, used by the `ensure_rls` event trigger that enables RLS on new tables in `public`. It is executable by `anon` and `authenticated` (through the default `PUBLIC` privilege), which the security advisor flags as two warnings. Restricting it was **deferred**; see `REFLECTION.md`.

### Policy approach (as applied)

- A **dedicated migration** (e.g. `…_temp_anon_access.sql`) holds all `to anon, authenticated` CRUD policies and grants for the four tables, and nothing else. Policies are named `TEMP anon …`, and the file carries a header comment explaining why it exists and when to delete it.
- Schema and RLS-enablement migrations create no `anon` policies or grants.
- The old "everyone" and duplicate select policies are replaced, leaving one policy set per table.
- `anon` gets nothing outside these four tables. The service-role key is never used.
- Table checks limit the size of what anonymous users can write (see section 3).
- Per the Supabase RLS guide ([docs/SUPABASE_REFERENCES.md](./SUPABASE_REFERENCES.md)), policies do not remove existing grants and access needs both a policy and a grant. The temp migration therefore starts with `revoke all` on each table from `anon` and `authenticated` (removing the default `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN`), then grants only `select, insert, update, delete`, with one policy per operation and the role named in `to`. Any new function, such as the `updated_at` trigger function, is `SECURITY INVOKER` with a fixed `search_path`, and has `EXECUTE` revoked from `public`.

### Risks accepted while anonymous access is enabled

- The publishable key ships in the browser bundle, so **anyone with the project URL and key can read, create, modify or delete any row**. RLS policies with `using (true)` provide no protection against them.
- Size limits only cap the size of writes; they do not prevent spam or deletion.
- No audit trail and no attribution of rows.
- **"Localhost only" limits the app, not the database.** The Supabase Data API is on the internet, so anyone who obtains the project URL and key can call it from anywhere. Mass deletion, defacement and filling the database with rows are all possible and are accepted risks; the key is also readable by anyone who can load the app's pages.
- `npm run dev` binds to `127.0.0.1` only (`next dev -H 127.0.0.1`). The default binds to all interfaces and prints a LAN "Network" URL, which would let other devices on the same network load the page and read the key. This was confirmed by running the default `next dev` during the PR review.
- This is acceptable **only** for localhost development with non-sensitive data. Deploying, sharing the key or publishing it would turn it into a real exposure.
- **Kill switch:** a new migration that drops the `TEMP anon` policies and runs `revoke all` on the four tables from `anon` and `authenticated`. The app then becomes fully closed until owner policies exist.
- Lists in `notes-db.ts` are not paged. The Data API's row cap (default 1000, project setting not checked) would silently truncate them, so keep the sample data small or add paging before the data grows.

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
9. **Checklist from the PR #1 review (all additional to steps 2 to 5):**
   - `authenticated` also holds the TEMP grants and policies. With the template's sign-up pages, anyone who signs up can read and change every row until the TEMP policies are dropped, so drop them in the same migration that adds owner policies.
   - Foreign-key checks bypass RLS. The `note_tags` insert policy must check ownership of both the note and the tag, and `notes` needs a check that `collection_id` belongs to the same owner, otherwise a user could reference another user's rows. Add a cross-owner test.
   - Review the backfill: `where user_id is null` adopts every row written during the anonymous window, including rows planted by others.
   - Restrict who can write `user_id` (and `created_at`) with column-level grants, or the owner policy's `with check` on `user_id`, so rows cannot be attributed to someone else.
   - Replace the "demo mode" assumptions: paging for large lists and the row-cap behaviour.

Steps 2 to 5 and the checklist in step 9 are the schema or policy changes; component logic does not change.

## 7. Requirements traceability

How this architecture supports the 12 course requirements (R) and the evaluation criteria (E) in [PROJECT_BRIEF.md](./PROJECT_BRIEF.md). "Gap" means the document needs a decision or a change before implementation.

| Req | Supported by | Status |
|---|---|---|
| R1 | `lib/notes-db.ts` as the only supabase-js access point (section 4) | Implemented. `app/notes/page.tsx` no longer queries Supabase. One accepted exception remains: the starter's `components/tutorial/fetch-data-steps.tsx` (used only by the unused `/protected` page) still calls `supabase.from('notes')`; see `REFLECTION.md`. |
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

Dependencies (existing in `package.json`): Next.js (`latest`, uses the `proxy.ts` convention; **read `node_modules/next/dist/docs/` before writing code**, per `AGENTS.md`), React 19, TypeScript, Tailwind CSS 3.x, `@supabase/supabase-js` and `@supabase/ssr` (`latest`), and shadcn/ui primitives in `components/ui`. **UI library (decided): shadcn/ui + Tailwind CSS**, no other UI library. The notes UI added five Radix packages (`@radix-ui/react-alert-dialog`, `-collapsible`, `-scroll-area`, `-select`, `-separator`); the components were written in the repo's existing style against `@/lib/utils`. Everything else adds no new dependencies.
