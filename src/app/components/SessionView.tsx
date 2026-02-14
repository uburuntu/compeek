import { useState, useEffect } from 'react';
import DesktopViewer from './DesktopViewer';
import WorkflowPanel from './WorkflowPanel';
import ActivityFeed from './ActivityFeed';
import ThinkingDisplay from './ThinkingDisplay';
import ValidationReport from './ValidationReport';
import { useSession } from '../hooks/useSession';
import type { SessionConfig, SessionStatus } from '../types/session';

type Tab = 'activity' | 'thinking' | 'validation';

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

  useEffect(() => {
    onStatusChange(session.status);
  }, [session.status, onStatusChange]);

  const thinkingEvents = session.events.filter(e => e.type === 'thinking');
  const actionEvents = session.events.filter(e => e.type === 'action' || e.type === 'status' || e.type === 'screenshot' || e.type === 'error');
  const validationEvents = session.events.filter(e => e.type === 'validation');
  const completionEvent = session.events.find(e => e.type === 'complete');

  const vncUrl = `http://${config.vncHost}:${config.vncPort}/compeek-vnc.html?show_dot=true${config.vncPassword ? `&password=${encodeURIComponent(config.vncPassword)}` : ''}`;

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
            {(['activity', 'thinking', 'validation'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-compeek-accent border-b-2 border-compeek-accent'
                    : 'text-compeek-text-dim hover:text-compeek-text'
                }`}
              >
                {tab === 'activity' && `Activity (${actionEvents.length})`}
                {tab === 'thinking' && `Thinking (${thinkingEvents.length})`}
                {tab === 'validation' && `Validation`}
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
            {activeTab === 'validation' && (
              <ValidationReport events={validationEvents} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
