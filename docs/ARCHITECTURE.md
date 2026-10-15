# Architecture: Notes Lab MVP

Status (2026-10-15): the Mid-Sprint MVP is **implemented and merged to `main`** (PRs #1 to #6): schema with colours, `lib/notes-db.ts`, the three-column notes UI with count badges and colours, Google and email/password sign-in, post-login navigation and the display-only sign-in status. **Feature 7 (server-side route protection, per-user ownership, secure RLS) is implemented and verified on `feature/user-data-isolation-rls` and is not merged yet**; it is described in **section 4b** and supersedes the anonymous-access design of section 5. `REFLECTION.md` records what was verified and how.

**Active scope: Turing Sprint 2** ([PROJECT_BRIEF.md](./PROJECT_BRIEF.md) Part A). How to read this document: sections 1 to 4a and 6 to 8 describe the Mid-Sprint design (with dated notes where Feature 7 changed it); **section 4b is the current security architecture**; **section 5 is historical** (the temporary anonymous access, no longer in the database); section 9 holds the Sprint 2 features that are **not implemented** (Features 8 to 10) and must not be read as current behaviour.

Related: [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)

## 1. Guiding principles

- **Simplest thing that works:** reuse the existing Next.js project and Supabase configuration; add no new services. *[Dated note 2026-10-15: this describes the implemented Mid-Sprint architecture. For Sprint 2, Supabase Storage is planned for Feature 10 (section 9.4); it is not implemented.]*
- **Client-side data layer:** data is loaded once; collection selection, AND tag filtering and live search run in memory.
- **Notes are private per user (Feature 7, section 4b):** `/notes` needs a verified user and the database allows each account to reach only its own rows. *[Mid-Sprint wording, now superseded: "notes are not user-protected, but auth-ready; anonymous access lives only in temporary policies".]* The notes code stays auth-free; the database does the work.
- **One data-access point:** all database access goes through `lib/notes-db.ts`.

## 2. System components and data flow

### Components

| Component | Role | Status |
|---|---|---|
| Next.js app (`/notes` route) | `app/notes/page.tsx` is a thin server shell; `components/notes/` is the three-column client UI (sidebar / notes list / editor) built with shadcn/ui | Implemented |
| `components/notes/use-notes-data.ts` | Loads notes, collections and tags once, calls `lib/notes-db.ts` and patches state with the returned rows; the only UI file that calls its data functions (components also import its constants and `NotesDbError` type for limits and messages) | Implemented |
| `lib/notes-view.ts` | Pure in-memory view logic: collection view, AND tag filter, live search, ordering (no Supabase) | Implemented |
| `lib/notes-db.ts` | The only module that talks to Supabase for notes data | Implemented and used by the UI |
| supabase-js (browser client, `lib/supabase/client.ts`) | Data API client | Existing |
| Supabase PostgreSQL (cloud) | Storage, migrations in `supabase/migrations/` | Existing project; 4 tables applied (migrations `…094205`, `…094206`, `…094208`) |

**Not needed:** a custom backend, Realtime, Storage, Edge Functions, ORM, state-management library, search service, any external service beyond Supabase Auth with the Google provider (Feature 5). The only route handlers are the starter's `/auth/confirm` and the new `/auth/callback`; the starter's other `/auth/*` pages and `/protected` are otherwise unchanged. *[Dated note 2026-10-15: this is the implemented architecture. **Current:** Supabase Storage is not implemented and not used. **Planned:** Storage is required for Feature 10 (Image uploads, Sprint 2), see section 9.4. The "not needed" list above is the historical Mid-Sprint statement and is kept.]*

### Data flow

```
User ─► React client components (/notes) ─► lib/notes-db.ts ─► supabase-js (browser client) ─► PostgREST ─► Postgres
            ▲                                                                                              │
            └──────────────── typed rows returned, local state updated ◄───────────────────────────────────┘
```

1. `/notes` loads once: all notes (with their tag ids), collections and tags.
2. Filtering and search operate on that in-memory list: collection, then AND tag filter, then case-insensitive search over title and body. This gives instant results with no per-keystroke queries.
3. Each write goes through `notes-db.ts`, then local state is updated with the returned row. Deleting a collection patches its notes to Uncollected locally and then re-syncs everything (to pick up their new `updated_at`); a `not_found` error (a row vanished, for example in another tab) also triggers a re-sync, and a collection view whose collection is gone falls back to "All notes".

### UI structure (decided)

Three columns, with a shared note-card component:

- **Left sidebar (280px):** a "Notes Lab" header with a blue app icon, a primary blue "New note" button (the notes-list header keeps its own New note button, shown only at medium widths where the sidebar is collapsed), the "All notes" row, a "Collections" section and a "Tags" section. Each section heading has a small "+" button that opens an inline create form (`createCollection`; `createTag`, a standalone tag with no note). "Uncollected" is the first row under Collections, followed by the collections as plain selectable rows (coloured folder icon that opens the colour menu, name, neutral count, delete button overlaying the row on hover). Tags are vertical rows (colour dot that opens the colour menu, name that toggles the filter, neutral usage count). The selected view or active tag has a soft blue background. There is no expand/collapse tree: notes are listed only in the middle column (scope change, see PROJECT_BRIEF R6 and R9).
- **Colours and counts in the UI (Feature 4 and 3):** collection rows show a coloured folder icon, tag rows a coloured dot, tag badges in the list and editor are soft-coloured, and the list header and editor collection select show the folder colour. Count badges (totals from `countNotes` and `countTagUses` in `lib/notes-view.ts`, memoised on `notes`, independent of tag filter and search) stay neutral gray. Colours change through `components/notes/color-swatch-menu.tsx` (a Radix dropdown with a 4 x 2 swatch grid), always a separate button from the name, so clicking a name keeps its action. `components/notes/sidebar-panel.tsx` holds the responsive wrapper (overlay, backdrop, close button, Escape).
- **Notes list and editor:** list rows are separated by thin lines with a soft blue selected row (title, two-line preview, tag badges left, date right). The editor header shows the saved/unsaved line and Delete, Cancel (reverts the draft to the last saved text) and Save (the title appears only in the Title field); below it are labelled fields: Title \*, Collection and Tags side by side, and Content \* (a plain-text area; rich text is out of scope [dated note 2026-10-15: out of scope in Mid-Sprint; the rich-text editor is now the planned Feature 8, section 9.2, and is not implemented]), with the existing tags offered only while the Tags field is focused or typed in (arrow keys move into the list, Escape closes it, a click outside closes it), and "Last saved" (from `updatedAt`, shown only when it parses) and the character counter underneath.
- **Middle:** the filtered and searchable notes list (collection selection, AND tag filter and live search combined), rendered with the same note-card component, plus the search box and the empty states.
- **Right:** the note editor (title, body, collection assignment, tags).

The sidebar tree and the middle list read from the same in-memory state, so a change in one shows in the other at once.

### Implemented behaviour and responsive layout (decided 2026-10-13)

- **Wide desktop (1200px and up):** three columns of 280px (sidebar), 420px (notes list) and the remaining width (editor), following `docs/design/notes-lab-original-mockup.png`. Each column scrolls on its own. Editor content is centred and limited to 1100px. A shared top bar over columns 2 and 3 holds the search field (and, at medium widths, the sidebar toggle and a New note button). The app background is a light gray (`--app`, #F3F5F8); the sidebar, notes list and editor are three separate white surfaces with 12px gaps, 12px radii and thin borders, without shadows.
- **Medium (768 to 1199px):** the collections sidebar is collapsible so the list and editor keep the width. It is hidden by default and opened with a toggle button in the top bar next to the search field; it then appears as a 260px overlay with a close button. It also closes on Escape, a backdrop click, or when a collection or note is chosen. The list stays 360px.
- **Below 768px:** the columns simply stack, with the sidebar always visible and no toggle. A dedicated mobile design is **not** part of the MVP (accepted). **Known limitation (follow-up task):** in this stacked layout the editor row is about 2px high, so a note cannot be edited below 768px; the fix is to let the page scroll on small screens, which changes the mobile layout and is not part of Feature 4.
- **Editing:** explicit Save button with an "Unsaved changes" indicator. Switching notes with unsaved changes asks "Save and switch", "Discard changes" or "Cancel". The selected note stays selected when saving changes its list position (selection is by id).
- **`updated_at`:** every note update, including moving a note between collections, bumps `updated_at` (the trigger has no `when` clause); the list is re-sorted locally by `updatedAt` then `id`, descending. Deleting a collection reloads the notes so their new `updated_at` values show. Adding or removing a tag changes `note_tags`, not the note row, so it does **not** bump `updated_at`.
- **Unsaved changes:** protected when switching notes or creating a new one (dialog) and on reload, tab close or Back (browser `beforeunload` prompt while the draft is dirty). A save never overwrites text typed while it was in flight. There is no draft persistence and no conflict detection: two tabs editing the same note overwrite each other (last write wins).
- **Deleting:** notes and collections are deleted after a confirmation dialog; deleting a collection keeps its notes (they become Uncollected).
- **Not in this feature:** tag deletion, collection renaming. (Count badges and colours were added in later features, see below.)

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
tags (id, name, color, user_id)        collections (… color …) likewise
```

- A note belongs to at most one collection; `collection_id` null means uncategorised.
- Notes and tags are many-to-many through `note_tags`.
- **AND filter:** a note matches when it has every selected tag (`selected.every(id => note.tagIds.includes(id))`).
- **Existing:** `public.notes(id, title, body, created_at)`. Its content column stays `body`. It needs `collection_id` and `updated_at` added, plus `user_id`. *[Status corrected 2026-10-15: these columns were added by the applied migrations of PR #1; `user_id` was nullable until Feature 7 made it `not null` (section 4b).]*
- **Colours (Feature 4):** `collections.color` and `tags.color` are `text not null default 'slate'` with a CHECK against eight palette keys (`slate, red, amber, green, teal, blue, violet, pink`). The database stores the key, never a hex value. Migration `add_palette_colors` replaced the earlier hex check on `tags.color`, added the collections column and gave existing rows distinct colours (collections blue, green, amber; tags violet, teal, pink, red, by id). No grants or policies changed: the existing temporary update policies cover the new column. `lib/palette.ts` maps each key to full Tailwind class strings (soft 100/800 badge, 500 dot, 600 folder, dark variants) and picks the least-used colour for new items; `lib/notes-db.ts` validates keys (`setCollectionColor`, `setTagColor`, optional colour on create) and maps unknown values to slate. `tailwind.config.ts` scans `lib/` so those class names are generated.

### Auth-ready ownership design (Mid-Sprint; the ownership is now enforced, see section 4b)

- `user_id uuid references auth.users(id) on delete cascade default auth.uid()` on `collections`, `notes` and `tags`. *[Mid-Sprint: nullable. Since the Feature 7 migration (2026-10-15) it is `not null`.]*
- *[Historical: with anonymous access, `auth.uid()` was null and rows were created unowned. Today `anon` cannot write at all and the database sets the owner for every signed-in insert.]*
- `note_tags` has no `user_id`; its policies check ownership through the parent note and tag (section 4b).
- `tags` uniqueness: unique indexes on `(user_id, lower(btrim(name))) nulls not distinct` for both `tags` and `collections`, so one owner cannot create duplicates that differ only by case or surrounding spaces; two different users may use the same name (to be confirmed by the optional test S2-X4). This requires Postgres 15+; the linked project reports 17.11 (`supabase/.temp/postgres-version`), so it is supported. Re-check if the project is ever recreated.
- **`updated_at` (course requirement R2), decided:** a PostgreSQL `before update` trigger on `notes` sets `updated_at = now()`, so it stays correct regardless of which client writes and `notes-db.ts` never sends it. The column defaults to `now()` on insert. The trigger function `set_updated_at()` is created in the schema migration.
- **Course table requirements, decided:** `collections` has the required `id`, `name`, `created_at` plus the nullable `user_id`. The extra column stays nullable for future authentication compatibility, so inserting a name alone works (R3). *[Mid-Sprint decision; since Feature 7 `user_id` is `not null` with the default `auth.uid()`, so a signed-in insert of a name alone still works.]*
- Indexes on `notes(collection_id)`, `note_tags(tag_id)` and the `user_id` columns.
- Size limits (abuse mitigation, see section 5): title ≤ 200 characters, body ≤ 20,000, tag and collection names ≤ 50.
- RLS is enabled on all four tables.

## 4. Centralised database access module: `lib/notes-db.ts`

- It is the **only** file allowed to call `supabase.from(...)` for notes data. Components never query Supabase directly.
- **Single client seam:** an internal `getClient()` returns the existing browser client. Changing the client later (server client, authenticated session) means editing this one function.
- **Never reads or writes `user_id`.** Exported `Note`, `Collection` and `Tag` types omit it, and select lists are explicit rather than `*`. The database default sets ownership and future RLS policies filter reads, so no query needs `.eq('user_id', …)`.
- **No role or auth references:** no anon checks, no `getUser()` calls, no signed-out branches.
- **Uniform errors:** each function returns data or throws a typed `NotesDbError` with a user-safe message, so raw Postgres messages stay out of the UI.

Planned API: *[dated note 2026-10-15: the heading is from the design phase; these functions are implemented in `lib/notes-db.ts`, including `createTag`, `setCollectionColor` and `setTagColor`; collection rename and tag deletion are not.]*

| Area | Functions |
|---|---|
| Notes | `listNotes` (with tag ids), `createNote`, `updateNote`, `deleteNote`, `setNoteCollection` |
| Collections | `listCollections`, `createCollection` (optional colour), `setCollectionColor`, `deleteCollection` (rename optional) |
| Tags | `listTags`, `createTag` (a tag on its own, optional colour), `addTagToNote` (find or create the tag, optional colour for a new tag, then insert into `note_tags`), `removeTagFromNote`, `setTagColor` |

## 4b. Route protection, per-user ownership and secure RLS (Feature 7, IMPLEMENTED)

Implemented and applied on 2026-10-15 (branch `feature/user-data-isolation-rls`, migration `supabase/migrations/20261015130030_enforce_owner_access.sql`, live 13:31 UTC). Verified by 18 automated two-account tests, owner-reported browser tests and database checks; `REFLECTION.md` has the evidence and its limits. It supersedes section 5.

### Server-side route protection

- **Deny by default.** `lib/auth/protected-routes.ts` lists the public paths only: `/`, `/auth/*` and the starter's `/login` prefix. Every other path, including `/notes` and `/protected`, needs a verified user. Paths that try to dress up as public ones (dot segments, encoded slashes or dots, backslashes, control characters) are treated as private.
- **Layer 1, the proxy (`lib/supabase/proxy.ts`):** an early, optimistic redirect to `/auth/login` when the verified claims (`getClaims()`) do not identify a user. It also refreshes the session cookies and keeps cookie changes on the redirect.
- **Layer 2, the page decides.** `app/notes/page.tsx` calls `requireUser()` (`lib/auth/require-user.ts`) inside `<Suspense>` (required by `cacheComponents`) before it renders `NotesApp`, so a signed-out request is redirected and never receives the notes UI. The fallback carries no data. `redirect()` is never inside try/catch. The proxy is not relied on alone.
- **What counts as a user.** `hasVerifiedUser`: verified claims with a non-empty `sub` that are not an anonymous sign-in (anonymous sign-ins also carry the `authenticated` database role).

### Authentication and session handling

- Supabase Auth with cookie sessions via `@supabase/ssr` (PKCE). Google (section 4a) and email/password both end on `/notes`. No application data is kept in `localStorage` or `sessionStorage` (S2-R3.7: code review plus the owner's Safari check).
- `getClaims()` verifies the token signature and refreshes a token near expiry; the server client is created per request.
- **Session loss in the UI.** If the database refuses a request because the session is gone (`NotesDbError` kind `forbidden`), the notes UI asks the server to re-check once (`lib/auth/session-loss.ts`, re-armed after a successful request); the server check then redirects to the sign-in page. Verified by deleting the authentication cookie; natural token expiry was **not** tested.
- The display-only header status (section 4a) is unchanged and decides nothing.

### The four secured tables

`notes`, `collections`, `tags` and `note_tags`, all with RLS enabled. `anon` has **no** privileges and no policies; the 16 `TEMP anon …` policies were dropped and `revoke all … from anon, authenticated` ran on all four tables before the grants below.

### Ownership

- `user_id uuid not null default auth.uid()` on `notes`, `collections` and `tags`: the database sets the owner from the signed-in session, and `lib/notes-db.ts` still never reads or writes it.
- `note_tags` has no `user_id`; ownership comes from its parents.
- Existing data was never assigned to a user: after a verified backup and the owner's explicit approval it was deleted (M6, then the final cleanup on 2026-10-15; the four tables are empty), so the migration needed no backfill. The cleanup scripts are the approved exception `supabase/maintenance/` (see `CLAUDE.md`): not migrations, inert by default, one atomic statement guarded by fingerprints, never touching `auth.*`.

### RLS policies (14, all `to authenticated`, `(select auth.uid())` evaluated once per statement)

| Table | Policies |
|---|---|
| `notes` | select, insert, update, delete: `user_id` is the caller; insert and update `with check` also require `collection_id` to be null or a collection of the caller |
| `collections` | select, insert, update, delete: `user_id` is the caller |
| `tags` | select, insert, update: `user_id` is the caller (no delete policy: the app never deletes tags) |
| `note_tags` | select and delete: the note belongs to the caller; insert: the note **and** the tag belong to the caller (no update policy) |

### Privileges (column-level where it matters)

- `authenticated`: `select` on all four; `notes` insert and update only `title, body, collection_id`, delete; `collections` insert `name, color`, update `color`, delete; `tags` insert `name, color`, update `color`; `note_tags` insert `note_id, tag_id`, delete.
- Clients therefore cannot write `user_id`, `id`, `created_at` or `updated_at` (`updated_at` stays under the trigger). Writing an `id` is refused with SQLSTATE `428C9` because the identity columns are `generated always`, not `42501`.
- `anon`: nothing. `service_role` and the project-wide default privileges are untouched (`CLAUDE.md`).

### Cross-user protection

- Foreign-key checks bypass RLS, so the policies must check references: a note cannot point at another user's collection, and a `note_tags` row needs the caller's own note and own tag. The migration starts with a guard that aborts if any row has no owner or any cross-owner reference exists.
- Tested with two real accounts (`npm run test:rls`, 18 tests, 22 independently evaluated cases): each account sees and changes only its own rows, cross-user reads, updates, deletes and links are refused or invisible, ownership cannot be reassigned, and `anon` reads and writes nothing.
- **Known limitation: the full migration chain cannot be replayed on a fresh database (unresolved, accepted for Sprint 2).** The historical seed migrations `20261012123644_seed_notes.sql` and `20261013094206_seed_sample_journal_data.sql` insert rows with `user_id` null (written while anonymous access was open, so `auth.uid()` was null). The Feature 7 migration starts with a guard that aborts when any row has no owner. *Why the live database works:* the approved cleanup (M6, 2026-10-15, 13:18 UTC) had emptied the four tables before the migration was applied at 13:31 UTC, so the guard found nothing and the migration succeeded. *Why a fresh reset may fail:* `supabase db reset` or a new project replays every migration in order, the seed rows exist when the Feature 7 migration runs, and its guard is expected to raise "rows without an owner exist", stopping the chain at that migration. This has not been tried (there is no local Supabase environment in this project), so it is reasoned from the migration text, not observed. *A future fix* must preserve the migration history and must not edit any already applied migration (`CLAUDE.md`): for example a new, later-dated approach that avoids creating ownerless seed data when a database is built from scratch, or a documented rebuild procedure that skips or removes the seed rows before the Feature 7 migration; the choice needs its own assessment and approval. Production data is not affected; only reproducibility from scratch is.
- **Not covered:** a restore from backup was not tested (M3); anonymous sign-ins and leaked-password protection are dashboard settings still to be checked; the same collection name for two users and a note deletion in the browser are not yet manually confirmed (see the brief).

## 5. Temporary anonymous access and security risks (HISTORICAL, superseded by section 4b)

> **Historical.** Everything below describes the temporary design of the Mid-Sprint project. The `TEMP anon` policies and grants no longer exist in the live database (dropped by the Feature 7 migration on 2026-10-15), the public `/notes` route and the demo banner are gone, and the risks listed here no longer apply. It is kept as the record of the earlier decision and its rationale.

### Current state (applied and verified against the live database, 2026-10-13)

- 12 migrations are applied (Postgres 17.11). `public` holds `notes`, `collections`, `tags` and `note_tags`, all with RLS enabled (not forced).
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
- This is acceptable **only** for localhost development with non-sensitive data. *[Dated note 2026-10-15: "localhost" here means the local machine; the project's required origin is `http://127.0.0.1:3000`, never the hostname `localhost` (see section 4a).]* Deploying, sharing the key or publishing it would turn it into a real exposure.
- **Kill switch:** a new migration that drops the `TEMP anon` policies and runs `revoke all` on the four tables from `anon` and `authenticated`. The app then becomes fully closed until owner policies exist.
- Lists in `notes-db.ts` are not paged. The Data API's row cap (default 1000, project setting not checked) would silently truncate them, so keep the sample data small or add paging before the data grows.

### Rules while anonymous access is on

- Use only generic, non-sensitive sample data (for example "Prompt engineering basics", "What is RAG?"). No real personal notes, names or credentials.
- Keep seed data in its own file or migration so it is easy to remove. The existing seed rows (Shopping list, Meeting notes, Ideas) are harmless but should be replaced with journal-themed samples. *[Dated note 2026-10-15: the journal-themed sample data was applied through the PR #1 migrations; its fate is an open decision for Feature 7 (PROJECT_BRIEF A10).]*
- Show a small "Demo mode: data is publicly accessible, don't store private notes" banner, implemented as a single constant that is easy to delete. *[Dated note 2026-10-15: the notice was removed once the temporary policies were replaced by owner-only RLS (Feature 7, M9 preparation); the file `components/notes/demo-banner.tsx` and its three uses in `notes-app.tsx` are gone, with a test that keeps them out.]*
- Keep `.env.local` out of Git (already covered by `.env*.local` in `.gitignore`), never put a service-role or secret key in the project, and add `supabase/.temp/` to `.gitignore` before committing.

## 4a. Google sign-in (Feature 5)

**Flow (PKCE, server-side completion).** (1) `components/google-sign-in-button.tsx` (on `/auth/login` and `/auth/sign-up`) calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: <origin>/auth/callback } })`. (2) Google authenticates the user and returns to **Supabase**. (3) Supabase returns to **our app** at `/auth/callback?code=…`. (4) `app/auth/callback/route.ts` creates the per-request server client and calls `exchangeCodeForSession(code)`; `@supabase/ssr` writes the session cookies; the handler answers with a relative `Location: /notes`. (5) `lib/supabase/proxy.ts` refreshes the session on later requests (unchanged; `/auth/*` was already exempt).

**Two different callbacks.**

| Leg | URL | Configured where |
|---|---|---|
| Google → Supabase | `https://<project-ref>.supabase.co/auth/v1/callback` (project ref from `NEXT_PUBLIC_SUPABASE_URL`) | Google Cloud: Authorized redirect URI |
| Supabase → app | `http://127.0.0.1:3000/auth/callback` | Supabase: Authentication → URL Configuration → Redirect URLs |

Also in Supabase: Site URL `http://127.0.0.1:3000`, and Authentication → Providers → Google enabled with the client ID and secret (stored only there). The origin is `127.0.0.1` throughout (`npm run dev` binds `-H 127.0.0.1`); cookies are per origin, so mixing it with `localhost` loses the session or falls back to the Site URL.

**Decisions.**
- The destination is fixed (`/notes`, `POST_LOGIN_PATH`; Feature 6 changed it from `/protected`); the callback ignores any `next` parameter. This is navigation only; access is decided by section 4b.
- Email/password login and a successful password update (`components/login-form.tsx`, `components/update-password-form.tsx`) also go to `POST_LOGIN_PATH`. Sign-up sets `emailRedirectTo` to `/auth/callback`, so a confirmation link that returns with a PKCE `?code=` is exchanged for a session there and ends on `/notes`; a failed or expired link goes to `/auth/login?error=…`. `/auth/confirm` (token-hash email templates) falls back to `/notes` when `next` is missing or unsafe. Which of the two the Supabase email template uses is a dashboard setting that the repo cannot show; both end on `/notes`.
- `/protected` remains available as the authentication test page.
- **Sign-in status in the notes header (Feature 6 extension).** `components/notes/auth-status.tsx` shows the signed-in email and a Logout button, or a Login link to `/auth/login` for anonymous visitors. *[Since Feature 7 `/notes` redirects signed-out visitors, so the Login link only appears if the session is lost while the page is open.]* It is rendered next to the "Notes Lab" title below 768px (email hidden, search field on its own full-width row) and at the end of `TopBar` from 768px up; CSS (`md:hidden` / `max-md:hidden`) hides the other instance, so both instances are mounted. A session in the browser is confirmed with `supabase.auth.getUser()` (validated by the Supabase Auth server, not just read from the cookie); `onAuthStateChange` drives updates, decided by `authEventAction` in `lib/auth/latest.ts`: `INITIAL_SESSION` replaces a separate first check, `TOKEN_REFRESHED` is ignored, no session clears the status, and `SIGNED_IN` or `INITIAL_SESSION` for the user already verified is ignored (auth-js re-emits `SIGNED_IN` whenever a tab regains focus and in other tabs, which would otherwise repeat the check); a new user id or `USER_UPDATED` re-checks. Races: `createLatestGate` in `lib/auth/latest.ts` lets only the newest check apply its result, and sign-out invalidates checks in flight; `identityAfterCheck` keeps the previous state on a transient error and fails closed to anonymous otherwise. When signed out there is no network request; when signed in, one `getUser()` on load (the two instances share the in-flight request) and another only when the user changes. Tab focus causes no request. Only the email is used, no tokens. Screen readers hear "Signed in as <email>" at every width; the visible address (768px and up) is `aria-hidden`. Logout reuses `components/logout-button.tsx` (`signOut()`, then `/auth/login`); its "Logging out…" and error states apply to every use of the button, including the starter pages. Display only: nothing in `lib/notes-db.ts` or the notes data flow depends on it.
- **Known limitation (logout error display).** auth-js clears the local session and emits `SIGNED_OUT` before it returns a network or server error from `signOut()`. In the notes header the component then switches to "Login" and unmounts the button, so "Logout failed" is not shown there (it is on the starter pages). The user is never shown as signed in after a failed logout, but the server-side token may not have been revoked. Accepted; no auth refactor for it.
- **Email confirmation errors.** The callback serves Google and email links, so the generic failure text is neutral ("Sign-in could not be completed. If you just confirmed your email, sign in with your password…"). `error_code=otp_expired` from Supabase selects the code `link_expired` (expired or already-used link). That parameter only selects text, it is never evidence of a sign-in. A link opened in another browser fails the PKCE exchange (no code verifier cookie there) and shows the neutral text; the email is confirmed and password login works.
- **Password recovery.** `/auth/confirm` sends a token-hash link of `type=recovery` to `/auth/update-password` (`confirmRedirectPath` in `lib/auth/redirect.ts`), whatever `next` says, so the password form is always shown; other types keep the validated `next` or `/notes`. The app's own forgot-password flow uses `redirectTo` = `/auth/update-password` directly and is unchanged. This was verified by automated tests only; the end-to-end recovery flow could not be retested after the change because of the Supabase email rate limit. No Supabase email-template change is required; a template that sends `{{ .SiteURL }}/auth/confirm?token_hash=…&type=recovery` works with or without `&next=`.
- **Accepted limitations (independent PR #6 review).** (L2) `/auth/confirm` still sends a failed token-hash verification to `/auth/error` with the Supabase message, so an expired token-hash link reads differently from the neutral `link_expired` text of `/auth/callback`; the message is URL-encoded, not reflected as HTML. (L3) The compact `LogoutButton` states ("Logging out…", "Logout failed") have no automated test (no component test framework); see also the logout error display limitation above.
- Failures redirect to `/auth/login?error=<code>` with a fixed code (`oauth_cancelled`, `oauth_failed`, `oauth_missing_code`, `link_expired`); `lib/auth/messages.ts` maps codes to text, so provider text is never displayed or reflected.
- Success depends only on the code exchange (`handleOAuthCallback` in `lib/auth/oauth-callback.ts`); an existing session never turns a failed exchange (invalid, used or replayed code) into a success. A failure goes to `/auth/login?error=oauth_failed`.
- The Google button refuses to start on `localhost` and tells the user to open `http://127.0.0.1:3000` (`lib/auth/dev-origin.ts`).
- The callback answers with a **relative** `Location`: in dev, `request.nextUrl.origin` reported `localhost` for a `127.0.0.1` request, which would have switched origins and dropped the cookies.
- `/auth/confirm` (starter, email links) now validates `next` with `safeRedirectPath` (`lib/auth/redirect.ts`): only absolute paths; the value is normalised against a fixed dummy base and the normalised path is checked and returned (no origin parameter); external, protocol-relative, backslash and control-character forms fall back to `/`. It also URL-encodes the error message.
- No new dependency, table, policy or grant. `lib/notes-db.ts` and the notes UI are unchanged.
- Tests: `npm run test:auth` (`scripts/test-auth.mts`, plain Node, no framework).

**What this did not do at the time (Mid-Sprint; superseded by Feature 7).** Signing in did not make notes private: `/notes` was open to `anon` and the `TEMP anon` policies gave every `authenticated` user full access to all rows. Since 2026-10-15 `/notes` requires a verified user and RLS isolates each account's rows (section 4b).

## 6. Authentication migration plan (HISTORICAL: executed as Feature 7, see section 4b)

> The plan below was written during the Mid-Sprint. It was carried out with one deliberate difference: instead of a backfill (step 2), the existing demo data was backed up and, with the owner's approval, deleted. Steps 3 to 5, 7, 8 and the checklist of step 9 are implemented.

1. **Enable sign-in:** done for Google and email/password (section 4a). Decide whether sign-up should be restricted, since any Google account can now become an `authenticated` user.
2. **Backfill:** `update … set user_id = '<owner uuid>' where user_id is null` on `collections`, `notes` and `tags`.
3. **Constrain:** `alter column user_id set not null` on all three tables.
4. **Replace policies:**
   - Drop the `TEMP anon` policies and revoke the anon grants.
   - Add owner policies `to authenticated using ((select auth.uid()) = user_id)` with matching `with check`; the `select` wrapper lets Postgres cache the call per query.
   - For `note_tags`, check ownership through the parent note.
5. **Protect the route:** remove the `/notes` exemption in `lib/supabase/proxy.ts` so unauthenticated visitors are redirected to login.
6. **Client:** swap `getClient()` only if a server client is needed; the existing browser client already carries the session.
7. **Clean-up:** remove the demo banner and replace the test data. *[Dated note 2026-10-15: the demo banner is removed and the demo and test data were deleted with the owner's approval (M6); see section 5 note and `REFLECTION.md`.]*
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
| R3 | `collections(id, name, created_at, user_id)` | Supported; the extra `user_id` stayed nullable in the Mid-Sprint (decided); `not null` since Feature 7. |
| R4 | `notes.collection_id`, nullable FK, `ON DELETE SET NULL` | Supported. |
| R5 | `tags` and `note_tags` with composite PK | Supported. |
| R6 | `listNotes` plus `listCollections`, grouped in memory; "Uncollected" is `collection_id is null` | Supported. UI split decided: sidebar tree with notes, middle filtered list, shared note card. *[Superseded by the Feature 4 scope change: the sidebar is a flat list and notes are listed only in the middle column, see section 2.]* |
| R7 | `createCollection` | Supported. |
| R8 | `setNoteCollection` | Supported. |
| R9 | `addTagToNote`, `removeTagFromNote`, tag objects resolved from `listTags` for the cards | Supported. |
| R10 | In-memory AND filter over each note's tag ids | Supported. |
| R11 | In-memory search over title and body combined with the tag filter | Supported. |
| R12 | Derived from the same in-memory filters | Supported; the UI must distinguish empty collection, no search results and no tag match. |
| E1–E4 | Existing project (App Router, TypeScript, Tailwind, supabase-js, no auth, local only) | Supported. See the version note below. *[Mid-Sprint wording: "no auth" is superseded by Sprint 2 and by Features 5 and 6 (section 4a); notes themselves are still not protected by user.]* |
| E5 | Migrations in `supabase/migrations/` | Supported once the schema migrations are written. *[Dated note 2026-10-15: written and applied (12 migrations, PRs #1 and #4); see section 5.]* |
| Optional: count badges | Counts derived in memory from the loaded notes, so they update instantly on create, move and delete, with an "Uncollected" count | Supported; no extra queries or schema. |
| E6–E9, E12, E13 | Git and PR workflow (PROJECT_BRIEF section 8) | Process, not architecture. No Git remote is configured yet (approval needed before the first PR). *[Status corrected 2026-10-15: the remote `origin` is `https://github.com/marcbecker1974/notes-lab` and PRs #1 to #6 are merged. It is the development repository; the final Turing submission location is pending.]* |
| E10 | `CLAUDE.md` with the Supabase conventions and database access rules | Supported: `CLAUDE.md` created with the rules; keep it updated. |
| E11 | Cited reference in `docs/` | Supported: `docs/SUPABASE_REFERENCES.md` has source URLs at the top. |

**Version note:** `next` 16.4.0 is installed (it uses `proxy.ts`), while `package.json` pins `eslint-config-next` to 15.3.1 and Tailwind to 3.x. This is not a requirement conflict, but it is worth checking that linting works.

## 8. Technical dependencies and decisions

| Decision | Rationale | Trade-off |
|---|---|---|
| Client-side data layer with in-memory filtering and search | Simplest; instant live search; fits a small single-user journal | Whole dataset loads into the browser; stops being suitable at thousands of notes. Postgres `ilike` or full-text search can be added inside `notes-db.ts` later |
| Server Actions not used | Adds a layer with little benefit at this size | None for the MVP |
| Temporary anon policies isolated in one migration *(historical, removed by Feature 7)* | Was required while there was no per-user data; removal was a single migration | Real exposure if the key leaked (section 5) |
| `updated_at` via a PostgreSQL trigger | Correct for any client; no application code involved | One more database object to maintain |
| Three-column UI with a shared note-card component | Meets R6/R9 (notes and tags in the sidebar) and keeps the agreed layout | Sidebar tree and middle list show overlapping notes, kept in sync from one state |
| Nullable `user_id` with `default auth.uid()` *(superseded: `not null` since Feature 7)* | Made the later ownership migration a policy swap | The data had to be deleted instead of backfilled |
| Owner-only RLS with column-level grants, proxy plus `requireUser()` (Feature 7) | The database enforces isolation whatever the client sends; the page does not depend on the proxy alone | Tags cannot be deleted by users; every new table needs the same pattern and a cross-user test |
| Google sign-in added to the starter's auth pages (Feature 5) | Reuses Supabase Auth and the existing SSR setup; no new dependency | Sign-in does not yet protect notes (section 4a) |
| PostgREST embedding for joins; counts computed in memory | No extra queries needed for note count badges | None at this scale |

Dependencies (existing in `package.json`): Next.js (`latest`, uses the `proxy.ts` convention; **read `node_modules/next/dist/docs/` before writing code**, per `AGENTS.md`), React 19, TypeScript, Tailwind CSS 3.x, `@supabase/supabase-js` and `@supabase/ssr` (`latest`), and shadcn/ui primitives in `components/ui`. **UI library (decided): shadcn/ui + Tailwind CSS**, no other UI library. The notes UI added five Radix packages (`@radix-ui/react-alert-dialog`, `-collapsible`, `-scroll-area`, `-select`, `-separator`); the components were written in the repo's existing style against `@/lib/utils`. Everything else adds no new dependencies.

## 9. Planned architecture for Sprint 2 (NOT IMPLEMENTED)

Everything in this section is a **plan** for the features in the [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) Part A roadmap. Except for 9.1 (Feature 7, now implemented, see section 4b), none of it exists in the code or the database today. Each feature gets its own architecture assessment before development; statements about Supabase behaviour below must be checked against the official documentation and added to `docs/SUPABASE_REFERENCES.md` when relied on. Written 2026-10-15; no verification of these plans has been done.

### 9.1 Feature 7: server-side route protection and per-user ownership (IMPLEMENTED, see section 4b)

The plan written on 2026-10-15 was carried out the same day; section 4b is the description of what exists. Differences from the plan: the page check is a Server Component call to `requireUser()` (the open design decision is settled: proxy plus page), the existing data was deleted with the owner's approval instead of being backfilled, and the unique name indexes are per owner (two users may share a name; the optional test S2-X4 would confirm it). Still open before the feature is complete: documentation and review steps, the commit, push, PR and merge (see the brief).

### 9.2 Feature 8: rich-text editor (additional product requirement)

- **Open decisions:** the editor library (an established, maintained one, none chosen, none installed), the content storage format, the heading levels and list controls (the mockup in `docs/design/` shows a toolbar but does not specify them), whether the code and full-screen buttons are required.
- **Data model impact:** `notes.body` is plain text with the check constraint `notes_body_length` (20,000 characters); a rich format is larger than its text, so the constraint and the format need a decision and a new migration (applied migrations are never edited). Existing plain-text notes must be preserved or safely migrated.
- **Search.** The in-memory search (`lib/notes-view.ts`) matches `title` and `body`; with rich content it needs a plain-text projection of the body.
- **Safe rendering.** User-generated content must not execute HTML or script; the approach (sanitising, or rendering from a structured document) is part of the library and format decision.
- **Mobile.** The editor is unreachable below 768px (see section 2); whether the fix is part of this feature is an open scope decision.

### 9.3 Feature 9: Markdown export (implemented; PR pending merge)

- **Implemented design (2026-10-15, owner-approved).** The editor's Export button downloads the **last saved version** of the selected note as a `.md` file (unsaved editor changes are not exported; the editor says so while changes are unsaved). The file is the title as an H1 followed by the body unchanged, with `\r\n` normalised to `\n`; no collection, tags or other metadata. The conversion is the pure module `lib/note-markdown.ts` (`noteToMarkdown`, `markdownFilename`: a readable file name with unsafe characters removed, Unicode kept, at most 200 UTF-8 bytes, Windows reserved names prefixed, fallback `note.md`). `components/notes/download-markdown.ts` triggers the native browser download (`Blob`, `URL.createObjectURL`, `<a download>`).
- **Security and data.** It reads no new data and makes no request: it uses the note already loaded in the browser, which RLS limits to the signed-in user's own rows. No database, Supabase, Auth, RLS or `lib/notes-db.ts` change. Workflow B.
- **Compatibility with Feature 8 (to revisit).** The body is exported as-is, which is correct only while it is plain text. If Feature 8 changes the note content format, the conversion in `lib/note-markdown.ts` must be revisited (OPT-1.2). Image references need a defined representation (Feature 10).

### 9.4 Feature 10: image uploads with Supabase Storage

- Images are stored as files in Supabase Storage, never as base64 in PostgreSQL. Private access (a private bucket, a per-user path or ownership record, policies on `storage.objects` for `authenticated`) is the intended direction; the details (bucket and policy design, how a note references an image, orphan and deletion handling, signed URLs or authenticated reads) are open and must be assessed before building.
- Per-user paths need the user id, which `lib/notes-db.ts` never touches: Storage access may use a separate dedicated module, subject to an approved architecture decision (`CLAUDE.md`, Database access rules); access to the existing tables stays in `lib/notes-db.ts`. Feature 10 (Workflow A) is selected and approved for planning only. It needs an architecture and security assessment in which the bucket configuration and the `storage.objects` access policies are reviewed explicitly. Creating buckets, changing Storage policies, installing dependencies, running migrations and changing Supabase configuration follow the existing workflow (assessment, then approval, then implementation). Schema and policy changes use version-controlled migrations where supported; an approved Supabase dashboard change is documented when a migration is not applicable. Any new table or policy follows the Supabase conventions in `CLAUDE.md`, and new dependencies and services still need explicit approval.
- **Current vs planned:** Storage is **not implemented** today; this subsection describes what Feature 10 is expected to need.

### 9.5 Not planned for Sprint 2

Account linking (FUT-1), deployment, public sharing, AI features.
