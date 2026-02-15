import { useState, useCallback, useEffect } from 'react';
import SessionTabBar from './components/SessionTabBar';
import SessionView from './components/SessionView';
import AddSessionDialog from './components/AddSessionDialog';
import SettingsDialog from './components/SettingsDialog';
import WelcomeGuide from './components/WelcomeGuide';
import Tooltip from './components/Tooltip';
import { useSessionManager } from './hooks/useSessionManager';
import { useSettings } from './hooks/useSettings';
import type { SessionStatus } from './types/session';
import logoImg from './assets/logo.png';

export default function App() {
  const { sessions, activeSessionId, setActiveSessionId, addSession, removeSession } = useSessionManager();
  const { settings, update: updateSettings } = useSettings();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, SessionStatus>>({});

  const handleStatusChange = useCallback((sessionId: string) => (status: SessionStatus) => {
    setSessionStatuses(prev => {
      if (prev[sessionId] === status) return prev;
      return { ...prev, [sessionId]: status };
    });
  }, []);

  const connectedCount = Object.values(sessionStatuses).filter(s => s === 'connected').length;

  // Auto-connect from URL hash: #config=<base64 JSON>
  useEffect(() => {
    const hash = window.location.hash;
    const prefix = '#config=';
    if (!hash.startsWith(prefix)) return;
    try {
      const b64 = hash.slice(prefix.length);
      const json = JSON.parse(atob(b64));
      if (json.name && json.apiHost && json.apiPort && json.vncHost && json.vncPort) {
        addSession({
          name: json.name,
          type: json.type || 'compeek',
          apiHost: json.apiHost,
          apiPort: json.apiPort,
          vncHost: json.vncHost,
          vncPort: json.vncPort,
          ...(json.vncPassword ? { vncPassword: json.vncPassword } : {}),
        });
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch {
      // Invalid config in hash — ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show welcome guide when Home tab is active
  const showHome = activeSessionId === '' || !sessions.find(s => s.id === activeSessionId);

  return (
    <div className="h-screen flex flex-col bg-compeek-bg text-compeek-text">
      {/* Header */}
      <header className="h-12 flex items-center px-4 border-b border-compeek-border bg-compeek-surface shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center">
            <img src={logoImg} alt="compeek" className="w-7 h-7" />
          </div>
          <span className="font-semibold text-base tracking-tight">compeek</span>
          <span className="text-xs text-compeek-text-dim ml-1 hidden sm:inline">AI eyes & hands for any desktop</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Tooltip content="Desktop connections">
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className={`w-1.5 h-1.5 rounded-full ${connectedCount > 0 ? 'bg-compeek-success' : 'bg-compeek-text-dim'}`} />
              <span className="text-compeek-text-dim">
                {connectedCount > 0 ? `${connectedCount} connected` : 'No desktops'}
              </span>
            </div>
          </Tooltip>

          {/* API key warning */}
          {!settings.apiKey && (
            <Tooltip content="You need an API key to use the AI agent. Click to add one.">
              <button
                onClick={() => setShowSettings(true)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-compeek-warning/15 text-compeek-warning border border-compeek-warning/30 hover:bg-compeek-warning/25 transition-colors"
              >
                Setup needed
              </button>
            </Tooltip>
          )}

          {/* Settings gear */}
          <Tooltip content="Settings">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 text-compeek-text-dim hover:text-compeek-text transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Session tabs */}
      <SessionTabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        sessionStatuses={sessionStatuses}
        onSelect={setActiveSessionId}
        onClose={removeSession}
        onAdd={() => setShowAddDialog(true)}
      />

      {/* Main content — Home and sessions always coexist */}
      <WelcomeGuide
        visible={showHome}
        onAddSession={() => setShowAddDialog(true)}
        onOpenSettings={() => setShowSettings(true)}
        hasApiKey={!!settings.apiKey}
        hasConnectedSession={connectedCount > 0}
      />
      {sessions.map(session => (
        <SessionView
          key={session.id}
          config={session}
          visible={session.id === activeSessionId}
          apiKey={settings.apiKey || undefined}
          initialModel={settings.lastModel}
          onStatusChange={handleStatusChange(session.id)}
        />
      ))}

      {/* Dialogs */}
      <AddSessionDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={addSession}
      />
      <SettingsDialog
        open={showSettings}
        settings={settings}
        onUpdate={updateSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
