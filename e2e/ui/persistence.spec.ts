import { test, expect } from '@playwright/test';
import { mockDisconnectedApi } from '../helpers/mock-api';
import { TEST_API_KEY } from '../helpers/test-data';

test.describe('Persistence across page reload', () => {
  test('settings survive page reload', async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');

    // Open settings and save an API key
    await page.getByText('Setup needed').click();
    await page.getByPlaceholder('sk-ant-...').fill(TEST_API_KEY);
    await page.getByRole('button', { name: 'Save' }).click();

    // Reload
    await page.reload();

    // "Setup needed" should still be gone
    await expect(page.getByText('Setup needed')).not.toBeVisible();

    // Open settings to verify key is still there
    await page.locator('header').getByRole('button').filter({ has: page.locator('svg') }).click();
    const input = page.getByPlaceholder('sk-ant-...');
    const value = await input.inputValue();
    expect(value).toBe(TEST_API_KEY);
  });

  test('sessions survive page reload', async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.addInitScript(() => {
      const sessions = [
        { id: 'persist-1', name: 'Persistent Desktop', type: 'compeek', apiHost: 'localhost', apiPort: 3001, vncHost: 'localhost', vncPort: 6081 },
      ];
      localStorage.setItem('compeek-sessions', JSON.stringify(sessions));
      localStorage.setItem('compeek-active-session', 'persist-1');
    });
    await page.goto('/');

    await expect(page.getByText('Persistent Desktop')).toBeVisible();

    // Reload
    await page.reload();

    await expect(page.getByText('Persistent Desktop')).toBeVisible();
  });

  test('active session tab persists across reload', async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.addInitScript(() => {
      const sessions = [
        { id: 'tab-1', name: 'Tab A', type: 'compeek', apiHost: 'localhost', apiPort: 3001, vncHost: 'localhost', vncPort: 6081 },
        { id: 'tab-2', name: 'Tab B', type: 'compeek', apiHost: 'localhost', apiPort: 3002, vncHost: 'localhost', vncPort: 6082 },
      ];
      localStorage.setItem('compeek-sessions', JSON.stringify(sessions));
      localStorage.setItem('compeek-active-session', 'tab-2');
    });
    await page.goto('/');

    // Reload
    await page.reload();

    const activeId = await page.evaluate(() => localStorage.getItem('compeek-active-session'));
    expect(activeId).toBe('tab-2');
  });
});
