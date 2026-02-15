import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCompeekMcpServer } from './server.js';
import { createHttpExecutor } from './executors.js';

interface StdioOptions {
  containerUrl: string;
  apiToken?: string;
}

function extractArg(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && i + 1 < args.length) return args[i + 1];
    if (args[i].startsWith(`${flag}=`)) return args[i].slice(flag.length + 1);
  }
  return undefined;
}

async function startStdioServer(options: StdioOptions): Promise<void> {
  const executor = createHttpExecutor(options.containerUrl, options.apiToken);

  if (executor.healthCheck) {
    const healthy = await executor.healthCheck();
    if (!healthy) {
      process.stderr.write(`Warning: Container at ${options.containerUrl} is not responding.\n`);
      process.stderr.write(`Make sure a container is running: npx @rmbk/compeek start\n`);
    }
  }

  const server = createCompeekMcpServer({ executor });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });

  process.stderr.write(`compeek MCP server started (stdio) → ${options.containerUrl}\n`);
}

// Direct execution: node dist/mcp/stdio.js --container-url http://localhost:3001
const args = process.argv.slice(2);
const containerUrl = extractArg(args, '--container-url') || 'http://localhost:3001';
const apiToken = extractArg(args, '--api-token');

startStdioServer({ containerUrl, apiToken: apiToken || undefined }).catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
