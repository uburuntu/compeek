// Agent event types emitted during workflow execution
export interface AgentEvent {
  type: 'screenshot' | 'action' | 'thinking' | 'validation' | 'complete' | 'error' | 'status';
  timestamp: number;
  data: ScreenshotEvent | ActionEvent | ThinkingEvent | ValidationEvent | CompleteEvent | ErrorEvent | StatusEvent;
}

export interface ScreenshotEvent {
  type: 'screenshot';
  base64: string;
  width: number;
  height: number;
}

export interface ActionEvent {
  type: 'action';
  action: string; // 'left_click' | 'type' | 'key' | 'scroll' | 'mouse_move' | 'zoom' etc.
  params: Record<string, unknown>;
  description?: string;
}

export interface ThinkingEvent {
  type: 'thinking';
  content: string;
}

export interface ValidationEvent {
  type: 'validation';
  results: ValidationResult[];
}

export interface ValidationResult {
  field: string;
  expected: string;
  actual: string;
  match: boolean;
}

export interface CompleteEvent {
  type: 'complete';
  message: string;
  success: boolean;
  totalActions: number;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  recoverable: boolean;
}

export interface StatusEvent {
  type: 'status';
  message: string;
  step: number;
  totalSteps?: number;
}

// Workflow types
export interface WorkflowRequest {
  goal: string;
  model?: string;
  context?: Record<string, unknown>;
  documentBase64?: string;
  documentMimeType?: string;
  maxIterations?: number;
  apiKey?: string;
}

export interface WorkflowStatus {
  id: string;
  state: 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
  goal: string;
  startedAt?: number;
  completedAt?: number;
  actionCount: number;
  events: AgentEvent[];
}

// Document extraction types
export interface ExtractedDocument {
  fields: Record<string, string>;
  confidence: Record<string, number>;
  documentType: string;
  rawText?: string;
}

// Computer use tool types
export type ComputerAction =
  | { action: 'screenshot' }
  | { action: 'left_click'; coordinate: [number, number]; text?: string }
  | { action: 'right_click'; coordinate: [number, number] }
  | { action: 'double_click'; coordinate: [number, number] }
  | { action: 'triple_click'; coordinate: [number, number] }
  | { action: 'middle_click'; coordinate: [number, number] }
  | { action: 'type'; text: string }
  | { action: 'key'; text: string }
  | { action: 'scroll'; coordinate: [number, number]; scroll_direction: 'up' | 'down' | 'left' | 'right'; scroll_amount: number }
  | { action: 'mouse_move'; coordinate: [number, number] }
  | { action: 'left_click_drag'; start_coordinate: [number, number]; coordinate: [number, number] }
  | { action: 'left_mouse_down'; coordinate: [number, number] }
  | { action: 'left_mouse_up'; coordinate: [number, number] }
  | { action: 'hold_key'; text: string; duration: number }
  | { action: 'wait'; duration: number }
  | { action: 'zoom'; region: [number, number, number, number] };
