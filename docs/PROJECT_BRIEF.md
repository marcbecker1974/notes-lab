# Project Brief: Notes Lab

**Notes Lab – Personal AI Development Journal**

> **Status (2026-10-15):** the active scope is the **Turing College Sprint 2 project**, "Full-Stack App with Database and Authentication" (Part A). The completed **Mid-Sprint project** ("Notes App with Collections and Search") is kept unchanged as a historical phase in Part B. This file is the **single source of truth** for active scope, requirements, acceptance criteria, requirement status, selected optional tasks, the feature roadmap, the verification checklist and the submission requirements. Nothing in Part A is implemented merely because it is written here: the traceability matrix (A7) says what is implemented and what is verified.

| Document | Responsibility |
|---|---|
| `docs/PROJECT_BRIEF.md` (this file) | Scope, requirements, acceptance criteria, status matrix, roadmap, verification checklist, submission |
| `docs/ARCHITECTURE.md` | Actual technical architecture, auth and authorisation design, data model, policies; planned architecture kept apart from what exists (section 9) |
| `REFLECTION.md` | Decisions, trade-offs, review findings, executed test results and evidence, lessons, accepted limitations |
| `CLAUDE.md` | Binding development conventions, security rules, documentation responsibilities, Git workflow |
| `README.md` | Public description and run instructions; still the unmodified starter text, its rewrite is tracked as SUB-3 and SUB-5 to SUB-8 in A7 |

**Scope layers.** The brief keeps four layers apart so that the product vision never hides the official requirements.

| Layer | ID prefix | Meaning |
|---|---|---|
| Mandatory Turing requirements | `S2-R1` to `S2-R6` | Official Sprint 2 minimum. Must all be met. |
| Additional security tests | `S2-X…` | Our own tests beyond the official minimum (defined in A7, scheduled in the A8 checklist). Never counted as the official minimum. |
| Selected Turing optional tasks | `OPT-1`, `OPT-2` | Chosen from the official list (A3). Selected is not implemented. |
| Additional product requirements | `PR-…` | Owner-defined product work that is **not** a Turing requirement (A4). |
| Future enhancements | `FUT-…` | Recorded only; not scheduled for Sprint 2. |

The Mid-Sprint requirement IDs (R1 to R12, E1 to E13) are unchanged and live in Part B. Sprint 2 IDs always carry the `S2-` prefix, so the two sets cannot be confused.

**Status values.** `PASS` verified by the stated evidence. `OPEN` not started or not yet verified. `IN PROGRESS` work has started. `FAIL` checked and does not meet the criterion. `BLOCKED` cannot be executed because of an external blocker. `RETEST REQUIRED` passed earlier but the code or conditions changed, or the earlier test does not cover the criterion. `EVIDENCE REQUIRED` believed true but the proof is missing or stale. `NOT APPLICABLE` not part of the selected scope. A requirement is never `PASS` only because the code exists; "Impl." (implementation) and "Status" (verification) are separate columns. Automated tests are not counted as manual verification: the evidence column says which kind was run.

**Priorities.** P0 mandatory Sprint 2 requirements. P1 selected optional tasks, and the rich-text editor and other product requirements. P2 additional product improvements. P3 future enhancements. If time is short, work that is needed for a valid Sprint 2 submission wins over P1 and below.

# Part A – Sprint 2: Full-Stack App with Database and Authentication (current)

## A1. Objective, selected app and dates

- **Official project objective:** extend Notes Lab into a secure full-stack application using Supabase Auth and PostgreSQL, where authenticated users can access only their own notes, collections, tags and related data.
- **Selected app option:** the continued Mid-Sprint Notes App (this repository's existing Notes Lab).
- **Runs and is verified locally** at `http://127.0.0.1:3000` (`npm run dev`; never `localhost`). **No public deployment is required** in Sprint 2.
- **Dates:** target completion **2026-10-19**, internal contingency buffer **2026-10-20**, official deadline **2026-10-21**.
- **Repositories:** the active **development** repository is `https://github.com/marcbecker1974/notes-lab`. It is **not** the final Turing submission location: it will be duplicated or transferred into the Turing College submission area according to the course process. The final location is **pending** (SUB-1); the development URL alone does not satisfy the submission requirement.
- **Two objectives:** (A) complete all official Sprint 2 requirements; (B) grow Notes Lab into a useful long-term personal AI Development Journal. Objective B must not obscure or replace objective A.

### A1.1 Product vision (additional to the Turing requirements)

Notes Lab is a secure, multi-user knowledge management application that supports learning, planning, documenting and executing AI-assisted software development projects. Each authenticated user keeps their own private collections of notes, rich-text content, images and reusable development guidance. The owner's Google-authenticated account will hold the personal AI Development Journal; other registered users have completely separate private data. The journal is organised around the AI development lifecycle (examples of intended **content**, not records to create now, and not an AI feature):

```
01 | DISCOVERY AND ARCHITECTURE
02 | PROJECT SETUP | Tooling, Git and Supabase
03 | IMPLEMENTATION
04 | DEBUGGING
05 | QUALITY ASSURANCE
06 | GIT, RELEASE AND DEPLOYMENT
```

Future content will include notes based on AI Development Playbook 2.1. The vision words "rich-text content" and "images" correspond to PR-RTE-01 (A4) and OPT-2 (A3); they are not implemented today.

## A2. Mandatory Turing Sprint 2 requirements (S2-R1 to S2-R6)

Source: the owner's Sprint 2 brief of 2026-10-15; the original Turing wording is not stored in this repository. The "Acceptance criteria" are derived from it. Individual rows with status are in A7.

**S2-R1 – Email/password authentication.** Email/password sign-in and a visible sign-out. Accounts may be created through Supabase Authentication or through the application's registration page. A self-service registration page is **not** mandatory.

**S2-R2 – Server-side protection of private routes.** The private area is accessible only to authenticated users. The server verifies the user's identity before rendering protected content. A signed-out user who opens a private route directly is redirected to the sign-in page. Browser-side session checks alone are insufficient. *Scope decision:* the private area is `/notes` (Feature 7 removes its exemption in `lib/supabase/proxy.ts`).

**S2-R3 – Per-user data ownership and secure RLS.** Every user sees and modifies only their own data. All user-created items are stored in Supabase. Every table holding user data has appropriate Row Level Security policies: `notes`, `collections`, `tags`, `note_tags` and any user-data table added later. Application user data is **not** persisted in `localStorage` or `sessionStorage` (Supabase's supported mechanisms for the auth session are allowed).

**S2-R4 – CRUD and persistence.** Users can create, edit and delete notes, and reload the application without losing saved changes, with user-specific data under secure RLS.

**S2-R5 – Local operation and verification.** The application runs and is verified locally at `http://127.0.0.1:3000`. A public deployment is not required.

**S2-R6 – Two-account end-to-end verification.** The checklist demonstrates: (1) create or obtain a test account; (2) sign in and reach the private application; (3) create an item and confirm it persists after reload; (4) sign out and confirm private routes redirect to login; (5) sign in with a second account; (6) confirm the second account cannot see the first account's items. **Additional security tests (ours, not part of the official minimum, `S2-X…`, defined in A7 and scheduled in A8):** unauthorised updates and deletes, direct database requests, anonymous access, user-specific collections and tags, cross-owner relationships.

## A3. Optional Turing tasks

Official list. **At least one** optional task, developed on its **own feature branch and merged through its own pull request**, is required by Turing.

| Level | Task | Selected? |
|---|---|---|
| EASY | Minimalist design | No |
| MEDIUM | Server-side search | No |
| MEDIUM | **Export to Markdown** | **Yes: OPT-1** |
| MEDIUM | Password-reset email flow | No |
| MEDIUM | Self-service sign-up page | No |
| MEDIUM | Database migrations | No |
| HARD | **Image uploads using Supabase Storage** | **Yes: OPT-2** |
| HARD | GitHub social login | No |

The plan is to complete **both** selected tasks; the second one is a bonus opportunity (A5). **Selected is not implemented**: neither task may be marked `PASS` before its implementation, tests and merged-PR evidence exist.

Rules for the unselected tasks:
- Several of them exist in the repository as starter or Mid-Sprint features (the password-reset pages, the sign-up page, the migrations folder, the colour and layout work). They are **not** claimed as Sprint 2 optional tasks, and earlier Mid-Sprint functionality is not automatically classified as a completed Sprint 2 optional task (the earlier PRs #1 to #6 were reviewed for this; none is claimed).
- **Google OAuth** (PR #5) stays an additional, existing feature. It does **not** satisfy the optional **GitHub** social login task.

**OPT-1 – Export to Markdown** (Feature 9). Export an individual note as a Markdown (`.md`) file. Requirements: export the selected note; preserve meaningful text formatting, including headings, lists and links where supported; produce a valid downloadable `.md` file; handle rich-text content appropriately; never expose other users' notes. Own feature branch, separate PR.

**OPT-2 – Image uploads** (Feature 10). Users upload and embed images in their notes. Requirements: use Supabase Storage; never store image files as base64 in PostgreSQL; associate each image with the correct user; images stay visible after reopening a note; private images are protected from unauthorised access; image insertion into the rich-text editor is supported; upload errors and deleted or orphaned images are handled. Own feature branch, separate PR. *Note:* this lifts the Mid-Sprint "file uploads" exclusion for this feature only. Feature 10 is **selected and approved for planning**. The selection does **not** by itself authorise creating Storage buckets, changing Storage policies, installing dependencies, running migrations or changing Supabase configuration: those technical decisions follow the project's usual workflow, a feature architecture assessment and owner approval before implementation (see A12 and ARCHITECTURE.md section 9.4).

## A4. Additional product requirements and future enhancements

These are **owner-defined, not Turing requirements**. They never outrank an official requirement.

### PR-RTE-01 – Full rich-text note editor (Feature 8, P1)

The plain-text note editor is eventually replaced by a full rich-text editor suitable for writing substantial AI development guidance and structured learning notes. It must support at least: headings, paragraphs, bold, italic, underline, bulleted lists, numbered lists, links, text-formatting controls, embedded images, editing previously saved rich-text content, and reliable persistence in Supabase.

**Mockup inspection (2026-10-15, `docs/design/notes-lab-original-mockup.png`).** The mockup's "Inhalt" (content) field has a toolbar: a block-style dropdown labelled "Normal", bold, italic, underline, link, two list buttons, a code (`</>`) button and a full-screen button. The sample content in the field contains a bulleted list. **The mockup does not specify:** which heading levels the dropdown offers; which of the two list buttons is numbered (the two icons look alike); image insertion; the code and full-screen buttons are not in the required list above; any mobile behaviour; the saved format. These are recorded as **open decisions** (A12) and not invented as requirements.

Architectural considerations (planning only, no library chosen and nothing installed): an established, maintained editor library (no custom rich-text engine); a defined content storage format; preservation or safe migration of existing plain-text notes; safe rendering of user-generated content (no unsafe HTML or script execution); Markdown export support; image insertion through Supabase Storage; user-specific access controls preserved; identical formatting after save and reload. The library decision belongs to the Feature 8 architecture assessment.

### PR-MOB-01 – Mobile note editing (P2, scheduling secondary to the P0 requirements)

**Existing limitation (documented, unchanged):** below about 768px the note editor is not reachable (its grid row is about 2px high; see Part B and `REFLECTION.md`), so users cannot reliably open and edit note content on a phone. Requirement: on smartphones a user can open existing notes, read the complete content, create notes, edit and save notes, access the rich-text controls, and insert or view images. It may be built together with PR-RTE-01 or as a separate feature; **this must be decided and recorded explicitly, not folded silently into another feature** (open decision, A12). Until then the limitation stays an accepted one.

### Future enhancements (not Sprint 2)

- **FUT-1 – Account linking** across Google and email/password identities, through supported Supabase Auth mechanisms only (A11).
- Other known limitations stay as recorded in `REFLECTION.md` (for example no tag deletion or renaming, unpaged lists, no automated browser tests, no CI).

## A5. Evaluation criteria (official) and bonus opportunities

| ID | Criterion | Weight | Status | Basis |
|---|---|---|---|---|
| EVAL-1 | Clear project purpose, secure private area and user-specific data | 2 | OPEN | Purpose documented (A1); private area and user data are Feature 7 |
| EVAL-2 | Complete local end-to-end verification using two accounts | 2 | OPEN | S2-R6 not yet run |
| EVAL-3 | Secure Supabase authentication, server-side route protection and RLS | 2 | OPEN | Auth exists; route protection and RLS are Feature 7 |
| EVAL-4 | Understanding of the Supabase data model and user ownership | 2 | OPEN | Data model documented in `ARCHITECTURE.md`; ownership is Feature 7 and its SQL evidence |
| EVAL-5 | Complete README and evidence of the selected optional task | 1 | OPEN | README is the starter text; no optional task done |

| ID | Bonus opportunity | Status |
|---|---|---|
| BONUS-1 | A second completed optional task (OPT-1 and OPT-2 both completed with their own merged PRs) | OPEN. Not claimed. |
| BONUS-2 | SQL evidence demonstrating correct user-specific data ownership (X6, X10 in A7) | IN PROGRESS. The evidence exists (S2-X6 and S2-X10 are `PASS`); it is claimed only once the README cites it. |

## A6. Submission requirements

All pending items are tracked as `SUB-…` rows in A7. Required: the correct repository in the **Turing submission area** (pending; the development repository is not it); at least one merged PR with visible diff and description; a README that explains the application; the selected app option (continued Mid-Sprint Notes App); local installation and run instructions; the required environment variable names and how to obtain their values; a screenshot of the local application; the selected optional task(s) with their feature branches and merged PRs. Deployment to a public URL is **not** required.

## A7. Requirements Traceability Matrix

**How to read it.** `Cat.`: T Turing mandatory, T+ additional security test, O selected Turing optional, P additional product requirement, E evaluation, S submission. `Impl.`: implementation state in the repository, always one of `None`, `Partial`, `Done` or `n/a`; a parenthetical only qualifies it and is never a fifth value. `Status`: verification status (values above), applied strictly: `PASS` needs current evidence (a result that is stale or that predates a relevant change is `EVIDENCE REQUIRED` or `RETEST REQUIRED`). Rows under "Supporting evidence (non-scoring)" are not acceptance criteria and are never counted towards a requirement. **Evidence standard (applies to every row).** *Current verified evidence*: a check that was run, with a date, against the present state after the last relevant change; only this can support `PASS`. *Historical evidence*: an earlier recorded result that predates a relevant change or whose state cannot be confirmed; it is kept in the row, but it supports only `RETEST REQUIRED` or `EVIDENCE REQUIRED`. *Known failure*: a criterion contradicted by a committed artifact (for example a migration) and by the last recorded observation, with nothing since that changes it; recorded as `FAIL` and to be confirmed against the live system by S2-X6. *Not started or never tested*: `OPEN`. Reading the source code never produces `PASS`. Evidence names who or what verified it and when. "Feature · PR" gives the related roadmap feature and merged PRs or commits (from `git log` and `gh pr list`, 2026-10-15). Test results themselves are recorded in `REFLECTION.md`.

### Mandatory Turing requirements

| ID | Cat. | Requirement and acceptance criteria | Impl. | Status | Verified evidence | Missing / remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| S2-R1.1 | T | Email/password sign-in works and ends in the private app | Done (starter login form, `POST_LOGIN_PATH`) | PASS | Current evidence: owner manual M1 test B, Safari, 2026-10-15, on the final M1 application code: email/password login opens Notes Lab (which account was used is not recorded). Historical: owner manual PASS 2026-10-14 (Feature 6). `test:auth` checks that the login form uses `POST_LOGIN_PATH`. | Repeat in the final two-account run (A8 items 1, 12) | F6 · PR #6 (4e2a16b, 41fb875); F7 M1 |
| S2-R1.2 | T | A visible sign-out ends the session | Done (`components/notes/auth-status.tsx`, `logout-button.tsx`) | PASS | Current evidence: owner manual M1 test C, Safari, 2026-10-15: after Logout, opening `/notes` directly redirects to `/auth/login`, so the session ended. Historical: owner manual PASS 2026-10-14 for both methods; cross-tab sign-out PASS after the PR #6 fixes. | Repeat in the final run; the header Login link can no longer appear on `/notes` because signed-out visitors never reach it | F6 · PR #6; F7 M1 |
| S2-R1.3 | T | Test accounts can be created through Supabase Auth or the registration page; a self-service page is not mandatory | Done | PASS | Two email/password test accounts exist in `auth.users` (created through the app on 2026-10-14, per the Feature 5 and 6 records, and checked in the database on 2026-10-15) and were used by the live tests and the owner's manual tests; a self-service registration page is not mandatory. Registration with email confirmation could not be retested after the review fixes (S2-X8, `BLOCKED`). | None | F5, F6 · PR #5, #6 |
| S2-R2.1 | T | Server verifies the user's identity before rendering `/notes` | Done | PASS | Current evidence, 2026-10-15: the `/notes` exemption is removed from `lib/supabase/proxy.ts` (deny-by-default `isPublicPath`), and `app/notes/page.tsx` runs `requireUser()` (`getClaims()` on the server) before `<NotesApp />`. HTTP checks against the dev server: signed-out `/notes`, `/notes/anything` and encoded-path variants return `307` to `/auth/login` before any notes content. Owner manual M1 tests A and B (Safari). Automated: 97 `test:auth` checks at M1 (paths, claims, source wiring); the current tree runs 107. The page-level check is covered by code and source tests only; the observed redirects come from the proxy. | None for M1; keep as a regression check | F7 M1 |
| S2-R2.2 | T | A signed-out user opening `/notes` directly is redirected to `/auth/login` | Done | PASS | Current evidence, 2026-10-15: owner manual M1 tests A (signed-out direct access) and C (after Logout), Safari; HTTP checks (`307` to `/auth/login`, query string dropped). Expired session: only an HTTP check with a **fake** expired cookie (`307` plus a `Max-Age=0` cookie that clears it); a genuinely expired real session was not tested. | Optional retest with a really expired session (A8 item 4) | F7 M1 |
| S2-R2.3 | T | Browser-side session state alone is not relied on | Done | PASS | Current evidence, 2026-10-15: the server decides (proxy plus `requireUser()`); a request with no browser state at all (curl) is redirected. `AuthStatus` uses `getUser()` for display only, and `test:auth` asserts that `notes-app.tsx`, `use-notes-data.ts` and the page use no browser-side session read. | None for M1 | F7 M1 |
| S2-R3.1 | T | `user_id` ownership column on `notes`, `collections`, `tags`: `not null`, default `auth.uid()` | Done | PASS | Current evidence, live read-only SQL on 2026-10-15 after the migration was applied (M7, applied 13:31 UTC): `user_id` is `NOT NULL` on `notes`, `collections` and `tags`, and the default is still `auth.uid()` (migration `20261015130030`, 13 of 13 migrations applied, none pending). The tables are empty (the cleanup of M6), so no backfill was needed. | Re-verify after the two-account tests that every row created is owned (M8) | F7 M7 · PR #1 (f655f74) |
| S2-R3.2 | T | RLS is enabled on every user-data table, including `note_tags` | Done | PASS | Current evidence, live read-only SQL on 2026-10-15 after the migration was applied (M7, applied 13:31 UTC): `relrowsecurity` is true on `notes`, `collections`, `tags` and `note_tags` (the migration also re-enables it explicitly). Earlier historical evidence: the 2026-10-13 query. **Scope:** this assessment covers the four current user-data tables (`notes`, `collections`, `tags`, `note_tags`); future Storage security (`storage.objects`, OPT-2.2) is **not** covered and needs its own verification in Feature 10. | Storage security stays a separate verification in Feature 10 | F1 · PR #1; F7 M7 |
| S2-R3.3 | T | Appropriate owner-only policies, one per operation, naming the role with `to` | Done | PASS | Current evidence, live read-only SQL on 2026-10-15 after the migration was applied (M7, applied 13:31 UTC): the 16 `TEMP anon …` policies are gone and exactly 14 owner policies exist, each `to authenticated` (notes 4, collections 4: select, insert, update, delete; tags 3: no delete; `note_tags` 3: select, insert, delete), using `(select auth.uid()) = user_id` (UPDATE with `USING` and `WITH CHECK`); `note_tags` ownership comes from the parent note. This verifies that the policies exist and have the intended shape; that they actually isolate two users is shown by the tests in S2-R3.4, S2-R3.5 and S2-X1 to X5, which have since passed (`test:rls` runs mv9m9vju and mv9mvd7f of 2026-10-15; see those rows). | None | F7 M7, M8 |
| S2-R3.4 | T | Users and anonymous visitors see and change only what they own (no access without ownership) | Done | PASS | Second live run `npm run test:rls -- --run` on 2026-10-15 (14:27 UTC, run id mv9mvd7f; both accounts signed in and are different users, anonymous denial confirmed before any write, API level): all 18 tests pass. Isolation: tests 1, 5, 6, 7, 8, 9 (anonymous reads and writes denied; each user sees only their own rows; B cannot read A's rows by id, cannot update A's note, collection or tag (zero rows, A's data unchanged) and cannot delete A's note, collection or link). Ownership and system fields: corrected test 11 evaluated 22 protected-field attempts on their own and all were refused (16 with 42501: `user_id`, `created_at`, `updated_at` and `name` on insert and update; 6 with 428C9, PostgreSQL's refusal to write the `GENERATED ALWAYS` identity column `id` on insert and update); no probe row was created and A's note kept its owner and id. **Scope:** database and API level with two accounts. Browser (Safari) verification of the application is tracked in S2-R4.x and S2-R6.x and is still pending. The first run (17 of 18) failed only on a wrong error-code expectation in the old test 11. | Keep `test:rls` as a regression test; Safari checks (owner) | F7 M7, M8 |
| S2-R3.5 | T | Relationships stay within one owner (`note_tags`, `notes.collection_id`); cross-owner references are rejected | Done | PASS | Current evidence, `npm run test:rls -- --run` on 2026-10-15 (14:11 UTC, run id mv9m9vju; both accounts signed in and are different users, anonymous denial confirmed before any write, API level): test 10 passes: 7 cross-user attempts were all denied with 42501 (B inserts a note into A's collection; B moves its own note into A's collection; B links its note to A's tag; B links A's note to its tag; B links A's note to A's tag; A links its note to B's tag; A moves its note into B's collection), and B's note still points to B's own collection. Re-confirmed in the second live run (14:27 UTC, run id mv9mvd7f): test 10 passes again. | None; keep `test:rls` as a regression test | F7 M7, M8 |
| S2-R3.6 | T | All user-created items are stored in Supabase | Done (notes, collections, tags, links) | PASS | Current evidence, `npm run test:rls -- --run` on 2026-10-15 (14:11 UTC, run id mv9m9vju; both accounts signed in and are different users, anonymous denial confirmed before any write, API level): tests 3, 4, 15, 16, 17 and 18: notes, collections, tags and links created under the per-user policies were stored in Supabase and read back, also by a fresh sign-in. **Scope:** the current tables, API level (the application UI is covered by the Safari checks); images in Storage (OPT-2.1) are verified separately in Feature 10. | Images in Storage: Feature 10 | F1–F4 · PR #1, #2; F7 M8 |
| S2-R3.7 | T | No application user data in `localStorage` or `sessionStorage` | Done | PASS | (1) Owner's manual Safari Web Inspector check of 2026-10-15: `localStorage` and `sessionStorage` for `127.0.0.1` both EMPTY (owner-reported; not observed by me). (2) Source review of 2026-10-15: no use of `localStorage`, `sessionStorage` or IndexedDB in `app/`, `components/`, `lib/`, `hooks/` or `proxy.ts`; the Supabase browser client (`@supabase/ssr` 0.12.7, default options) keeps the session in cookies, and its `localStorage` use applies only to the opt-in `tokens-only` cookie encoding, which the app does not use; the only other storage-capable library is `next-themes`, which would store only the theme name (`theme`), never user data. Notes, collections, tags and note content are held in React state and the database only. Limit: the check covers the state of that session (signed in, data loaded); a later theme change would add only the theme key. | None | F7 |
| S2-R3.8 | T | The existing shared demo data is resolved without losing personal data (derived from S2-R3 and planning decision D5, not a separate Turing wording) | Done | PASS | Current evidence, 2026-10-15 13:18 UTC (M6): after a final live recheck against the verified backup (MD5 per table, exact ids, links, owners), the guarded cleanup deleted exactly the owner-approved disposable data (10 notes, 3 collections, 4 tags, 9 links) in one atomic statement; afterwards all four tables are empty, the three Auth accounts are byte-identical before and after (fingerprints), schema, policies and grants are unchanged, and the verified backup (outside the repository) is intact. No personal data existed in the approved scope, and nothing was reassigned. **Final cleanup, 2026-10-15 (M9):** after the two-account tests and manual tests had created new test data, the owner confirmed that ALL remaining application data (3 notes, 1 collection, 4 tags, 2 links, including the Google account's records) was disposable; after a fresh verified backup and a live recheck against it, one atomic guarded statement deleted exactly those records, and the four tables are empty again; Auth users and identities, policies, grants, column grants and sequences are identical before and after (fingerprints). See `REFLECTION.md`. | None | F7 M6, M9 |
| S2-R4.1 | T | Create, edit and delete notes work with user-specific data under RLS | Done | PASS | Current evidence, `npm run test:rls -- --run` on 2026-10-15 (14:11 UTC, run id mv9m9vju; both accounts signed in and are different users, anonymous denial confirmed before any write, API level): direct supabase-js calls with each account (not `lib/notes-db.ts`): create, read, update (`updated_at` advances through the trigger) and delete of notes work for the owner under the per-user policies (tests 3, 15, 17). **Not yet verified:** the application itself (UI and `lib/notes-db.ts`) under RLS, which is the Safari checklist. **Manual (owner-reported, 2026-10-15):** notes can be created, edited and saved in the browser under the per-user policies (tests 2, 4, 5). **UI deletion (owner-reported, Safari, 2026-10-15, Google account):** created a note titled "Feature 7 – Delete Test", saved it, deleted it with the editor's delete function, reloaded the application, and the note did not reappear and the notes count returned to zero (I did not observe it). Together: create, edit and delete work in the UI and at API level under the per-user policies, and the deletion persists after a reload. Limit: one account, one note; the confirmation dialog wording and keyboard paths were not reported. | None | F2 · PR #2; F7 M8 |
| S2-R4.2 | T | Saved changes survive a reload | Done | PASS | Owner-reported manual browser test of 2026-10-15 (the database shows the test data created between 14:38 and 14:49 UTC and sign-ins until 14:54 UTC; browser: Safari, named explicitly for test 8; the details of each step are as reported, nothing more is claimed), with the owner-access RLS policies in force: test 2: notes, collections and tags persist after a page reload. Supported by `test:rls` test 18 (API level). | None | F2 · PR #2; F7 M9 |
| S2-R5.1 | T | The app runs locally at `http://127.0.0.1:3000` with `npm run dev` | Done (`dev` binds `-H 127.0.0.1`) | PASS | Owner manual use 2026-10-14 and again in the M1 tests (Safari, 2026-10-15); `package.json` script | None | F1 · PR #1 (670dc2d) |
| S2-R6.1 | T | Create or obtain a test account (account A) | Done | PASS | The two existing email/password accounts are the test accounts, A and B (credentials only in the git-ignored `.env.test.local`). The live run on 2026-10-15 signed both in and confirmed they are different users. | None | F7 M8 |
| S2-R6.2 | T | Sign in and reach the private application | Done | PASS | Owner-reported manual browser test of 2026-10-15 (the database shows the test data created between 14:38 and 14:49 UTC and sign-ins until 14:54 UTC; browser: Safari, named explicitly for test 8; the details of each step are as reported, nothing more is claimed), with the owner-access RLS policies in force: tests 1, 4 and 5: sign-in with Google and with the two email/password test accounts reaches the Notes Lab app; accounts A and B can create and access their own data; the obsolete demo banner is no longer displayed. | None; keep as a regression check | F7 M9 |
| S2-R6.3 | T | Create an item and confirm it persists after reload | Done | PASS | Owner-reported manual browser test of 2026-10-15 (the database shows the test data created between 14:38 and 14:49 UTC and sign-ins until 14:54 UTC; browser: Safari, named explicitly for test 8; the details of each step are as reported, nothing more is claimed), with the owner-access RLS policies in force: test 2: notes, collections and tags can be created, edited, saved and persist after a page reload; tests 4 and 5: accounts A and B create and access their own data. The database confirms the data and its owners (inventory of 2026-10-15 15:04 UTC). | None | F7 M9 |
| S2-R6.4 | T | Sign out and confirm private routes redirect to login | Done | PASS | Owner-reported manual browser test of 2026-10-15 (the database shows the test data created between 14:38 and 14:49 UTC and sign-ins until 14:54 UTC; browser: Safari, named explicitly for test 8; the details of each step are as reported, nothing more is claimed), with the owner-access RLS policies in force: tests 3 and 7: logout works and signed-out access is protected; after logout, reloading `/notes` in another browser tab redirects to `/auth/login`; test 8: with the Supabase authentication cookie deleted while signed in, reloading `/notes` redirects to `/auth/login`. **Session loss was tested; the natural expiry of an access token was NOT.** Earlier evidence: HTTP checks and the first Safari run of M1. | None | F7 M1, M9 |
| S2-R6.5 | T | Sign in with a second account (B) | Done | PASS | Owner-reported manual browser test of 2026-10-15 (the database shows the test data created between 14:38 and 14:49 UTC and sign-ins until 14:54 UTC; browser: Safari, named explicitly for test 8; the details of each step are as reported, nothing more is claimed), with the owner-access RLS policies in force: test 5: signing in with the second account (B) works and B can create and access its own data. | None | F7 M9 |
| S2-R6.6 | T | The second account cannot see the first account's items | Done | PASS | Owner-reported manual browser test of 2026-10-15 (the database shows the test data created between 14:38 and 14:49 UTC and sign-ins until 14:54 UTC; browser: Safari, named explicitly for test 8; the details of each step are as reported, nothing more is claimed), with the owner-access RLS policies in force: tests 5 and 6: account B does not see account A's data, and after returning to account A none of account B's data is visible. Supported by the API-level tests 6 and 7 of `test:rls` and by the database inventory (each record is owned by its creating account). | None | F7 M8, M9 |

### Supporting evidence (non-scoring)

Not an acceptance criterion of any Turing requirement; it is context for S2-R2 and is never counted towards it.

| ID | Cat. | Observation | Impl. | Status | Verified evidence | Remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| SUP-1 | – | An existing server-verified route (`/protected`, starter) redirects a signed-out visitor to the sign-in page | Done | RETEST REQUIRED (non-scoring) | Historical evidence: owner manual PASS (Feature 5 test 8; the date is not recorded in `REFLECTION.md`, PR #5 was merged 2026-10-14) and a curl smoke test during Feature 5 (undated) | Re-run as a regression check; it does not show that `/notes` is protected | F5 · PR #5 |

### Additional security and regression tests (ours, not the official minimum)

| ID | Cat. | Test | Impl. | Status | Verified evidence | Missing / remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| S2-X1 | T+ | B cannot update or delete A's notes, collections, tags (UI and API) | Done | PASS | UI: manual tests 5 and 6 (owner-reported, 2026-10-15): account B does not see account A's data, so the UI offers no way to change or delete it. API: `test:rls` tests 8 and 9 (B's update or delete of A's note, collection, tag and link affects zero rows and A's data is unchanged) and test 12 (clients cannot delete tags). | None; keep as a regression test | F7 M8, M9 |
| S2-X2 | T+ | Direct database (PostgREST) requests with B's token, A's ids and no token return no private data | Done | PASS | Current evidence, `npm run test:rls -- --run` on 2026-10-15 (14:11 UTC, run id mv9m9vju; both accounts signed in and are different users, anonymous denial confirmed before any write, API level): test 7: B's requests with A's ids return no rows for notes, collections, tags and links; tests 1 and 5: requests without a token are denied (reads and writes). | None; keep as a regression test | F7 M8 |
| S2-X3 | T+ | Anonymous requests with only the publishable key cannot read or write | Done | PASS | Current evidence, 2026-10-15 after the migration (M7 and again in M8): anonymous REST `GET` of `notes`, `collections`, `tags` and `note_tags` returns HTTP 401, code 42501 on all four; **11 anonymous write attempts** (insert on all four tables, update and delete on notes, collections and tags, delete on `note_tags`) were all denied with HTTP 401, code 42501; the tables stayed empty; the live catalog shows `anon` with no table or column privileges. (Safe to send: an anonymous insert could not succeed anyway, because `user_id` is NOT NULL and `auth.uid()` is null for anon.) | None. Repeated in `test:rls` tests 1 and 5 (runs mv9m9vju and mv9mvd7f, 2026-10-15, 18 of 18 on the second run). | F7 M7, M8 |
| S2-X4 | T+ | Collections and tags are user-specific, also their uniqueness (same name for two users is allowed) | Partial | IN PROGRESS | The unique name indexes are `(user_id, lower(btrim(name)))`, see ARCHITECTURE. Current evidence, `npm run test:rls -- --run` on 2026-10-15 (14:11 UTC, run id mv9m9vju; both accounts signed in and are different users, anonymous denial confirmed before any write, API level): tests 4 and 13: the same tag name exists once per user (A's and B's `zz-f7-shared` tags have different ids), and a duplicate within one user is rejected (23505, also when the case differs); test 6: each user sees only their own collections and tags. **Not tested:** the same collection name for two users. | Add a same-collection-name case to the next run | F7 M8 |
| S2-X5 | T+ | Cross-owner relationships are rejected (`note_tags`, `notes.collection_id`) | Done | PASS | Current evidence, `npm run test:rls -- --run` on 2026-10-15 (14:11 UTC, run id mv9m9vju; both accounts signed in and are different users, anonymous denial confirmed before any write, API level): same evidence as S2-R3.5 (test 10: all 7 cross-user attempts denied). Re-confirmed in the second live run (14:27 UTC, run id mv9mvd7f): test 10 passes again. | None; keep as a regression test | F7 M7, M8 |
| S2-X6 | T+ | RLS policies, grants and `user_id` constraints verified against the **actual** Supabase database (read-only SQL on `pg_policies`, `information_schema`) | Done | PASS | Current evidence, live read-only SQL on 2026-10-15 after the migration was applied (M7, applied 13:31 UTC): policies (14 owner, 0 temporary, all `{authenticated}`), table and column privileges (`anon` none; `authenticated` exactly the columns the app writes, never `user_id`, `id`, `created_at`, `updated_at`), RLS flags, `user_id` NOT NULL with default, `migration list` 13/13, and a full before/after catalog diff showing that only policies, grants and `user_id` nullability changed (constraints, indexes, trigger, functions, event triggers identical); security advisors unchanged (the 3 known warnings). Recorded in `REFLECTION.md`. | Add the per-user ownership evidence after the two-account tests (S2-X10, BONUS-2) | F7 M7 |
| S2-X7 | T+ | Google sign-in regression: still works after Feature 7 and leads to `/notes` | Done | PASS | Manual test 1 (owner-reported, 2026-10-15): Google sign-in works after Feature 7. Independent database evidence: a Google-authenticated session created a note, a collection and two tags under RLS (owned by the Google account, created 14:38 to 14:41 UTC). **Not separately recorded:** the landing page after sign-in (the app is reached through `/notes`) and a Google sign-out; the Google *cancellation* flow was never testable (see Feature 5). | Re-run once before submission if the owner wants the sign-out covered | F5 · PR #5; F7 M9 |
| S2-X8 | T+ | Email registration with confirmation regression | Done | BLOCKED | Passed manually 2026-10-14 before the PR #6 review fixes. After them it could not be retested: Supabase returned "email rate limit exceeded" (A11). | Retest when email delivery is available; do not count the old result | F6 · PR #6 |
| S2-X9 | T+ | Password-recovery regression (forgot-password, email link, new password, `/notes`) | Done | BLOCKED | Passed manually before the fixes; after the L1 fix only covered by automated tests (REFLECTION). Blocked by the same rate limit. The owner reports a successful password-recovery test earlier (date not recorded); it is kept as a previous successful test and is **not** a new M1 regression test, so the status is unchanged. | Retest when email delivery is available | F6 · PR #6 |
| S2-X10 | T+ | SQL evidence of correct user ownership (two users, rows and policies) | Done | PASS | SQL evidence, read-only inventory 2026-10-15 15:04 UTC: three owner ids exist in the tables (the Google account, test account A, test account B); no row without an owner; every record is owned by its creator (notes 301 and 302, titled as the test notes of accounts A and B, are owned by two different email/password accounts; note 300, collection 109 and tags 118 and 119 by the Google account; tags 114 and 115 by A and B); every `note_tags` link joins a note and a tag of the same owner. Per owner: A 1 note and 1 tag, B 1 note and 1 tag, the Google account 1 note, 1 collection and 2 tags. Recorded in `REFLECTION.md` (the rows may be deleted later; the evidence stays recorded). | Cite in the README at submission (BONUS-2) | F7 M9 |
| S2-X11 | T+ | Wrong password and other sign-in errors show a clear message | Done (starter) | EVIDENCE REQUIRED | Not reported as manually tested (REFLECTION, Feature 6 "not verified") | Manual test | F6 |
| S2-X12 | T+ | Static quality checks pass: type check, lint, auth unit tests and build (our quality standard, not a Turing acceptance criterion) | Done | PASS | Current evidence, 2026-10-15, on the M1 working tree after its last code change: `tsc --noEmit` no errors, `npm run lint` clean, `npm run test:auth` 97 checks, "all auth tests passed", `next build` succeeded (automated only; they support but never replace the manual checks). Re-run at M8 on the committed tree (2026-10-15): `tsc` no errors, lint clean, `test:auth` 104 checks, `next build` succeeded, `test:rls --dry-run` lists 18 tests. Re-run on the uncommitted working tree after the final documentation alignment (2026-10-15, M9): `tsc` no errors, lint clean, `test:auth` 107 checks, `next build` succeeded, `test:rls --dry-run` lists 18 tests, `git diff --check` clean. | Repeat all four before each commit that changes code and before each PR | all |

### Selected Turing optional tasks

| ID | Cat. | Requirement and acceptance criteria | Impl. | Status | Verified evidence | Missing / remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| OPT-1.1 | O | A user can export the selected note as a valid downloadable `.md` file | Done | PASS | Current evidence, 2026-10-15: owner manual Safari test A (owner-reported, not observed by me): the `.md` file downloaded, with the saved title and body in correct Markdown structure and the `.md` extension. Test B: unsaved editor changes are not exported, the download holds the last saved version. Automated: 10 export checks in `test:auth` (content, file name, `.md`, Unicode, line breaks, empty body). Limit: plain-text notes only, one browser. | None for plain text; re-check after Feature 8 | F9 |
| OPT-1.2 | O | Formatting is preserved: headings, lists and links where supported; rich-text content is handled appropriately | Done on the Feature 8 branch (Markdown from the rich-text editor) | PASS (pending merge of Feature 8) | Owner decision 2026-10-15: Feature 9 is built before Feature 8 and exports the plain-text body unchanged under an H1 title, so Markdown the user typed (headings, lists, links) is preserved (unit-tested; the owner's Safari test A confirmed the structure for the note used). Rich-text content does not exist yet; **not `PASS` until Feature 8 settles the content format** and the conversion is revisited. | Re-check after PR-RTE-01: since 2026-10-15 the body is Markdown from the rich-text editor; `test:editor` and `test:auth` check that formatted notes export as saved (underline as `<u>`). Owner-reported Safari test E (2026-10-15): a formatted note exported correctly. Becomes `PASS` when Feature 8 is merged | F9 (F8) |
| OPT-1.3 | O | Export exposes no other user's notes | Done (by design) | PASS | Current evidence, 2026-10-15: owner manual Safari test C (owner-reported, not observed by me): account B cannot see or export notes of the Google account. By design, export makes no request and uses only the notes already loaded in the browser, which RLS limits to the signed-in user (Feature 7 evidence: 18 two-account tests); `lib/notes-db.ts` is unchanged (tested statically). | None | F9 (F7) |
| OPT-1.4 | O | Own feature branch and separate merged PR with visible diff and description | Done | PASS | Current evidence, 2026-10-15: branch `feature/export-to-markdown`, PR #9 with description and visible diff, `/code-review` (3 of 7 findings fixed) and a separate-session review (APPROVE), merged as `7e7b7c2` (merge commit, same strategy as PR #8); branch deleted. | None. Limitation unchanged: plain text only, OPT-1.2 stays `EVIDENCE REQUIRED` until Feature 8 settles the content format | F9 · PR #9 |
| OPT-2.1 | O | Images stored in Supabase Storage, never as base64 in PostgreSQL | None | OPEN | Selected 2026-10-15, not implemented | Bucket and upload design; migration or dashboard changes only through the approved process | F10 |
| OPT-2.2 | O | Each image is associated with the correct user; private images protected from unauthorised access | None | OPEN | – | Storage policies, two-account test | F10 (F7) |
| OPT-2.3 | O | Images are still visible after reopening a note; image insertion works in the rich-text editor | None | OPEN | Depends on PR-RTE-01 | Implement after the editor decision | F10 (F8) |
| OPT-2.4 | O | Upload errors and deleted or orphaned images are handled | None | OPEN | – | Error states, cleanup rule | F10 |
| OPT-2.5 | O | Own feature branch and separate merged PR with visible diff and description | None | OPEN | – | Branch, PR, review, merge | F10 |
| OPT-R | O | At least one optional task with its own feature branch and merged PR (Turing rule) | None | OPEN | Mid-Sprint PRs are not claimed (A3) | Complete OPT-1 or OPT-2 | F9, F10 |
| OPT-N | O | Unselected tasks (Minimalist design, Server-side search, Password-reset flow, Self-service sign-up, Database migrations, GitHub login) | n/a | NOT APPLICABLE | Not selected. Starter and Mid-Sprint features that resemble some of them are not claimed. Google OAuth is not GitHub login. | None | – |

### Additional product requirements

| ID | Cat. | Requirement and acceptance criteria | Impl. | Status | Verified evidence | Missing / remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| PR-RTE-01.1 | P | The editor supports headings, paragraphs, bold, italic, underline, bulleted and numbered lists, links and formatting controls | Implemented on `feature/rich-text-editor` (uncommitted) | PASS | Owner manual Safari tests A (toolbar), C (source mode) and D (full screen), 2026-10-15, owner-reported, not observed by me: Normal/H1 to H3, bold, italic, underline, link insert/edit/remove, bulleted and numbered lists, Markdown source mode and full screen all worked. Automated: `npm run test:editor` (81 checks) covers the Markdown each formatting produces. Re-checked after the review fixes by owner-reported tests I, J and K (2026-10-15). Limit: one browser. | None | F8 |
| PR-RTE-01.2 | P | An established, maintained editor library is selected (no custom engine) | Tiptap 3.32.0 (MIT) with `@tiptap/starter-kit`, `@tiptap/markdown`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/extension-underline` | PASS | Owner decision 2026-10-15 after the architecture assessment (Tiptap, Lexical and Quill compared) and a compatibility spike; installed at the matching versions; type check, lint and production build pass with React 19.3.0 and Next 16.4.0. | None | F8 |
| PR-RTE-01.3 | P | A content storage format is defined; existing plain-text notes are preserved or safely migrated | Markdown in the existing `notes.body`; no migration | PASS | Owner decision 2026-10-15: Markdown, underline as inline `<u>…</u>`; no migration. Owner-reported Safari tests B (save and reload) and G (lossy content) passed: an existing note opened, edited and saved; notes with unsupported structures opened in source mode and kept their text. Automated: guard and round-trip tests. Existing notes are never rewritten unless the user edits and saves (accepted: cosmetic re-encoding of the stored Markdown on a visual edit, REFLECTION finding 1). Limit: the owner's real notes could not be inventoried by me. | None | F8 |
| PR-RTE-01.4 | P | User-generated content is rendered safely (no unsafe HTML or script execution) | Implemented on `feature/rich-text-editor` | PASS | Owner-reported Safari tests, 2026-10-15 (not observed by me): L, `javascript:` links rejected and permitted links verified; M, script content did not execute, no alert, HTML preserved after Save and reload, source mode opened with the protection notice; M3, script markup typed in the visual editor did not execute. Automated: hostile-input and link tests in `test:editor`; a static test forbids unsafe HTML APIs in the editor layer. No `dangerouslySetInnerHTML`. Limit: one browser, disposable test notes, owner-reported. | None | F8 |
| PR-RTE-01.5 | P | Saved rich-text content reloads identically and persists in Supabase; in-memory search still finds title and body text | Implemented (uncommitted) | PASS | Owner-reported Safari test B (2026-10-15): formatting identical after Save and reload. Automated: round trips are stable; search also matches the unescaped body and raw Markdown (review fix, tested). Owner-reported test I (2026-10-15): search with special characters passed. Limit: one browser. | None | F8 |
| PR-RTE-01.6 | P | Markdown export and image insertion are supported by the format; user-specific access controls are preserved | Export: unchanged code, new tests. Images: Feature 10 | PASS (export and access); images: Feature 10 | Owner-reported Safari tests E (export of a formatted note, underline as `<u>`, saved version only) and H (a second account cannot see the note), 2026-10-15. Automated: export of editor output in `test:editor` and `test:auth`. No Supabase, Auth, RLS or grant change. Image insertion belongs to Feature 10 (`![](url)` fits the format). | Image insertion in Feature 10 | F8 |
| PR-MOB-01 | P | On smartphones: open, read, create, edit and save notes, use rich-text controls, insert or view images | None | OPEN | Known limitation: editor unreachable below 768px (REFLECTION, Features 4) | Scope decision: bundle with F8 or separate (A12); secondary to P0 | follow-up |

### Evaluation criteria and submission

| ID | Cat. | Requirement | Impl. | Status | Verified evidence | Missing / remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| EVAL-1 to EVAL-5, BONUS-1, BONUS-2 | E | See A5 | n/a | OPEN | See A5 | Assessed from the rows above | – |
| SUB-1 | S | Correct repository in the Turing submission area | None | OPEN | Development repository `marcbecker1974/notes-lab` exists; the submission location is **pending** and is not this URL | Follow the course submission process, then record the URL | – |
| SUB-2 | S | At least one merged PR with visible diff and description | Done (development repository only) | EVIDENCE REQUIRED | PRs #1 to #6 are merged, each with a description and a visible diff (`gh pr view`, 2026-10-15). Whether they appear in the submission repository depends on how it is duplicated. | Confirm in the submission area; Sprint 2 PRs will add more | PR #1 to #6 |
| SUB-3 | S | README explains the application | None | OPEN | `README.md` is still the unmodified starter text (verified 2026-10-15) | Rewrite in the submission-preparation step; not changed in this documentation task | follow-up |
| SUB-4 | S | Selected app option recorded: continued Mid-Sprint Notes App | Partial (recorded on this uncommitted branch) | IN PROGRESS | A1 of this file; on branch `docs/sprint2-requirements`, uncommitted | Commit and merge this documentation change | docs |
| SUB-5 | S | Local installation and run instructions | None | OPEN | README says `localhost:3000` and `create-next-app`, which contradicts the project rule (`http://127.0.0.1:3000`) | Write in the README | follow-up |
| SUB-6 | S | Required environment variable names | Partial | OPEN | `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; README does not | Document in the README; state that no secret or service-role key is used | follow-up |
| SUB-7 | S | Instructions for obtaining the values | None | OPEN | – | README: Supabase project API settings; Google client ID and secret only in the Supabase dashboard | follow-up |
| SUB-8 | S | Screenshot of the local application | None | OPEN | No screenshot in the repository (only the design mockup and starter images) | Take after Feature 7 | follow-up |
| SUB-9 | S | Selected optional task(s) with branches and merged PRs documented | None | OPEN | – | After F9 and F10 | F9, F10 |
| SUB-10 | S | Public deployment | n/a | NOT APPLICABLE | Not required in Sprint 2 | None | – |
| SUB-11 | S | `.env.local` and secrets are not committed | Done | PASS | `git ls-files` lists only `.env.example`; `git log --all -- .env.local` is empty (2026-10-15); `.gitignore` hardened in 7a08ea9 | None | chore/secure-gitignore |

## A8. Sprint 2 verification checklist

This is the central checklist. **Executed results and evidence are recorded in `REFLECTION.md`**, not here. "Type": **Official** = demonstrates a mandatory requirement S2-R1 to S2-R6 (the S2-R6 steps, or an acceptance criterion derived from the official text in A7); **Additional** = our own security, product, quality or regression test (`S2-X…`, `OPT-…`, `PR-…`). Every mandatory matrix row is covered by at least one item. Automated tests (unit scripts, type check, build) support but never replace the manual and SQL checks named here. None of the items below has been executed yet in its Sprint 2 form.

| # | Test | Type | Method required | Matrix ID | Result |
|---|---|---|---|---|---|
| 1 | Create or obtain test account A; sign in with email/password; reach the private app | Official | Manual | S2-R6.1, R6.2, R1.1, R1.3 | run (owner-reported, 2026-10-15): sign-in as account A, Google and account B reaches the app; accounts A and B are the two existing email/password test accounts |
| 2 | A creates and edits private notes (also a collection and a tag); sign-out is visible and works | Official | Manual | S2-R6.3, R4.1, R1.2 | run (owner-reported, 2026-10-15, tests 2, 4, 5 and the final delete test): create, edit, save, delete and logout work; a deleted note stays gone after a reload |
| 3 | A reloads and keeps the data | Official | Manual | S2-R6.3, R4.2, R3.6 | run (owner-reported, 2026-10-15, test 2): data persists after a page reload |
| 4 | Signed out: opening `/notes` redirects to `/auth/login` (direct URL, after logout, expired session) | Official | Manual plus HTTP check | S2-R6.4, R2.1 to R2.3 | run (M1 and owner-reported tests 3, 7, 8 of 2026-10-15): direct URL, after logout, another tab after logout, and a deleted authentication cookie all redirect to `/auth/login`; natural token expiry not tested |
| 5 | Create or obtain test account B; sign in with it | Official | Manual | S2-R6.5 | run (owner-reported, 2026-10-15, test 5): account B signs in |
| 6 | B cannot see A's notes, collections or tags | Official | Manual | S2-R6.6, R3.4 | run: API level (`test:rls` tests 6 and 7) and owner-reported manual tests 5 and 6 of 2026-10-15 |
| 7 | B cannot update or delete A's data (UI and direct API with B's token) | Additional | Manual plus scripted API | S2-X1, X2 | API part run 2026-10-15 (`test:rls` tests 8, 9, 12, 7, 1, 5: pass); the UI part is not yet manually verified |
| 8 | Anonymous requests (publishable key only) cannot read or write private data | Additional | Scripted API | S2-X3 | run (M7 and M8, 2026-10-15): anonymous reads of all four tables and 11 anonymous write attempts denied (401, 42501), `anon` holds no privileges; repeated by `test:rls` tests 1 and 5 when the credentials exist |
| 9 | Collections and tags are per user; same name allowed for two users | Additional | Manual plus SQL | S2-X4 | partly run 2026-10-15 (`test:rls` tests 4, 6, 13: pass); the same collection name for two users is not tested |
| 10 | Cross-owner relationships are rejected (`note_tags`, `notes.collection_id`) | Official (S2-R3.5) plus Additional (S2-X5) | Scripted API | S2-R3.5, S2-X5 | run 2026-10-15 (`test:rls` test 10: pass, 7 cross-user attempts denied) |
| 11 | Ownership columns, RLS and owner policies verified against the actual Supabase database | Official (derived from S2-R3) | Read-only SQL | S2-R3.1, R3.2, R3.3 | run 2026-10-15 (M7, after the apply): all verified against the live database, see `REFLECTION.md` |
| 12 | Google sign-in regression (sign in, lands on `/notes`, sign out) | Additional | Manual | S2-X7 | run (owner-reported, 2026-10-15, test 1): Google sign-in works; sign-out and landing page not separately recorded |
| 13 | Email registration with confirmation regression | Additional | Manual | S2-X8 | BLOCKED (email rate limit) |
| 14 | Password-recovery regression | Additional | Manual | S2-X9 | BLOCKED (email rate limit) |
| 15 | No user data in `localStorage` or `sessionStorage` | Official (S2-R3) | Browser DevTools | S2-R3.7 | PASS (2026-10-15, owner, Safari Web Inspector: both empty) |
| 16 | Local run at `http://127.0.0.1:3000` with `npm run dev` | Official (S2-R5) | Manual | S2-R5.1 | partly run: owner use in Safari during the M1 tests (2026-10-15); formal Sprint 2 run pending |
| 17 | Markdown export: downloaded file content matches the note, with other users' notes inaccessible | Additional (OPT-1) | Manual, open the file | OPT-1.1 to 1.3 | run 2026-10-15 (owner-reported, Safari): tests A, B and C passed, see `REFLECTION.md` |
| 18 | Rich-text persistence: formatting identical after save and reload, safe rendering | Additional (PR-RTE-01) | Manual plus hostile-input test | PR-RTE-01.1 to 01.5 | Save and reload: PASS (owner-reported, 2026-10-15, tests A to D). Hostile-input tests L, M and M3: PASS (owner-reported, 2026-10-15, plus automated hostile-input tests) |
| 19 | Image upload and retrieval; cross-user image access denied; error and orphan handling | Additional (OPT-2) | Manual plus API | OPT-2.1 to 2.4 | not run (not implemented) |
| 20 | Desktop functionality (three-column layout) | Additional | Manual | S2-R4, PR-RTE-01 | not run in Sprint 2 form |
| 21 | Mobile functionality (open, read, create, edit, save below 768px) | Additional (PR-MOB-01) | Manual at about 375px | PR-MOB-01 | not run (known limitation) |
| 22 | Documentation and PR evidence: README, screenshot, env names, merged PRs, branches, submission copy | Official (submission) | Inspection | SUB-1 to SUB-11 | not run |
| 23 | Sign-in errors: a wrong password and other sign-in errors show a clear message | Additional | Manual | S2-X11 | not run |
| 24 | Static quality checks: type check, lint, auth unit tests and build (our quality standard, automated only; not an official acceptance criterion) | Additional | Automated | S2-X12 | run 2026-10-15 after M1: type check, lint, 97 auth tests and build pass; current tree (M9, 2026-10-15): type check, lint, **107** auth tests and build pass |
| 25 | Existing data: backup verified, the intended owner's Supabase Auth user ID recorded, personal records retained, disposable demo data handled only after explicit approval | Official (derived from S2-R3 and decision D5) | Inspection plus read-only SQL | S2-R3.8 | run 2026-10-15 13:18 UTC (M6): final recheck passed, then the approved cleanup; four tables empty, Auth accounts unchanged, backup retained (it is not copied or deleted; owner decides later). Run again in M9 for the test data created afterwards (the four tables empty, Auth unchanged). The owner's Auth user id was not needed because nothing was reassigned. |
| 26 | SQL ownership evidence with two users (rows, owner ids, policies) | Additional (supports BONUS-2) | Read-only SQL | S2-X6, S2-X10 | not run |

## A9. Feature roadmap, dependencies and timeline

| Feature | Priority | Workflow | Scope | Status |
|---|---|---|---|---|
| **7 – User Data Isolation & Secure RLS** | P0 | A – Full Feature Development | Protect `/notes` on the server; users access only their own data; secure `notes`, `collections`, `tags`, `note_tags`; replace the temporary anonymous policies; resolve ownership of the existing shared data; preserve personal records; safe migrations; test with two authenticated accounts; verify anonymous restrictions; retest CRUD and persistence | **In progress.** M1 to M8 are done and verified: server-side route protection (M1); verified backup (M2); offline backup checks, full restore NOT tested, risk accepted (M3); preparation (M4); pre-execution checks (M5); approved demo data deleted (M6); the secure RLS migration applied on 2026-10-15 at 13:31 UTC with owner-only policies and no anonymous access (M7); the 18 automated two-account tests passed on 2026-10-15 (M8). The owner reported eight manual browser tests as passed on 2026-10-15 (Google sign-in, per-user create, edit and reload, logout and protection, accounts A and B, isolation both ways, redirect in another tab, and session loss by deleting the authentication cookie; natural token expiry was not tested), and the obsolete demo banner was removed from the UI. On 2026-10-15 the owner confirmed that all remaining application data was disposable test data, and a guarded, atomic, backed-up cleanup deleted it (the four application tables are now empty; Auth accounts untouched; policies and grants unchanged; see `REFLECTION.md`). **Still to do before Feature 7 is complete:** the localStorage and sessionStorage check (S2-R3.7), the documentation updates (`CLAUDE.md`, `ARCHITECTURE.md`, README), the required reviews, then commit, push, pull request and merge. Feature 7 is **not marked complete** until then. |
| **8 – Full Rich-Text Editor** | P1, product requirement | A | Select an editor library; implement rich-text formatting; define the persistent content representation; headings, lists, links; preserve existing note content; prepare image integration; secure rendering; consider mobile editing | **Implemented on `feature/rich-text-editor` (uncommitted, 2026-10-15).** Owner decisions: Tiptap, Markdown storage in `notes.body` (underline as `<u>`), no migration, source and full-screen modes required, H1 to H3 and a numbered list, existing structures preserved, mobile editing deferred (PR-MOB-01 stays separate). Owner manual Safari tests A to K and security tests L, M and M3 passed (2026-10-15, owner-reported); `/code-review` done, 8 of 10 findings fixed, 2 accepted (REFLECTION); committed on the branch with a PR open; the separate-session PR review and merge are pending. Deferred and accepted: mobile editing (PR-MOB-01), cosmetic Markdown re-encoding, synchronous processing of long notes. |
| **9 – Export to Markdown** (OPT-1) | P1, selected Turing optional | B – Standard Feature | Export individual notes as `.md`; preserve supported rich-text formatting; headings, lists, links; handle image references; verify the downloaded file; own branch and PR. Normal feature planning and approval; it does not automatically need the security assessment of a database or Storage change (it reads only what the user can already read) | **Implemented on `feature/export-to-markdown`; the owner's three Safari tests passed (2026-10-15); PR #9 reviewed and merged on 2026-10-15 (`7e7b7c2`).** Owner decisions: export the last **saved** version (the editor says so while changes are unsaved); only the title as H1 and the body, no collection, tags or metadata; built before Feature 8, so plain text only (revisit if F8 changes the format). |
| **10 – Image Uploads with Supabase Storage** (OPT-2) | P1, selected Turing optional | A | Configure Storage; secure uploads; associate images with the right user; insert into notes; persist across reloads; prevent cross-user access; errors and cleanup; own branch and PR. Needs an architecture and security assessment; bucket configuration and `storage.objects` access policies are reviewed explicitly; schema and policy changes use version-controlled migrations where supported, and an approved dashboard change is documented when a migration is not applicable | Planned, not started |

Additional follow-ups (not yet features): mobile editor accessibility (PR-MOB-01); optional account linking (FUT-1); final README (SUB-3, SUB-5 to SUB-8); complete Sprint 2 regression testing (A8); SQL ownership evidence (S2-X6, S2-X10); Turing submission preparation (SUB-1, SUB-2, SUB-9).

**Dependencies (proposal, to be reviewed before development).**
- Feature 7 comes first and blocks the official verification (S2-R2, S2-R3, S2-R6), and the ownership and access rules for Features 9 and 10. Its data decisions (A10) need explicit approval first.
- Feature 9 needs a content format. Done after Feature 8 it can export rich text; done before it, only plain-text notes can be exported and OPT-1.2 stays open until the format exists.
- Feature 10 needs Feature 7 (per-user Storage policies) and, for insertion into the editor, Feature 8.
- Feature 8 is the largest piece: library choice, content format, migration of existing notes, safe rendering, search over rich content, review of the body size constraint.
- The mobile editing requirement may be bundled into Feature 8 only by an explicit recorded decision.

**Timeline and feasibility.** Target 2026-10-19, buffer 2026-10-20, deadline 2026-10-21; this assessment is dated 2026-10-15. **Feasibility has not been estimated in effort units and the full roadmap is not assumed to fit.** Qualitative assessment, to be replaced by estimates in each feature's architecture assessment: Feature 7 plus the two-account verification, the README and the screenshot are the minimum for a valid submission (P0). Features 8 and 10 are each substantial and Feature 10 depends on both 7 and 8, so completing all four features before the deadline is **at risk**. Proposal for the review: protect P0 first; do the first selected optional task that fits the remaining time to secure OPT-R; treat the rest as stretch goals; if Feature 7 is not merged early enough, drop the P1 product work and keep the buffer day for the regression checklist and submission. Official requirements take precedence if the deadline is at risk.

## A10. Existing data and ownership (DECIDED and EXECUTED in Feature 7)

**Facts at the time of the planning (2026-10-13/14; historical, superseded by the executed cleanups below).** `notes`, `collections`, `tags` hold rows with `user_id` null, written while access was open: the last recorded counts are 8 notes, 3 collections, 4 tags, 7 links (REFLECTION, 2026-10-13/14). Since then the owner has used the app in manual tests, so **the live data was not inspected in this task and may have changed**. Nothing was deleted, reassigned or modified.

**Decisions already taken (owner, 2026-10-15).** The shared demo data is no longer required. Personal journal data **must be preserved**. The owner's Google-authenticated account will hold the personal journal. Every user owns their own notes, collections and tags, relationships stay within one owner, other users' data is invisible. The demo data may be deleted later after verification and approval. **Existing records are not automatically assigned to one user.**

**Deletion decision (owner, 2026-10-15), recorded when implementation began and EXECUTED on 2026-10-15 at 13:18 UTC (M6):** after a complete, verified backup, the demo and test data may be permanently deleted from the linked project: 10 notes, 3 collections, 4 tags and 8 `note_tags` links (the 2026-10-15 discovery snapshot). Conditions: (1) back up all four tables outside the repository; (2) verify backup integrity and restorability *[changed by the owner on 2026-10-15: offline verification of the backup files instead of a tested restore; a full restore has NOT been tested and the risk is accepted, see `REFLECTION.md`, Feature 7 M3]*; (3) recheck the live records immediately before deletion; (4) do not delete records added after the snapshot; (5) never assign anonymous records to a user; (6) if the records differ from the approved snapshot, stop and ask again; (7) never delete user accounts or authentication records. The cleanup ran as one atomic, guarded statement after a final recheck: exactly the approved records were deleted (all four tables are now empty), nothing was reassigned, and no Auth account was touched. *[Updated 2026-10-15: after the first export the owner re-baselined the scope to 10 notes, 3 collections, 4 tags and **9** `note_tags` links (one more link on note 289, a test record already in scope); a verified backup now exists outside the repository, see `REFLECTION.md`, Feature 7 M2. Deletion remains subject to the final approval.]*

**Result (2026-10-15).** All six steps below were done before any deletion (data inspected read-only, backup verified, deletion explicitly approved by the owner); no record was reassigned and no Auth account was touched. Two guarded, atomic cleanups ran: M6 (13:18 UTC, the demo and test data) and M9 (the test data created by the later verification tests; the owner confirmed it was disposable). The four tables are empty; `REFLECTION.md` has the evidence. The list is kept as the requirements the plan had to meet:
1. Inspect the current data (read-only).
2. Separate disposable demo records from personal records that must be kept.
3. Propose a backup strategy (for example an export of the four tables, taken and checked before any change).
4. Identify the intended owner by the **actual Supabase Auth user ID** (not assumed from an email address; not looked up in this task).
5. Propose a safe cleanup and migration strategy (backfill only the approved rows, then `not null`; consider rows planted during the open window, ARCHITECTURE section 6 step 9).
6. Obtain **explicit approval** before deleting, reassigning or modifying any record.

## A11. Authentication decisions and the email rate-limit blocker

- **Methods preserved:** email/password and Google OAuth. Google is an additional supported method and does not replace email/password. Both must keep working after Feature 7 (S2-R1.1, S2-X7).
- **Identity:** each sign-in method is handled through supported Supabase Auth mechanisms. Accounts are **not** merged automatically on a matching email address. Account linking is a possible future enhancement (FUT-1), not a Sprint 2 requirement. **Unverified assumption to check in Feature 7:** whether Supabase's default behaviour links identities that share a verified email, which would contradict this decision; the dashboard check is already listed as open in `REFLECTION.md` (PR #5 review). Nothing has been changed.
- **Testing limitation (current):** Supabase returned "email rate limit exceeded" during the PR #6 regression tests, so password recovery and registration with email confirmation could not be retested after the review fixes. Those items are `BLOCKED` (S2-X8, S2-X9) and earlier passes are not counted. The email provider, SMTP settings and the Supabase dashboard are **not** to be changed for this; retest when delivery is available again. The rate limit also affects creating the two test accounts, so S2-R1.3 and S2-R6.1 and R6.5 are recorded as open and must say how the accounts were created.

## A12. Planning decisions, scope conflicts and open decisions

**Planning decisions of 2026-10-15 (owner; details in `REFLECTION.md`).**

| # | Decision |
|---|---|
| D1 | The repository `marcbecker1974/notes-lab` is the development repository; the final Turing submission location is pending. |
| D2 | Sprint 2 IDs use the `S2-` prefix; Mid-Sprint IDs are preserved. |
| D3 | Contradictions are resolved by marking Mid-Sprint text as historical and superseded, not by rewriting it. |
| D4 | Selected optional tasks: Export to Markdown and Image uploads. |
| D5 | Shared demo data is not needed; personal data is preserved; no automatic assignment of records (A10). |
| D6 | Google OAuth stays supported next to email/password; no automatic account merging; linking is a future enhancement. |
| D7 | The email rate limit is recorded as a blocker; no email, SMTP or dashboard change. |
| D8 | The verification checklist lives in this file; results are recorded in `REFLECTION.md`. |
| D9 | Stale status statements are corrected, as marked notes next to the old text. |

**Scope conflicts and how they are handled.**
- Mid-Sprint E4 ("no authentication"), the Part B sections "Single-user, no accounts", 4.7 and 5 (exclusions) and the Feature 7 follow-up in section 9 are **superseded by Part A**. They stay as written, with a marker.
- The Mid-Sprint exclusions "rich-text editing" and "file uploads" are lifted for PR-RTE-01 (Feature 8) and OPT-2 (Feature 10). Exclusions that stay: AI features (the journal's lifecycle themes are content, not AI features), public sharing, and deployment.
- `CLAUDE.md` forbids new dependencies and services without asking: the editor library (Feature 8) and Supabase Storage (Feature 10) are selected here and approved for planning. Selection does not authorise installing the editor library, creating Storage buckets, changing Storage policies, running migrations or changing Supabase configuration; those follow the existing workflow (a feature architecture assessment and owner approval before implementation). Feature 9 (Workflow B) needs normal feature planning and approval, not the security assessment of a database or Storage change. Feature 10 (Workflow A) needs an architecture and security assessment in which the bucket configuration and the `storage.objects` access policies are reviewed explicitly; its schema and policy changes use version-controlled migrations where supported, and an approved Supabase dashboard change is documented when migrations do not apply. The rule that new dependencies and services need explicit approval is unchanged, and no additional approval step is introduced.
- `lib/notes-db.ts` must not read or write `user_id`. Per-user Storage paths (Feature 10) need the user id, so Storage access may use a separate dedicated module, subject to an approved architecture decision made in Feature 10's assessment. Access to the existing tables stays centralised in `lib/notes-db.ts`, which keeps not reading or writing `user_id`.
- Per-user RLS removes the public `/notes` route: the Login link and the demo banner for anonymous visitors then no longer apply to `/notes` (the demo banner was removed on 2026-10-15).
- Rich text changes the data model: the `notes_body_length` constraint (20,000 characters) and in-memory search over plain text need review in Feature 8.

**Open decisions (none decided yet).**
1. Existing data: inspection, backup, owner user ID, cleanup and approval (A10).
2. Rich-text editor: **decided 2026-10-15**: Tiptap; Markdown in `notes.body`; H1 to H3; numbered list; source and full-screen buttons required; existing plain-text notes kept as they are (unsupported structures open in source mode).
3. Mobile editing: **decided 2026-10-15**: deferred, separate from Feature 8 (PR-MOB-01).
4. Feature order and which features are dropped if the deadline is at risk (A9).
5. Whether Google sign-up needs an allow-list now that per-user isolation limits what a new account can see (carried over from Mid-Sprint section 9).
6. Whether Supabase links identities with the same verified email (A11).
7. Storage design for Feature 10 (private bucket, path scheme, orphan cleanup) and the dedicated Storage module decision above.
8. How the repository is duplicated or transferred to the Turing submission area, and whether PR history transfers (SUB-1, SUB-2).

# Part B – Mid-Sprint Project (completed, historical)

> **Historical.** This is the Mid-Sprint scope as approved and delivered. It is preserved unchanged (apart from marked notes where Sprint 2 supersedes it or a status was out of date). Where it contradicts Part A, Part A governs the active scope. Its IDs (R1 to R12, E1 to E13) are different from the Sprint 2 IDs (`S2-R1` to `S2-R6`).

**Notes Lab – Notes App with Collections and Search**

Course: Turing College Mid-Sprint Project, "Notes App with Collections and Search".

## 1. Purpose

Notes Lab is a personal notes application, primarily intended as an **AI Learning Journal**: a place to capture what is learned while studying and working with AI, organise it, and find it again quickly.

## 2. Product Vision

A fast, focused, modern notes app where writing, organising and retrieving notes feel effortless. Notes are grouped into collections, labelled with tags, and findable instantly through live search and tag filtering. The interface keeps navigation, the notes list and the editor visible at the same time, so nothing gets in the way of capturing and revisiting ideas.

## 3. Target Users

- **Primary:** the author, using the app as a personal AI Learning Journal.
- **Secondary:** learners and reviewers evaluating the project against the Turing College requirements.

Single-user, no accounts. *[Superseded by Part A (Sprint 2): multiple registered users, each with private data. Kept here as the Mid-Sprint decision.]*

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
| R6 | The sidebar lists collections as selectable rows. Selecting a collection shows its notes in the notes list. Unassigned notes appear under "All notes" or "Uncollected". (Changed in Feature 4: the original wording required expandable collections that list their notes in the sidebar; the owner approved a flat list following the original mockup.) |
| R7 | Users can create named collections directly from the sidebar. |
| R8 | Users can assign notes to collections; changes persist in Supabase. |
| R9 | Users can add and remove tags on notes; tags appear on the note cards in the notes list (changed in Feature 4: the sidebar no longer lists notes). |
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
| E4 | No deployment. No authentication in the MVP; the owner later approved one extension, Google sign-in next to the starter's email/password pages (Feature 5, section 4.3). Notes stay unprotected by user (section 4.7). *[Superseded by Part A (Sprint 2): authentication and per-user data are now required.]* |
| E5 | Database tables created in Supabase with correct relationships. |
| E6 | At least one optional task, completed in its own feature branch and pull request. *[Mid-Sprint criterion, met by PR #3. Superseded for Sprint 2 by the optional-task rule in Part A, A3; the Mid-Sprint optional task is not a Sprint 2 optional task.]* |
| E7 | At least two feature branches, with their PRs merged. |
| E8 | At least one third-party slash command run on a PR diff before merging, with one finding documented in `REFLECTION.md`. |
| E9 | At least one PR diff reviewed in a fresh Claude Code session, with one finding documented. |
| E10 | `CLAUDE.md` kept up to date with Supabase conventions and the centralised database access rules. |
| E11 | At least one cited Supabase or supabase-js reference in `docs/`, with the source URL at the top. |
| E12 | Meaningful commit messages. |
| E13 | `.env.local` is never committed. |

### 4.3 Optional task

*[Historical: the Mid-Sprint optional task, completed in PR #3. Not a Sprint 2 optional task; the Sprint 2 selection is in Part A, A3.]* **Chosen optional task: note count badges.** Each collection in the sidebar shows the number of notes it contains, and the count updates when notes are created, deleted or moved between collections. It is built in its own feature branch and PR (E6). Acceptance criteria are in section 6.3.

Other optional ideas, only if time permits after the above:
1. **Colour-coded tags and collections** (built in Feature 4, `feature/color-coded-tags-collections`): eight palette colours stored in the database, shown for collections (folder icon) and tags (dot and soft badge) and changeable from the UI. Scope change: collections got colours too.
2. **Renaming collections.**
3. **Google sign-in** (Feature 5, `feature/google-signin`; scope change approved by the owner, status: implemented in PR #5; manual acceptance tests passed except the Google cancellation flow, which could not be tested manually; independent PR review done, its fixes applied and awaiting owner approval to commit): "Continue with Google" on the sign-in and sign-up pages through Supabase Auth, completed server-side at `/auth/callback`, landing on `/protected` like email/password (Feature 6 later changed the destination to `/notes`). It adds no schema or policy change and **does not make notes private per user**; see section 4.7 and the follow-up in section 9. *[Status corrected 2026-10-15: PR #5 was merged on 2026-10-14 (merge commit 9ec3f28) together with its review fixes (c9baa60). The Google cancellation flow was never verified manually.]*
4. **Post-login navigation** (Feature 6, `feature/post-login-navigation`; scope change approved by the owner, status: implemented in PR #6, manual acceptance tests passed, independent review fixes (header request volume, password-recovery destination) applied locally and awaiting owner approval to commit; password recovery and registration with email confirmation could not be retested afterwards because of the Supabase email rate limit, see REFLECTION.md): after Google sign-in, email/password sign-in, email confirmation and password update the user lands on `/notes` instead of `/protected`; the notes header shows the signed-in email with a Logout button, or a Login link for anonymous visitors (display only); email-link errors have their own neutral messages; a recovery link opened through `/auth/confirm` leads to the password form. Navigation and display only: no change to notes, database permissions, RLS, providers or anonymous access; `/protected` stays as the auth test page. Details and limitations: ARCHITECTURE.md 4a and REFLECTION.md. *[Status corrected 2026-10-15: PR #6 was merged on 2026-10-14 (merge commit effaecc) including the review fixes (41fb875). The email-dependent retests are still BLOCKED, see S2-X8 and S2-X9 in A7.]*

### 4.4 UI

Modern **three-column layout**:

- **Left (sidebar):** "All notes", then a Collections section ("Uncollected" first, then the collections as plain rows, with a "+" to create one) and a Tags section (filter rows with colour dots and counts, with a "+" to create a tag). The earlier expandable tree of notes under each collection was removed in Feature 4 to follow the original mockup; notes are listed in the middle column (R6, R9).
- **Middle:** notes list reflecting the selected collection, active tag filters and the search query.
- **Right:** note editor.

*Responsive behaviour (decided):* three columns on wide desktop (1200px and up); at 768 to 1199px the collections sidebar is collapsible behind a visible toggle; below 768px the columns stack (a dedicated mobile design is out of scope for the MVP).

*Decided:* the sidebar tree shows notes (with their tags) under their collection, the middle column shows the filtered and searched results, and both use a shared note-card component where appropriate. See ARCHITECTURE.md, section 2.

### 4.5 Technology

- Next.js (App Router)
- TypeScript
- Tailwind CSS with shadcn/ui components (decided for the notes UI)
- Supabase PostgreSQL
- supabase-js

### 4.6 Existing setup

Reuse the existing `notes-lab` project and its Supabase configuration. Do not start a new project or a new Supabase setup.

### 4.7 Security constraints

*[Mid-Sprint constraints. The temporary anonymous access described here is replaced by Feature 7 (Part A, A9); it is no longer the state of the database: the temporary policies were dropped on 2026-10-15 (migration `20261015130030_enforce_owner_access.sql`, applied live; the feature branch is not merged yet). The text below is kept as the Mid-Sprint record.]*

The notes data has no per-user protection, so the database is temporarily reachable by anonymous (`anon`) clients. Google and email/password sign-in exist (Feature 5) but only gate the starter's `/protected` page; they do not restrict notes. Since Feature 6 a successful sign-in, email confirmation or password update lands on `/notes` (navigation only). The notes header also shows the signed-in email with a Logout button, or a Login link for anonymous visitors (display only). The following constraints therefore still apply. Details are in [ARCHITECTURE.md](./ARCHITECTURE.md).

- **Environment:** the app runs locally on `127.0.0.1:3000` (`npm run dev` binds that address; do not use `localhost`, see ARCHITECTURE.md 4a) against a cloud-hosted Supabase project. It is not deployed, shared or published.
- **Non-sensitive data only:** use generic sample data. Never store real personal notes, names or credentials while anonymous access is enabled.
- **Anonymous access is temporary and isolated:** the anon read/write policies live in one dedicated migration, named and commented as temporary, and are the only place that mentions `anon`. Removing that migration closes anonymous access.
- **Accepted risk:** anyone with the project URL and publishable key can read, modify or delete rows in the four app tables. This is acceptable only for local development with non-sensitive data.
- **Abuse limits:** size limits on titles, bodies, and tag and collection names.
- **Keys:** only the publishable key is used in the browser. A service-role or secret key must never be added to the project or to any `NEXT_PUBLIC_` variable. `.env.local` stays out of Git, and `supabase/.temp/` is ignored via `.gitignore`.
- **Demo-mode notice:** the UI shows a notice that data is publicly accessible while anonymous access is on. *[Superseded 2026-10-15: removed with the temporary policies; the data is private under owner-only RLS (Feature 7).]*
- **Auth-ready design (Mid-Sprint; `user_id` is `not null` and `/notes` is private since Feature 7):** the schema has a nullable `user_id` (default `auth.uid()`) on `notes`, `collections` and `tags`. All database access goes through `lib/notes-db.ts`, which never reads or writes `user_id` and has no role or auth logic. *[Mid-Sprint wording, superseded by Feature 7 on 2026-10-15: sign-in was separate from notes, `/notes` stayed open and the TEMP policies gave every signed-in user full access. Now `/notes` needs a verified user and owner-only RLS applies; `lib/notes-db.ts` is unchanged in this respect.]*
- **Future migration:** adding authentication is a backfill plus a policy swap (see ARCHITECTURE.md, section 6), with no change to application logic.

## 5. Exclusions (Out of Scope)

*[Mid-Sprint exclusions. Under Sprint 2 (Part A): per-user data isolation and authentication are in scope; rich-text editing (PR-RTE-01) and file uploads (OPT-2, images only) are in scope for their own features. Still excluded: AI features, public sharing, deployment.]*

- Rich-text editing (plain text only)
- Authentication beyond sign-in (Google plus the starter's email/password), e.g. per-user data isolation, roles, profile pages
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
- R2.2 `updated_at` is set on creation and changes whenever a note is updated, including edits of the title or body and moving the note to another collection (decided 2026-10-13; check by editing or moving a note and comparing the value).

**R3: collections table**
- R3.1 `public.collections` has columns `id`, `name`, `created_at`.
- R3.2 Any additional columns (the nullable `user_id`) are nullable or defaulted, so inserting `name` alone succeeds. *[Superseded by Feature 7: `user_id` is `not null` with the default `auth.uid()`; inserting `name` alone still succeeds for a signed-in user.]*

**R4: note to collection relationship**
- R4.1 `notes.collection_id` is a nullable foreign key referencing `collections.id`.
- R4.2 A note can be saved with no collection; inserting a `collection_id` that does not exist is rejected.
- R4.3 Deleting a collection leaves its notes in place as unassigned (shown under "Uncollected").

**R5: tags and note_tags**
- R5.1 `public.tags` and `public.note_tags` exist; `note_tags` references both `notes` and `tags` with foreign keys.
- R5.2 The same tag can be attached to several notes and a note can have several tags; attaching the same tag to a note twice is rejected.
- R5.3 Deleting a note or a tag removes the related `note_tags` rows.

**R6: collections in the sidebar** (scope change approved in Feature 4: flat rows instead of an expandable tree)
- R6.1 The sidebar lists every collection as a selectable row with its note count. (Originally: each collection can be expanded and collapsed. Superseded by the approved scope change.)
- R6.2 Selecting a collection shows exactly the notes assigned to it in the notes list. (Originally: it also expanded in the sidebar.)
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
- R9.3 Tags appear on each note card in the notes list and update immediately after adding or removing. (Originally: also on cards in the sidebar.)
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
- E3: `npm run dev` starts the app, which loads on `127.0.0.1:3000` without errors.
- E4: no login flow is used by the notes app and nothing is deployed. *[Superseded by Part A for authentication; deployment stays out of scope.]*
- E5: the four tables and their foreign keys exist in the Supabase project, created through migrations in `supabase/migrations/`.
- E6: the optional task (note count badges) lives in its own feature branch and PR. *[Historical Mid-Sprint criterion; not a Sprint 2 optional task, see A3.]*
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
- The three-column layout is implemented and usable at desktop widths; at 768 to 1199px the sidebar is collapsible; below 768px the columns stack (accepted for the MVP).
- The app builds without errors.

### 6.5 Security and architecture

- All notes data access goes through `lib/notes-db.ts`; components do not call Supabase directly.
- Anonymous access policies existed only in the dedicated temporary migration, and only on the four app tables. *[Historical: dropped by the Feature 7 migration on 2026-10-15.]*
- No service-role or secret key appears in the code, the browser bundle or Git; `.env.local` is ignored by Git.
- Only non-sensitive sample data is stored, and the demo-mode notice is visible. *[Superseded 2026-10-15: the notice no longer exists; see Part A.]*

### 6.6 Other optional features (when implemented)

- **Colour-coded tags and collections:** a tag's or collection's colour (one of eight) can be changed, persists after reload, and is shown consistently in the sidebar, list and editor; count badges stay neutral.
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
4. **Feature branch 3 (optional task), `feature/collection-count-badges`:** the badge feature (E6).
5. **Documentation:** `docs/SUPABASE_REFERENCES.md` (E11) is already written, with its source URLs at the top, and is extended when new Supabase behaviour is used.

Each branch is merged through its own PR (E7). Branch 3 satisfies E6.

*[Note 2026-10-15: the work later continued with `feature/color-coded-tags-collections` (PR #4), `feature/google-signin` (PR #5) and `feature/post-login-navigation` (PR #6), all merged. Sprint 2 work is planned in Part A, A9.]*

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
| Q1 | Keep the three-column layout: left = collections (flat rows, Uncollected first) and tags, with counts; middle = filtered, searchable notes list; right = editor. Shared note-card component where appropriate. |
| Q2 | `notes.updated_at` is maintained by a PostgreSQL trigger. |
| Q3 | `collections.user_id` stays nullable for future authentication compatibility. *[Superseded: `not null` since Feature 7.]* |
| Q7 | UI library: shadcn/ui + Tailwind CSS (compared options Primer and Material UI not pursued). |
| Q8 | Every note update, including collection moves, bumps `updated_at`; the trigger stays as is. |
| Q9 | Responsive: three columns on wide desktop, collapsible sidebar at 768 to 1199px, stacked mobile layout accepted for the MVP. |
| Q4 | Recommended review command for E8: `/code-review` (built-in, reviews a PR number, branch or diff and reports correctness findings). `/security-review` is a good second choice for the PR that adds the anon-access migration. Not executed yet. See the note below. *[Dated note 2026-10-15: superseded. `REFLECTION.md` records the reviews actually run: `/code-review` on PRs #1, #2 and #5, and the plugin `/comprehensive-review:full-review` on PRs #1 to #4 (PR #3 only phases 1 and 2), plus fresh-session reviews.]* |
| Q5 | No GitHub remote is configured (`git remote -v` is empty). The GitHub CLI (`gh`) is installed and logged in. No repository has been created or pushed. *[Status corrected 2026-10-15: the remote `origin` is `https://github.com/marcbecker1974/notes-lab` and PRs #1 to #6 are merged. This is the development repository, not the final Turing submission location (Part A, SUB-1).]* |
| Q6 | The first planning commit contains only `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, `REFLECTION.md`, `.gitignore` and `CLAUDE.md`. |

*Note on Q4:* the course wording "third-party slash command" is not defined in the material I have. `/code-review` ships with Claude Code and is not written by this project; the personal `pr-review` skill is the user's own and probably does not count as third-party. Confirm what the course accepts.

### Follow-up (historical; done as Feature 7): "Implement user-level data isolation and secure Supabase RLS policies."

*[Superseded 2026-10-15: this follow-up is Feature 7 (P0) in Part A, A9, with its data-handling decisions in A10, and is implemented on `feature/user-data-isolation-rls` (not merged yet); the temporary policies are gone, the data was deleted instead of backfilled.]*

*(Mid-Sprint wording.)* Sign-in did not make notes private. Needed before any real data: backfill `user_id`, set it `not null`, drop the `TEMP anon` policies and anon grants, add owner policies, remove the `/notes` exemption in `lib/supabase/proxy.ts`, add cross-owner tests, and decide whether Google sign-up should be restricted (for example to an allow-list). Steps are in ARCHITECTURE.md section 6. Until then, use non-sensitive sample data only.

### Follow-ups after Feature 6 (not started)

- User-level data isolation and secure Supabase RLS (above).
- Full mobile note editing below 768px.
- Verify the token-hash recovery flow (`/auth/confirm`, `type=recovery`) end to end.
- Retest password recovery and registration with email confirmation when Supabase email delivery is available again.

### Still needing approval

- Whether `docs/SUPABASE_REFERENCES.md` goes in the first planning commit (Q6 does not list it, but E11 needs it in `docs/`).
- Whether a GitHub repository is created and a remote added, and when (needed before the first PR).
- Whether `/code-review` is accepted as the third-party command for E8.

*[Status corrected 2026-10-15: these three items were handled during Mid-Sprint. `REFLECTION.md` records that the third-party `/comprehensive-review:full-review` plugin was installed and run on PR #1, in addition to `/code-review` and a fresh-session review. The Mid-Sprint review workflow was applied to PRs #1 to #6. Whether the course accepts each review as the required third-party command was not confirmed in the repository.]*
