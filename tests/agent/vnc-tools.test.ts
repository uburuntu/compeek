import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeActionVnc } from '../../src/agent/vnc-tools.js';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
}));

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => Buffer.from('fake-png-data')),
}));

// Mock sharp
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    extract: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('cropped-png-data')),
  })),
}));

import { execSync } from 'child_process';

const mockExecSync = vi.mocked(execSync);

describe('VNC Tools (sidecar mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('screenshot', () => {
    it('captures a screenshot via vncdotool', async () => {
      const result = await executeActionVnc({ action: 'screenshot' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('vncdo -s'),
        expect.any(Object),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('capture /tmp/compeek_screenshot.png'),
        expect.any(Object),
      );
      expect(result.base64).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('left_click', () => {
    it('moves mouse and clicks via VNC', async () => {
      const result = await executeActionVnc({ action: 'left_click', coordinate: [500, 300] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('move 500 300 click 1'),
        expect.any(Object),
      );
      expect(result.error).toBeUndefined();
    });
  });

  describe('right_click', () => {
    it('right-clicks via VNC (button 3)', async () => {
      await executeActionVnc({ action: 'right_click', coordinate: [200, 400] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('move 200 400 click 3'),
        expect.any(Object),
      );
    });
  });

  describe('double_click', () => {
    it('double-clicks via VNC', async () => {
      await executeActionVnc({ action: 'double_click', coordinate: [100, 200] });

      // First call: move + click
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('move 100 200 click 1'),
        expect.any(Object),
      );
      // Second call: another click
      const clickCalls = mockExecSync.mock.calls.filter(
        (call) => (call[0] as string).includes('click 1'),
      );
      expect(clickCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('middle_click', () => {
    it('middle-clicks via VNC (button 2)', async () => {
      await executeActionVnc({ action: 'middle_click', coordinate: [300, 400] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('move 300 400 click 2'),
        expect.any(Object),
      );
    });
  });

  describe('type', () => {
    it('types text via VNC', async () => {
      await executeActionVnc({ action: 'type', text: 'Hello World' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("vncdo -s"),
        expect.any(Object),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("type 'Hello World'"),
        expect.any(Object),
      );
    });
  });

  describe('key', () => {
    it('presses a key via VNC with mapping', async () => {
      await executeActionVnc({ action: 'key', text: 'Return' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('key enter'),
        expect.any(Object),
      );
    });

    it('maps key combinations', async () => {
      await executeActionVnc({ action: 'key', text: 'ctrl+a' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('key ctrl-a'),
        expect.any(Object),
      );
    });

    it('maps modifier keys', async () => {
      await executeActionVnc({ action: 'key', text: 'Escape' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('key esc'),
        expect.any(Object),
      );
    });

    it('maps function keys', async () => {
      await executeActionVnc({ action: 'key', text: 'F11' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('key f11'),
        expect.any(Object),
      );
    });

    it('passes through unmapped keys in lowercase', async () => {
      await executeActionVnc({ action: 'key', text: 'a' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('key a'),
        expect.any(Object),
      );
    });
  });

  describe('scroll', () => {
    it('scrolls down via VNC', async () => {
      await executeActionVnc({
        action: 'scroll',
        coordinate: [500, 400],
        scroll_direction: 'down',
        scroll_amount: 3,
      });

      // First moves mouse
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('move 500 400'),
        expect.any(Object),
      );
      // Then clicks button 5 (scroll down) 3 times
      const scrollCalls = mockExecSync.mock.calls.filter(
        (call) => (call[0] as string).includes('click 5'),
      );
      expect(scrollCalls).toHaveLength(3);
    });

    it('scrolls up via VNC', async () => {
      await executeActionVnc({
        action: 'scroll',
        coordinate: [500, 400],
        scroll_direction: 'up',
        scroll_amount: 2,
      });

      const scrollCalls = mockExecSync.mock.calls.filter(
        (call) => (call[0] as string).includes('click 4'),
      );
      expect(scrollCalls).toHaveLength(2);
    });
  });

  describe('mouse_move', () => {
    it('moves mouse via VNC', async () => {
      await executeActionVnc({ action: 'mouse_move', coordinate: [250, 350] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('move 250 350'),
        expect.any(Object),
      );
    });
  });

  describe('left_click_drag', () => {
    it('drags via VNC using mousedown/mouseup', async () => {
      await executeActionVnc({
        action: 'left_click_drag',
        start_coordinate: [100, 100],
        coordinate: [400, 400],
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('move 100 100'),
        expect.any(Object),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('mousedown 1'),
        expect.any(Object),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('move 400 400'),
        expect.any(Object),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('mouseup 1'),
        expect.any(Object),
      );
    });
  });

  describe('wait', () => {
    it('waits for specified duration', async () => {
      const start = Date.now();
      await executeActionVnc({ action: 'wait', duration: 0.1 });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90);
    });
  });

  describe('zoom', () => {
    it('captures and crops a screenshot region via VNC', async () => {
      const result = await executeActionVnc({
        action: 'zoom',
        region: [100, 200, 400, 350],
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('capture'),
        expect.any(Object),
      );
      expect(result.base64).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('returns error when VNC action fails', async () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('vncdo: connection refused');
      });

      const result = await executeActionVnc({ action: 'left_click', coordinate: [100, 100] });

      expect(result.error).toContain('vncdo: connection refused');
    });
  });
});
