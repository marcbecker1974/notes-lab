# CLAUDE.md

@AGENTS.md

Notes Lab is the active **Turing College Sprint 2 project**, "Full-Stack App with Database and Authentication": a secure, multi-user Personal AI Development Journal with collections, tags and live search, continued from the Mid-Sprint Notes App. **Historical context:** the Mid-Sprint project, "Notes App with Collections and Search" (a personal notes app and AI Learning Journal), is complete; its scope and decisions are preserved in `docs/PROJECT_BRIEF.md` Part B.

Read before working: `docs/PROJECT_BRIEF.md` (scope and acceptance criteria), `docs/ARCHITECTURE.md` (design and security), `docs/SUPABASE_REFERENCES.md` (cited Supabase references).

## Active scope: Turing Sprint 2

The Mid-Sprint project is complete and kept as history. The **active scope is the Turing College Sprint 2 project**, "Full-Stack App with Database and Authentication" (Notes Lab as the continued Mid-Sprint app). `docs/PROJECT_BRIEF.md` Part A is the **single source of truth** for the current scope, the official requirements (`S2-R1` to `S2-R6`), the selected optional tasks, the additional product requirements, the Requirements Traceability Matrix, the roadmap, the verification checklist and the submission requirements. Do not copy that list here.

- Before starting any development task, read Part A of the brief, find the related matrix rows and update their status when the work or its verification changes. Never mark a row `PASS` because the code exists; it needs the stated evidence. Official Turing requirements outrank additional product features if the deadline is at risk.
- **Per-user data isolation and secure RLS are now in scope** (Feature 7, P0), together with server-side route protection of `/notes`. Implement them only on their own feature branch, after the architecture assessment and after explicit approval of the existing-data plan (see below).
- Selected for Sprint 2 (not yet implemented): Export to Markdown (Feature 9) and Image uploads with Supabase Storage (Feature 10); the full rich-text editor (Feature 8) is an additional product requirement, not a Turing requirement. Each is selected and approved for planning; the selection does not by itself authorise installing the editor library, creating Storage buckets, changing Storage policies, running migrations or changing Supabase configuration. Those follow the usual workflow, on the feature's own branch and PR. **Feature 9 (Export to Markdown, Workflow B)** needs normal feature planning and approval, not the security assessment of a database or Storage change. **Feature 10 (Image uploads, Workflow A)** needs an architecture and security assessment that explicitly reviews the bucket configuration and the `storage.objects` access policies; its schema and policy changes use version-controlled migrations where supported, and an approved Supabase dashboard change is documented in `REFLECTION.md` when a migration does not apply. New dependencies and services still need explicit approval (unchanged); no additional approval step is added.
- **Existing data:** a backup and explicit approval are required for bulk cleanup, migration, reassignment (for example of owners) or any destructive change to the existing records. Normal user-initiated create, edit and delete in the app is not affected. Do not assign existing records to a user automatically; the intended owner is identified by the actual Supabase Auth user ID.
- Google sign-in and email/password stay supported side by side. Do not merge accounts automatically on a matching email address.
- Do not change the email provider or SMTP settings, and make no other Supabase dashboard change that was not asked for. This does not block the Supabase configuration that an approved Feature 10 (Storage) or Feature 7 requires, once its architecture assessment is approved. Email-dependent flows blocked by the Supabase email rate limit are recorded as BLOCKED, not PASS.

## Documentation responsibilities

- `docs/PROJECT_BRIEF.md`: scope, requirements, acceptance criteria, requirement status, roadmap, verification checklist, submission. Keep the matrix current.
- `REFLECTION.md`: decisions, trade-offs, review findings, executed test results and their evidence, lessons, accepted limitations. Only real results; never invent them.
- `docs/ARCHITECTURE.md`: the actual architecture, auth and authorisation design, data model and policies; planned work stays in its own marked section and is never described as implemented.
- `CLAUDE.md` (this file): binding conventions only. `README.md` is rewritten for the submission later (tracked in the brief).

## Project rules

- Stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase PostgreSQL, supabase-js. Run locally with `npm run dev` (http://127.0.0.1:3000; use this origin, not `localhost`).
- Next.js in this repo has breaking changes (see `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.
- Out of scope: deployment, AI features and public sharing. Do not implement them. (Mid-Sprint also excluded rich-text editing, file uploads and per-user data isolation; under Sprint 2 these are in scope, but **only** as the planned features in the brief: rich-text editor (Feature 8), image uploads (Feature 10) and data isolation (Feature 7), each on its own branch and not ad hoc. Authentication beyond the extension below is covered by the Sprint 2 requirements in the brief.)
- **Authorised authentication extension (Feature 5, `feature/google-signin`):** "Continue with Google" via Supabase Auth, next to the starter's email/password pages. Sign-in is completed on the server in `app/auth/callback/route.ts`; redirect validation, callback outcomes and messages live in `lib/auth/`; the button is `components/google-sign-in-button.tsx`; `/notes` is the destination for both methods (Feature 6, `feature/post-login-navigation`: navigation and a display-only status only, with password-recovery links ending on `/auth/update-password`, via `POST_LOGIN_PATH` in `lib/auth/oauth-callback.ts`; `/protected` stays as the auth test page). The client ID and secret are stored only in the Supabase dashboard, never in the repo or any env file. Local origin is always `http://127.0.0.1:3000` (never `localhost`). **Signing in does not make notes private (current state until Feature 7 is merged):** `/notes` stays open to `anon` and the TEMP policies still give every `authenticated` user full access, so no confidential data. `lib/notes-db.ts` and the notes data flow stay auth-free; the only auth-aware piece of the notes UI is the display-only sign-in status in the header (`components/notes/auth-status.tsx`, Feature 6: email + Logout, or a Login link). Any `next`-style redirect parameter must go through `safeRedirectPath` in `lib/auth/redirect.ts`. Tests: `npm run test:auth`.
- Reuse the existing project and Supabase setup. Do not add dependencies or services without asking.
- UI: shadcn/ui components in `components/ui` (new-york style, Tailwind 3, imports `cn` from `@/lib/utils`), notes UI in `components/notes/`. Do not run `npx shadcn add` unattended: the 4.x CLI added unapproved packages (`cn`, the umbrella `radix-ui`) and imported `cn` from the wrong place. Write or review components by hand and add only the individual `@radix-ui/react-*` packages that are approved (currently `alert-dialog`, `checkbox`, `collapsible`, `dropdown-menu`, `label`, `scroll-area`, `select`, `separator`, `slot`).
- Layout: three columns from 1200px; collapsible collections sidebar at 768 to 1199px; stacked below 768px (accepted for the MVP). **Known limitation:** below 768px the editor is not reachable (its grid row is about 2px high); fixing it is a separate follow-up task, not part of Feature 4. Every note update, including collection moves, bumps `updated_at`.
- Scope changes are recorded in `docs/PROJECT_BRIEF.md`.

## Database access rules (centralised)

- **All reads and writes of notes, collections and tags go through `lib/notes-db.ts`, using supabase-js.** No other file under `app/`, `components/` or `lib/` may call `supabase.from(...)` for those tables. Accepted exception: the starter's `components/tutorial/fetch-data-steps.tsx` (used only by the unused `/protected` page) still queries `notes`; leave it untouched. In the notes UI only `components/notes/use-notes-data.ts` imports `lib/notes-db.ts` for data access; components receive data and callbacks as props. Pure view logic (filter, search, order, counts) lives in `lib/notes-view.ts`; the colour palette lives in `lib/palette.ts` (colours are stored as palette keys, with full Tailwind class strings there, and `tailwind.config.ts` scans `lib/`).
- The module obtains its client in one internal `getClient()` (the existing browser client from `lib/supabase/client.ts`). Never create a Supabase client at module scope on the server, create it per call.
- Use explicit column lists, not `select('*')`. Fetch related rows with nested `select` (embedding) instead of extra requests.
- Always check `error`. Functions return typed data or throw a typed `NotesDbError` with a user-safe message; raw Postgres errors do not reach the UI.
- `notes-db.ts` never reads or writes `user_id` and contains no role, `anon` or auth logic. Exported types omit `user_id`. This keeps the app auth-ready.
- Filtering, AND tag filtering, search and count badges run in memory on loaded data, not through extra queries.
- **Sprint 2 clarification:** access to the existing database tables stays centralised in `lib/notes-db.ts` as above. Supabase Storage (Feature 10, planned, not implemented) is not covered by the table rule: it may use a separate dedicated module (so `storage.from(...)` calls do not count against the table rule), subject to an approved architecture decision. `lib/notes-db.ts` itself keeps not reading or writing `user_id`.

## Supabase conventions

- Schema changes are SQL migrations in `supabase/migrations/` (create with `npx supabase migration new <name>`). Never edit an applied migration; add a new one. Do not change the live database by hand.
- Enable RLS on every table. Write one policy per operation and always name the role with `to`.
- Granting access takes both a policy and a `grant`; adding policies does not remove existing grants.
- **Default privileges:** Supabase gives `anon`, `authenticated` and `service_role` `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` on every new table created by `postgres`, and `TRUNCATE` is not subject to RLS. Do not change the project-wide default privileges (no `alter default privileges`); handle each table individually.
- **Every new table needs its own `revoke all on table … from anon, authenticated;` before any `grant`**, in the same migration that grants access. Then grant only the operations the app uses, naming each table explicitly (a single statement may list several named tables). Never use `all tables in schema`.
- **Anonymous (`anon`) access:** the only migration that creates `anon` policies or grants is the single temporary one (policies named `TEMP anon …`). Other migrations may mention `anon` only to revoke privileges or to document it. The starter's earlier `notes` select policies and grant predate this rule; the temp migration replaces them. Use only non-sensitive sample data while it is enabled.
- Do not edit `public.rls_auto_enable()` or its `ensure_rls` event trigger; hardening was deferred (see `REFLECTION.md`). New tables still enable RLS explicitly.
- Keep `user_id uuid null default auth.uid()` on `notes`, `collections` and `tags`. `updated_at` on `notes` is maintained by a PostgreSQL trigger, not by application code.
- Only the publishable key is used in the browser. **Never** add a service-role or secret key to the project, to `.env.local` or to any `NEXT_PUBLIC_` variable.
- **Never commit `.env.local`.** `supabase/.temp/` is also ignored.
- References: `docs/SUPABASE_REFERENCES.md`. Update it when you rely on a new Supabase behaviour.

## Git workflow

- Meaningful commit messages, Conventional Commits style (`feat(db): add collections and tags tables`). No "update" or "wip".
- Planning docs go in the first commit on `main`. Application work goes on feature branches (Mid-Sprint, all merged: `feature/db-schema-and-helper`, `feature/notes-ui`, `feature/collection-count-badges`, `feature/color-coded-tags-collections`, `feature/google-signin`, `feature/post-login-navigation`) merged through pull requests. Sprint 2 documentation work uses `docs/sprint2-requirements`; each Sprint 2 feature (7 to 10) gets its own branch and PR, named when its architecture assessment is done. The development repository is `marcbecker1974/notes-lab`; the final Turing submission location is pending (see the brief).
- Check `git status` before every commit; never stage `.env.local` or `supabase/.temp/`.
- Do not commit, push or create a repository or remote unless asked.
- Before merging a PR, run a review slash command on its diff and record a real finding in `REFLECTION.md`. Also review one PR diff in a fresh Claude Code session and record a finding. Never invent findings.
- Keep this file up to date when the Supabase conventions or database access rules change.

## Authentication and Route Protection

- Use Supabase Auth for authentication and session management.
- Every authenticated-only route must verify the user's
  identity on the server before rendering protected content.
  This is mandatory only for routes designated as authenticated-only;
  designating a route is a scope decision recorded in `docs/PROJECT_BRIEF.md`.
- Never rely solely on client-side session state.
- Redirect unauthenticated users to /auth/login.
- Use the official Supabase skill for authentication,
  session management and database security tasks.
- Enforce data access permissions through appropriate
  Supabase Row Level Security (RLS) policies. Secure, user-specific
  RLS policies are mandatory for any future protected data access.
- Public routes must be explicitly identified and documented.
  Currently public: `/notes` (open to anonymous visitors, display-only
  sign-in status), `/auth/*` (sign-in, sign-up, callback, confirmation
  and password pages) and `/` (starter landing page); `/protected` is the
  only route that verifies the user on the server (`lib/supabase/proxy.ts`).
- **Documented demo exception:** the temporary anonymous (`TEMP anon …`)
  Notes policies and grants, and the public `/notes` route with them, are
  an accepted exception for the course demo (see "Supabase conventions").
  Their replacement is Feature 7: User Data Isolation &
  Secure RLS (approved P0 of the Sprint 2 roadmap in
  `docs/PROJECT_BRIEF.md`), which also removes the `/notes` exemption in
  `lib/supabase/proxy.ts`. It is not started: implement it only on its own
  feature branch after the architecture assessment and the approved
  existing-data plan (not ad hoc), and until then keep using only
  non-sensitive data.
