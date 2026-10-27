# PR #16 review (2026-10-27)

Scope: `git diff main...HEAD` at `dd82fce` (5 commits, 55 files). Reviewer: the project's `ai-code-reviewer`
subagent, which has no shell and read the diff from files. The working tree also holds three unrelated
uncommitted files (`next.config.ts`, `package.json`, `package-lock.json`); they are not part of this PR.
Nothing was run beyond the checks listed under "Verified by the author". Not a human review.

Result: no Critical findings, no secrets or env files in the diff, no change under `app/`, `components/`
or `lib/`. Playwright `baseURL` is `http://127.0.0.1:3000`. Five Warnings and several Suggestions below.

## Warnings

1. **Live-database writes, cleanup only on success** (`tests/note-persists.spec.ts`,
   `tests/edit-title.spec.ts`). Both sign in as test account A (shared with `test:rls`) against the live
   Supabase project and delete their note only at the end of a passing run. A failure or timeout leaves
   `ZZ-E2E-*` notes in that account. No `supabase/maintenance/` script or CLAUDE.md line covers `ZZ-E2E-`.
2. **`test:e2e` is undocumented as a live-data test** (CLAUDE.md "Browser tooling" bullet). It does not say
   the tests need `TEST_USER_A_*` in `.env.test.local`, run against the live database, need
   `npx playwright install chromium`, or that `reuseExistingServer` attaches to any server on port 3000.
   `docs/PROJECT_BRIEF.md` line 127 still lists "no automated browser tests" as a known limitation.
3. **Silent policy change in CLAUDE.md.** The `REFLECTION.md` rule is now owner-request-only, the
   pre-merge "record a real finding in `REFLECTION.md`" requirement is removed, and the Feature 10
   dashboard-change reporting rule changed. Check the Sprint 2 submission checklist does not still
   depend on the old rule.
4. **Vendored skill contradicts project policy** (`.agents/skills/supabase/SKILL.md`, "Option B", line 133).
   It tells agents to run SQL directly; the skill auto-loads through the `.claude/skills/` symlinks. The
   CLAUDE.md override only helps if it is read. No script runs automatically.
5. **Vendored skill version mismatch.** `.agents/skills/supabase-postgres-best-practices/SKILL.md` says
   version 1.1.1 while its `CHANGELOG.md` lists 1.6.0 as newest. The reviewer reports the same pattern for
   `supabase/SKILL.md` (0.1.2); that one was not re-checked. The hashes in `skills-lock.json` were not verified.

## Suggestions

- `playwright.config.ts` keeps template boilerplate, including a commented `localhost` baseURL that
  contradicts the 127.0.0.1 rule; `fullyParallel: true` sits beside `workers: 1`.
- `process.loadEnvFile` needs Node 20.12+; `package.json` has no `engines` field.
- Login and cleanup steps are duplicated across both tests; `note-persists.spec.ts` has a redundant
  `goto('/')`; `waitForLoadState('networkidle')` before reloads is a stopgap for an `ERR_ABORTED` flake.
- "All changes saved" may already be visible before the save completes; the reload assertion catches this.
- `.gitignore` adds `node_modules/`, a duplicate of the existing `/node_modules` (line 4 vs 53).
- The Playwright MCP convention in CLAUDE.md has no `.mcp.json` in the PR.

## Verified by the author

Line 127 of the brief, the `Option B` heading, the changelog/version mismatch of the postgres skill, the
commented `localhost` line, the duplicate `node_modules` entry and the missing `engines` field were checked
in the repository. Both Playwright tests passed 2/2 in Chromium on 2026-10-27 before the review.
No fixes are made by this commit.
