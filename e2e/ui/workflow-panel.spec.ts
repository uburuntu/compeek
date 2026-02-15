import { test, expect } from '@playwright/test';
import { mockContainerApi } from '../helpers/mock-api';

test.describe('Workflow Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockContainerApi(page);
    // Pre-seed with API key and a session
    await page.addInitScript(() => {
      localStorage.setItem('compeek-settings', JSON.stringify({
        apiKey: 'sk-ant-test-key-for-playwright-testing-only',
        lastModel: 'claude-sonnet-4-5',
      }));
      const sessions = [
        { id: 'sess-1', name: 'Desktop 1', type: 'compeek', apiHost: 'localhost', apiPort: 3001, vncHost: 'localhost', vncPort: 6081 },
      ];
      localStorage.setItem('compeek-sessions', JSON.stringify(sessions));
      localStorage.setItem('compeek-active-session', 'sess-1');
    });
    await page.goto('/');
    // Wait for health check to resolve so we leave the welcome guide
    await expect(page.getByText('1 connected')).toBeVisible({ timeout: 15000 });
  });

  test('shows goal textarea and model selector', async ({ page }) => {
    await expect(page.getByPlaceholder("Tell the AI what to do")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sonnet 4.5' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Opus 4.6' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Haiku 4.5' })).toBeVisible();
  });

  test('start button is disabled when goal is empty', async ({ page }) => {
    const startButton = page.getByRole('button', { name: 'Start Agent' });
    await expect(startButton).toBeDisabled();
  });

  test('start button enables when goal is entered', async ({ page }) => {
    await page.getByPlaceholder("Tell the AI what to do").fill('Open Firefox');
    const startButton = page.getByRole('button', { name: 'Start Agent' });
    await expect(startButton).toBeEnabled();
  });

  test('preset goals populate the textarea', async ({ page }) => {
    await page.getByRole('button', { name: 'Browse the web' }).click();

    const textarea = page.getByPlaceholder("Tell the AI what to do");
    await expect(textarea).not.toBeEmpty();
  });

  test('shows mode toggle with General Goal and Document modes', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'General Goal' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Document/ })).toBeVisible();
  });

  test('switching to Document mode shows upload area', async ({ page }) => {
    await page.getByRole('button', { name: /Document/ }).click();

    await expect(page.getByText('Drop document photo')).toBeVisible();
  });
});
