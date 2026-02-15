#!/usr/bin/env node

// compeek CLI — zero dependencies, Node.js built-ins only
// Usage: npx compeek [start|stop|status|logs|open|mcp]

import { execSync, spawn } from 'node:child_process';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const IMAGE = 'ghcr.io/uburuntu/compeek:latest';
const VM_IMAGES = {
  windows: 'dockurr/windows:latest',
  macos: 'dockurr/macos:latest',
};
const SIDECAR_IMAGE = IMAGE;
const CONTAINER_PREFIX = 'compeek-';
const DASHBOARD_URL = 'https://compeek.rmbk.me';
const HEALTH_TIMEOUT = 30_000;
const VM_HEALTH_TIMEOUT = 180_000; // VMs take longer to boot
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

function hasKvm() {
  try {
    run('ls /dev/kvm', { allowFail: false });
    return true;
  } catch {
    return false;
  }
}

function validateOsRequirements(os) {
  if (os === 'linux') return;
  const platform = process.platform;
  const osLabel = os === 'windows' ? 'Windows' : 'macOS';

  if (platform === 'darwin') {
    console.error(`\n  ${c.red}${osLabel} containers require a Linux host with KVM.${c.reset}`);
    console.error(`  They do not work on macOS Docker Desktop.\n`);
    process.exit(1);
  }
  if (platform === 'win32' && os === 'macos') {
    console.error(`\n  ${c.red}macOS containers require a Linux host with KVM.${c.reset}`);
    console.error(`  They do not work on Windows Docker Desktop.\n`);
    process.exit(1);
  }
  if (platform === 'linux' && !hasKvm()) {
    console.error(`\n  ${c.red}KVM is not available (/dev/kvm not found).${c.reset}`);
    console.error(`  ${osLabel} containers require hardware virtualization.`);
    console.error(`  Enable virtualization in BIOS and ensure the kvm kernel module is loaded.\n`);
    process.exit(1);
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

function waitForTunnelUrls(host, port, timeout) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;
  let spinner;

  if (isColorSupported) {
    spinner = setInterval(() => {
      process.stdout.write(`\r  ${c.cyan}${frames[frame]}${c.reset} Waiting for tunnel URLs...`);
      frame = (frame + 1) % frames.length;
    }, 80);
  } else {
    console.log('  Waiting for tunnel URLs...');
  }

  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://${host}:${port}/api/info`, { timeout: 2000 }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.tunnel?.apiUrl && data.tunnel?.vncUrl) {
              if (spinner) {
                clearInterval(spinner);
                process.stdout.write(`\r  ${c.green}✓${c.reset} Tunnels ready               \n`);
              }
              return resolve(data.tunnel);
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
          process.stdout.write(`\r  ${c.yellow}!${c.reset} Tunnel timed out (local-only mode)\n`);
        }
        return resolve(null);
      }
      setTimeout(check, HEALTH_INTERVAL);
    };
    check();
  });
}

function buildConnectionString(name, apiHost, apiPort, vncHost, vncPort, vncPassword, osType) {
  const config = { name, type: 'compeek', apiHost, apiPort, vncHost, vncPort };
  if (vncPassword) config.vncPassword = vncPassword;
  if (osType && osType !== 'linux') config.osType = osType;
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

function detectRunningContainer() {
  const containers = listContainers().filter(c => c.status.startsWith('Up'));
  if (containers.length === 0) return null;

  const name = containers[0].name;
  const inspect = run(`docker inspect --format '{{json .NetworkSettings.Ports}}' ${name}`, { allowFail: true });
  if (!inspect) return null;

  try {
    const ports = JSON.parse(inspect);
    const apiBinding = ports['3000/tcp']?.[0];
    const apiPort = apiBinding ? parseInt(apiBinding.HostPort) : 3001;

    // Extract VNC_PASSWORD from container env
    const envStr = run(`docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' ${name}`, { allowFail: true });
    let apiToken;
    if (envStr) {
      const match = envStr.match(/^VNC_PASSWORD=(.+)$/m);
      if (match) apiToken = match[1];
    }

    return { name, apiPort, apiToken, containerUrl: `http://localhost:${apiPort}` };
  } catch {
    return null;
  }
}

async function cmdStart(args) {
  if (!hasDocker()) {
    console.error(`${c.red}Docker is not available.${c.reset} Install Docker first: https://docs.docker.com/get-docker/`);
    process.exit(1);
  }

  const flags = parseFlags(args);
  const os = flags.os || 'linux';
  if (!['linux', 'windows', 'macos'].includes(os)) {
    console.error(`${c.red}Invalid --os value: ${os}${c.reset}. Use: linux, windows, or macos`);
    process.exit(1);
  }

  // Validate KVM requirements for Windows/macOS
  if (os !== 'linux') {
    validateOsRequirements(os);
  }

  const name = flags.name || findNextName();
  const { apiPort: defaultApi, vncPort: defaultVnc } = findNextPorts();
  const apiPort = parseInt(flags['api-port']) || defaultApi;
  const vncPort = parseInt(flags['vnc-port']) || defaultVnc;
  const mode = os === 'linux' ? (flags.mode || 'full') : 'sidecar';
  const vncPassword = flags.password || crypto.randomBytes(24).toString('base64url').slice(0, 24);
  const osLabel = os === 'windows' ? 'Windows' : os === 'macos' ? 'macOS' : 'Linux';
  const sessionName = flags.name
    ? name.replace(CONTAINER_PREFIX, '')
    : name.replace(CONTAINER_PREFIX, '').replace(/^(\d+)$/, `${osLabel} $1`);

  // Tunnel provider: cloudflare by default for Linux, disabled for VMs in v1
  const tunnelProvider = os !== 'linux' ? 'none'
    : flags['no-tunnel'] ? 'none'
    : typeof flags.tunnel === 'string' ? flags.tunnel
    : flags.tunnel === true ? 'cloudflare'
    : 'cloudflare';

  console.log('');
  console.log(`  ${c.bold}${c.cyan}compeek${c.reset}`);
  console.log('');

  if (os === 'linux') {
    // ── Linux: single container (existing behavior) ──
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
    if (tunnelProvider !== 'none') info.push(`${c.yellow}${tunnelProvider}${c.reset}`);

    console.log(`  ${c.cyan}▸${c.reset} Starting ${c.bold}${name}${c.reset}  ${c.dim}${info.join(' · ')}${c.reset}`);

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
      `-e TUNNEL_PROVIDER=${tunnelProvider}`,
      flags.persist ? `-v ${name}-data:/home/compeek/data` : '',
      `--security-opt seccomp=unconfined`,
      IMAGE,
    ].filter(Boolean).join(' '));
  } else {
    // ── Windows/macOS: VM + sidecar containers ──
    const vmImage = VM_IMAGES[os];
    const vmName = `${name}-vm`;
    const netName = `${name}-net`;

    if (!flags['no-pull']) {
      console.log(`  ${c.dim}Pulling images...${c.reset}`);
      try {
        run(`docker pull ${vmImage}`, { stdio: 'inherit' });
      } catch {
        console.log(`  ${c.yellow}VM image pull failed, using cached.${c.reset}`);
      }
      try {
        run(`docker pull ${SIDECAR_IMAGE}`, { stdio: 'inherit' });
      } catch {
        console.log(`  ${c.yellow}Sidecar image pull failed, using cached.${c.reset}`);
      }
      console.log('');
    }

    const vmVersion = flags.version || (os === 'windows' ? '11' : '15');
    const vmRam = flags.ram || '4G';
    const vmCpus = flags.cpus || '2';
    const vmDisk = flags.disk || '64G';

    const info = [
      `os:${c.white}${osLabel}${c.reset}`,
      `ver:${c.white}${vmVersion}${c.reset}`,
      `ram:${c.white}${vmRam}${c.reset}`,
      `api:${c.white}${apiPort}${c.reset}`,
      `vnc:${c.white}${vncPort}${c.reset}`,
    ];
    if (flags.persist) info.push(`${c.green}persist${c.reset}`);

    console.log(`  ${c.cyan}▸${c.reset} Starting ${c.bold}${name}${c.reset}  ${c.dim}${info.join(' · ')}${c.reset}`);
    console.log(`  ${c.yellow}Note:${c.reset} ${osLabel} VM boot is slow. Tunneling not available for VMs.`);

    // Clean up any existing containers/network
    run(`docker rm -f ${name}`, { allowFail: true });
    run(`docker rm -f ${vmName}`, { allowFail: true });
    run(`docker network rm ${netName}`, { allowFail: true });

    // Create dedicated network
    run(`docker network create ${netName}`);

    // Start dockur VM container
    run([
      'docker run -d',
      `--name ${vmName}`,
      `--network ${netName}`,
      `--device /dev/kvm`,
      `-e VERSION=${vmVersion}`,
      `-e RAM_SIZE=${vmRam}`,
      `-e CPU_CORES=${vmCpus}`,
      `-e DISK_SIZE=${vmDisk}`,
      os === 'windows' ? '-e USERNAME=User -e PASSWORD=password' : '',
      flags.persist ? `-v ${name}-data:/storage` : '',
      `--cap-add NET_ADMIN`,
      vmImage,
    ].filter(Boolean).join(' '));

    // Start compeek sidecar container
    run([
      'docker run -d',
      `--name ${name}`,
      `--network ${netName}`,
      `-p ${apiPort}:3000`,
      `-p ${vncPort}:6080`,
      `-e DESKTOP_MODE=sidecar`,
      `-e SIDECAR_TARGET=${vmName}`,
      `-e SIDECAR_VNC_PORT=5900`,
      `-e SIDECAR_VIEWER_PORT=8006`,
      `-e SIDECAR_OS=${os}`,
      `-e COMPEEK_SESSION_NAME="${sessionName}"`,
      `-e VNC_PASSWORD="${vncPassword}"`,
      SIDECAR_IMAGE,
    ].filter(Boolean).join(' '));
  }

  const healthTimeout = os === 'linux' ? HEALTH_TIMEOUT : VM_HEALTH_TIMEOUT;
  try {
    await waitForHealth('localhost', apiPort, healthTimeout);
  } catch {
    console.error(`\n  ${c.red}Container did not start.${c.reset} Check logs: npx compeek logs`);
    process.exit(1);
  }

  // Wait for tunnel URLs if tunneling is enabled (Linux only)
  let tunnel = null;
  if (tunnelProvider !== 'none' && mode !== 'headless') {
    tunnel = await waitForTunnelUrls('localhost', apiPort, 30_000);
  }

  // Build connection strings
  const localConnStr = buildConnectionString(sessionName, 'localhost', apiPort, 'localhost', vncPort, vncPassword, os);
  let tunnelConnStr = null;
  let dashboardLink;

  if (tunnel) {
    const apiUrl = new URL(tunnel.apiUrl);
    const vncUrl = new URL(tunnel.vncUrl);
    tunnelConnStr = buildConnectionString(
      sessionName,
      apiUrl.hostname, 443,
      vncUrl.hostname, 443,
      vncPassword,
      os,
    );
    dashboardLink = `${DASHBOARD_URL}/#config=${tunnelConnStr}`;
  } else {
    dashboardLink = `${DASHBOARD_URL}/#config=${localConnStr}`;
  }

  console.log('');
  console.log(`  ${c.dim}──── Links ─────────────────────────────────────${c.reset}`);
  console.log('');
  console.log(`  ${c.bold}Dashboard${c.reset}   ${c.cyan}${dashboardLink}${c.reset}`);
  if (tunnel) {
    console.log(`  ${c.dim}API${c.reset}         ${tunnel.apiUrl}`);
    console.log(`  ${c.dim}noVNC${c.reset}       ${tunnel.vncUrl}`);
  }
  console.log(`  ${c.dim}Local API${c.reset}   http://localhost:${apiPort}`);
  if (mode !== 'headless') {
    console.log(`  ${c.dim}Local VNC${c.reset}   http://localhost:${vncPort}`);
    console.log(`  ${c.dim}Password${c.reset}    ${vncPassword}`);
  }
  if (os !== 'linux') {
    console.log('');
    console.log(`  ${c.yellow}Limitations:${c.reset} No bash/shell access in ${osLabel} VMs.`);
    console.log(`  ${c.dim}The agent uses mouse, keyboard, and screenshots only.${c.reset}`);
  }
  console.log('');
  console.log(`  ${c.dim}──── Connection string ──────────────────────────${c.reset}`);
  console.log(`  ${c.dim}${tunnelConnStr || localConnStr}${c.reset}`);
  console.log('');
  console.log(`  ${c.dim}──── MCP ───────────────────────────────────────${c.reset}`);
  console.log('');
  if (tunnel) {
    console.log(`  ${c.dim}Streamable HTTP${c.reset}  ${tunnel.apiUrl}/mcp`);
  }
  console.log(`  ${c.dim}Local MCP${c.reset}        http://localhost:${apiPort}/mcp`);
  console.log(`  ${c.dim}stdio proxy${c.reset}      npx @rmbk/compeek mcp`);
  console.log('');
  console.log(`  ${c.dim}Claude Code config (~/.claude/settings.json):${c.reset}`);
  console.log(`  ${c.dim}{ "mcpServers": { "compeek": { "command": "npx", "args": ["-y", "@rmbk/compeek", "mcp"] } } }${c.reset}`);
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
    // Clean up companion VM container and network if they exist
    run(`docker rm -f ${name}-vm`, { allowFail: true });
    run(`docker network rm ${name}-net`, { allowFail: true });
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
      // Clean up companion VM container and network
      run(`docker rm -f ${ctr.name}-vm`, { allowFail: true });
      run(`docker network rm ${ctr.name}-net`, { allowFail: true });
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

async function cmdMcp(args) {
  const flags = parseFlags(args);
  let containerUrl = flags['container-url'];
  let apiToken = flags['api-token'];
  let startedContainerName = null;

  if (!containerUrl) {
    // Auto-detect running container
    const detected = detectRunningContainer();
    if (detected) {
      containerUrl = detected.containerUrl;
      apiToken = apiToken || detected.apiToken;
      process.stderr.write(`Using container ${detected.name} at ${containerUrl}\n`);
    } else if (flags.start) {
      // Auto-start a container
      if (!hasDocker()) {
        process.stderr.write('Docker is not available. Specify --container-url or install Docker.\n');
        process.exit(1);
      }

      const name = flags.name || findNextName();
      const { apiPort } = findNextPorts();
      const vncPassword = flags.password || crypto.randomBytes(24).toString('base64url').slice(0, 24);
      const mode = flags.mode || 'full';

      run(`docker rm -f ${name}`, { allowFail: true });
      run([
        'docker run -d',
        `--name ${name}`,
        `-p ${apiPort}:3000`,
        `--shm-size=512m`,
        `-e DISPLAY=:1`,
        `-e DESKTOP_MODE=${mode}`,
        `-e COMPEEK_SESSION_NAME="${name}"`,
        `-e VNC_PASSWORD="${vncPassword}"`,
        `-e TUNNEL_PROVIDER=none`,
        flags.persist ? `-v ${name}-data:/home/compeek/data` : '',
        `--security-opt seccomp=unconfined`,
        IMAGE,
      ].filter(Boolean).join(' '));

      process.stderr.write(`Starting container ${name}...\n`);
      try {
        await waitForHealth('localhost', apiPort, HEALTH_TIMEOUT);
      } catch {
        process.stderr.write('Container did not start. Check logs: npx compeek logs\n');
        process.exit(1);
      }

      containerUrl = `http://localhost:${apiPort}`;
      apiToken = vncPassword;
      startedContainerName = name;
      process.stderr.write(`Container ${name} ready at ${containerUrl}\n`);
    } else {
      process.stderr.write('No running compeek container found.\n');
      process.stderr.write('Start one with: npx @rmbk/compeek start\n');
      process.stderr.write('Or use: npx @rmbk/compeek mcp --start\n');
      process.exit(1);
    }
  }

  // Resolve path to the compiled stdio entrypoint
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const stdioPath = join(__dirname, '..', 'dist', 'mcp', 'stdio.js');

  const mcpArgs = ['--container-url', containerUrl];
  if (apiToken) mcpArgs.push('--api-token', apiToken);

  const child = spawn('node', [stdioPath, ...mcpArgs], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  // Clean up auto-started container on exit
  if (startedContainerName && !flags.persist) {
    const cleanup = () => {
      try {
        run(`docker rm -f ${startedContainerName}`, { allowFail: true });
        process.stderr.write(`Container ${startedContainerName} removed.\n`);
      } catch { /* ignore */ }
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { child.kill('SIGINT'); });
    process.on('SIGTERM', () => { child.kill('SIGTERM'); });
  }

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
      if (key === 'open' || key === 'no-pull' || key === 'persist' || key === 'no-tunnel' || key === 'start') {
        flags[key] = true;
      } else if (key === 'tunnel') {
        // --tunnel (default provider) or --tunnel cloudflare / --tunnel localtunnel
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          flags[key] = args[++i];
        } else {
          flags[key] = true;
        }
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
  case 'mcp':
    cmdMcp(rest);
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
    mcp ${c.dim}..............${c.reset} Start MCP stdio server ${c.dim}(for Claude Code, Cursor, etc.)${c.reset}

  ${c.bold}Options${c.reset}
    --open ${c.dim}..........${c.reset} Open dashboard after start
    --os ${c.dim}<os>${c.reset} ${c.dim}........${c.reset} linux ${c.dim}(default)${c.reset} ${c.dim}|${c.reset} windows ${c.dim}|${c.reset} macos
    --mode ${c.dim}<m>${c.reset} ${c.dim}......${c.reset} full ${c.dim}|${c.reset} browser ${c.dim}|${c.reset} minimal ${c.dim}|${c.reset} headless
    --persist ${c.dim}.......${c.reset} Mount volume for persistent data
    --password ${c.dim}<pw>${c.reset} ${c.dim}.${c.reset} Custom VNC password ${c.dim}(auto-generated if omitted)${c.reset}
    --no-tunnel ${c.dim}.....${c.reset} Disable tunneling ${c.dim}(local-only mode)${c.reset}
    --tunnel ${c.dim}<p>${c.reset} ${c.dim}.....${c.reset} cloudflare ${c.dim}(default)${c.reset} ${c.dim}|${c.reset} localtunnel
    --no-pull ${c.dim}.......${c.reset} Skip pulling latest Docker image
    --name ${c.dim}<n>${c.reset} ${c.dim}......${c.reset} Custom container name
    --api-port ${c.dim}<p>${c.reset} ${c.dim}.${c.reset} Host port for tool API
    --vnc-port ${c.dim}<p>${c.reset} ${c.dim}.${c.reset} Host port for noVNC

  ${c.bold}VM Options${c.reset} ${c.dim}(Windows/macOS only, requires KVM)${c.reset}
    --version ${c.dim}<v>${c.reset} ${c.dim}..${c.reset} OS version ${c.dim}(Win: 11/10/8; macOS: 11-15)${c.reset}
    --ram ${c.dim}<size>${c.reset} ${c.dim}....${c.reset} VM RAM ${c.dim}(default: 4G)${c.reset}
    --cpus ${c.dim}<n>${c.reset} ${c.dim}......${c.reset} VM CPU cores ${c.dim}(default: 2)${c.reset}
    --disk ${c.dim}<size>${c.reset} ${c.dim}...${c.reset} VM disk size ${c.dim}(default: 64G)${c.reset}

  ${c.bold}MCP Options${c.reset}
    --container-url ${c.dim}<u>${c.reset}  Container API URL ${c.dim}(default: auto-detect)${c.reset}
    --api-token ${c.dim}<t>${c.reset} ${c.dim}....${c.reset} Bearer token for container auth
    --start ${c.dim}.........${c.reset} Auto-launch container if none running
`);
    break;
  default:
    console.error(`Unknown command: ${command}. Run "npx compeek --help" for usage.`);
    process.exit(1);
}
