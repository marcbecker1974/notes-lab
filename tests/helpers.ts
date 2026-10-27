import type { Page } from '@playwright/test';

// Best-effort cleanup for the signed-in test user. Deletes only notes whose title exactly matches one
// of the unique ZZ-E2E titles created by the current test; never throws, so it cannot hide the
// test's own failure.
export async function deleteTestNotes(page: Page, titles: string[]) {
  for (const title of titles) {
    try {
      await page.goto('/notes');
      await page.waitForLoadState('networkidle');
      const card = page.getByText(title, { exact: true }).first();
      const found = await card
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true, () => false);
      if (!found) continue; // never created, renamed or already deleted: nothing to clean up
      await card.click();
      await page.getByRole('button', { name: 'Delete note' }).click();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await page.getByText(title, { exact: true }).waitFor({ state: 'detached', timeout: 5000 });
    } catch {
      // the note was found but could not be deleted
      console.warn(`E2E cleanup: could not delete "${title}"`);
    }
  }
}
