import { expect, test } from '@playwright/test';

const email = process.env.TEST_USER_A_EMAIL;
const password = process.env.TEST_USER_A_PASSWORD;

test('a created note is still visible after a refresh', async ({ page }) => {
  test.skip(!email || !password, 'TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD missing in .env.test.local');
  const title = `ZZ-E2E-${Date.now().toString(36)}`;

  // Open the home page; /notes is private, so sign in first.
  await page.goto('/');
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/notes');

  // Create a note and give it a unique title.
  await page.getByRole('button', { name: 'New note' }).first().click();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved')).toBeVisible();

  // Refresh and confirm the note is still there.
  await page.waitForLoadState('networkidle');
  await page.reload();
  await expect(page.getByText(title).first()).toBeVisible();

  // Clean up the disposable note through the UI.
  await page.getByText(title).first().click();
  await page.getByRole('button', { name: 'Delete note' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText(title)).toHaveCount(0);
});
