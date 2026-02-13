import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAction } from '../../src/agent/tools.js';

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

describe('Computer Use Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('screenshot', () => {
    it('captures a screenshot via scrot and returns base64', async () => {
      const result = await executeAction({ action: 'screenshot' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('scrot -o /tmp/compeek_screenshot.png')
      );
      expect(result.base64).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('left_click', () => {
    it('moves mouse and clicks at coordinates', async () => {
      const result = await executeAction({ action: 'left_click', coordinate: [500, 300] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool mousemove --sync 500 300 click 1')
      );
      expect(result.error).toBeUndefined();
    });

    it('handles various coordinate positions', async () => {
      await executeAction({ action: 'left_click', coordinate: [0, 0] });
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool mousemove --sync 0 0 click 1')
      );

      await executeAction({ action: 'left_click', coordinate: [1024, 768] });
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool mousemove --sync 1024 768 click 1')
      );
    });
  });

  describe('right_click', () => {
    it('right-clicks at coordinates (button 3)', async () => {
      await executeAction({ action: 'right_click', coordinate: [200, 400] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool mousemove --sync 200 400 click 3')
      );
    });
  });

  describe('double_click', () => {
    it('double-clicks at coordinates', async () => {
      await executeAction({ action: 'double_click', coordinate: [100, 200] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool mousemove --sync 100 200 click --repeat 2 1')
      );
    });
  });

  describe('triple_click', () => {
    it('triple-clicks at coordinates', async () => {
      await executeAction({ action: 'triple_click', coordinate: [100, 200] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool mousemove --sync 100 200 click --repeat 3 1')
      );
    });
  });

  describe('middle_click', () => {
    it('middle-clicks at coordinates (button 2)', async () => {
      await executeAction({ action: 'middle_click', coordinate: [300, 400] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool mousemove --sync 300 400 click 2')
      );
    });
  });

  describe('type', () => {
    it('types text with delay', async () => {
      await executeAction({ action: 'type', text: 'Hello World' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("xdotool type --delay 12 -- 'Hello World'")
      );
    });

    it('escapes single quotes in text', async () => {
      await executeAction({ action: 'type', text: "it's" });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("xdotool type --delay 12 --")
      );
      // The argument should be shell-escaped
      const callArg = mockExecSync.mock.calls[0][0] as string;
      expect(callArg).toContain("it");
    });
  });

  describe('key', () => {
    it('presses a single key', async () => {
      await executeAction({ action: 'key', text: 'Return' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool key -- Return')
      );
    });

    it('presses key combinations', async () => {
      await executeAction({ action: 'key', text: 'ctrl+s' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool key -- ctrl+s')
      );
    });
  });

  describe('scroll', () => {
    it('scrolls down at coordinates', async () => {
      await executeAction({
        action: 'scroll',
        coordinate: [500, 400],
        scroll_direction: 'down',
        scroll_amount: 3,
      });

      // First moves mouse
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool mousemove --sync 500 400')
      );
      // Then clicks button 5 (scroll down) 3 times
      const scrollCalls = mockExecSync.mock.calls.filter(
        (call) => (call[0] as string).includes('click 5')
      );
      expect(scrollCalls).toHaveLength(3);
    });

    it('scrolls up at coordinates', async () => {
      await executeAction({
        action: 'scroll',
        coordinate: [500, 400],
        scroll_direction: 'up',
        scroll_amount: 2,
      });

      const scrollCalls = mockExecSync.mock.calls.filter(
        (call) => (call[0] as string).includes('click 4')
      );
      expect(scrollCalls).toHaveLength(2);
    });

    it('scrolls left and right', async () => {
      await executeAction({
        action: 'scroll',
        coordinate: [500, 400],
        scroll_direction: 'left',
        scroll_amount: 1,
      });
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('click 6'));

      vi.clearAllMocks();

      await executeAction({
        action: 'scroll',
        coordinate: [500, 400],
        scroll_direction: 'right',
        scroll_amount: 1,
      });
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('click 7'));
    });
  });

  describe('mouse_move', () => {
    it('moves mouse to coordinates', async () => {
      await executeAction({ action: 'mouse_move', coordinate: [250, 350] });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('xdotool mousemove --sync 250 350')
      );
    });
  });

  describe('left_click_drag', () => {
    it('drags from start to end coordinates', async () => {
      await executeAction({
        action: 'left_click_drag',
        start_coordinate: [100, 100],
        coordinate: [400, 400],
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('mousemove --sync 100 100 mousedown 1 mousemove --sync 400 400 mouseup 1')
      );
    });
  });

  describe('wait', () => {
    it('waits for specified duration', async () => {
      const start = Date.now();
      await executeAction({ action: 'wait', duration: 0.1 });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90); // allow small variance
    });
  });

  describe('zoom', () => {
    it('captures and crops a screenshot region', async () => {
      const result = await executeAction({
        action: 'zoom',
        region: [100, 200, 400, 350],
      });

      // Should take a screenshot first
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('scrot')
      );
      // Should return cropped base64
      expect(result.base64).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('returns error when action fails', async () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('xdotool not found');
      });

      const result = await executeAction({ action: 'left_click', coordinate: [100, 100] });

      expect(result.error).toContain('xdotool not found');
    });
  });
});
