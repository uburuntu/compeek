import { test, expect } from '@playwright/test';
import { mockContainerApi, mockDisconnectedApi } from '../helpers/mock-api';
import { makeConnectionString, makeDashboardUrl } from '../helpers/test-data';

test.describe('Add Session Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
  });

  test('opens add session dialog from welcome guide', async ({ page }) => {
    await page.getByRole('button', { name: 'Connect Desktop' }).click();

    await expect(page.getByText('Connect a Desktop')).toBeVisible();
    await expect(page.getByText('Start a virtual desktop')).toBeVisible();
    await expect(page.getByText('Paste the connection code')).toBeVisible();
  });

  test('parses a valid connection string on Enter', async ({ page }) => {
    await mockContainerApi(page);
    await page.getByRole('button', { name: 'Connect Desktop' }).click();

    const connectionString = makeConnectionString({ name: 'My Desktop' });
    const textarea = page.getByPlaceholder('Paste your connection code here...');
    await textarea.fill(connectionString);
    await textarea.press('Enter');

    // Should show success with session name
    await expect(page.getByText('Connected! Session: My Desktop')).toBeVisible();
  });

  test('parses a dashboard URL with #config=', async ({ page }) => {
    await mockContainerApi(page);
    await page.getByRole('button', { name: 'Connect Desktop' }).click();

    const url = makeDashboardUrl({ name: 'URL Desktop' });
    const textarea = page.getByPlaceholder('Paste your connection code here...');
    await textarea.fill(url);
    await textarea.press('Enter');

    await expect(page.getByText('Connected! Session: URL Desktop')).toBeVisible();
  });

  test('shows error for invalid connection string', async ({ page }) => {
    await page.getByRole('button', { name: 'Connect Desktop' }).click();

    const textarea = page.getByPlaceholder('Paste your connection code here...');
    await textarea.fill('not-valid-base64');
    await textarea.press('Enter');

    await expect(page.getByText('Invalid connection code')).toBeVisible();
  });

  test('manual configuration form works', async ({ page }) => {
    await mockContainerApi(page);
    await page.getByRole('button', { name: 'Connect Desktop' }).click();

    // Expand manual config
    await page.getByText('Configure manually').click();

    // Fill name
    await page.getByPlaceholder('Desktop 2').fill('Manual Desktop');

    // Click Add Session
    await page.getByRole('button', { name: 'Add Session' }).click();

    // Dialog should close
    await expect(page.getByText('Connect a Desktop')).not.toBeVisible();

    // New tab should appear
    await expect(page.getByText('Manual Desktop')).toBeVisible();
  });

  test('test connection button works with mock API', async ({ page }) => {
    await mockContainerApi(page);
    await page.getByRole('button', { name: 'Connect Desktop' }).click();
    await page.getByText('Configure manually').click();

    await page.getByRole('button', { name: 'Test Connection' }).click();

    await expect(page.getByText('Connected', { exact: false })).toBeVisible();
  });

  test('closes dialog on Cancel', async ({ page }) => {
    await page.getByRole('button', { name: 'Connect Desktop' }).click();
    await expect(page.getByText('Connect a Desktop')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Connect a Desktop')).not.toBeVisible();
  });
});
