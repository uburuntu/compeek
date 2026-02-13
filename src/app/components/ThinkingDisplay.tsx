import { useEffect, useRef } from 'react';
import emptyThinkingImg from '../assets/empty-thinking.png';

interface Props {
  events: any[];
}

export default function ThinkingDisplay({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-compeek-text-dim">
        <div className="text-center text-xs">
          <img src={emptyThinkingImg} alt="" className="w-32 h-32 mx-auto mb-3 opacity-40" />
          <p>No thinking yet</p>
          <p className="mt-1 opacity-50">Extended thinking from Opus 4.6 will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {events.map((event, i) => (
        <div
          key={i}
          className="p-2 bg-compeek-bg rounded-lg border border-compeek-border/50 animate-slide-in"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-compeek-accent" />
            <span className="text-[10px] text-compeek-text-dim font-medium">THINKING</span>
            <span className="text-[10px] text-compeek-text-dim ml-auto">
              {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-compeek-text leading-relaxed whitespace-pre-wrap font-mono">
            {event.data.content}
          </p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
