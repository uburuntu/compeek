import type { SessionConfig, SessionStatus } from '../types/session';
import Tooltip from './Tooltip';

interface Props {
  sessions: SessionConfig[];
  activeSessionId: string;
  sessionStatuses: Record<string, SessionStatus>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

const statusLabels: Record<SessionStatus, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
};

const statusColors: Record<SessionStatus, string> = {
  connected: 'bg-compeek-success',
  reconnecting: 'bg-yellow-500 animate-pulse',
  disconnected: 'bg-compeek-text-dim',
};

export default function SessionTabBar({ sessions, activeSessionId, sessionStatuses, onSelect, onClose, onAdd }: Props) {
  const isHomeActive = activeSessionId === '';

  return (
    <div className="h-9 flex items-center bg-compeek-bg border-b border-compeek-border shrink-0 overflow-x-auto">
      {/* Permanent Home tab */}
      <button
        onClick={() => onSelect('')}
        className={`group relative flex items-center gap-2 px-4 h-full text-xs font-medium transition-colors whitespace-nowrap ${
          isHomeActive
            ? 'bg-compeek-surface text-compeek-text border-b-2 border-compeek-accent'
            : 'text-compeek-text-dim hover:text-compeek-text hover:bg-compeek-surface/50'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>Home</span>
      </button>

      {/* Session tabs */}
      {sessions.map(session => {
        const isActive = session.id === activeSessionId;
        const status = sessionStatuses[session.id] || 'disconnected';

        return (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`group relative flex items-center gap-2 px-4 h-full text-xs font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-compeek-surface text-compeek-text border-b-2 border-compeek-accent'
                : 'text-compeek-text-dim hover:text-compeek-text hover:bg-compeek-surface/50'
            }`}
          >
            <Tooltip content={statusLabels[status]} position="bottom">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColors[status]}`} />
            </Tooltip>
            <span>{session.name}</span>
            {session.type === 'vnc-only' && (
              <Tooltip content="View-only mode — no AI agent" position="bottom">
                <span className="text-[9px] text-compeek-text-dim opacity-60 cursor-help">VNC</span>
              </Tooltip>
            )}
            {session.osType && session.osType !== 'linux' && (
              <Tooltip content={`${session.osType === 'windows' ? 'Windows' : 'macOS'} VM — mouse and keyboard only`} position="bottom">
                <span className="text-[9px] text-compeek-text-dim opacity-60 cursor-help uppercase">
                  {session.osType === 'windows' ? 'WIN' : 'MAC'}
                </span>
              </Tooltip>
            )}
            <span
              onClick={(e) => { e.stopPropagation(); onClose(session.id); }}
              className="ml-1 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-compeek-border text-compeek-text-dim hover:text-compeek-text transition-all"
            >
              &times;
            </span>
          </button>
        );
      })}

      <Tooltip content="Connect to another desktop" position="bottom">
        <button
          onClick={onAdd}
          className="flex items-center justify-center w-8 h-full text-compeek-text-dim hover:text-compeek-text hover:bg-compeek-surface/50 transition-colors text-sm shrink-0"
        >
          +
        </button>
      </Tooltip>
    </div>
  );
}
