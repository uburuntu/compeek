import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT_BASE, SYSTEM_PROMPT_WINDOWS, SYSTEM_PROMPT_MACOS, GENERAL_WORKFLOW_PROMPT } from '@/agent/prompts';
import type { AgentEvent, ComputerAction } from '@/agent/types';
import { buildTextEditorCommand, describeTextEditorAction } from '@/agent/text-editor';
import type { TextEditorInput } from '@/agent/text-editor';

const DISPLAY_WIDTH = 1280;
const DISPLAY_HEIGHT = 768;
const MAX_TOKENS = 16384;
const THINKING_BUDGET = 10240;
const DEFAULT_MAX_ITERATIONS = 50;
const DEFAULT_MODEL = 'claude-sonnet-4-5';

export interface BrowserWorkflowRequest {
  goal: string;
  apiKey: string;
  containerUrl: string;
  apiToken?: string;
  model?: string;
  attachments?: Array<{ base64: string; mimeType: string }>;
  maxIterations?: number;
  osType?: 'linux' | 'windows' | 'macos';
}

type EventCallback = (event: AgentEvent) => void;

function makeEvent(type: AgentEvent['type'], data: AgentEvent['data']): AgentEvent {
  return { type, timestamp: Date.now(), data };
}

async function executeToolRemote(containerUrl: string, action: ComputerAction, apiToken?: string): Promise<{ base64?: string; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;
  const res = await fetch(`${containerUrl}/api/tool`, {
    method: 'POST',
    headers,
    body: JSON.stringify(action),
  });
  return res.json();
}

async function executeBashRemote(containerUrl: string, command: string, apiToken?: string): Promise<{ output?: string; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;
  const res = await fetch(`${containerUrl}/api/bash`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ command }),
  });
  return res.json();
}

function describeAction(action: ComputerAction): string {
  switch (action.action) {
    case 'screenshot': return 'Taking screenshot';
    case 'left_click': return `Clicking at (${action.coordinate[0]}, ${action.coordinate[1]})`;
    case 'right_click': return `Right-clicking at (${action.coordinate[0]}, ${action.coordinate[1]})`;
    case 'double_click': return `Double-clicking at (${action.coordinate[0]}, ${action.coordinate[1]})`;
    case 'triple_click': return `Triple-clicking at (${action.coordinate[0]}, ${action.coordinate[1]})`;
    case 'type': return `Typing: "${action.text.slice(0, 50)}${action.text.length > 50 ? '...' : ''}"`;
    case 'key': return `Pressing key: ${action.text}`;
    case 'scroll': return `Scrolling ${action.scroll_direction} by ${action.scroll_amount}`;
    case 'mouse_move': return `Moving mouse to (${action.coordinate[0]}, ${action.coordinate[1]})`;
    case 'zoom': return `Zooming into region [${action.region.join(', ')}]`;
    case 'wait': return `Waiting ${action.duration}s`;
    default: return `Action: ${(action as ComputerAction).action}`;
  }
}

// --- Text editor tool helpers (imported from @/agent/text-editor) ---

/**
 * Browser-side agent loop.
 * Calls the Anthropic API directly and executes tools via the container's HTTP API.
 */
export async function agentLoop(
  request: BrowserWorkflowRequest,
  onEvent?: EventCallback,
  abortSignal?: AbortSignal,
): Promise<{ success: boolean; actionCount: number; message: string }> {
  const client = new Anthropic({
    apiKey: request.apiKey,
    dangerouslyAllowBrowser: true,
  });
  const maxIterations = request.maxIterations || DEFAULT_MAX_ITERATIONS;
  const model = request.model || DEFAULT_MODEL;
  const osType = request.osType || 'linux';

  // Select system prompt based on OS
  const systemPrompt = osType === 'windows' ? SYSTEM_PROMPT_WINDOWS
    : osType === 'macos' ? SYSTEM_PROMPT_MACOS
    : SYSTEM_PROMPT_BASE;

  // Build prompt
  const userPrompt = GENERAL_WORKFLOW_PROMPT
    .replace('{goal}', request.goal)
    .replace('{context}', '');

  const userContent: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];

  // Add all attachment images
  if (request.attachments?.length) {
    for (const attachment of request.attachments) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: attachment.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: attachment.base64,
        },
      });
    }
  }

  userContent.push({ type: 'text', text: userPrompt });

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    { role: 'user', content: userContent },
  ];

  const isOpus = model.includes('opus');
  const computerToolType = isOpus ? 'computer_20251124' : 'computer_20250124';

  // VM desktops may use different resolution
  const displayWidth = osType !== 'linux' ? 1024 : DISPLAY_WIDTH;
  const displayHeight = osType !== 'linux' ? 768 : DISPLAY_HEIGHT;

  const tools: Anthropic.Beta.Messages.BetaToolUnion[] = [
    {
      type: computerToolType,
      name: 'computer',
      display_width_px: displayWidth,
      display_height_px: displayHeight,
      display_number: 1,
      ...(isOpus ? { enable_zoom: true } : {}),
    } as Anthropic.Beta.Messages.BetaToolUnion,
  ];

  // Bash and text editor only available on Linux containers
  if (osType === 'linux') {
    tools.push(
      { type: 'bash_20250124', name: 'bash' },
      { type: 'text_editor_20250728', name: 'str_replace_based_edit_tool' },
    );
  }

  let actionCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  onEvent?.(makeEvent('status', {
    type: 'status',
    message: `Starting workflow: ${request.goal}`,
    step: 0,
  }));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (abortSignal?.aborted) {
      return { success: false, actionCount, message: 'Workflow stopped by user' };
    }

    onEvent?.(makeEvent('status', {
      type: 'status',
      message: `Step ${iteration + 1}/${maxIterations}`,
      step: iteration + 1,
      totalSteps: maxIterations,
    }));

    const response = await client.beta.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      tools,
      betas: [isOpus ? 'computer-use-2025-11-24' : 'computer-use-2025-01-24'],
      thinking: {
        type: 'enabled',
        budget_tokens: THINKING_BUDGET,
      },
    });

    // Track token usage
    if (response.usage) {
      totalInputTokens += response.usage.input_tokens || 0;
      totalOutputTokens += response.usage.output_tokens || 0;
      onEvent?.(makeEvent('tokens', {
        type: 'tokens',
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      } as any));
    }

    const responseContent = response.content;
    messages.push({ role: 'assistant', content: responseContent as Anthropic.Beta.Messages.BetaContentBlockParam[] });

    const toolResults: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];

    for (const block of responseContent) {
      if (block.type === 'thinking') {
        onEvent?.(makeEvent('thinking', { type: 'thinking', content: block.thinking }));
      } else if (block.type === 'text') {
        onEvent?.(makeEvent('status', { type: 'status', message: block.text.slice(0, 200), step: iteration + 1 }));
      } else if (block.type === 'tool_use') {
        actionCount++;

        if (block.name === 'computer') {
          const action = block.input as ComputerAction;

          onEvent?.(makeEvent('action', {
            type: 'action',
            action: action.action,
            params: block.input as Record<string, unknown>,
            description: describeAction(action),
          }));

          const result = await executeToolRemote(request.containerUrl, action, request.apiToken);

          if (result.error) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.error, is_error: true });
          } else if (result.base64) {
            onEvent?.(makeEvent('screenshot', { type: 'screenshot', base64: result.base64, width: displayWidth, height: displayHeight }));
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: result.base64 } }],
            });
          } else {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Action executed successfully.' });
          }
        } else if (block.name === 'bash') {
          const input = block.input as { command: string };

          onEvent?.(makeEvent('action', {
            type: 'action',
            action: 'bash',
            params: block.input as Record<string, unknown>,
            description: `$ ${input.command.length > 80 ? input.command.slice(0, 80) + '...' : input.command}`,
          }));

          const result = await executeBashRemote(request.containerUrl, input.command, request.apiToken);

          if (result.error) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${result.error}`, is_error: true });
          } else {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.output || 'Command executed successfully (no output).' });
          }
        } else if (block.name === 'str_replace_based_edit_tool') {
          const input = block.input as TextEditorInput;

          onEvent?.(makeEvent('action', {
            type: 'action',
            action: input.command,
            params: block.input as Record<string, unknown>,
            description: describeTextEditorAction(input),
          }));

          const command = buildTextEditorCommand(input);
          const result = await executeBashRemote(request.containerUrl, command, request.apiToken);

          if (result.error) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${result.error}`, is_error: true });
          } else {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.output || 'Operation completed successfully.' });
          }
        }
      }
    }

    // No tool use → model is done
    if (toolResults.length === 0) {
      const textBlocks = responseContent.filter(b => b.type === 'text');
      const finalMessage = textBlocks.map(b => (b as { text: string }).text).join('\n') || 'Task completed.';

      onEvent?.(makeEvent('complete', { type: 'complete', message: finalMessage, success: true, totalActions: actionCount }));
      return { success: true, actionCount, message: finalMessage };
    }

    messages.push({ role: 'user', content: toolResults });
  }

  // Max steps
  onEvent?.(makeEvent('error', { type: 'error', message: `Maximum steps (${maxIterations}) reached.`, recoverable: false }));
  return { success: false, actionCount, message: 'Maximum steps reached' };
}
