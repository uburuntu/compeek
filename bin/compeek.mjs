#!/usr/bin/env node

// compeek CLI — zero dependencies, Node.js built-ins only
// Usage: npx compeek [start|stop|status|logs|open]

import { execSync, spawn } from 'node:child_process';
import http from 'node:http';
import crypto from 'node:crypto';

const IMAGE = 'ghcr.io/uburuntu/compeek:latest';
const CONTAINER_PREFIX = 'compeek-';
const DASHBOARD_URL = 'https://compeek.rmbk.me';
const HEALTH_TIMEOUT = 30_000;
const HEALTH_INTERVAL = 1_000;

// ── ANSI Colors ──────────────────────────────────────────

const isColorSupported = process.stdout.isTTY && !process.env.NO_COLOR;
const c = isColorSupported ? {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  white:   '\x1b[97m',
  gray:    '\x1b[90m',
} : { reset: '', bold: '', dim: '', cyan: '', green: '', yellow: '', red: '', magenta: '', white: '', gray: '' };

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
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;
  let spinner;

  if (isColorSupported) {
    spinner = setInterval(() => {
      process.stdout.write(`\r  ${c.cyan}${frames[frame]}${c.reset} Waiting for container...`);
      frame = (frame + 1) % frames.length;
    }, 80);
  } else {
    console.log('  Waiting for container...');
  }

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://${host}:${port}/api/health`, { timeout: 2000 }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.status === 'ok') {
              if (spinner) {
                clearInterval(spinner);
                process.stdout.write(`\r  ${c.green}✓${c.reset} Container ready            \n`);
              }
              return resolve(data);
            }
          } catch { /* retry */ }
          retry();
        });
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        if (spinner) {
          clearInterval(spinner);
          process.stdout.write(`\r  ${c.red}✗${c.reset} Health check timed out      \n`);
        }
        return reject(new Error('Health check timed out'));
      }
      setTimeout(check, HEALTH_INTERVAL);
    };
    check();
  });
}

function buildConnectionString(name, apiHost, apiPort, vncHost, vncPort, vncPassword) {
  const config = { name, type: 'compeek', apiHost, apiPort, vncHost, vncPort };
  if (vncPassword) config.vncPassword = vncPassword;
  return Buffer.from(JSON.stringify(config)).toString('base64');
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
    console.error(`${c.red}Docker is not available.${c.reset} Install Docker first: https://docs.docker.com/get-docker/`);
    process.exit(1);
  }

  const flags = parseFlags(args);
  const name = flags.name || findNextName();
  const { apiPort: defaultApi, vncPort: defaultVnc } = findNextPorts();
  const apiPort = parseInt(flags['api-port']) || defaultApi;
  const vncPort = parseInt(flags['vnc-port']) || defaultVnc;
  const mode = flags.mode || 'full';
  const vncPassword = flags.password || crypto.randomBytes(6).toString('base64url').slice(0, 8);
  const sessionName = name.replace(CONTAINER_PREFIX, '').replace(/^(\d+)$/, 'Desktop $1');

  console.log('');
  console.log(`  ${c.bold}${c.cyan}compeek${c.reset}`);
  console.log('');

  if (!flags['no-pull']) {
    console.log(`  ${c.dim}Pulling image...${c.reset}`);
    try {
      run(`docker pull ${IMAGE}`, { stdio: 'inherit' });
    } catch {
      console.log(`  ${c.yellow}Pull failed, using cached image.${c.reset}`);
    }
    console.log('');
  }

  const info = [
    `mode:${c.white}${mode}${c.reset}`,
    `api:${c.white}${apiPort}${c.reset}`,
    `vnc:${c.white}${vncPort}${c.reset}`,
  ];
  if (flags.persist) info.push(`${c.green}persist${c.reset}`);
  if (flags.tunnel)  info.push(`${c.yellow}tunnel${c.reset}`);

  console.log(`  ${c.cyan}▸${c.reset} Starting ${c.bold}${name}${c.reset}  ${c.dim}${info.join(' · ')}${c.reset}`);

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
    `-e COMPEEK_SESSION_NAME="${sessionName}"`,
    `-e VNC_PASSWORD="${vncPassword}"`,
    flags.tunnel ? '-e ENABLE_TUNNEL=true' : '',
    flags.persist ? `-v ${name}-data:/home/compeek/data` : '',
    `--security-opt seccomp=unconfined`,
    IMAGE,
  ].filter(Boolean).join(' '));

  try {
    await waitForHealth('localhost', apiPort, HEALTH_TIMEOUT);
  } catch {
    console.error(`\n  ${c.red}Container did not start.${c.reset} Check logs: npx compeek logs`);
    process.exit(1);
  }

  const connStr = buildConnectionString(sessionName, 'localhost', apiPort, 'localhost', vncPort, vncPassword);
  const dashboardLink = `${DASHBOARD_URL}/#config=${connStr}`;

  console.log('');
  console.log(`  ${c.dim}──── Links ─────────────────────────────────────${c.reset}`);
  console.log('');
  console.log(`  ${c.bold}Dashboard${c.reset}   ${c.cyan}${dashboardLink}${c.reset}`);
  console.log(`  ${c.dim}Tool API${c.reset}    http://localhost:${apiPort}`);
  if (mode !== 'headless') {
    console.log(`  ${c.dim}noVNC${c.reset}       http://localhost:${vncPort}`);
    console.log(`  ${c.dim}Password${c.reset}    ${vncPassword}`);
  }
  console.log('');
  console.log(`  ${c.dim}──── Connection string ──────────────────────────${c.reset}`);
  console.log(`  ${c.dim}${connStr}${c.reset}`);
  console.log('');

  if (flags.open) {
    openUrl(dashboardLink);
  }
}

function cmdStop(args) {
  const target = args[0];
  if (target) {
    const name = target.startsWith(CONTAINER_PREFIX) ? target : `${CONTAINER_PREFIX}${target}`;
    console.log(`  ${c.cyan}▸${c.reset} Stopping ${c.bold}${name}${c.reset}...`);
    run(`docker rm -f ${name}`, { allowFail: true, stdio: 'inherit' });
    console.log(`  ${c.green}✓${c.reset} Stopped`);
  } else {
    const containers = listContainers();
    if (containers.length === 0) {
      console.log(`  ${c.dim}No compeek containers running.${c.reset}`);
      return;
    }
    for (const ctr of containers) {
      console.log(`  ${c.cyan}▸${c.reset} Stopping ${c.bold}${ctr.name}${c.reset}...`);
      run(`docker rm -f ${ctr.name}`, { allowFail: true });
    }
    console.log(`  ${c.green}✓${c.reset} Stopped ${containers.length} container(s)`);
  }
}

function cmdStatus() {
  const containers = listContainers();
  if (containers.length === 0) {
    console.log(`  ${c.dim}No compeek containers found.${c.reset}`);
    return;
  }
  console.log('');
  for (const ctr of containers) {
    const isUp = ctr.status.startsWith('Up');
    const dot = isUp ? `${c.green}●${c.reset}` : `${c.red}●${c.reset}`;
    const statusText = isUp ? `${c.green}${ctr.status}${c.reset}` : `${c.dim}${ctr.status}${c.reset}`;
    console.log(`  ${dot} ${c.bold}${ctr.name}${c.reset}  ${statusText}`);
    if (ctr.ports) {
      const portList = ctr.ports.replace(/0\.0\.0\.0:/g, ':').replace(/:::(\d+)/g, ':$1');
      console.log(`    ${c.dim}${portList}${c.reset}`);
    }
  }
  console.log('');
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
      if (key === 'open' || key === 'no-pull' || key === 'persist' || key === 'tunnel') {
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
  ${c.bold}${c.cyan}compeek${c.reset} ${c.dim}— AI eyes & hands for any desktop${c.reset}

  ${c.bold}Usage${c.reset}   npx @rmbk/compeek ${c.dim}[command] [options]${c.reset}

  ${c.bold}Commands${c.reset}
    start ${c.dim}............${c.reset} Start a new virtual desktop ${c.dim}(default)${c.reset}
    stop  ${c.dim}[name]${c.reset} ${c.dim}....${c.reset} Stop one or all containers
    status ${c.dim}...........${c.reset} List running containers
    logs  ${c.dim}[name]${c.reset} ${c.dim}....${c.reset} Follow container logs
    open  ${c.dim}[name]${c.reset} ${c.dim}....${c.reset} Open dashboard in browser

  ${c.bold}Options${c.reset}
    --open ${c.dim}..........${c.reset} Open dashboard after start
    --mode ${c.dim}<m>${c.reset} ${c.dim}......${c.reset} full ${c.dim}|${c.reset} browser ${c.dim}|${c.reset} minimal ${c.dim}|${c.reset} headless
    --persist ${c.dim}.......${c.reset} Mount volume for persistent data
    --password ${c.dim}<pw>${c.reset} ${c.dim}.${c.reset} Custom VNC password ${c.dim}(auto-generated if omitted)${c.reset}
    --tunnel ${c.dim}........${c.reset} Enable localtunnel for remote access
    --no-pull ${c.dim}.......${c.reset} Skip pulling latest Docker image
    --name ${c.dim}<n>${c.reset} ${c.dim}......${c.reset} Custom container name
    --api-port ${c.dim}<p>${c.reset} ${c.dim}.${c.reset} Host port for tool API
    --vnc-port ${c.dim}<p>${c.reset} ${c.dim}.${c.reset} Host port for noVNC
`);
    break;
  default:
    console.error(`Unknown command: ${command}. Run "npx compeek --help" for usage.`);
    process.exit(1);
}
