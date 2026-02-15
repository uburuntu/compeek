import type { Page } from '@playwright/test';

export interface MockApiOptions {
  healthStatus?: 'ok' | 'error';
  sessionName?: string;
  osType?: string;
}

/**
 * Intercept all /api/* routes with mock responses.
 * Must be called before navigating to the app.
 */
export async function mockContainerApi(page: Page, options: MockApiOptions = {}) {
  const { healthStatus = 'ok', sessionName = 'Test Desktop', osType = 'linux' } = options;

  await page.route('**/api/health', async (route) => {
    if (healthStatus === 'ok') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', uptime: 123.4 }),
      });
    } else {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    }
  });

  await page.route('**/api/info', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: sessionName,
        apiPort: 3000,
        vncPort: 6080,
        mode: 'full',
        osType,
        tunnel: null,
      }),
    });
  });

  await page.route('**/api/tool', async (route) => {
    const body = route.request().postDataJSON();
    if (body?.action === 'screenshot') {
      // 1x1 transparent PNG
      const TINY_PNG =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ base64: TINY_PNG }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
  });

  await page.route('**/api/bash', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ output: 'mock bash output' }),
    });
  });
}

/**
 * Intercept health check to simulate disconnected container.
 */
export async function mockDisconnectedApi(page: Page) {
  await page.route('**/api/health', async (route) => {
    await route.abort('connectionrefused');
  });
}
