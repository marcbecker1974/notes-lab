# CLAUDE.md

@AGENTS.md

Notes Lab: a personal notes app (AI Learning Journal) with collections, tags and live search. Course project: Turing College Mid-Sprint "Notes App with Collections and Search".

Read before working: `docs/PROJECT_BRIEF.md` (scope and acceptance criteria), `docs/ARCHITECTURE.md` (design and security), `docs/SUPABASE_REFERENCES.md` (cited Supabase references).

## Project rules

- Stack: Next.js App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL, supabase-js. Run locally with `npm run dev` (localhost:3000).
- Next.js in this repo has breaking changes (see `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.
- Out of scope: authentication, deployment, rich-text editing, AI features, file uploads, public sharing. Do not implement them. The template's `/auth/*` and `/protected` pages stay untouched and unused.
- Reuse the existing project and Supabase setup. Do not add dependencies or services without asking.
- Scope changes are recorded in `docs/PROJECT_BRIEF.md`.

## Database access rules (centralised)

- **All reads and writes of notes, collections and tags go through `lib/notes-db.ts`, using supabase-js.** No other file under `app/`, `components/` or `lib/` may call `supabase.from(...)` for those tables. Known exception until `feature/notes-ui`: the starter's `app/notes/page.tsx` still queries `notes` directly and is replaced there.
- The module obtains its client in one internal `getClient()` (the existing browser client from `lib/supabase/client.ts`). Never create a Supabase client at module scope on the server, create it per call.
- Use explicit column lists, not `select('*')`. Fetch related rows with nested `select` (embedding) instead of extra requests.
- Always check `error`. Functions return typed data or throw a typed `NotesDbError` with a user-safe message; raw Postgres errors do not reach the UI.
- `notes-db.ts` never reads or writes `user_id` and contains no role, `anon` or auth logic. Exported types omit `user_id`. This keeps the app auth-ready.
- Filtering, AND tag filtering, search and count badges run in memory on loaded data, not through extra queries.

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
- Planning docs go in the first commit on `main`. Application work goes on feature branches (`feature/db-schema-and-helper`, `feature/notes-ui`, `feature/note-count-badges`) merged through pull requests.
- Check `git status` before every commit; never stage `.env.local` or `supabase/.temp/`.
- Do not commit, push or create a repository or remote unless asked.
- Before merging a PR, run a review slash command on its diff and record a real finding in `REFLECTION.md`. Also review one PR diff in a fresh Claude Code session and record a finding. Never invent findings.
- Keep this file up to date when the Supabase conventions or database access rules change.
