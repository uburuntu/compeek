import type { ComputerAction } from '../agent/types.js';

export interface ToolExecutor {
  executeAction(action: ComputerAction): Promise<{ base64?: string; error?: string }>;
  executeBash(command: string): Promise<{ output?: string; error?: string }>;
  getInfo?(): Promise<{
    name: string;
    apiPort: number;
    vncPort: number;
    mode: string;
    tunnel: { apiUrl: string; vncUrl: string } | null;
  }>;
  healthCheck?(): Promise<boolean>;
}

export function createHttpExecutor(containerUrl: string, apiToken?: string): ToolExecutor {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

  return {
    async executeAction(action: ComputerAction) {
      const res = await fetch(`${containerUrl}/api/tool`, {
        method: 'POST',
        headers,
        body: JSON.stringify(action),
      });
      if (!res.ok) {
        return { error: `Container returned ${res.status}: ${res.statusText}` };
      }
      return res.json();
    },

    async executeBash(command: string) {
      const res = await fetch(`${containerUrl}/api/bash`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ command }),
      });
      if (!res.ok) {
        return { error: `Container returned ${res.status}: ${res.statusText}` };
      }
      return res.json();
    },

    async getInfo() {
      const res = await fetch(`${containerUrl}/api/info`);
      if (!res.ok) throw new Error(`Container returned ${res.status}`);
      return res.json();
    },

    async healthCheck() {
      try {
        const res = await fetch(`${containerUrl}/api/health`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json() as { status: string };
        return data.status === 'ok';
      } catch {
        return false;
      }
    },
  };
}

export function createDirectExecutor(): ToolExecutor {
  return {
    async executeAction(action: ComputerAction) {
      const { executeAction } = await import('../agent/tools.js');
      return executeAction(action);
    },

    async executeBash(command: string) {
      const { execSync } = await import('child_process');
      try {
        const output = execSync(command, {
          encoding: 'utf-8',
          timeout: 120_000,
          env: { ...process.env, DISPLAY: process.env.DISPLAY || ':1' },
        });
        return { output: output || '' };
      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string };
        return { error: e.stderr || e.message || String(err) };
      }
    },

    async getInfo() {
      const { readFileSync } = await import('fs');
      let tunnel: { apiUrl: string; vncUrl: string } | null = null;
      try {
        const apiUrl = readFileSync('/tmp/tunnel-api.url', 'utf-8').trim();
        const vncUrl = readFileSync('/tmp/tunnel-vnc.url', 'utf-8').trim();
        if (apiUrl && vncUrl) tunnel = { apiUrl, vncUrl };
      } catch { /* tunnel files don't exist */ }

      return {
        name: process.env.COMPEEK_SESSION_NAME || 'Desktop',
        apiPort: parseInt(process.env.PORT || '3000'),
        vncPort: 6080,
        mode: process.env.DESKTOP_MODE || 'full',
        tunnel,
      };
    },

    async healthCheck() {
      return true;
    },
  };
}
