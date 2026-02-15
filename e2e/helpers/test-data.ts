/**
 * Creates a base64-encoded connection string matching the format
 * produced by the CLI's `start` command.
 */
export function makeConnectionString(overrides: Record<string, unknown> = {}): string {
  const config = {
    name: 'Test Desktop',
    type: 'compeek',
    apiHost: 'localhost',
    apiPort: 3001,
    vncHost: 'localhost',
    vncPort: 6081,
    ...overrides,
  };
  return btoa(JSON.stringify(config));
}

/**
 * Creates a full dashboard URL with a connection string hash.
 */
export function makeDashboardUrl(overrides: Record<string, unknown> = {}): string {
  return `https://compeek.rmbk.me/#config=${makeConnectionString(overrides)}`;
}

export const TEST_API_KEY = 'sk-ant-test-key-for-playwright-testing-only';
