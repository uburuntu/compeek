import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { executeAction } from '../agent/tools.js';
import { log } from '../lib/logger.js';
import type { ComputerAction } from '../agent/types.js';

const app = express();
app.use(cors());
app.use(express.json());

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
app.post('/api/tool', async (req, res) => {
  try {
    const action = req.body as ComputerAction;
    const result = await executeAction(action);
    res.json(result);
  } catch (err: unknown) {
    res.json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Execute a bash command
app.post('/api/bash', (req, res) => {
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

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, '0.0.0.0', () => {
  log.info('container', `Tool server listening on port ${PORT}`);
});
