# Project Brief: Notes Lab

**Notes Lab – Notes App with Collections and Search**

Course: Turing College Mid-Sprint Project, "Notes App with Collections and Search".

## 1. Purpose

Notes Lab is a personal notes application, primarily intended as an **AI Learning Journal**: a place to capture what is learned while studying and working with AI, organise it, and find it again quickly.

## 2. Product Vision

A fast, focused, modern notes app where writing, organising and retrieving notes feel effortless. Notes are grouped into collections, labelled with tags, and findable instantly through live search and tag filtering. The interface keeps navigation, the notes list and the editor visible at the same time, so nothing gets in the way of capturing and revisiting ideas.

## 3. Target Users

- **Primary:** the author, using the app as a personal AI Learning Journal.
- **Secondary:** learners and reviewers evaluating the project against the Turing College requirements.

Single-user, no accounts.

## 4. Functional Scope

### 4.1 Mandatory requirements

The official course list has 12 mandatory requirements. All must be met; each has testable acceptance criteria in section 6.1.

| # | Requirement |
|---|-------------|
| R1 | All database reads and writes use supabase-js through one centralised helper module. |
| R2 | The `notes` table contains at least `id`, `title`, `body`, `created_at`, `updated_at`. |
| R3 | The `collections` table contains `id`, `name`, `created_at`. |
| R4 | Notes belong to zero or one collection: `notes.collection_id` is a nullable foreign key referencing `collections`. |
| R5 | Tags use two tables, `tags` and `note_tags`; notes and tags are many-to-many. |
| R6 | The sidebar displays expandable collections. Selecting a collection expands it and shows its notes. Unassigned notes appear under "All notes" or "Uncollected". |
| R7 | Users can create named collections directly from the sidebar. |
| R8 | Users can assign notes to collections; changes persist in Supabase. |
| R9 | Users can add and remove tags on notes; tags appear on note cards in the sidebar. |
| R10 | Users can filter notes by multiple tags; only notes containing **all** selected tags are shown. |
| R11 | Live search filters note titles and body content as the user types, combined with active tag filters. |
| R12 | Clear empty-state messages appear for empty collections, searches without results, and unmatched tag filters. |

Beyond the 12 requirements, the app also needs basic **notes CRUD** (create, read, update, delete of title and plain-text body), which the requirements assume.

### 4.2 Course evaluation criteria (mandatory)

| # | Criterion |
|---|-----------|
| E1 | Next.js App Router, TypeScript and Tailwind CSS. |
| E2 | Supabase with the supabase-js client. |
| E3 | Runs locally with `npm run dev`. |
| E4 | No authentication and no deployment. |
| E5 | Database tables created in Supabase with correct relationships. |
| E6 | At least one optional task, completed in its own feature branch and pull request. |
| E7 | At least two feature branches, with their PRs merged. |
| E8 | At least one third-party slash command run on a PR diff before merging, with one finding documented in `REFLECTION.md`. |
| E9 | At least one PR diff reviewed in a fresh Claude Code session, with one finding documented. |
| E10 | `CLAUDE.md` kept up to date with Supabase conventions and the centralised database access rules. |
| E11 | At least one cited Supabase or supabase-js reference in `docs/`, with the source URL at the top. |
| E12 | Meaningful commit messages. |
| E13 | `.env.local` is never committed. |

### 4.3 Optional task

**Chosen optional task: note count badges.** Each collection in the sidebar shows the number of notes it contains, and the count updates when notes are created, deleted or moved between collections. It is built in its own feature branch and PR (E6). Acceptance criteria are in section 6.3.

Other optional ideas, only if time permits after the above:
1. **Colour-coded tags**: each tag has a colour shown wherever the tag appears. (Previously the first priority; the course-preferred badge task now comes first.)
2. **Renaming collections.**

### 4.4 UI

Modern **three-column layout**:

- **Left (sidebar):** "All notes" and "Uncollected", expandable collections with their notes (R6), the tag filter, and note cards showing their tags (R9).
- **Middle:** notes list reflecting the selected collection, active tag filters and the search query.
- **Right:** note editor.

*Decided:* the sidebar tree shows notes (with their tags) under their collection, the middle column shows the filtered and searched results, and both use a shared note-card component where appropriate. See ARCHITECTURE.md, section 2.

### 4.5 Technology

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- supabase-js

### 4.6 Existing setup

Reuse the existing `notes-lab` project and its Supabase configuration. Do not start a new project or a new Supabase setup.

### 4.7 Security constraints

The MVP has no authentication, so the database is temporarily reachable by anonymous (`anon`) clients. The following constraints apply until authentication is added. Details are in [ARCHITECTURE.md](./ARCHITECTURE.md).

- **Environment:** the app runs locally on `localhost:3000` against a cloud-hosted Supabase project. It is not deployed, shared or published.
- **Non-sensitive data only:** use generic sample data. Never store real personal notes, names or credentials while anonymous access is enabled.
- **Anonymous access is temporary and isolated:** the anon read/write policies live in one dedicated migration, named and commented as temporary, and are the only place that mentions `anon`. Removing that migration closes anonymous access.
- **Accepted risk:** anyone with the project URL and publishable key can read, modify or delete rows in the four app tables. This is acceptable only for local development with non-sensitive data.
- **Abuse limits:** size limits on titles, bodies, and tag and collection names.
- **Keys:** only the publishable key is used in the browser. A service-role or secret key must never be added to the project or to any `NEXT_PUBLIC_` variable. `.env.local` stays out of Git, and `supabase/.temp/` is ignored via `.gitignore`.
- **Demo-mode notice:** the UI shows a notice that data is publicly accessible while anonymous access is on.
- **Auth-ready design:** the schema has a nullable `user_id` (default `auth.uid()`) on `notes`, `collections` and `tags`. All database access goes through `lib/notes-db.ts`, which never reads or writes `user_id` and has no role or auth logic. The existing auth pages stay untouched and unused.
- **Future migration:** adding authentication is a backfill plus a policy swap (see ARCHITECTURE.md, section 6), with no change to application logic.

## 5. Exclusions (Out of Scope)

- Rich-text editing (plain text only)
- Authentication
- AI features
- File uploads
- Public sharing
- Deployment

## 6. Acceptance Criteria

Each criterion is written so it can be checked individually, by inspection of the code or database, or by a manual test in the running app.

### 6.1 Course requirements R1–R12

**R1: centralised supabase-js access**
- R1.1 `lib/notes-db.ts` exists and is the only file that imports a Supabase client for notes, collections or tags data (`grep` finds no other `.from(` calls on those tables under `app/` or `components/`).
- R1.2 Every read and write in the running app (list, create, update, delete, assign, tag, filter data loading) works through functions exported from that module.
- R1.3 The existing direct query in `app/notes/page.tsx` is removed or routed through the module.

**R2: notes table**
- R2.1 `public.notes` has columns `id`, `title`, `body`, `created_at`, `updated_at`.
- R2.2 `updated_at` is set on creation and changes whenever a note's title or body is edited (check by editing a note and comparing the value).

**R3: collections table**
- R3.1 `public.collections` has columns `id`, `name`, `created_at`.
- R3.2 Any additional columns (the nullable `user_id`) are nullable or defaulted, so inserting `name` alone succeeds.

**R4: note to collection relationship**
- R4.1 `notes.collection_id` is a nullable foreign key referencing `collections.id`.
- R4.2 A note can be saved with no collection; inserting a `collection_id` that does not exist is rejected.
- R4.3 Deleting a collection leaves its notes in place as unassigned (shown under "Uncollected").

**R5: tags and note_tags**
- R5.1 `public.tags` and `public.note_tags` exist; `note_tags` references both `notes` and `tags` with foreign keys.
- R5.2 The same tag can be attached to several notes and a note can have several tags; attaching the same tag to a note twice is rejected.
- R5.3 Deleting a note or a tag removes the related `note_tags` rows.

**R6: expandable collections in the sidebar**
- R6.1 The sidebar lists every collection; each can be expanded and collapsed.
- R6.2 Selecting a collection expands it and shows exactly the notes assigned to it.
- R6.3 Notes without a collection appear under "All notes" or "Uncollected".
- R6.4 "All notes" shows every note regardless of collection.

**R7: create collections from the sidebar**
- R7.1 The sidebar has a control to enter a name and create a collection without leaving the page.
- R7.2 The new collection appears in the sidebar immediately and is still there after a reload.
- R7.3 Empty or whitespace-only names are rejected with a visible message.

**R8: assign notes to collections**
- R8.1 From the editor or note card, a note can be assigned to a collection, moved to another, or set to none.
- R8.2 The sidebar updates immediately to show the note in its new place.
- R8.3 After a page reload, the assignment is unchanged (verified in the Supabase table).

**R9: add and remove tags**
- R9.1 A user can add a tag to a note, either by choosing an existing tag or typing a new name.
- R9.2 A user can remove a tag from a note without deleting the tag from other notes.
- R9.3 Tags appear on each note card in the sidebar and update immediately after adding or removing.
- R9.4 Tag changes persist after a page reload.

**R10: multi-tag AND filter**
- R10.1 The user can select more than one tag as a filter.
- R10.2 With tags A and B selected, only notes that have both A and B are shown (a note with only A is hidden).
- R10.3 Deselecting a tag widens the result; deselecting all restores the unfiltered list.

**R11: live search**
- R11.1 Typing in the search box filters notes on each keystroke, with no submit action.
- R11.2 A match in the title or in the body is enough for a note to appear; matching is case-insensitive.
- R11.3 Search combines with active tag filters: only notes that match the query **and** have all selected tags are shown.
- R11.4 Clearing the search box restores the list for the current filters.

**R12: empty states**
- R12.1 An empty collection shows a clear message (for example, "No notes in this collection yet").
- R12.2 A search with no matches shows a message that includes or refers to the query.
- R12.3 A tag filter combination that matches no notes shows a message that no notes carry all selected tags, with a way to clear the filters.

### 6.2 Course evaluation criteria

- E1: the project uses the Next.js App Router (`app/` directory), TypeScript and Tailwind CSS.
- E2: all data access uses `@supabase/supabase-js` (via the existing client helpers).
- E3: `npm run dev` starts the app, which loads on `localhost:3000` without errors.
- E4: no login flow is used by the notes app and nothing is deployed.
- E5: the four tables and their foreign keys exist in the Supabase project, created through migrations in `supabase/migrations/`.
- E6: the optional task (note count badges) lives in its own feature branch and PR.
- E7: at least two feature branches exist, each merged through a PR (see section 8).
- E8: a third-party slash command was run on a PR diff before that PR was merged, and one finding is documented in `REFLECTION.md`.
- E9: one PR diff was reviewed in a fresh Claude Code session, and one finding is documented in `REFLECTION.md`.
- E10: `CLAUDE.md` exists and describes the Supabase conventions and the centralised database access rules (`lib/notes-db.ts`), and is updated when those rules change.
- E11: at least one file in `docs/` cites a Supabase or supabase-js reference, with its source URL at the top of the file.
- E12: commit messages are meaningful (describe what changed and why; no "update" or "wip" messages).
- E13: `git ls-files` never lists `.env.local`, and `git log --all -- .env.local` is empty.

### 6.3 Optional task: note count badges

- Each collection in the sidebar shows a badge with the number of notes it contains (also for "Uncollected" and "All notes").
- Creating a note in a collection increases that badge by one.
- Moving a note between collections decreases the old badge and increases the new one.
- Deleting a note decreases its collection's badge.
- Deleting a collection moves its count into "Uncollected".
- A collection with no notes shows `0`.
- Badge values match the number of rows in `notes` for each `collection_id`, including after a page reload.

### 6.4 Notes CRUD and general behaviour

- A user can create a note, view it, edit its title and plain-text content, and delete it.
- Changes persist in Supabase and remain after a page reload.
- Deleting a note removes it from the list and clears the editor.
- The three-column layout is implemented and usable at desktop widths.
- The app builds without errors.

### 6.5 Security and architecture

- All notes data access goes through `lib/notes-db.ts`; components do not call Supabase directly.
- Anonymous access policies exist only in the dedicated temporary migration, and only on the four app tables.
- No service-role or secret key appears in the code, the browser bundle or Git; `.env.local` is ignored by Git.
- Only non-sensitive sample data is stored, and the demo-mode notice is visible.

### 6.6 Other optional features (when implemented)

- **Colour-coded tags:** a tag's colour can be set and is displayed consistently in the sidebar, list and editor.
- **Renaming collections:** a collection can be renamed and the new name persists.

## 7. Working Agreements

- The architecture and security plan are documented in [ARCHITECTURE.md](./ARCHITECTURE.md).
- Mandatory requirements come first; optional work starts only after all R1–R12 criteria pass, except where the optional branch is prepared in parallel.
- Scope changes are recorded in this document.

## 8. Delivery Plan and Git/PR Workflow

### 8.1 Order of work

1. **Planning commit on `main`:** only `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, `REFLECTION.md`, `.gitignore` and `CLAUDE.md`. Also in `docs/`, `SUPABASE_REFERENCES.md` is a new planning file and needs approval to be included (see section 9). Other pending files (migrations, `/notes` page, `package*.json`, tooling) are committed separately.
2. **Feature branch 1, `feature/db-schema-and-helper`:** schema migrations (four tables, constraints, `updated_at` handling), the `updated_at` trigger, the temporary anon-access migration, seed data and `lib/notes-db.ts` with types. `CLAUDE.md` (E10) already exists from the planning commit and is updated here if the rules change.
3. **Feature branch 2, `feature/notes-ui`:** three-column UI, notes CRUD, collections in the sidebar, assignment, tags, AND filter, live search, empty states, demo-mode notice (R6–R12).
4. **Feature branch 3 (optional task), `feature/note-count-badges`:** the badge feature (E6).
5. **Documentation:** `docs/SUPABASE_REFERENCES.md` (E11) is already written, with its source URLs at the top, and is extended when new Supabase behaviour is used.

Each branch is merged through its own PR (E7). Branch 3 satisfies E6.

### 8.2 Review workflow

- **Before merging at least one PR:** run a third-party slash command on its diff, and record one real finding (what it flagged and what was done) in `REFLECTION.md` (E8).
- **In a fresh Claude Code session:** review at least one PR diff and record one real finding in `REFLECTION.md` (E9).
- Only findings that actually occurred are recorded; none are written in advance.

### 8.3 Commit and secret rules

- Meaningful, descriptive commit messages (E12), for example `feat(db): add collections and tags tables with note relations`.
- Never stage `.env.local` (E13). Check `git status` before every commit.
- No commit is created until the pre-commit review of the files has been approved.

## 9. Decisions and Open Items

### Resolved

| # | Decision |
|---|----------|
| Q1 | Keep the three-column layout: left = expandable collections with their notes and tags; middle = filtered, searchable notes list; right = editor. Shared note-card component where appropriate. |
| Q2 | `notes.updated_at` is maintained by a PostgreSQL trigger. |
| Q3 | `collections.user_id` stays nullable for future authentication compatibility. |
| Q4 | Recommended review command for E8: `/code-review` (built-in, reviews a PR number, branch or diff and reports correctness findings). `/security-review` is a good second choice for the PR that adds the anon-access migration. Not executed yet. See the note below. |
| Q5 | No GitHub remote is configured (`git remote -v` is empty). The GitHub CLI (`gh`) is installed and logged in. No repository has been created or pushed. |
| Q6 | The first planning commit contains only `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, `REFLECTION.md`, `.gitignore` and `CLAUDE.md`. |

*Note on Q4:* the course wording "third-party slash command" is not defined in the material I have. `/code-review` ships with Claude Code and is not written by this project; the personal `pr-review` skill is the user's own and probably does not count as third-party. Confirm what the course accepts.

### Still needing approval

- Whether `docs/SUPABASE_REFERENCES.md` goes in the first planning commit (Q6 does not list it, but E11 needs it in `docs/`).
- Whether a GitHub repository is created and a remote added, and when (needed before the first PR).
- Whether `/code-review` is accepted as the third-party command for E8.
