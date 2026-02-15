import { useState, useEffect } from 'react';
import DesktopViewer from './DesktopViewer';
import WorkflowPanel from './WorkflowPanel';
import ActivityFeed from './ActivityFeed';
import ThinkingDisplay from './ThinkingDisplay';
import { useSession } from '../hooks/useSession';
import type { SessionConfig, SessionStatus } from '../types/session';

type Tab = 'activity' | 'thinking';

interface Props {
  config: SessionConfig;
  visible: boolean;
  apiKey?: string;
  initialModel?: string;
  onStatusChange: (status: SessionStatus) => void;
}

export default function SessionView({ config, visible, apiKey, initialModel, onStatusChange }: Props) {
  const session = useSession(config, apiKey);
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [lastSeenThinkingCount, setLastSeenThinkingCount] = useState(0);

  useEffect(() => {
    onStatusChange(session.status);
  }, [session.status, onStatusChange]);

  const thinkingEvents = session.events.filter(e => e.type === 'thinking');
  const actionEvents = session.events.filter(e => e.type === 'action' || e.type === 'status' || e.type === 'screenshot' || e.type === 'error');
  const completionEvent = session.events.find(e => e.type === 'complete');

  // Track current step from status events
  const latestStatusEvent = [...session.events].reverse().find(e => e.type === 'status' && e.data.step);
  const currentStep = latestStatusEvent?.data.step || null;

  // Track token usage from tokens events
  const latestTokensEvent = [...session.events].reverse().find(e => e.type === 'tokens');
  const tokenUsage = latestTokensEvent ? { input: latestTokensEvent.data.inputTokens, output: latestTokensEvent.data.outputTokens } : null;

  // Update seen thinking count when tab is active
  useEffect(() => {
    if (activeTab === 'thinking') {
      setLastSeenThinkingCount(thinkingEvents.length);
    }
  }, [activeTab, thinkingEvents.length]);

  const hasNewThinking = thinkingEvents.length > lastSeenThinkingCount && activeTab !== 'thinking';

  // Format model name for display
  const modelLabel = session.currentModel?.includes('opus') ? 'Opus 4.6'
    : session.currentModel?.includes('sonnet') ? 'Sonnet 4.5'
    : session.currentModel?.includes('haiku') ? 'Haiku 4.5'
    : null;

  const isLocalVnc = config.vncHost === 'localhost' || config.vncHost === '127.0.0.1';
  const vncProto = isLocalVnc ? 'http' : 'https';
  const vncShowPort = isLocalVnc || (vncProto === 'https' && config.vncPort !== 443);
  const vncUrl = `${vncProto}://${config.vncHost}${vncShowPort ? `:${config.vncPort}` : ''}/compeek-vnc.html?show_dot=true${config.vncPassword ? `&password=${encodeURIComponent(config.vncPassword)}` : ''}`;

  return (
    <div className={`flex-1 flex overflow-hidden ${visible ? '' : 'hidden'}`}>
      {/* Left: Desktop Viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        <DesktopViewer
          screenshot={session.latestScreenshot}
          action={session.latestAction}
          isRunning={session.isRunning}
          vncUrl={vncUrl}
          sessionType={config.type}
          currentStep={currentStep}
          modelName={modelLabel}
          tokenUsage={tokenUsage}
        />
      </div>

      {/* Right: Control Panel (hidden for vnc-only) */}
      {config.type !== 'vnc-only' && (
        <div className="w-[420px] border-l border-compeek-border flex flex-col bg-compeek-surface shrink-0">
          <WorkflowPanel
            isRunning={session.isRunning}
            onStart={session.startWorkflow}
            onStop={session.stopWorkflow}
            apiKey={apiKey}
            initialModel={initialModel}
          />

          {/* Tab navigation */}
          <div className="flex border-b border-compeek-border shrink-0">
            {(['activity', 'thinking'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-compeek-accent border-b-2 border-compeek-accent'
                    : 'text-compeek-text-dim hover:text-compeek-text'
                }`}
              >
                {tab === 'activity' && `Activity (${actionEvents.length})`}
                {tab === 'thinking' && (
                  <>
                    {`Thinking (${thinkingEvents.length})`}
                    {hasNewThinking && (
                      <span className="absolute top-1.5 right-[calc(50%-30px)] w-2 h-2 rounded-full bg-compeek-accent animate-pulse" />
                    )}
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'activity' && (
              <ActivityFeed events={actionEvents} completionEvent={completionEvent} />
            )}
            {activeTab === 'thinking' && (
              <ThinkingDisplay events={thinkingEvents} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
