import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import sharp from 'sharp';
import { log } from '../lib/logger.js';
import type { ComputerAction } from './types.js';

const DISPLAY = process.env.DISPLAY || ':1';
const SCREENSHOT_PATH = '/tmp/compeek_screenshot.png';

/**
 * Execute a computer use action and return the result.
 * All actions interact with the X11 display via xdotool/scrot.
 */
export async function executeAction(action: ComputerAction): Promise<{ base64?: string; error?: string }> {
  const start = Date.now();
  log.debug('tools', `Executing: ${action.action}${('coordinate' in action && action.coordinate) ? ` at (${action.coordinate.join(', ')})` : ''}`);

  try {
    switch (action.action) {
      case 'screenshot':
        return await takeScreenshot();

      case 'left_click': {
        const cmd = `DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]} click 1`;
        log.debug('tools', `CMD: ${cmd}`);
        execSync(cmd);
        return {};
      }

      case 'right_click': {
        const cmd = `DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]} click 3`;
        log.debug('tools', `CMD: ${cmd}`);
        execSync(cmd);
        return {};
      }

      case 'double_click': {
        const cmd = `DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]} click --repeat 2 1`;
        log.debug('tools', `CMD: ${cmd}`);
        execSync(cmd);
        return {};
      }

      case 'triple_click': {
        const cmd = `DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]} click --repeat 3 1`;
        log.debug('tools', `CMD: ${cmd}`);
        execSync(cmd);
        return {};
      }

      case 'middle_click': {
        const cmd = `DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]} click 2`;
        log.debug('tools', `CMD: ${cmd}`);
        execSync(cmd);
        return {};
      }

      case 'type': {
        const cmd = `DISPLAY=${DISPLAY} xdotool type --delay 12 -- ${escapeShellArg(action.text)}`;
        log.debug('tools', `CMD: xdotool type --delay 12 -- "${action.text.slice(0, 50)}..."`);
        execSync(cmd);
        return {};
      }

      case 'key': {
        const cmd = `DISPLAY=${DISPLAY} xdotool key -- ${action.text}`;
        log.debug('tools', `CMD: ${cmd}`);
        execSync(cmd);
        return {};
      }

      case 'scroll': {
        execSync(`DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]}`);
        // Button 4 = scroll up, 5 = down, 6 = left, 7 = right
        const buttonMap: Record<string, number> = { up: 4, down: 5, left: 6, right: 7 };
        const button = buttonMap[action.scroll_direction] || 5;
        for (let i = 0; i < action.scroll_amount; i++) {
          execSync(`DISPLAY=${DISPLAY} xdotool click ${button}`);
        }
        return {};
      }

      case 'mouse_move': {
        const cmd = `DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]}`;
        log.debug('tools', `CMD: ${cmd}`);
        execSync(cmd);
        return {};
      }

      case 'left_click_drag':
        execSync(`DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.start_coordinate[0]} ${action.start_coordinate[1]} mousedown 1 mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]} mouseup 1`);
        return {};

      case 'left_mouse_down':
        execSync(`DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]} mousedown 1`);
        return {};

      case 'left_mouse_up':
        execSync(`DISPLAY=${DISPLAY} xdotool mousemove --sync ${action.coordinate[0]} ${action.coordinate[1]} mouseup 1`);
        return {};

      case 'hold_key':
        execSync(`DISPLAY=${DISPLAY} xdotool keydown ${action.text}`);
        await sleep(action.duration * 1000);
        execSync(`DISPLAY=${DISPLAY} xdotool keyup ${action.text}`);
        return {};

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
    log.error('tools', `Action "${action.action}" failed after ${duration}ms`, {
      message: errObj.message,
      stderr: errObj.stderr,
      exitCode: errObj.status,
    });
    return { error: `Action failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    const duration = Date.now() - start;
    if (duration > 100) {
      log.debug('tools', `Action "${action.action}" took ${duration}ms`);
    }
  }
}

/**
 * Take a full screenshot of the display.
 */
async function takeScreenshot(): Promise<{ base64: string }> {
  execSync(`DISPLAY=${DISPLAY} scrot -o ${SCREENSHOT_PATH}`);
  const buffer = readFileSync(SCREENSHOT_PATH);
  return { base64: buffer.toString('base64') };
}

/**
 * Take a zoomed screenshot of a specific region.
 * Region: [x1, y1, x2, y2] — top-left and bottom-right corners.
 */
async function takeZoomedScreenshot(region: [number, number, number, number]): Promise<{ base64: string }> {
  // First take full screenshot
  execSync(`DISPLAY=${DISPLAY} scrot -o ${SCREENSHOT_PATH}`);

  const [x1, y1, x2, y2] = region;
  const width = x2 - x1;
  const height = y2 - y1;

  // Crop the region using sharp
  const cropped = await sharp(SCREENSHOT_PATH)
    .extract({ left: x1, top: y1, width, height })
    .png()
    .toBuffer();

  return { base64: cropped.toString('base64') };
}

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
