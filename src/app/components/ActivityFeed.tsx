import { useEffect, useRef, useState } from 'react';
import emptyActivityImg from '../assets/empty-activity.png';

interface Props {
  events: any[];
  completionEvent?: any;
}

function getActionIcon(action: string): string {
  switch (action) {
    case 'left_click': case 'right_click': case 'double_click': return '\u{1F5B1}';
    case 'type': return '\u{2328}';
    case 'key': return '\u{2328}';
    case 'scroll': return '\u{2195}';
    case 'screenshot': return '\u{1F4F7}';
    case 'zoom': return '\u{1F50D}';
    case 'mouse_move': return '\u{27A1}';
    default: return '\u{26A1}';
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case 'left_click': case 'right_click': case 'double_click': return 'text-blue-400';
    case 'type': return 'text-green-400';
    case 'key': return 'text-yellow-400';
    case 'scroll': return 'text-purple-400';
    case 'screenshot': return 'text-cyan-400';
    case 'zoom': return 'text-orange-400';
    case 'mouse_move': return 'text-indigo-400';
    default: return 'text-compeek-text-dim';
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
    <div className="p-2 space-y-0.5">
      {events.map((event, i) => {
        if (event.type === 'action') {
          return (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-compeek-bg/50 animate-slide-in group">
              <span className={`text-sm shrink-0 mt-0.5 ${getActionColor(event.data.action)}`}>
                {getActionIcon(event.data.action)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-compeek-text">
                  {event.data.description || event.data.action}
                </p>
                {event.data.params?.text && event.data.action === 'type' && (
                  <p className="text-[10px] text-compeek-text-dim font-mono mt-0.5 break-all bg-compeek-bg/70 rounded px-1.5 py-0.5 leading-relaxed">
                    "{event.data.params.text}"
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
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-compeek-bg/30 animate-slide-in group">
              <span className="text-[10px] text-compeek-accent shrink-0 mt-1">&#9670;</span>
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
            <div key={i} className="flex items-center gap-2 p-1.5 text-xs text-compeek-text-dim animate-slide-in">
              <span className="text-sm text-cyan-400">&#128247;</span>
              <p>Screenshot captured</p>
              <span className="text-[10px] ml-auto shrink-0">{formatTime(event.timestamp)}</span>
            </div>
          );
        }

        if (event.type === 'error') {
          return (
            <div key={i} className="p-2.5 rounded-lg bg-compeek-error/10 border border-compeek-error/30 animate-slide-in">
              <div className="flex items-start gap-2">
                <span className="text-sm shrink-0">&#9888;</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-compeek-error">Error</p>
                  <p className="text-xs text-compeek-error/80 mt-0.5 break-words leading-relaxed">
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
        <div className={`p-4 rounded-lg mt-2 text-xs animate-scale-in ${
          completionEvent.data.success
            ? 'bg-compeek-success/10 border border-compeek-success/30 text-compeek-success'
            : 'bg-compeek-error/10 border border-compeek-error/30 text-compeek-error'
        }`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">
              {completionEvent.data.success ? '\u2713' : '\u2717'}
            </span>
            <span className="text-sm font-semibold">
              {completionEvent.data.success ? 'Workflow completed' : 'Workflow failed'}
            </span>
          </div>
          <p className="opacity-80 leading-relaxed text-center">{completionEvent.data.message}</p>
          <p className="mt-2 opacity-60 text-center font-medium">
            {completionEvent.data.totalActions} actions performed
          </p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
