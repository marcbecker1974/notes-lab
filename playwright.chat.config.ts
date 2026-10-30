import { defineConfig, devices } from '@playwright/test';

// Chat flow tests (`npm run test:e2e:chat`). They run against their OWN dev server on
// port 3100 with CHAT_TEST_STUB=1, so the server answers with fixed test replies instead
// of calling OpenRouter: no live model calls, no credits. The normal app on port 3000
// never has the stub. reuseExistingServer is false on purpose: an already running server
// (possibly without the stub) must never be reused.
for (const file of ['.env.local', '.env.test.local']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // missing files are reported by the tests that need them
  }
}

const PORT = 3100;
const env = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

export default defineConfig({
  testDir: './tests-stub', // outside ./tests: the default config must never run these against port 3000
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...env, CHAT_TEST_STUB: '1', NEXT_DIST_DIR: '.next-chat-test' },
  },
});
