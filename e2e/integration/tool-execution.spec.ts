import { test, expect } from '@playwright/test';

/**
 * Integration tests requiring a running compeek container.
 * Start one with: docker run -d -p 3001:3000 -p 6081:6080 --shm-size=512m ghcr.io/uburuntu/compeek
 * Run with: npm run test:e2e:integration
 */

const CONTAINER_API = 'http://localhost:3001';

test.describe('Integration: Tool Execution', () => {
  test('screenshot action returns a base64 PNG', async ({ request }) => {
    const response = await request.post(`${CONTAINER_API}/api/tool`, {
      data: { action: 'screenshot' },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.base64).toBeDefined();
    expect(body.base64.length).toBeGreaterThan(100);
    expect(body.error).toBeUndefined();
  });

  test('mouse_move action completes without error', async ({ request }) => {
    const response = await request.post(`${CONTAINER_API}/api/tool`, {
      data: { action: 'mouse_move', coordinate: [640, 360] },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.error).toBeUndefined();
  });

  test('bash execution returns output', async ({ request }) => {
    const response = await request.post(`${CONTAINER_API}/api/bash`, {
      data: { command: 'echo hello-from-integration-test' },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.output).toContain('hello-from-integration-test');
  });

  test('key action completes without error', async ({ request }) => {
    const response = await request.post(`${CONTAINER_API}/api/tool`, {
      data: { action: 'key', text: 'Return' },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.error).toBeUndefined();
  });
});
