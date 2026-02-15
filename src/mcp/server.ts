import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolExecutor } from './executors.js';
import type { ComputerAction } from '../agent/types.js';
import { buildTextEditorCommand } from '../agent/text-editor.js';
import { SYSTEM_PROMPT_BASE, GENERAL_WORKFLOW_PROMPT } from '../agent/prompts.js';

export interface McpServerOptions {
  executor: ToolExecutor;
  serverName?: string;
}

export function createCompeekMcpServer(options: McpServerOptions): McpServer {
  const { executor, serverName = 'compeek' } = options;

  const server = new McpServer({
    name: serverName,
    version: '1.0.0',
  });

  // ── Tool: screenshot ──────────────────────────────────

  server.tool(
    'screenshot',
    'Take a screenshot of the virtual desktop (1280x720). Optionally zoom into a specific region.',
    {
      region: z.tuple([z.number(), z.number(), z.number(), z.number()])
        .describe('Zoom region [x1, y1, x2, y2] for a cropped screenshot')
        .optional(),
    },
    async ({ region }) => {
      const action: ComputerAction = region
        ? { action: 'zoom', region: region as [number, number, number, number] }
        : { action: 'screenshot' };

      const result = await executor.executeAction(action);

      if (result.error) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }

      return {
        content: [{
          type: 'image',
          data: result.base64!,
          mimeType: 'image/png',
        }],
      };
    },
  );

  // ── Tool: computer ────────────────────────────────────

  server.tool(
    'computer',
    'Perform mouse and keyboard actions on the virtual desktop (1280x720). Actions: left_click, right_click, double_click, triple_click, middle_click, type, key, scroll, mouse_move, left_click_drag, left_mouse_down, left_mouse_up, hold_key, wait.',
    {
      action: z.enum([
        'left_click', 'right_click', 'double_click', 'triple_click', 'middle_click',
        'type', 'key', 'scroll', 'mouse_move',
        'left_click_drag', 'left_mouse_down', 'left_mouse_up',
        'hold_key', 'wait',
      ]).describe('The action to perform'),
      coordinate: z.tuple([z.number(), z.number()])
        .describe('Screen coordinates [x, y] for click/scroll/move/drag actions')
        .optional(),
      text: z.string()
        .describe('Text to type, key name (e.g. "Return", "ctrl+s"), or key to hold')
        .optional(),
      scroll_direction: z.enum(['up', 'down', 'left', 'right'])
        .describe('Scroll direction (for scroll action)')
        .optional(),
      scroll_amount: z.number()
        .describe('Number of scroll clicks (for scroll action)')
        .optional(),
      start_coordinate: z.tuple([z.number(), z.number()])
        .describe('Start coordinates [x, y] for left_click_drag')
        .optional(),
      duration: z.number()
        .describe('Duration in seconds (for hold_key or wait actions)')
        .optional(),
    },
    async (input) => {
      const action = input as unknown as ComputerAction;
      const result = await executor.executeAction(action);

      if (result.error) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }

      if (result.base64) {
        return {
          content: [{ type: 'image', data: result.base64, mimeType: 'image/png' }],
        };
      }

      return { content: [{ type: 'text', text: 'Action executed successfully.' }] };
    },
  );

  // ── Tool: bash ────────────────────────────────────────

  server.tool(
    'bash',
    'Execute a bash command on the virtual desktop container. Has access to the full Linux toolchain: git, curl, wget, python3, node, npm, Firefox, and more. Timeout: 120s.',
    {
      command: z.string().describe('The bash command to execute'),
    },
    async ({ command }) => {
      const result = await executor.executeBash(command);

      if (result.error) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text', text: result.output || '(no output)' }] };
    },
  );

  // ── Tool: text_editor ─────────────────────────────────

  server.tool(
    'text_editor',
    'View, create, and edit files on the container. Commands: view (read file with line numbers), create (write new file), str_replace (find & replace exactly one occurrence), insert (insert text at line number).',
    {
      command: z.enum(['view', 'create', 'str_replace', 'insert'])
        .describe('The file operation to perform'),
      path: z.string().describe('Absolute path to the file'),
      file_text: z.string()
        .describe('Full file content (for create)')
        .optional(),
      old_str: z.string()
        .describe('String to find and replace (for str_replace, must match exactly once)')
        .optional(),
      new_str: z.string()
        .describe('Replacement string (for str_replace or insert)')
        .optional(),
      insert_line: z.number()
        .describe('Line number to insert at (for insert)')
        .optional(),
      view_range: z.tuple([z.number(), z.number()])
        .describe('Line range [start, end] to view (for view)')
        .optional(),
    },
    async (input) => {
      const bashCommand = buildTextEditorCommand(input);
      const result = await executor.executeBash(bashCommand);

      if (result.error) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text', text: result.output || 'Operation completed successfully.' }] };
    },
  );

  // ── Resource: container info ──────────────────────────

  if (executor.getInfo) {
    const getInfo = executor.getInfo.bind(executor);
    server.resource(
      'container-info',
      'compeek://container/info',
      { description: 'Container session info (name, mode, ports, tunnel URLs)' },
      async (uri) => {
        const info = await getInfo();
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(info, null, 2),
            mimeType: 'application/json',
          }],
        };
      },
    );
  }

  // ── Prompt: desktop-agent ─────────────────────────────

  server.prompt(
    'desktop-agent',
    'System prompt for a desktop automation agent with compeek tools',
    async () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: SYSTEM_PROMPT_BASE },
      }],
    }),
  );

  // ── Prompt: execute-task ──────────────────────────────

  server.prompt(
    'execute-task',
    'Prompt template for executing a task on the virtual desktop',
    { goal: z.string().describe('The task to execute on the desktop') },
    async ({ goal }) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: GENERAL_WORKFLOW_PROMPT
            .replace('{goal}', goal)
            .replace('{context}', ''),
        },
      }],
    }),
  );

  return server;
}
