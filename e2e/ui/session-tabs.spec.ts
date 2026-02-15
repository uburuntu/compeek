import { test, expect } from '@playwright/test';
import { mockContainerApi, mockDisconnectedApi } from '../helpers/mock-api';

test.describe('Session Tabs', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-seed localStorage with two sessions
    await page.addInitScript(() => {
      const sessions = [
        { id: 'sess-1', name: 'Desktop 1', type: 'compeek', apiHost: 'localhost', apiPort: 3001, vncHost: 'localhost', vncPort: 6081 },
        { id: 'sess-2', name: 'Desktop 2', type: 'compeek', apiHost: 'localhost', apiPort: 3002, vncHost: 'localhost', vncPort: 6082 },
      ];
      localStorage.setItem('compeek-sessions', JSON.stringify(sessions));
      localStorage.setItem('compeek-active-session', 'sess-1');
    });
  });

  test('displays tabs for all sessions', async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.goto('/');

    await expect(page.getByText('Desktop 1')).toBeVisible();
    await expect(page.getByText('Desktop 2')).toBeVisible();
  });

  test('switches active tab on click', async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.goto('/');

    // Click Desktop 2 tab
    await page.getByText('Desktop 2').click();

    // Verify active session changed
    const activeId = await page.evaluate(() => localStorage.getItem('compeek-active-session'));
    expect(activeId).toBe('sess-2');
  });

  test('shows connected count in header when health succeeds', async ({ page }) => {
    await mockContainerApi(page);
    await page.goto('/');

    // Health check fires immediately, both sessions point to localhost so mock serves both
    await expect(page.getByText('connected', { exact: false })).toBeVisible({ timeout: 15000 });
  });

  test('shows + button to add new session', async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.goto('/');

    // The + button
    const addButton = page.locator('button:has-text("+")');
    await expect(addButton).toBeVisible();

    await addButton.click();
    await expect(page.getByText('Connect a Desktop')).toBeVisible();
  });

  test('close button removes a session tab', async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.goto('/');

    // Hover over Desktop 2 tab to reveal close button (× icon)
    const tab = page.locator('button', { hasText: 'Desktop 2' });
    await tab.hover();

    // Click the close span (×)
    await tab.locator('span').last().click();

    // Desktop 2 should be gone
    await expect(page.locator('button', { hasText: 'Desktop 2' })).not.toBeVisible();
    // Desktop 1 remains
    await expect(page.getByText('Desktop 1')).toBeVisible();
  });
});
