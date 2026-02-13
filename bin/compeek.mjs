#!/usr/bin/env node

// compeek CLI — zero dependencies, Node.js built-ins only
// Usage: npx compeek [start|stop|status|logs|open]

import { execSync, spawn } from 'node:child_process';
import http from 'node:http';

const IMAGE = 'ghcr.io/uburuntu/compeek:latest';
const CONTAINER_PREFIX = 'compeek-';
const DASHBOARD_URL = 'https://compeek.rmbk.me';
const HEALTH_TIMEOUT = 30_000;
const HEALTH_INTERVAL = 1_000;

// ── Helpers ──────────────────────────────────────────────

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: opts.stdio || 'pipe', ...opts }).trim();
  } catch (e) {
    if (opts.allowFail) return '';
    throw e;
  }
}

function hasDocker() {
  try {
    run('docker info', { allowFail: false });
    return true;
  } catch {
    return false;
  }
}

function listContainers() {
  const out = run(
    `docker ps -a --filter "name=^${CONTAINER_PREFIX}" --format "{{.Names}}\\t{{.Status}}\\t{{.Ports}}"`,
    { allowFail: true },
  );
  if (!out) return [];
  return out.split('\n').map(line => {
    const [name, ...rest] = line.split('\t');
    return { name, status: rest[0] || '', ports: rest[1] || '' };
  });
}

function findNextPorts() {
  const containers = listContainers();
  const usedApi = new Set();
  const usedVnc = new Set();
  for (const c of containers) {
    const apiMatch = c.ports.match(/0\.0\.0\.0:(\d+)->3000/);
    const vncMatch = c.ports.match(/0\.0\.0\.0:(\d+)->6080/);
    if (apiMatch) usedApi.add(parseInt(apiMatch[1]));
    if (vncMatch) usedVnc.add(parseInt(vncMatch[1]));
  }
  let apiPort = 3001;
  while (usedApi.has(apiPort)) apiPort++;
  let vncPort = 6081;
  while (usedVnc.has(vncPort)) vncPort++;
  return { apiPort, vncPort };
}

function findNextName() {
  const containers = listContainers();
  let n = 1;
  const names = new Set(containers.map(c => c.name));
  while (names.has(`${CONTAINER_PREFIX}${n}`)) n++;
  return `${CONTAINER_PREFIX}${n}`;
}

function waitForHealth(host, port, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://${host}:${port}/api/health`, { timeout: 2000 }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.status === 'ok') return resolve(data);
          } catch { /* retry */ }
          retry();
        });
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeout) return reject(new Error('Health check timed out'));
      setTimeout(check, HEALTH_INTERVAL);
    };
    check();
  });
}

function buildConnectionString(name, apiHost, apiPort, vncHost, vncPort) {
  const config = JSON.stringify({ name, type: 'compeek', apiHost, apiPort, vncHost, vncPort });
  return Buffer.from(config).toString('base64');
}

function openUrl(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  try {
    execSync(`${cmd} "${url}"`, { stdio: 'ignore' });
  } catch {
    console.log(`  Open manually: ${url}`);
  }
}

// ── Commands ─────────────────────────────────────────────

async function cmdStart(args) {
  if (!hasDocker()) {
    console.error('Docker is not available. Install Docker first: https://docs.docker.com/get-docker/');
    process.exit(1);
  }

  const flags = parseFlags(args);
  const name = flags.name || findNextName();
  const { apiPort: defaultApi, vncPort: defaultVnc } = findNextPorts();
  const apiPort = parseInt(flags['api-port']) || defaultApi;
  const vncPort = parseInt(flags['vnc-port']) || defaultVnc;
  const mode = flags.mode || 'full';
  const sessionName = name.replace(CONTAINER_PREFIX, '').replace(/^(\d+)$/, 'Desktop $1');

  if (!flags['no-pull']) {
    console.log(`Pulling ${IMAGE}...`);
    try {
      run(`docker pull ${IMAGE}`, { stdio: 'inherit' });
    } catch {
      console.log('Pull failed, using cached image if available.');
    }
  }

  console.log(`Starting ${name} (api:${apiPort}, vnc:${vncPort}, mode:${mode})...`);

  // Remove existing container with same name if stopped
  run(`docker rm -f ${name}`, { allowFail: true });

  run([
    'docker run -d',
    `--name ${name}`,
    `-p ${apiPort}:3000`,
    `-p ${vncPort}:6080`,
    `--shm-size=512m`,
    `-e DISPLAY=:1`,
    `-e DESKTOP_MODE=${mode}`,
    `-e COMPEEK_SESSION_NAME=${sessionName}`,
    `--security-opt seccomp=unconfined`,
    IMAGE,
  ].join(' '));

  console.log('Waiting for container to be ready...');

  try {
    await waitForHealth('localhost', apiPort, HEALTH_TIMEOUT);
    console.log('Container is ready.');
  } catch {
    console.error('Container did not become healthy. Check logs: npx compeek logs');
    process.exit(1);
  }

  const connStr = buildConnectionString(sessionName, 'localhost', apiPort, 'localhost', vncPort);

  console.log('');
  console.log('=========================================');
  console.log(`  ${name}`);
  console.log('=========================================');
  console.log(`  Tool API : http://localhost:${apiPort}`);
  if (mode !== 'headless') {
    console.log(`  noVNC    : http://localhost:${vncPort}`);
  }
  console.log('');
  console.log('  Connection string:');
  console.log(`  ${connStr}`);
  console.log('');
  console.log('  Dashboard link:');
  console.log(`  ${DASHBOARD_URL}/#config=${connStr}`);
  console.log('=========================================');

  if (flags.open) {
    openUrl(`${DASHBOARD_URL}/#config=${connStr}`);
  }
}

function cmdStop(args) {
  const target = args[0];
  if (target) {
    const name = target.startsWith(CONTAINER_PREFIX) ? target : `${CONTAINER_PREFIX}${target}`;
    console.log(`Stopping ${name}...`);
    run(`docker rm -f ${name}`, { allowFail: true, stdio: 'inherit' });
  } else {
    const containers = listContainers();
    if (containers.length === 0) {
      console.log('No compeek containers running.');
      return;
    }
    for (const c of containers) {
      console.log(`Stopping ${c.name}...`);
      run(`docker rm -f ${c.name}`, { allowFail: true });
    }
    console.log(`Stopped ${containers.length} container(s).`);
  }
}

function cmdStatus() {
  const containers = listContainers();
  if (containers.length === 0) {
    console.log('No compeek containers found.');
    return;
  }
  console.log('NAME\t\t\tSTATUS\t\t\t\tPORTS');
  console.log('─'.repeat(80));
  for (const c of containers) {
    console.log(`${c.name}\t\t${c.status}\t\t${c.ports}`);
  }
}

function cmdLogs(args) {
  const target = args[0];
  let name;
  if (target) {
    name = target.startsWith(CONTAINER_PREFIX) ? target : `${CONTAINER_PREFIX}${target}`;
  } else {
    const containers = listContainers();
    if (containers.length === 0) {
      console.error('No compeek containers found.');
      process.exit(1);
    }
    name = containers[0].name;
  }
  const child = spawn('docker', ['logs', '-f', '--tail', '50', name], { stdio: 'inherit' });
  child.on('exit', code => process.exit(code || 0));
}

function cmdOpen(args) {
  const target = args[0];
  let name;
  if (target) {
    name = target.startsWith(CONTAINER_PREFIX) ? target : `${CONTAINER_PREFIX}${target}`;
  } else {
    const containers = listContainers().filter(c => c.status.startsWith('Up'));
    if (containers.length === 0) {
      console.error('No running compeek containers found.');
      process.exit(1);
    }
    name = containers[0].name;
  }

  // Extract ports from docker inspect
  const inspect = run(`docker inspect --format '{{json .NetworkSettings.Ports}}' ${name}`, { allowFail: true });
  if (!inspect) {
    console.error(`Container ${name} not found.`);
    process.exit(1);
  }

  try {
    const ports = JSON.parse(inspect);
    const apiBinding = ports['3000/tcp']?.[0];
    const vncBinding = ports['6080/tcp']?.[0];
    const apiPort = apiBinding ? parseInt(apiBinding.HostPort) : 3001;
    const vncPort = vncBinding ? parseInt(vncBinding.HostPort) : 6081;
    const sessionName = name.replace(CONTAINER_PREFIX, '').replace(/^(\d+)$/, 'Desktop $1');

    const connStr = buildConnectionString(sessionName, 'localhost', apiPort, 'localhost', vncPort);
    const url = `${DASHBOARD_URL}/#config=${connStr}`;
    console.log(`Opening ${url}`);
    openUrl(url);
  } catch (e) {
    console.error('Failed to read container ports:', e.message);
    process.exit(1);
  }
}

// ── Flag parsing ─────────────────────────────────────────

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'open' || key === 'no-pull') {
        flags[key] = true;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = args[++i];
      }
    }
  }
  return flags;
}

// ── Main ─────────────────────────────────────────────────

const [command = 'start', ...rest] = process.argv.slice(2);

switch (command) {
  case 'start':
    cmdStart(rest);
    break;
  case 'stop':
    cmdStop(rest);
    break;
  case 'status':
    cmdStatus();
    break;
  case 'logs':
    cmdLogs(rest);
    break;
  case 'open':
    cmdOpen(rest);
    break;
  case '--help':
  case '-h':
  case 'help':
    console.log(`
compeek — AI desktop agent

Usage: npx compeek [command] [options]

Commands:
  start       Start a new container (default)
  stop [name] Stop one or all compeek containers
  status      List running containers
  logs [name] Follow container logs
  open [name] Open dashboard with auto-connect URL

Start options:
  --name <n>       Container name (default: compeek-N)
  --api-port <p>   Host port for tool API (default: auto)
  --vnc-port <p>   Host port for noVNC (default: auto)
  --mode <m>       Desktop mode: full|browser|minimal|headless
  --no-pull        Skip docker pull
  --open           Open dashboard after start
`);
    break;
  default:
    console.error(`Unknown command: ${command}. Run "npx compeek --help" for usage.`);
    process.exit(1);
}
