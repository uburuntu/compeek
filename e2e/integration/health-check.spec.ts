import { test, expect } from '@playwright/test';

/**
 * Integration tests requiring a running compeek container.
 * Start one with: docker run -d -p 3001:3000 -p 6081:6080 --shm-size=512m ghcr.io/uburuntu/compeek
 * Run with: npm run test:e2e:integration
 */

const CONTAINER_API = 'http://localhost:3001';

test.describe('Integration: Container Health', () => {
  test('container health endpoint returns ok', async ({ request }) => {
    const response = await request.get(`${CONTAINER_API}/api/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThan(0);
  });

  test('container info endpoint returns session data', async ({ request }) => {
    const response = await request.get(`${CONTAINER_API}/api/info`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.name).toBeDefined();
    expect(body.apiPort).toBe(3000);
    expect(body.vncPort).toBe(6080);
    expect(body.osType).toBe('linux');
  });

  test('session connects and shows green status in UI', async ({ page }) => {
    await page.addInitScript(() => {
      const sessions = [
        { id: 'int-1', name: 'Integration Desktop', type: 'compeek', apiHost: 'localhost', apiPort: 3001, vncHost: 'localhost', vncPort: 6081 },
      ];
      localStorage.setItem('compeek-sessions', JSON.stringify(sessions));
      localStorage.setItem('compeek-active-session', 'int-1');
    });
    await page.goto('/');

    await expect(page.getByText('1 connected')).toBeVisible({ timeout: 15000 });
  });
});
