import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpExecutor } from '../../src/mcp/executors';

describe('HTTP Executor', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('calls /api/tool for executeAction', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ base64: 'abc123' }),
    });

    const executor = createHttpExecutor('http://localhost:3001', 'token123');
    const result = await executor.executeAction({ action: 'screenshot' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/tool',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123',
        }),
      }),
    );
    expect(result.base64).toBe('abc123');
  });

  it('calls /api/bash for executeBash', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ output: 'hello world' }),
    });

    const executor = createHttpExecutor('http://localhost:3001');
    const result = await executor.executeBash('echo hello');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/bash',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ command: 'echo hello' }),
      }),
    );
    expect(result.output).toBe('hello world');
  });

  it('returns error on HTTP failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const executor = createHttpExecutor('http://localhost:3001');
    const result = await executor.executeAction({ action: 'screenshot' });

    expect(result.error).toContain('401');
  });

  it('does not include auth header when no token provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const executor = createHttpExecutor('http://localhost:3001');
    await executor.executeAction({ action: 'left_click', coordinate: [100, 200] });

    const callArgs = (fetch as any).mock.calls[0];
    expect(callArgs[1].headers['Authorization']).toBeUndefined();
  });

  it('healthCheck returns true on healthy response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    const executor = createHttpExecutor('http://localhost:3001');
    const healthy = await executor.healthCheck!();
    expect(healthy).toBe(true);
  });

  it('healthCheck returns false on error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const executor = createHttpExecutor('http://localhost:3001');
    const healthy = await executor.healthCheck!();
    expect(healthy).toBe(false);
  });
});
