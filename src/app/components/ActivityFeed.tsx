import { useEffect, useRef, useState } from 'react';
import emptyActivityImg from '../assets/empty-activity.png';

interface Props {
  events: any[];
  completionEvent?: any;
}

function getActionColor(action: string): string {
  switch (action) {
    case 'left_click': case 'right_click': case 'double_click': case 'triple_click': return 'text-blue-400';
    case 'type': return 'text-green-400';
    case 'key': return 'text-yellow-400';
    case 'scroll': return 'text-purple-400';
    case 'screenshot': return 'text-cyan-400';
    case 'zoom': return 'text-orange-400';
    case 'mouse_move': return 'text-indigo-400';
    case 'bash': return 'text-emerald-400';
    case 'view': case 'create': case 'str_replace': case 'insert': return 'text-amber-400';
    default: return 'text-compeek-text-dim';
  }
}

function ActionIcon({ action }: { action: string }) {
  const color = getActionColor(action);
  const props = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: `w-3.5 h-3.5 ${color}` };

  switch (action) {
    case 'left_click': case 'right_click': case 'double_click': case 'triple_click':
      return <svg {...props}><rect x="6" y="2" width="12" height="20" rx="6" /><line x1="12" y1="2" x2="12" y2="10" /><line x1="12" y1="6" x2="12" y2="8" strokeWidth="3" /></svg>;
    case 'type':
      return <svg {...props}><rect x="2" y="6" width="20" height="12" rx="2" /><line x1="6" y1="10" x2="6" y2="10.01" /><line x1="10" y1="10" x2="10" y2="10.01" /><line x1="14" y1="10" x2="14" y2="10.01" /><line x1="18" y1="10" x2="18" y2="10.01" /><line x1="8" y1="14" x2="16" y2="14" /></svg>;
    case 'key':
      return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></svg>;
    case 'scroll':
      return <svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="8 9 12 5 16 9" /><polyline points="8 15 12 19 16 15" /></svg>;
    case 'screenshot':
      return <svg {...props}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>;
    case 'zoom':
      return <svg {...props}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>;
    case 'mouse_move':
      return <svg {...props}><path d="M5 3l14 9-6 2-4 6z" /><path d="M13 14l4 6" /></svg>;
    case 'wait':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    case 'bash':
      return <svg {...props}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
    case 'view': case 'create': case 'str_replace': case 'insert':
      return <svg {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
    default:
      return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatusMessage({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > 120;

  return (
    <p
      className={`text-xs leading-relaxed ${isLong && !expanded ? 'line-clamp-2' : ''} ${isLong ? 'cursor-pointer' : ''}`}
      onClick={isLong ? () => setExpanded(e => !e) : undefined}
      title={isLong ? (expanded ? 'Click to collapse' : 'Click to expand') : undefined}
    >
      {message}
      {isLong && !expanded && (
        <span className="text-compeek-accent ml-1 text-[10px] font-medium">more</span>
      )}
    </p>
  );
}

export default function ActivityFeed({ events, completionEvent }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-compeek-text-dim">
        <div className="text-center text-xs">
          <img src={emptyActivityImg} alt="" className="w-32 h-32 mx-auto mb-3 opacity-40" />
          <p>No activity yet</p>
          <p className="mt-1 opacity-50">Start a workflow to see agent actions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-px">
      {events.map((event, i) => {
        if (event.type === 'action') {
          return (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-compeek-bg/50 animate-slide-in group">
              <ActionIcon action={event.data.action} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-compeek-text truncate">
                  {event.data.description || event.data.action}
                </p>
                {event.data.params?.text && event.data.action === 'type' && (
                  <p className="text-[10px] text-compeek-text-dim font-mono mt-0.5 break-all bg-compeek-bg/70 rounded px-1.5 py-0.5 leading-relaxed">
                    &quot;{event.data.params.text}&quot;
                  </p>
                )}
                {event.data.action === 'bash' && event.data.params?.command && (
                  <p className="text-[10px] text-compeek-text-dim font-mono mt-0.5 break-all bg-compeek-bg/70 rounded px-1.5 py-0.5 leading-relaxed">
                    {event.data.params.command}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-compeek-text-dim shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(event.timestamp)}
              </span>
            </div>
          );
        }

        if (event.type === 'status') {
          return (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-compeek-bg/30 animate-slide-in group">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0 text-compeek-accent/60">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" />
              </svg>
              <div className="flex-1 min-w-0 text-compeek-text-dim">
                <StatusMessage message={event.data.message} />
              </div>
              <span className="text-[10px] text-compeek-text-dim shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(event.timestamp)}
              </span>
            </div>
          );
        }

        if (event.type === 'screenshot') {
          return (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-1 text-xs text-compeek-text-dim animate-slide-in group">
              <ActionIcon action="screenshot" />
              <p className="flex-1">Screenshot captured</p>
              <span className="text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{formatTime(event.timestamp)}</span>
            </div>
          );
        }

        if (event.type === 'error') {
          return (
            <div key={i} className="mx-1 my-1 p-2.5 rounded-lg bg-compeek-error/10 border border-compeek-error/30 animate-slide-in">
              <div className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0 text-compeek-error">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-compeek-error break-words leading-relaxed">
                    {event.data.message}
                  </p>
                </div>
                <span className="text-[10px] text-compeek-text-dim shrink-0">{formatTime(event.timestamp)}</span>
              </div>
            </div>
          );
        }

        return null;
      })}

      {completionEvent && (
        <div className={`mx-1 my-2 p-3 rounded-lg text-xs animate-scale-in ${
          completionEvent.data.success
            ? 'bg-compeek-success/10 border border-compeek-success/30 text-compeek-success'
            : 'bg-compeek-error/10 border border-compeek-error/30 text-compeek-error'
        }`}>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="text-lg font-bold">
              {completionEvent.data.success ? '\u2713' : '\u2717'}
            </span>
            <span className="text-sm font-semibold">
              {completionEvent.data.success ? 'Workflow completed' : 'Workflow failed'}
            </span>
          </div>
          <p className="opacity-80 leading-relaxed text-center">{completionEvent.data.message}</p>
          <p className="mt-1.5 opacity-60 text-center font-medium">
            {completionEvent.data.totalActions} actions performed
          </p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
