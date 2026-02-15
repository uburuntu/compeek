import { test, expect } from '@playwright/test';
import { mockDisconnectedApi } from '../helpers/mock-api';

test.describe('App Load', () => {
  test.beforeEach(async ({ page }) => {
    await mockDisconnectedApi(page);
    await page.addInitScript(() => localStorage.clear());
  });

  test('shows the welcome guide when no sessions are connected', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('header')).toContainText('compeek');
    await expect(page.getByText('AI eyes & hands')).toBeVisible();
    await expect(page.getByText('for any desktop')).toBeVisible();
    await expect(page.getByText('Get started')).toBeVisible();
  });

  test('shows "Setup needed" warning when no API key is set', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Setup needed')).toBeVisible();
  });

  test('shows "No desktops" indicator in header', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('No desktops')).toBeVisible();
  });

  test('shows onboarding steps in Get Started card', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Add your AI key')).toBeVisible();
    await expect(page.getByText('Connect a virtual desktop')).toBeVisible();
  });

  test('clicking "Open Settings" in welcome guide opens settings dialog', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open Settings' }).click();

    await expect(page.getByText('Anthropic API Key')).toBeVisible();
  });

  test('clicking "Connect Desktop" in welcome guide opens add session dialog', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Connect Desktop' }).click();

    await expect(page.getByText('Connect a Desktop')).toBeVisible();
  });
});
