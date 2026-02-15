import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { executeAction } from '../agent/tools.js';
import { log } from '../lib/logger.js';
import type { ComputerAction } from '../agent/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createCompeekMcpServer } from '../mcp/server.js';
import { createDirectExecutor } from '../mcp/executors.js';

const app = express();
app.use(cors());
app.use(express.json());

// Bearer token auth for dangerous endpoints (POST /api/tool, /api/bash)
// Uses the session password (same as VNC password) as the shared secret
const API_TOKEN = process.env.API_TOKEN || process.env.VNC_PASSWORD || '';

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_TOKEN) return next(); // no password set = local-only, skip auth
  const auth = req.headers.authorization;
  if (auth === `Bearer ${API_TOKEN}`) return next();
  res.status(401).json({ error: 'Unauthorized — invalid or missing Bearer token' });
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Container info for connection strings
app.get('/api/info', (_req, res) => {
  // Read tunnel URLs if available (written by entrypoint.sh)
  let tunnel: { apiUrl: string; vncUrl: string } | null = null;
  try {
    const apiUrl = readFileSync('/tmp/tunnel-api.url', 'utf-8').trim();
    const vncUrl = readFileSync('/tmp/tunnel-vnc.url', 'utf-8').trim();
    if (apiUrl && vncUrl) tunnel = { apiUrl, vncUrl };
  } catch { /* tunnel files don't exist yet or tunneling disabled */ }

  res.json({
    name: process.env.COMPEEK_SESSION_NAME || 'Desktop',
    apiPort: parseInt(process.env.PORT || '3000'),
    vncPort: 6080,
    mode: process.env.DESKTOP_MODE || 'full',
    tunnel,
  });
});

// Execute a computer-use tool action (screenshot, click, type, etc.)
app.post('/api/tool', requireAuth, async (req, res) => {
  try {
    const action = req.body as ComputerAction;
    const result = await executeAction(action);
    res.json(result);
  } catch (err: unknown) {
    res.json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Execute a bash command
app.post('/api/bash', requireAuth, (req, res) => {
  try {
    const { command } = req.body;
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout: 120000,
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':1' },
    });
    res.json({ output: output || '' });
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    res.json({ error: e.stderr || e.message || String(err) });
  }
});

// ── MCP Streamable HTTP endpoint (always enabled) ─────────────────
const mcpTransports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', requireAuth, async (req, res) => {
  // Check for existing session
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && mcpTransports.has(sessionId)) {
    const transport = mcpTransports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session — create transport and server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      mcpTransports.delete(sid);
      log.info('mcp', `Session ${sid} closed`);
    }
  };

  const mcpServer = createCompeekMcpServer({
    executor: createDirectExecutor(),
    serverName: 'compeek-container',
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);

  if (transport.sessionId) {
    mcpTransports.set(transport.sessionId, transport);
    log.info('mcp', `Session ${transport.sessionId} started`);
  }
});

app.get('/mcp', requireAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !mcpTransports.has(sessionId)) {
    res.status(400).json({ error: 'Invalid or missing mcp-session-id header' });
    return;
  }
  const transport = mcpTransports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

app.delete('/mcp', requireAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId && mcpTransports.has(sessionId)) {
    const transport = mcpTransports.get(sessionId)!;
    await transport.handleRequest(req, res);
    mcpTransports.delete(sessionId);
    log.info('mcp', `Session ${sessionId} deleted`);
  } else {
    res.status(400).json({ error: 'Invalid or missing mcp-session-id header' });
  }
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, '0.0.0.0', () => {
  log.info('container', `Tool server listening on port ${PORT}`);
  log.info('container', `MCP endpoint available at /mcp`);
});
