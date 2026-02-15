import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import sharp from 'sharp';
import { log } from '../lib/logger.js';
import type { ComputerAction } from './types.js';

const SIDECAR_TARGET = process.env.SIDECAR_TARGET || 'localhost';
const SIDECAR_VNC_PORT = process.env.SIDECAR_VNC_PORT || '5900';
const VNC_SERVER = `${SIDECAR_TARGET}::${SIDECAR_VNC_PORT}`;
const SCREENSHOT_PATH = '/tmp/compeek_screenshot.png';

/**
 * Execute a computer use action via VNC protocol (sidecar mode).
 * Uses vncdotool to interact with a remote QEMU/KVM VM display.
 */
export async function executeActionVnc(action: ComputerAction): Promise<{ base64?: string; error?: string }> {
  const start = Date.now();
  log.debug('vnc-tools', `Executing: ${action.action}${('coordinate' in action && action.coordinate) ? ` at (${action.coordinate.join(', ')})` : ''}`);

  try {
    switch (action.action) {
      case 'screenshot':
        return await takeScreenshot();

      case 'left_click': {
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]} click 1`);
        return {};
      }

      case 'right_click': {
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]} click 3`);
        return {};
      }

      case 'double_click': {
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]} click 1`);
        vncdo(`click 1`);
        return {};
      }

      case 'triple_click': {
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]} click 1`);
        vncdo(`click 1`);
        vncdo(`click 1`);
        return {};
      }

      case 'middle_click': {
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]} click 2`);
        return {};
      }

      case 'type': {
        vncdo(`type ${escapeShellArg(action.text)}`);
        return {};
      }

      case 'key': {
        const vncKey = mapKeyToVnc(action.text);
        vncdo(`key ${vncKey}`);
        return {};
      }

      case 'scroll': {
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]}`);
        // VNC button 4 = scroll up, 5 = down, 6 = left, 7 = right
        const buttonMap: Record<string, number> = { up: 4, down: 5, left: 6, right: 7 };
        const button = buttonMap[action.scroll_direction] || 5;
        for (let i = 0; i < action.scroll_amount; i++) {
          vncdo(`click ${button}`);
        }
        return {};
      }

      case 'mouse_move': {
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]}`);
        return {};
      }

      case 'left_click_drag': {
        vncdo(`move ${action.start_coordinate[0]} ${action.start_coordinate[1]}`);
        vncdo(`mousedown 1`);
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]}`);
        vncdo(`mouseup 1`);
        return {};
      }

      case 'left_mouse_down': {
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]}`);
        vncdo(`mousedown 1`);
        return {};
      }

      case 'left_mouse_up': {
        vncdo(`move ${action.coordinate[0]} ${action.coordinate[1]}`);
        vncdo(`mouseup 1`);
        return {};
      }

      case 'hold_key': {
        const vncKey = mapKeyToVnc(action.text);
        vncdo(`keydown ${vncKey}`);
        await sleep(action.duration * 1000);
        vncdo(`keyup ${vncKey}`);
        return {};
      }

      case 'wait':
        await sleep(action.duration * 1000);
        return {};

      case 'zoom':
        return await takeZoomedScreenshot(action.region);

      default:
        return { error: `Unknown action: ${(action as ComputerAction).action}` };
    }
  } catch (err) {
    const duration = Date.now() - start;
    const errObj = err as { stderr?: string; message?: string; status?: number };
    log.error('vnc-tools', `Action "${action.action}" failed after ${duration}ms`, {
      message: errObj.message,
      stderr: errObj.stderr,
      exitCode: errObj.status,
    });
    return { error: `VNC action failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    const duration = Date.now() - start;
    if (duration > 100) {
      log.debug('vnc-tools', `Action "${action.action}" took ${duration}ms`);
    }
  }
}

/**
 * Run a vncdotool command against the remote VNC server.
 */
function vncdo(cmd: string): void {
  const fullCmd = `vncdo -s ${VNC_SERVER} ${cmd}`;
  log.debug('vnc-tools', `CMD: ${fullCmd}`);
  execSync(fullCmd, { timeout: 30000 });
}

/**
 * Take a full screenshot via VNC framebuffer capture.
 */
async function takeScreenshot(): Promise<{ base64: string }> {
  vncdo(`capture ${SCREENSHOT_PATH}`);
  const buffer = readFileSync(SCREENSHOT_PATH);
  return { base64: buffer.toString('base64') };
}

/**
 * Take a zoomed screenshot of a specific region.
 * Region: [x1, y1, x2, y2] — top-left and bottom-right corners.
 */
async function takeZoomedScreenshot(region: [number, number, number, number]): Promise<{ base64: string }> {
  vncdo(`capture ${SCREENSHOT_PATH}`);

  const [x1, y1, x2, y2] = region;
  const width = x2 - x1;
  const height = y2 - y1;

  const cropped = await sharp(SCREENSHOT_PATH)
    .extract({ left: x1, top: y1, width, height })
    .png()
    .toBuffer();

  return { base64: cropped.toString('base64') };
}

/**
 * Map xdotool key names to vncdotool key names.
 * xdotool uses X11 keysym names, vncdotool uses its own conventions.
 */
function mapKeyToVnc(xdotoolKey: string): string {
  // Handle modifier combos like "ctrl+a", "super+l", "alt+F4"
  if (xdotoolKey.includes('+')) {
    return xdotoolKey
      .split('+')
      .map(part => KEY_MAP[part] || part.toLowerCase())
      .join('-');
  }
  return KEY_MAP[xdotoolKey] || xdotoolKey.toLowerCase();
}

const KEY_MAP: Record<string, string> = {
  // Modifier keys
  'ctrl': 'ctrl',
  'alt': 'alt',
  'shift': 'shift',
  'super': 'super',
  'Super_L': 'super',
  'Super_R': 'super',
  'Control_L': 'ctrl',
  'Control_R': 'ctrl',
  'Alt_L': 'alt',
  'Alt_R': 'alt',
  'Shift_L': 'shift',
  'Shift_R': 'shift',
  'Meta_L': 'super',

  // Navigation
  'Return': 'enter',
  'Escape': 'esc',
  'BackSpace': 'bsp',
  'Tab': 'tab',
  'space': 'space',
  'Delete': 'del',
  'Insert': 'ins',
  'Home': 'home',
  'End': 'end',
  'Prior': 'pgup',
  'Next': 'pgdn',
  'Page_Up': 'pgup',
  'Page_Down': 'pgdn',

  // Arrow keys
  'Up': 'up',
  'Down': 'down',
  'Left': 'left',
  'Right': 'right',

  // Function keys
  'F1': 'f1',
  'F2': 'f2',
  'F3': 'f3',
  'F4': 'f4',
  'F5': 'f5',
  'F6': 'f6',
  'F7': 'f7',
  'F8': 'f8',
  'F9': 'f9',
  'F10': 'f10',
  'F11': 'f11',
  'F12': 'f12',

  // Special
  'Print': 'prtsc',
  'Caps_Lock': 'caps',
  'Num_Lock': 'num',
  'Scroll_Lock': 'scroll',
  'Menu': 'menu',
};

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
