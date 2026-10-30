# Chat lab stage 1 verification — 2026-10-30

Branch: `feature/chat-memory-lab`. Existing unrelated local changes were preserved.
No commit, push, Supabase migration or user-data write was performed.

| Check | Result | Scope |
|---|---|---|
| `npm run test:auth` | PASS | Existing auth/ownership regression checks, offline |
| `npm run test:ai` | PASS, 7 tests | Input limits, history, config/model switch, safe errors, network failures. Fetch replaced, no OpenRouter credits |
| `npx playwright test tests/chat-connection.spec.ts --reporter=list` | PASS, 2 tests, 3.1 seconds | Signed-out redirect, real test-account login and notes UI, API validation and cross-origin rejection. No valid model request or database-row changes |
| `npx tsc --noEmit --incremental false` | PASS | TypeScript checks |
| `npm run lint` | PASS | Includes new adapter and browser tests |
| `npm run build` | PASS | Next.js 16.4.3, including /api/chat; repeated after the origin correction |
| Browser-secret scan | PASS | Built with artificial OPENROUTER_API_KEY; neither that canary nor OPENROUTER_API_KEY appears in .next/static JS/map/JSON files |
| `git diff --check` | PASS | No whitespace errors |

Corrections verified: the class uses erasable TypeScript for the Node test runner;
cacheComponents uses the default Node runtime without a route runtime export; the
origin check uses the incoming HTTP Host because Next may internally use localhost
when the browser accesses 127.0.0.1. The Playwright tests verify that same-origin
requests pass this check and foreign-origin requests fail.

Existing nonblocking warning: cacheComponents has no partialPrefetching setting.
No unrelated upgrade/config change was made.

Not verified: real OpenRouter connection (key not configured in notes-lab), real
provider comparison, chat UI, persistence or full chat E2E flows. These remain
explicitly pending in PROJECT_BRIEF.md Part C. No mock run is presented as live AI.
