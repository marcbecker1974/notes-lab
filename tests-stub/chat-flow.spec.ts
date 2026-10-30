import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Chat flow against the dedicated stub server (playwright.chat.config.ts, port 3100):
// the server answers with fixed "[stub] …" replies, so no OpenRouter call is made.
// Runs as the existing hosted test account A and creates its own conversations only.
// Every message starts with a unique ZZ-E2E-CHAT-<run> marker; afterwards exactly the
// conversations this run created (their ids are recorded from the API responses, plus a
// sweep by the run's marker in the title) are deleted. Nothing else is touched.

const email = process.env.TEST_USER_A_EMAIL;
const password = process.env.TEST_USER_A_PASSWORD;
const RUN = `ZZ-E2E-CHAT-${Date.now().toString(36)}`;
const createdIds = new Set<number>();

test.skip(!email || !password, 'TEST_USER_A_* missing in .env.test.local');

function track(page: Page) {
  page.on('response', async (response) => {
    const url = new URL(response.url());
    if (response.request().method() !== 'POST' || !response.ok()) return;
    if (url.pathname !== '/api/chat' && url.pathname !== '/api/chat/conversations') return;
    const data = await response.json().catch(() => null);
    const id = data?.conversationId ?? data?.id;
    if (typeof id === 'number') createdIds.add(id);
  });
}

async function openChat(page: Page) {
  await page.getByRole('button', { name: 'Open chat' }).click();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled(); // saved conversation loaded
}

const roles = (page: Page) => page.locator('[data-role]');
const texts = (page: Page) => roles(page).evaluateAll((els) => els.map((e) => `${e.getAttribute('data-role')}: ${e.textContent}`));

async function send(page: Page, text: string) {
  await page.getByLabel('Message', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
}

test.afterAll(async () => {
  if (!email || !password) return;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    console.warn('E2E cleanup: sign-in failed, test conversations remain:', [...createdIds].join(','));
    return;
  }
  // By recorded id, and by this run's marker in the title (never anything else).
  if (createdIds.size) await client.from('conversations').delete().in('id', [...createdIds]);
  await client.from('conversations').delete().like('title', `${RUN}%`);
  const left = await client.from('conversations').select('id').in('id', [...createdIds]);
  if (left.error || left.data?.length) {
    console.warn('E2E cleanup: could not remove conversations', [...createdIds].join(','));
  }
});

test('chat: reply, follow-up, reload keeps order, new conversation is empty', async ({ page }) => {
  track(page);
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForURL('**/notes');
  await openChat(page);

  // Start from an empty chat, whatever the account had before.
  const fresh = page.getByRole('button', { name: 'New conversation' });
  if (await fresh.isEnabled()) await fresh.click();
  await expect(roles(page)).toHaveCount(0);

  const first = `${RUN} first`;
  const second = `${RUN} second`;

  await test.step('a sent message gets a reply', async () => {
    const reply = page.waitForResponse((r) => r.url().endsWith('/api/chat') && r.request().method() === 'POST');
    await send(page, first);
    // The server must be the stub: this stops a real model call from ever being accepted.
    expect((await (await reply).json()).model).toBe('test-stub');
    await expect(roles(page)).toHaveCount(2);
    expect(await texts(page)).toEqual([`user: ${first}`, `assistant: [stub] reply 1 to: ${first} (history: 1)`]);
  });

  await test.step('a follow-up continues the same conversation', async () => {
    await send(page, second);
    await expect(roles(page)).toHaveCount(4);
    // history: 3 = first question, first reply and the follow-up all reached the server.
    expect((await texts(page))[3]).toBe(`assistant: [stub] reply 2 to: ${second} (history: 3)`);
  });

  const expected = [
    `user: ${first}`,
    `assistant: [stub] reply 1 to: ${first} (history: 1)`,
    `user: ${second}`,
    `assistant: [stub] reply 2 to: ${second} (history: 3)`,
  ];

  await test.step('after a reload the messages and replies are still there, in order', async () => {
    await page.reload();
    await openChat(page);
    await expect(roles(page)).toHaveCount(4);
    expect(await texts(page)).toEqual(expected);
  });

  await test.step('the conversation still continues after the reload', async () => {
    await send(page, `${RUN} third`);
    await expect(roles(page)).toHaveCount(6);
    expect((await texts(page))[5]).toBe(`assistant: [stub] reply 3 to: ${RUN} third (history: 5)`);
  });

  await test.step('a new conversation opens an empty chat, also after a reload', async () => {
    await page.getByRole('button', { name: 'New conversation' }).click();
    await expect(roles(page)).toHaveCount(0);
    await expect(page.getByText('Ask anything.')).toBeVisible();
    await page.reload();
    await openChat(page);
    await expect(roles(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New conversation' })).toBeDisabled();
  });

  await test.step('the new conversation does not remember the old one', async () => {
    await send(page, `${RUN} fourth`);
    await expect(roles(page)).toHaveCount(2);
    expect((await texts(page))[1]).toBe(`assistant: [stub] reply 1 to: ${RUN} fourth (history: 1)`);
  });
});
