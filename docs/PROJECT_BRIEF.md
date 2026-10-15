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
| BONUS-2 | SQL evidence demonstrating correct user-specific data ownership (X6, X10 in A7) | OPEN. Not claimed. |

## A6. Submission requirements

All pending items are tracked as `SUB-…` rows in A7. Required: the correct repository in the **Turing submission area** (pending; the development repository is not it); at least one merged PR with visible diff and description; a README that explains the application; the selected app option (continued Mid-Sprint Notes App); local installation and run instructions; the required environment variable names and how to obtain their values; a screenshot of the local application; the selected optional task(s) with their feature branches and merged PRs. Deployment to a public URL is **not** required.

## A7. Requirements Traceability Matrix

**How to read it.** `Cat.`: T Turing mandatory, T+ additional security test, O selected Turing optional, P additional product requirement, E evaluation, S submission. `Impl.`: implementation state in the repository, always one of `None`, `Partial`, `Done` or `n/a`; a parenthetical only qualifies it and is never a fifth value. `Status`: verification status (values above), applied strictly: `PASS` needs current evidence (a result that is stale or that predates a relevant change is `EVIDENCE REQUIRED` or `RETEST REQUIRED`). Rows under "Supporting evidence (non-scoring)" are not acceptance criteria and are never counted towards a requirement. **Evidence standard (applies to every row).** *Current verified evidence*: a check that was run, with a date, against the present state after the last relevant change; only this can support `PASS`. *Historical evidence*: an earlier recorded result that predates a relevant change or whose state cannot be confirmed; it is kept in the row, but it supports only `RETEST REQUIRED` or `EVIDENCE REQUIRED`. *Known failure*: a criterion contradicted by a committed artifact (for example a migration) and by the last recorded observation, with nothing since that changes it; recorded as `FAIL` and to be confirmed against the live system by S2-X6. *Not started or never tested*: `OPEN`. Reading the source code never produces `PASS`. Evidence names who or what verified it and when. "Feature · PR" gives the related roadmap feature and merged PRs or commits (from `git log` and `gh pr list`, 2026-10-15). Test results themselves are recorded in `REFLECTION.md`.

### Mandatory Turing requirements

| ID | Cat. | Requirement and acceptance criteria | Impl. | Status | Verified evidence | Missing / remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| S2-R1.1 | T | Email/password sign-in works and ends in the private app | Done (starter login form, `POST_LOGIN_PATH`) | RETEST REQUIRED | Owner manual PASS 2026-10-14 (REFLECTION, Feature 6). Not re-run after the PR #6 review fixes. | Retest with the two test accounts | F6 · PR #6 (4e2a16b, 41fb875) |
| S2-R1.2 | T | A visible sign-out ends the session | Done (`components/notes/auth-status.tsx`, `logout-button.tsx`) | RETEST REQUIRED | Owner manual PASS 2026-10-14 for both methods; cross-tab sign-out PASS after the fixes | Retest after Feature 7; note: the Login link for anonymous visitors disappears once `/notes` is private | F6 · PR #6 |
| S2-R1.3 | T | Test accounts can be created through Supabase Auth or the registration page; a self-service page is not mandatory | Done (dashboard users; starter sign-up page) | OPEN | Registration with email confirmation passed manually 2026-10-14 before the review fixes | Create and record test accounts A and B (see S2-R6.1); the registration retest is S2-X8 | F5, F6 · PR #5, #6 |
| S2-R2.1 | T | Server verifies the user's identity before rendering `/notes` | None | OPEN | `lib/supabase/proxy.ts` explicitly exempts `/notes` (read 2026-10-15); only `/protected` is verified on the server | Remove the exemption; verify on the server (design in ARCHITECTURE section 9) | F7 |
| S2-R2.2 | T | A signed-out user opening `/notes` directly is redirected to `/auth/login` | None | OPEN | Not testable until S2-R2.1 | Test: direct URL, after sign-out, with an expired session | F7 |
| S2-R2.3 | T | Browser-side session state alone is not relied on | Partial | OPEN | `AuthStatus` uses `getUser()` for display only; display is not protection | Server check in the page or proxy path, no client-only gate | F7 |
| S2-R3.1 | T | `user_id` ownership column on `notes`, `collections`, `tags`: `not null`, default `auth.uid()` | Partial (column exists, nullable) | OPEN | Migrations and ARCHITECTURE section 3 | Backfill per the approved data plan (A10), then constrain | F7 · PR #1 (f655f74) |
| S2-R3.2 | T | RLS is enabled on every user-data table, including `note_tags` | Done | EVIDENCE REQUIRED | Historical evidence, a live read-only query on 2026-10-13: RLS enabled on all four tables (REFLECTION, Phase C); the later `add_palette_colors` migration created no table. That result is not current, so it is not counted as `PASS`. **Scope:** this assessment covers the four current user-data tables (`notes`, `collections`, `tags`, `note_tags`); future Storage security (`storage.objects`, OPT-2.2) is **not** covered and needs its own verification in Feature 10. | Re-query the live database (read-only) and record the result in `REFLECTION.md`; re-verify after Feature 7 (S2-X6) | F1 · PR #1 |
| S2-R3.3 | T | Appropriate owner-only policies, one per operation, naming the role with `to` | None | OPEN | Only the 16 `TEMP anon …` policies (`using (true)`) exist | Write owner policies; `note_tags` through the parent note | F7 |
| S2-R3.4 | T | Users and anonymous visitors see and change only what they own (no access without ownership) | None | FAIL | Known failure: the committed migration `…094208` creates `TEMP anon …` policies (`using (true)`) and CRUD grants for `anon` and `authenticated` on all four tables, and no later migration changes them (source inspection, which supports the failure but never a `PASS`). Historical evidence: the 2026-10-13 REST smoke test (31/31) performed anonymous CRUD. The live database was not queried on 2026-10-15; the documented demo exception applies. | Drop the TEMP policies and anon grants in the Feature 7 migration | F7 |
| S2-R3.5 | T | Relationships stay within one owner (`note_tags`, `notes.collection_id`); cross-owner references are rejected | None | OPEN | Checklist in ARCHITECTURE section 6 step 9, no tests | Policy checks plus negative tests (X5) | F7 |
| S2-R3.6 | T | All user-created items are stored in Supabase | Done (notes, collections, tags, links) | RETEST REQUIRED | Historical evidence only: `lib/notes-db.ts` is the only data path (source); smoke and browser suites 2026-10-13; owner manual "Notes CRUD across sessions" PASS on 2026-10-14, recorded before the PR #6 review fixes and not repeated since (REFLECTION). No current Sprint 2 run exists. **Scope:** the current database tables only; images in Storage (OPT-2.1) are verified separately in Feature 10. | Retest persistence in Supabase after Feature 7; verify Storage separately in Feature 10 | F1–F4 · PR #1, #2 |
| S2-R3.7 | T | No application user data in `localStorage` or `sessionStorage` | Partial (source search only, not checked in the browser) | EVIDENCE REQUIRED | Source `grep` for `localStorage` and `sessionStorage` in `app/`, `components/`, `lib/`, `proxy.ts` found nothing (2026-10-15). Not checked in the browser; libraries (for example the theme switcher) were not inspected. | DevTools check in the browser; record what is stored | F7 |
| S2-R3.8 | T | The existing shared demo data is resolved without losing personal data (derived from S2-R3 and planning decision D5, not a separate Turing wording) | None | OPEN | A10; live data not inspected in this task | Decision and approval before any change (A10) | F7 |
| S2-R4.1 | T | Create, edit and delete notes work with user-specific data under RLS | Partial (shared data only, not per user) | RETEST REQUIRED | Browser suites (27, 33 and others, scripts outside the repo) 2026-10-13 and owner manual CRUD 2026-10-14 ran against shared anon data, not per-user RLS | Re-run as authenticated owner after Feature 7 | F2 · PR #2 (5632a83, 8fcc63d) |
| S2-R4.2 | T | Saved changes survive a reload | Partial (shared data only, not per user) | RETEST REQUIRED | Same as S2-R4.1 | Re-run per user after Feature 7 | F2 · PR #2 |
| S2-R5.1 | T | The app runs locally at `http://127.0.0.1:3000` with `npm run dev` | Done (`dev` binds `-H 127.0.0.1`) | PASS | Owner manual use 2026-10-14; `package.json` script | None | F1 · PR #1 (670dc2d) |
| S2-R6.1 | T | Create or obtain a test account (account A) | None | OPEN | Not done | Create or confirm account A, record it | F7 |
| S2-R6.2 | T | Sign in and reach the private application | Partial | OPEN | **From source inspection only (2026-10-15):** the sign-in form and `POST_LOGIN_PATH` send a signed-in user to `/notes`, and `/notes` renders because `lib/supabase/proxy.ts` exempts it. **Not verified:** no browser or end-to-end run of this step in its Sprint 2 form exists, and because `/notes` is not private it cannot satisfy this step yet. Earlier owner results (landing on `/notes`, 2026-10-14) are historical and are not a private-area test. | Run in a browser with account A after Feature 7 | F7 |
| S2-R6.3 | T | Create an item and confirm it persists after reload | Partial | OPEN | See S2-R4 | Run as account A after Feature 7 | F7 |
| S2-R6.4 | T | Sign out and confirm private routes redirect to login | None | OPEN | Blocked by S2-R2 (not implemented) | Run after Feature 7 | F7 |
| S2-R6.5 | T | Sign in with a second account (B) | None | OPEN | Not done | Create account B | F7 |
| S2-R6.6 | T | The second account cannot see the first account's items | None | OPEN | Not possible until S2-R3 | Run after Feature 7 | F7 |

### Supporting evidence (non-scoring)

Not an acceptance criterion of any Turing requirement; it is context for S2-R2 and is never counted towards it.

| ID | Cat. | Observation | Impl. | Status | Verified evidence | Remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| SUP-1 | – | An existing server-verified route (`/protected`, starter) redirects a signed-out visitor to the sign-in page | Done | RETEST REQUIRED (non-scoring) | Historical evidence: owner manual PASS (Feature 5 test 8; the date is not recorded in `REFLECTION.md`, PR #5 was merged 2026-10-14) and a curl smoke test during Feature 5 (undated) | Re-run as a regression check; it does not show that `/notes` is protected | F5 · PR #5 |

### Additional security and regression tests (ours, not the official minimum)

| ID | Cat. | Test | Impl. | Status | Verified evidence | Missing / remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| S2-X1 | T+ | B cannot update or delete A's notes, collections, tags (UI and API) | None | OPEN | – | Run after Feature 7 | F7 |
| S2-X2 | T+ | Direct database (PostgREST) requests with B's token, A's ids and no token return no private data | None | OPEN | – | Run after Feature 7 | F7 |
| S2-X3 | T+ | Anonymous requests with only the publishable key cannot read or write | None | FAIL | Known failure: same artifacts as S2-R3.4 (the `TEMP anon …` migration, source inspection). Historical evidence: the 2026-10-13 smoke test (31/31) performed anonymous CRUD. Live state not re-queried. | Same fix as S2-R3.4; confirm live with S2-X6 | F7 |
| S2-X4 | T+ | Collections and tags are user-specific, also their uniqueness (same name for two users is allowed) | None | OPEN | The unique name indexes are `(user_id, lower(btrim(name)))`, see ARCHITECTURE | Run after Feature 7 | F7 |
| S2-X5 | T+ | Cross-owner relationships are rejected (`note_tags`, `notes.collection_id`) | None | OPEN | Not started: no cross-owner test exists, and there is no ownership model to test until Feature 7; the cases are listed in ARCHITECTURE.md section 6 step 9 | Same as S2-R3.5 | F7 |
| S2-X6 | T+ | RLS policies, grants and `user_id` constraints verified against the **actual** Supabase database (read-only SQL on `pg_policies`, `information_schema`) | None | OPEN | Last live read 2026-10-13 shows the TEMP policies | Record SQL and output in `REFLECTION.md` (supports BONUS-2) | F7 |
| S2-X7 | T+ | Google sign-in regression: still works after Feature 7 and leads to `/notes` | Done | RETEST REQUIRED | Owner manual PASS in the Feature 6 results of 2026-10-14 (the Feature 5 tests are not dated in `REFLECTION.md`); cancellation flow never verified (REFLECTION) | Retest after Feature 7 | F5 · PR #5 |
| S2-X8 | T+ | Email registration with confirmation regression | Done | BLOCKED | Passed manually 2026-10-14 before the PR #6 review fixes. After them it could not be retested: Supabase returned "email rate limit exceeded" (A11). | Retest when email delivery is available; do not count the old result | F6 · PR #6 |
| S2-X9 | T+ | Password-recovery regression (forgot-password, email link, new password, `/notes`) | Done | BLOCKED | Passed manually before the fixes; after the L1 fix only covered by automated tests (REFLECTION). Blocked by the same rate limit. | Retest when email delivery is available | F6 · PR #6 |
| S2-X10 | T+ | SQL evidence of correct user ownership (two users, rows and policies) | None | OPEN | – | Collect with S2-X6 (BONUS-2) | F7 |
| S2-X11 | T+ | Wrong password and other sign-in errors show a clear message | Done (starter) | EVIDENCE REQUIRED | Not reported as manually tested (REFLECTION, Feature 6 "not verified") | Manual test | F6 |
| S2-X12 | T+ | Static quality checks pass: type check, lint, auth unit tests and build (our quality standard, not a Turing acceptance criterion) | Done | RETEST REQUIRED | Current evidence, 2026-10-15 on `main` (no application code changed since 41fb875): `tsc --noEmit` no errors, `npm run lint` clean, `npm run test:auth` "all auth tests passed" (automated only). Historical evidence: `next build` passed 2026-10-14 (REFLECTION); it was not run on 2026-10-15. | Run `next build`; repeat all four before each PR | all |

### Selected Turing optional tasks

| ID | Cat. | Requirement and acceptance criteria | Impl. | Status | Verified evidence | Missing / remaining action | Feature · PR |
|---|---|---|---|---|---|---|---|
| OPT-1.1 | O | A user can export the selected note as a valid downloadable `.md` file | None | OPEN | Selected 2026-10-15, not implemented | Implement; check the downloaded file content | F9 |
| OPT-1.2 | O | Formatting is preserved: headings, lists and links where supported; rich-text content is handled appropriately | None | OPEN | Depends on the content format chosen in PR-RTE-01 | Decide order with F8 (A9); until then only plain-text notes exist | F9 (F8) |
| OPT-1.3 | O | Export exposes no other user's notes | None | OPEN | – | Test with two accounts | F9 (F7) |
| OPT-1.4 | O | Own feature branch and separate merged PR with visible diff and description | None | OPEN | – | Branch, PR, review, merge | F9 |
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
| PR-RTE-01.1 | P | The editor supports headings, paragraphs, bold, italic, underline, bulleted and numbered lists, links and formatting controls | None (plain-text area) | OPEN | Mockup toolbar inspected 2026-10-15 (A4); details open | Resolve the open UI decisions, then implement | F8 |
| PR-RTE-01.2 | P | An established, maintained editor library is selected (no custom engine) | None | OPEN | Not selected, nothing installed (by decision) | Architecture assessment and approval of the dependency | F8 |
| PR-RTE-01.3 | P | A content storage format is defined; existing plain-text notes are preserved or safely migrated | None | OPEN | As of 2026-10-15 `notes.body` is plain text with a 20,000-character check constraint (ARCHITECTURE section 3) | Format decision, migration plan, constraint review | F8 |
| PR-RTE-01.4 | P | User-generated content is rendered safely (no unsafe HTML or script execution) | None | OPEN | – | Sanitising or schema-based rendering; test with hostile input | F8 |
| PR-RTE-01.5 | P | Saved rich-text content reloads identically and persists in Supabase; in-memory search still finds title and body text | None | OPEN | Search runs in memory over plain text as of 2026-10-15 (`lib/notes-view.ts`) | Plain-text projection for search; round-trip tests | F8 |
| PR-RTE-01.6 | P | Markdown export and image insertion are supported by the format; user-specific access controls are preserved | None | OPEN | – | Align with F9, F10 and F7 | F8 |
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
| 1 | Create or obtain test account A; sign in with email/password; reach the private app | Official | Manual | S2-R6.1, R6.2, R1.1, R1.3 | not run |
| 2 | A creates and edits private notes (also a collection and a tag); sign-out is visible and works | Official | Manual | S2-R6.3, R4.1, R1.2 | not run |
| 3 | A reloads and keeps the data | Official | Manual | S2-R6.3, R4.2, R3.6 | not run |
| 4 | Signed out: opening `/notes` redirects to `/auth/login` (direct URL, after logout, expired session) | Official | Manual plus HTTP check | S2-R6.4, R2.1 to R2.3 | not run |
| 5 | Create or obtain test account B; sign in with it | Official | Manual | S2-R6.5 | not run |
| 6 | B cannot see A's notes, collections or tags | Official | Manual | S2-R6.6, R3.4 | not run |
| 7 | B cannot update or delete A's data (UI and direct API with B's token) | Additional | Manual plus scripted API | S2-X1, X2 | not run |
| 8 | Anonymous requests (publishable key only) cannot read or write private data | Additional | Scripted API | S2-X3 | not run (known failure per the TEMP migration and the 2026-10-13 smoke test; live recheck pending) |
| 9 | Collections and tags are per user; same name allowed for two users | Additional | Manual plus SQL | S2-X4 | not run |
| 10 | Cross-owner relationships are rejected (`note_tags`, `notes.collection_id`) | Official (S2-R3.5) plus Additional (S2-X5) | Scripted API | S2-R3.5, S2-X5 | not run |
| 11 | Ownership columns, RLS and owner policies verified against the actual Supabase database | Official (derived from S2-R3) | Read-only SQL | S2-R3.1, R3.2, R3.3 | not run |
| 12 | Google sign-in regression (sign in, lands on `/notes`, sign out) | Additional | Manual | S2-X7 | not run |
| 13 | Email registration with confirmation regression | Additional | Manual | S2-X8 | BLOCKED (email rate limit) |
| 14 | Password-recovery regression | Additional | Manual | S2-X9 | BLOCKED (email rate limit) |
| 15 | No user data in `localStorage` or `sessionStorage` | Official (S2-R3) | Browser DevTools | S2-R3.7 | not run |
| 16 | Local run at `http://127.0.0.1:3000` with `npm run dev` | Official (S2-R5) | Manual | S2-R5.1 | not run in Sprint 2 form (historical owner use 2026-10-14) |
| 17 | Markdown export: downloaded file content matches the note, with other users' notes inaccessible | Additional (OPT-1) | Manual, open the file | OPT-1.1 to 1.3 | not run (not implemented) |
| 18 | Rich-text persistence: formatting identical after save and reload, safe rendering | Additional (PR-RTE-01) | Manual plus hostile-input test | PR-RTE-01.1 to 01.5 | not run (not implemented) |
| 19 | Image upload and retrieval; cross-user image access denied; error and orphan handling | Additional (OPT-2) | Manual plus API | OPT-2.1 to 2.4 | not run (not implemented) |
| 20 | Desktop functionality (three-column layout) | Additional | Manual | S2-R4, PR-RTE-01 | not run in Sprint 2 form |
| 21 | Mobile functionality (open, read, create, edit, save below 768px) | Additional (PR-MOB-01) | Manual at about 375px | PR-MOB-01 | not run (known limitation) |
| 22 | Documentation and PR evidence: README, screenshot, env names, merged PRs, branches, submission copy | Official (submission) | Inspection | SUB-1 to SUB-11 | not run |
| 23 | Sign-in errors: a wrong password and other sign-in errors show a clear message | Additional | Manual | S2-X11 | not run |
| 24 | Static quality checks: type check, lint, auth unit tests and build (our quality standard, automated only; not an official acceptance criterion) | Additional | Automated | S2-X12 | partly run (A7) |
| 25 | Existing data: backup verified, the intended owner's Supabase Auth user ID recorded, personal records retained, disposable demo data handled only after explicit approval | Official (derived from S2-R3 and decision D5) | Inspection plus read-only SQL | S2-R3.8 | not run (open decision, A10) |
| 26 | SQL ownership evidence with two users (rows, owner ids, policies) | Additional (supports BONUS-2) | Read-only SQL | S2-X6, S2-X10 | not run |

## A9. Feature roadmap, dependencies and timeline

| Feature | Priority | Workflow | Scope | Status |
|---|---|---|---|---|
| **7 – User Data Isolation & Secure RLS** | P0 | A – Full Feature Development | Protect `/notes` on the server; users access only their own data; secure `notes`, `collections`, `tags`, `note_tags`; replace the temporary anonymous policies; resolve ownership of the existing shared data; preserve personal records; safe migrations; test with two authenticated accounts; verify anonymous restrictions; retest CRUD and persistence | Planned, not started |
| **8 – Full Rich-Text Editor** | P1, product requirement | A | Select an editor library; implement rich-text formatting; define the persistent content representation; headings, lists, links; preserve existing note content; prepare image integration; secure rendering; consider mobile editing | Planned, not started |
| **9 – Export to Markdown** (OPT-1) | P1, selected Turing optional | B – Standard Feature | Export individual notes as `.md`; preserve supported rich-text formatting; headings, lists, links; handle image references; verify the downloaded file; own branch and PR. Normal feature planning and approval; it does not automatically need the security assessment of a database or Storage change (it reads only what the user can already read) | Planned, not started |
| **10 – Image Uploads with Supabase Storage** (OPT-2) | P1, selected Turing optional | A | Configure Storage; secure uploads; associate images with the right user; insert into notes; persist across reloads; prevent cross-user access; errors and cleanup; own branch and PR. Needs an architecture and security assessment; bucket configuration and `storage.objects` access policies are reviewed explicitly; schema and policy changes use version-controlled migrations where supported, and an approved dashboard change is documented when a migration is not applicable | Planned, not started |

Additional follow-ups (not yet features): mobile editor accessibility (PR-MOB-01); optional account linking (FUT-1); final README (SUB-3, SUB-5 to SUB-8); complete Sprint 2 regression testing (A8); SQL ownership evidence (S2-X6, S2-X10); Turing submission preparation (SUB-1, SUB-2, SUB-9).

**Dependencies (proposal, to be reviewed before development).**
- Feature 7 comes first and blocks the official verification (S2-R2, S2-R3, S2-R6), and the ownership and access rules for Features 9 and 10. Its data decisions (A10) need explicit approval first.
- Feature 9 needs a content format. Done after Feature 8 it can export rich text; done before it, only plain-text notes can be exported and OPT-1.2 stays open until the format exists.
- Feature 10 needs Feature 7 (per-user Storage policies) and, for insertion into the editor, Feature 8.
- Feature 8 is the largest piece: library choice, content format, migration of existing notes, safe rendering, search over rich content, review of the body size constraint.
- The mobile editing requirement may be bundled into Feature 8 only by an explicit recorded decision.

**Timeline and feasibility.** Target 2026-10-19, buffer 2026-10-20, deadline 2026-10-21; this assessment is dated 2026-10-15. **Feasibility has not been estimated in effort units and the full roadmap is not assumed to fit.** Qualitative assessment, to be replaced by estimates in each feature's architecture assessment: Feature 7 plus the two-account verification, the README and the screenshot are the minimum for a valid submission (P0). Features 8 and 10 are each substantial and Feature 10 depends on both 7 and 8, so completing all four features before the deadline is **at risk**. Proposal for the review: protect P0 first; do the first selected optional task that fits the remaining time to secure OPT-R; treat the rest as stretch goals; if Feature 7 is not merged early enough, drop the P1 product work and keep the buffer day for the regression checklist and submission. Official requirements take precedence if the deadline is at risk.

## A10. Existing data and ownership (OPEN DECISION for Feature 7)

**Facts (verified).** `notes`, `collections`, `tags` hold rows with `user_id` null, written while access was open: the last recorded counts are 8 notes, 3 collections, 4 tags, 7 links (REFLECTION, 2026-10-13/14). Since then the owner has used the app in manual tests, so **the live data was not inspected in this task and may have changed**. Nothing was deleted, reassigned or modified.

**Decisions already taken (owner, 2026-10-15).** The shared demo data is no longer required. Personal journal data **must be preserved**. The owner's Google-authenticated account will hold the personal journal. Every user owns their own notes, collections and tags, relationships stay within one owner, other users' data is invisible. The demo data may be deleted later after verification and approval. **Existing records are not automatically assigned to one user.**

**Before Feature 7 is implemented (all required, none done):**
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
- Per-user RLS removes the public `/notes` route: the Login link and the demo banner for anonymous visitors then no longer apply to `/notes`.
- Rich text changes the data model: the `notes_body_length` constraint (20,000 characters) and in-memory search over plain text need review in Feature 8.

**Open decisions (none decided yet).**
1. Existing data: inspection, backup, owner user ID, cleanup and approval (A10).
2. Rich-text editor: library, storage format, heading levels, numbered-list control, whether the mockup's code and full-screen buttons are required, handling of existing plain-text notes.
3. Mobile editing: bundled with Feature 8 or separate.
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

*[Mid-Sprint constraints. The temporary anonymous access described here is replaced by Feature 7 (Part A, A9); it is still the actual state of the database until that feature is merged.]*

The notes data has no per-user protection, so the database is temporarily reachable by anonymous (`anon`) clients. Google and email/password sign-in exist (Feature 5) but only gate the starter's `/protected` page; they do not restrict notes. Since Feature 6 a successful sign-in, email confirmation or password update lands on `/notes` (navigation only). The notes header also shows the signed-in email with a Logout button, or a Login link for anonymous visitors (display only). The following constraints therefore still apply. Details are in [ARCHITECTURE.md](./ARCHITECTURE.md).

- **Environment:** the app runs locally on `127.0.0.1:3000` (`npm run dev` binds that address; do not use `localhost`, see ARCHITECTURE.md 4a) against a cloud-hosted Supabase project. It is not deployed, shared or published.
- **Non-sensitive data only:** use generic sample data. Never store real personal notes, names or credentials while anonymous access is enabled.
- **Anonymous access is temporary and isolated:** the anon read/write policies live in one dedicated migration, named and commented as temporary, and are the only place that mentions `anon`. Removing that migration closes anonymous access.
- **Accepted risk:** anyone with the project URL and publishable key can read, modify or delete rows in the four app tables. This is acceptable only for local development with non-sensitive data.
- **Abuse limits:** size limits on titles, bodies, and tag and collection names.
- **Keys:** only the publishable key is used in the browser. A service-role or secret key must never be added to the project or to any `NEXT_PUBLIC_` variable. `.env.local` stays out of Git, and `supabase/.temp/` is ignored via `.gitignore`.
- **Demo-mode notice:** the UI shows a notice that data is publicly accessible while anonymous access is on.
- **Auth-ready design:** the schema has a nullable `user_id` (default `auth.uid()`) on `notes`, `collections` and `tags`. All database access goes through `lib/notes-db.ts`, which never reads or writes `user_id` and has no role or auth logic. Sign-in (email/password and Google) is separate from notes: `/notes` stays open, the TEMP policies also grant every signed-in (`authenticated`) user full access, and this is **not** suitable for confidential data or production use.
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
- R3.2 Any additional columns (the nullable `user_id`) are nullable or defaulted, so inserting `name` alone succeeds.

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
- Anonymous access policies exist only in the dedicated temporary migration, and only on the four app tables.
- No service-role or secret key appears in the code, the browser bundle or Git; `.env.local` is ignored by Git.
- Only non-sensitive sample data is stored, and the demo-mode notice is visible.

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
| Q3 | `collections.user_id` stays nullable for future authentication compatibility. |
| Q7 | UI library: shadcn/ui + Tailwind CSS (compared options Primer and Material UI not pursued). |
| Q8 | Every note update, including collection moves, bumps `updated_at`; the trigger stays as is. |
| Q9 | Responsive: three columns on wide desktop, collapsible sidebar at 768 to 1199px, stacked mobile layout accepted for the MVP. |
| Q4 | Recommended review command for E8: `/code-review` (built-in, reviews a PR number, branch or diff and reports correctness findings). `/security-review` is a good second choice for the PR that adds the anon-access migration. Not executed yet. See the note below. *[Dated note 2026-10-15: superseded. `REFLECTION.md` records the reviews actually run: `/code-review` on PRs #1, #2 and #5, and the plugin `/comprehensive-review:full-review` on PRs #1 to #4 (PR #3 only phases 1 and 2), plus fresh-session reviews.]* |
| Q5 | No GitHub remote is configured (`git remote -v` is empty). The GitHub CLI (`gh`) is installed and logged in. No repository has been created or pushed. *[Status corrected 2026-10-15: the remote `origin` is `https://github.com/marcbecker1974/notes-lab` and PRs #1 to #6 are merged. This is the development repository, not the final Turing submission location (Part A, SUB-1).]* |
| Q6 | The first planning commit contains only `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, `REFLECTION.md`, `.gitignore` and `CLAUDE.md`. |

*Note on Q4:* the course wording "third-party slash command" is not defined in the material I have. `/code-review` ships with Claude Code and is not written by this project; the personal `pr-review` skill is the user's own and probably does not count as third-party. Confirm what the course accepts.

### Follow-up (not started): "Implement user-level data isolation and secure Supabase RLS policies."

*[Superseded 2026-10-15: this follow-up is now Feature 7 (P0) in Part A, A9, with its data-handling decisions in A10.]*

Sign-in does not make notes private. Needed before any real data: backfill `user_id`, set it `not null`, drop the `TEMP anon` policies and anon grants, add owner policies, remove the `/notes` exemption in `lib/supabase/proxy.ts`, add cross-owner tests, and decide whether Google sign-up should be restricted (for example to an allow-list). Steps are in ARCHITECTURE.md section 6. Until then, use non-sensitive sample data only.

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
