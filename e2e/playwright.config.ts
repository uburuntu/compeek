import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
const INTEGRATION = !!process.env.COMPEEK_E2E_INTEGRATION;

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? 'github' : 'html',
  outputDir: './test-results',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'ui',
      testDir: './ui',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'integration',
      testDir: './integration',
      use: { ...devices['Desktop Chrome'] },
      ...(INTEGRATION ? {} : { testMatch: /^$/ }),
    },
  ],

  webServer: {
    command: 'npm run dev:client',
    url: 'http://localhost:5173',
    reuseExistingServer: !CI,
    timeout: 30_000,
  },
});
