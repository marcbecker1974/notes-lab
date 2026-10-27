import { expect, test } from '@playwright/test';
import { deleteTestNotes } from './helpers';

const email = process.env.TEST_USER_A_EMAIL;
const password = process.env.TEST_USER_A_PASSWORD;

test('an edited note title is saved and shown after a reload', async ({ page }) => {
  test.skip(!email || !password, 'TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD missing in .env.test.local');
  const run = Date.now().toString(36);
  const oldTitle = `ZZ-E2E-old-${run}`;
  const newTitle = `ZZ-E2E-new-${run}`;

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/notes');

  try {
    // Arrange: a disposable note with a known title.
    await page.getByRole('button', { name: 'New note' }).first().click();
    await page.getByLabel('Title').fill(oldTitle);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();

    // Act: reload, open the note from the list, change the title and save.
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.getByText(oldTitle).first().click();
    await expect(page.getByLabel('Title')).toHaveValue(oldTitle);
    await page.getByLabel('Title').fill(newTitle);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();

    // Assert: after another reload the new title is in the list and the editor, the old one is gone.
    await page.waitForLoadState('networkidle');
    await page.reload();
    await expect(page.getByText(newTitle).first()).toBeVisible();
    await expect(page.getByText(oldTitle)).toHaveCount(0);
    await page.getByText(newTitle).first().click();
    await expect(page.getByLabel('Title')).toHaveValue(newTitle);
  } finally {
    await deleteTestNotes(page, [oldTitle, newTitle]);
  }
});
