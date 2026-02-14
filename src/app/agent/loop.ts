import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT_BASE, FORM_FILL_PROMPT, GENERAL_WORKFLOW_PROMPT } from '@/agent/prompts';
import type { AgentEvent, ComputerAction } from '@/agent/types';

const DISPLAY_WIDTH = 1280;
const DISPLAY_HEIGHT = 720;
const MAX_TOKENS = 16384;
const THINKING_BUDGET = 10240;
const DEFAULT_MAX_ITERATIONS = 50;
const DEFAULT_MODEL = 'claude-sonnet-4-5';

export interface BrowserWorkflowRequest {
  goal: string;
  apiKey: string;
  containerUrl: string;
  model?: string;
  context?: Record<string, unknown>;
  documentBase64?: string;
  documentMimeType?: string;
  maxIterations?: number;
}

type EventCallback = (event: AgentEvent) => void;

function makeEvent(type: AgentEvent['type'], data: AgentEvent['data']): AgentEvent {
  return { type, timestamp: Date.now(), data };
}

async function executeToolRemote(containerUrl: string, action: ComputerAction): Promise<{ base64?: string; error?: string }> {
  const res = await fetch(`${containerUrl}/api/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  return res.json();
}

async function executeBashRemote(containerUrl: string, command: string): Promise<{ output?: string; error?: string }> {
  const res = await fetch(`${containerUrl}/api/bash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

// --- Text editor tool helpers ---

interface TextEditorInput {
  command: 'view' | 'create' | 'str_replace' | 'insert';
  path: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
  view_range?: [number, number];
}

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function buildTextEditorCommand(input: TextEditorInput): string {
  switch (input.command) {
    case 'view': {
      if (input.view_range) {
        const [start, end] = input.view_range;
        return `sed -n '${start},${end}p' ${shellEscape(input.path)} | cat -n`;
      }
      return `cat -n ${shellEscape(input.path)}`;
    }
    case 'create': {
      const dir = input.path.substring(0, input.path.lastIndexOf('/'));
      const content = input.file_text || '';
      return `mkdir -p ${shellEscape(dir)} && cat > ${shellEscape(input.path)} << 'COMPEEK_EOF'\n${content}\nCOMPEEK_EOF`;
    }
    case 'str_replace': {
      const oldStr = input.old_str || '';
      const newStr = input.new_str || '';
      // Use python3 for reliable multi-line string replacement
      const pyScript = `
import sys
path = ${JSON.stringify(input.path)}
old = ${JSON.stringify(oldStr)}
new = ${JSON.stringify(newStr)}
with open(path, 'r') as f:
    content = f.read()
count = content.count(old)
if count == 0:
    print(f"Error: string not found in {path}", file=sys.stderr)
    sys.exit(1)
if count > 1:
    print(f"Error: found {count} occurrences, expected exactly 1", file=sys.stderr)
    sys.exit(1)
content = content.replace(old, new, 1)
with open(path, 'w') as f:
    f.write(content)
print(f"Replaced 1 occurrence in {path}")
`.trim();
      return `python3 -c ${shellEscape(pyScript)}`;
    }
    case 'insert': {
      const lineNum = input.insert_line || 0;
      const newStr = input.new_str || '';
      const pyScript = `
import sys
path = ${JSON.stringify(input.path)}
line_num = ${lineNum}
new_text = ${JSON.stringify(newStr)}
with open(path, 'r') as f:
    lines = f.readlines()
new_lines = new_text.split('\\n')
for i, line in enumerate(new_lines):
    lines.insert(line_num + i, line + '\\n')
with open(path, 'w') as f:
    f.writelines(lines)
print(f"Inserted {len(new_lines)} line(s) at line {line_num} in {path}")
`.trim();
      return `python3 -c ${shellEscape(pyScript)}`;
    }
    default:
      return `echo "Unknown text editor command: ${(input as TextEditorInput).command}"`;
  }
}

function describeTextEditorAction(input: TextEditorInput): string {
  switch (input.command) {
    case 'view': return `Viewing ${input.path}${input.view_range ? ` (lines ${input.view_range[0]}-${input.view_range[1]})` : ''}`;
    case 'create': return `Creating ${input.path}`;
    case 'str_replace': return `Editing ${input.path}`;
    case 'insert': return `Inserting at line ${input.insert_line} in ${input.path}`;
    default: return `Text editor: ${(input as TextEditorInput).command}`;
  }
}

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

  // Build prompt
  let userPrompt: string;
  if (request.context && request.documentBase64) {
    userPrompt = FORM_FILL_PROMPT.replace('{data}', JSON.stringify(request.context, null, 2));
  } else {
    const contextStr = request.context ? `\nAdditional context:\n${JSON.stringify(request.context, null, 2)}` : '';
    userPrompt = GENERAL_WORKFLOW_PROMPT
      .replace('{goal}', request.goal)
      .replace('{context}', contextStr);
  }

  const userContent: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];

  if (request.documentBase64 && request.documentMimeType) {
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: request.documentMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: request.documentBase64,
      },
    });
  }

  userContent.push({ type: 'text', text: userPrompt });

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    { role: 'user', content: userContent },
  ];

  const isOpus = model.includes('opus');
  const computerToolType = isOpus ? 'computer_20251124' : 'computer_20250124';

  const tools: Anthropic.Beta.Messages.BetaToolUnion[] = [
    {
      type: computerToolType,
      name: 'computer',
      display_width_px: DISPLAY_WIDTH,
      display_height_px: DISPLAY_HEIGHT,
      display_number: 1,
      ...(isOpus ? { enable_zoom: true } : {}),
    } as Anthropic.Beta.Messages.BetaToolUnion,
    { type: 'bash_20250124', name: 'bash' },
    { type: 'text_editor_20250728', name: 'str_replace_based_edit_tool' },
  ];

  let actionCount = 0;

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
      message: `Iteration ${iteration + 1}/${maxIterations}`,
      step: iteration + 1,
      totalSteps: maxIterations,
    }));

    const response = await client.beta.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT_BASE,
      messages,
      tools,
      betas: [isOpus ? 'computer-use-2025-11-24' : 'computer-use-2025-01-24'],
      thinking: {
        type: 'enabled',
        budget_tokens: THINKING_BUDGET,
      },
    });

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

          const result = await executeToolRemote(request.containerUrl, action);

          if (result.error) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.error, is_error: true });
          } else if (result.base64) {
            onEvent?.(makeEvent('screenshot', { type: 'screenshot', base64: result.base64, width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT }));
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
          const result = await executeBashRemote(request.containerUrl, input.command);

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
          const result = await executeBashRemote(request.containerUrl, command);

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

  // Max iterations
  onEvent?.(makeEvent('error', { type: 'error', message: `Maximum iterations (${maxIterations}) reached.`, recoverable: false }));
  return { success: false, actionCount, message: 'Maximum iterations reached' };
}

/**
 * Extract structured data from a document image using Anthropic Vision API (browser-side).
 */
export async function extractDocument(
  apiKey: string,
  base64: string,
  mimeType: string,
): Promise<{ fields: Record<string, string>; documentType: string } | { error: string }> {
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Analyze this document image and extract all relevant personal/identifying information. Extract fields like firstName, lastName, dateOfBirth (YYYY-MM-DD), gender, nationality, documentType, documentNumber, address, email, phone. Respond in JSON: { "documentType": "...", "fields": { ... }, "confidence": { ... } }`,
          },
        ],
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return { error: 'No response' };

    const jsonMatch = textBlock.text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, textBlock.text];
    const parsed = JSON.parse(jsonMatch[1]!);
    return { documentType: parsed.documentType || 'unknown', fields: parsed.fields || {} };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}
