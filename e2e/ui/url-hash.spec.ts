import { test, expect } from '@playwright/test';
import { mockContainerApi } from '../helpers/mock-api';
import { makeConnectionString } from '../helpers/test-data';

test.describe('URL Hash Auto-Connect', () => {
  test('auto-adds session from #config= hash', async ({ page }) => {
    await mockContainerApi(page);
    await page.addInitScript(() => localStorage.clear());

    const config = makeConnectionString({ name: 'Hash Desktop', apiPort: 3001, vncPort: 6081 });
    await page.goto(`/#config=${config}`);

    // Should create a tab with the session name
    await expect(page.getByText('Hash Desktop')).toBeVisible();

    // URL hash should be cleared after processing
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('');
  });

  test('ignores invalid #config= hash gracefully', async ({ page }) => {
    await mockContainerApi(page);
    await page.addInitScript(() => localStorage.clear());

    await page.goto('/#config=not-valid-json');

    // App should still load normally — header is visible, no crash
    await expect(page.locator('header')).toContainText('compeek');
  });

  test('does not duplicate session on page reload after hash is cleared', async ({ page }) => {
    await mockContainerApi(page);
    await page.addInitScript(() => localStorage.clear());

    const config = makeConnectionString({ name: 'Reload Test' });
    await page.goto(`/#config=${config}`);

    await expect(page.getByText('Reload Test')).toBeVisible();

    // Hash is cleared, so reloading should not add another session
    await page.reload();

    // Count tabs — should not have duplicates
    const tabs = page.locator('button', { hasText: 'Reload Test' });
    await expect(tabs).toHaveCount(1);
  });
});
