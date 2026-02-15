import { test, expect } from '@playwright/test';
import { mockDisconnectedApi } from '../helpers/mock-api';
import { TEST_API_KEY } from '../helpers/test-data';

test.describe('Settings Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
  });

  test('opens settings dialog from header gear icon', async ({ page }) => {
    // The gear icon is the last button in the header (after "Setup needed")
    await page.locator('header').getByRole('button').filter({ has: page.locator('svg') }).click();

    await expect(page.getByText('Anthropic API Key')).toBeVisible();
    await expect(page.getByText('Default Model')).toBeVisible();
  });

  test('saves API key to localStorage', async ({ page }) => {
    await page.locator('header').getByRole('button').filter({ has: page.locator('svg') }).click();

    await page.getByPlaceholder('sk-ant-...').fill(TEST_API_KEY);
    await page.getByRole('button', { name: 'Save' }).click();

    // Dialog closes
    await expect(page.getByText('Anthropic API Key')).not.toBeVisible();

    // "Setup needed" disappears
    await expect(page.getByText('Setup needed')).not.toBeVisible();

    // Verify localStorage
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('compeek-settings');
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored?.apiKey).toBe(TEST_API_KEY);
  });

  test('shows warning for invalid API key format', async ({ page }) => {
    await page.locator('header').getByRole('button').filter({ has: page.locator('svg') }).click();

    await page.getByPlaceholder('sk-ant-...').fill('invalid-key');

    await expect(page.getByText("doesn't look like an Anthropic key")).toBeVisible();
  });

  test('toggles API key visibility', async ({ page }) => {
    await page.locator('header').getByRole('button').filter({ has: page.locator('svg') }).click();

    const input = page.getByPlaceholder('sk-ant-...');
    await input.fill(TEST_API_KEY);

    // Initially masked
    await expect(input).toHaveAttribute('type', 'password');

    // Click Show
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(input).toHaveAttribute('type', 'text');

    // Click Hide
    await page.getByRole('button', { name: 'Hide' }).click();
    await expect(input).toHaveAttribute('type', 'password');
  });

  test('closes dialog on Cancel', async ({ page }) => {
    await page.locator('header').getByRole('button').filter({ has: page.locator('svg') }).click();
    await expect(page.getByText('Anthropic API Key')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Anthropic API Key')).not.toBeVisible();
  });

  test('closes dialog on backdrop click', async ({ page }) => {
    await page.locator('header').getByRole('button').filter({ has: page.locator('svg') }).click();
    await expect(page.getByText('Anthropic API Key')).toBeVisible();

    // Click the backdrop overlay
    await page.locator('.fixed.inset-0.z-50').click({ position: { x: 10, y: 10 } });
    await expect(page.getByText('Anthropic API Key')).not.toBeVisible();
  });
});
