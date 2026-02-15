import { describe, it, expect, vi } from 'vitest';
import { createCompeekMcpServer } from '../../src/mcp/server';
import type { ToolExecutor } from '../../src/mcp/executors';

function createMockExecutor(): ToolExecutor {
  return {
    executeAction: vi.fn().mockResolvedValue({ base64: 'dGVzdA==' }),
    executeBash: vi.fn().mockResolvedValue({ output: 'hello world' }),
    getInfo: vi.fn().mockResolvedValue({
      name: 'Test',
      apiPort: 3000,
      vncPort: 6080,
      mode: 'full',
      tunnel: null,
    }),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

describe('MCP Server', () => {
  it('creates a server instance', () => {
    const executor = createMockExecutor();
    const server = createCompeekMcpServer({ executor });
    expect(server).toBeDefined();
    expect(server.server).toBeDefined();
  });

  it('creates a server with custom name', () => {
    const executor = createMockExecutor();
    const server = createCompeekMcpServer({ executor, serverName: 'my-compeek' });
    expect(server).toBeDefined();
  });

  it('can connect and close', async () => {
    const executor = createMockExecutor();
    const server = createCompeekMcpServer({ executor });

    // Create a mock transport
    const mockTransport = {
      start: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      onclose: undefined as (() => void) | undefined,
      onerror: undefined as ((error: Error) => void) | undefined,
      onmessage: undefined as ((message: any) => void) | undefined,
    };

    await server.connect(mockTransport as any);
    expect(mockTransport.start).toHaveBeenCalled();

    await server.close();
    expect(mockTransport.close).toHaveBeenCalled();
  });
});

describe('Text Editor Command Builder (via MCP)', () => {
  it('builds view command', async () => {
    const executor = createMockExecutor();
    createCompeekMcpServer({ executor });

    // Directly test the text editor command builder through the executor
    const { buildTextEditorCommand } = await import('../../src/agent/text-editor');

    const cmd = buildTextEditorCommand({ command: 'view', path: '/tmp/test.txt' });
    expect(cmd).toContain('cat -n');
    expect(cmd).toContain('/tmp/test.txt');
  });

  it('builds view command with range', async () => {
    const { buildTextEditorCommand } = await import('../../src/agent/text-editor');

    const cmd = buildTextEditorCommand({
      command: 'view',
      path: '/tmp/test.txt',
      view_range: [10, 20],
    });
    expect(cmd).toContain("sed -n '10,20p'");
  });

  it('builds create command', async () => {
    const { buildTextEditorCommand } = await import('../../src/agent/text-editor');

    const cmd = buildTextEditorCommand({
      command: 'create',
      path: '/tmp/new.txt',
      file_text: 'hello world',
    });
    expect(cmd).toContain('mkdir -p');
    expect(cmd).toContain('COMPEEK_EOF');
    expect(cmd).toContain('hello world');
  });

  it('builds str_replace command', async () => {
    const { buildTextEditorCommand } = await import('../../src/agent/text-editor');

    const cmd = buildTextEditorCommand({
      command: 'str_replace',
      path: '/tmp/test.txt',
      old_str: 'foo',
      new_str: 'bar',
    });
    expect(cmd).toContain('python3 -c');
    expect(cmd).toContain('replace');
  });

  it('builds insert command', async () => {
    const { buildTextEditorCommand } = await import('../../src/agent/text-editor');

    const cmd = buildTextEditorCommand({
      command: 'insert',
      path: '/tmp/test.txt',
      insert_line: 5,
      new_str: 'new line',
    });
    expect(cmd).toContain('python3 -c');
    expect(cmd).toContain('insert');
  });
});
