import { useState, useEffect, useRef, useCallback } from 'react';
import { agentLoop } from '../agent/loop';
import type { SessionConfig, SessionStatus } from '../types/session';

interface AgentEvent {
  type: string;
  timestamp: number;
  data: any;
}

export interface SessionState {
  config: SessionConfig;
  status: SessionStatus;
  events: AgentEvent[];
  isRunning: boolean;
  latestScreenshot: string | null;
  latestAction: any;
  startWorkflow: (goal: string, model?: string, documentBase64?: string, documentMimeType?: string, extractedData?: Record<string, string>) => Promise<void>;
  stopWorkflow: () => void;
  containerUrl: string;
}

export function useSession(config: SessionConfig, apiKey?: string): SessionState {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [latestAction, setLatestAction] = useState<any>(null);
  const [status, setStatus] = useState<SessionStatus>('disconnected');
  const abortRef = useRef<AbortController | null>(null);
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  const containerUrl = `http://${config.apiHost}:${config.apiPort}`;

  // Health-check polling for container status
  useEffect(() => {
    if (config.type === 'vnc-only') {
      setStatus('connected');
      return;
    }

    let cancelled = false;

    async function check() {
      if (cancelled) return;
      try {
        const res = await fetch(`${containerUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
        setStatus(res.ok ? 'connected' : 'disconnected');
      } catch {
        setStatus('disconnected');
      }
    }

    check();
    const interval = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [config.type, containerUrl]);

  const startWorkflow = useCallback(async (goal: string, model?: string, documentBase64?: string, documentMimeType?: string, extractedData?: Record<string, string>) => {
    if (!apiKeyRef.current) {
      setEvents([{ type: 'error', timestamp: Date.now(), data: { type: 'error', message: 'Set your Anthropic API key in Settings first.', recoverable: false } }]);
      return;
    }

    setEvents([]);
    setIsRunning(true);
    setLatestScreenshot(null);
    setLatestAction(null);

    const abort = new AbortController();
    abortRef.current = abort;

    const onEvent = (event: AgentEvent) => {
      setEvents(prev => [...prev, event]);
      if (event.type === 'screenshot') setLatestScreenshot(event.data.base64);
      if (event.type === 'action') setLatestAction(event.data);
    };

    try {
      await agentLoop({
        goal,
        model,
        apiKey: apiKeyRef.current,
        containerUrl,
        documentBase64,
        documentMimeType,
        context: extractedData ? { extractedFields: extractedData } : undefined,
      }, onEvent, abort.signal);
    } catch (err: any) {
      onEvent({
        type: 'error',
        timestamp: Date.now(),
        data: { type: 'error', message: err.message || String(err), recoverable: false },
      });
    } finally {
      setIsRunning(false);
    }
  }, [containerUrl]);

  const stopWorkflow = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  return {
    config,
    status,
    events,
    isRunning,
    latestScreenshot,
    latestAction,
    startWorkflow,
    stopWorkflow,
    containerUrl,
  };
}
