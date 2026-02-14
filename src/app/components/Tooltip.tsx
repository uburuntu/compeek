import { useState, useRef, useCallback, useLayoutEffect, type ReactNode, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  maxWidth?: number;
}

function computeCoords(rect: DOMRect, position: 'top' | 'bottom' | 'left' | 'right') {
  const gap = 8;
  let top = 0;
  let left = 0;

  switch (position) {
    case 'top':
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
      break;
    case 'bottom':
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
      break;
    case 'right':
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
      break;
  }

  // Clamp to viewport
  left = Math.max(8, Math.min(left, window.innerWidth - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - 8));

  return { top, left };
}

export default function Tooltip({ content, children, position = 'top', delay = 300, maxWidth = 240 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Recompute position on every render while visible (handles scroll/resize)
  useLayoutEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords(computeCoords(rect, position));
    }
  }, [visible, position]);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setCoords(null);
  }, []);

  const transformOrigin = {
    top: 'bottom center',
    bottom: 'top center',
    left: 'center right',
    right: 'center left',
  }[position];

  const translate = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  }[position];

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>
      {visible && coords && createPortal(
        <div
          className="animate-tooltip-in pointer-events-none"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: translate,
            transformOrigin,
            zIndex: 9999,
            maxWidth,
          }}
        >
          <div className="bg-compeek-bg border border-compeek-border rounded-lg shadow-xl text-xs text-compeek-text px-3 py-2 leading-relaxed">
            {content}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
