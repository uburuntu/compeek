import { useRef, useEffect, useState, useCallback } from 'react';
import emptyDesktopImg from '../assets/empty-desktop.png';
import Tooltip from './Tooltip';

interface Props {
  screenshot: string | null;
  action: any;
  isRunning: boolean;
  vncUrl?: string;
  sessionType?: 'compeek' | 'vnc-only';
}

export default function DesktopViewer({ screenshot, action, isRunning, vncUrl, sessionType }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [useVnc, setUseVnc] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const resolvedVncUrl = vncUrl || `http://${window.location.hostname}:6080/compeek-vnc.html?autoconnect=true&show_dot=true`;
  const isVncOnly = sessionType === 'vnc-only';

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Draw agent overlay on canvas
  useEffect(() => {
    if (!canvasRef.current || !action || !overlayVisible) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / 1280;
    const scaleY = canvas.height / 720;

    // Draw action indicator
    if (action.params?.coordinate) {
      const [x, y] = action.params.coordinate;
      const sx = x * scaleX;
      const sy = y * scaleY;

      // Pulsing circle at click target
      ctx.beginPath();
      ctx.arc(sx, sy, 20, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crosshair
      ctx.beginPath();
      ctx.moveTo(sx - 8, sy);
      ctx.lineTo(sx + 8, sy);
      ctx.moveTo(sx, sy - 8);
      ctx.lineTo(sx, sy + 8);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Action label
      const label = action.description || action.action;
      ctx.font = '12px "Inter", sans-serif';
      const metrics = ctx.measureText(label);
      const labelX = Math.min(sx + 24, canvas.width - metrics.width - 16);
      const labelY = Math.max(sy - 10, 24);

      // Label background
      ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
      ctx.beginPath();
      ctx.roundRect(labelX - 6, labelY - 14, metrics.width + 12, 22, 4);
      ctx.fill();

      // Label border
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label text
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(label, labelX, labelY);
    }

    // Draw zoom region
    if (action.params?.region) {
      const [x1, y1, x2, y2] = action.params.region;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
      ctx.setLineDash([]);

      // Zoom label
      ctx.font = '11px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
      ctx.fillText('ZOOM', x1 * scaleX + 4, y1 * scaleY - 6);
    }

    // Auto-clear overlay after 3 seconds
    const timer = setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 3000);

    return () => clearTimeout(timer);
  }, [action, overlayVisible]);

  // Resize canvas to match container
  useEffect(() => {
    const resize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="flex-1 flex flex-col relative" ref={containerRef}>
      {/* Toolbar */}
      <div className="h-9 flex items-center px-3 gap-2 border-b border-compeek-border bg-compeek-surface shrink-0">
        <span className="text-xs text-compeek-text-dim">Desktop View</span>
        <div className="ml-auto flex items-center gap-1">
          {!isVncOnly && (
            <>
              <Tooltip content="Show or hide the AI's click targets on the desktop">
                <button
                  onClick={() => setOverlayVisible(!overlayVisible)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    overlayVisible ? 'bg-compeek-accent/20 text-compeek-accent' : 'text-compeek-text-dim hover:text-compeek-text'
                  }`}
                >
                  Overlay {overlayVisible ? 'ON' : 'OFF'}
                </button>
              </Tooltip>
              <Tooltip content="Switch between live desktop view and screenshot snapshots">
                <button
                  onClick={() => setUseVnc(!useVnc)}
                  className="text-xs text-compeek-text-dim hover:text-compeek-text px-2 py-1 rounded"
                >
                  {useVnc ? 'VNC' : 'Screenshots'}
                </button>
              </Tooltip>
            </>
          )}
          <span className="w-px h-4 bg-compeek-border mx-0.5" />
          <Tooltip content={isFullscreen ? 'Exit fullscreen' : 'View desktop in fullscreen'}>
            <button
              onClick={toggleFullscreen}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                isFullscreen ? 'bg-compeek-accent/20 text-compeek-accent' : 'text-compeek-text-dim hover:text-compeek-text'
              }`}
            >
              {isFullscreen ? 'Exit FS' : 'Fullscreen'}
            </button>
          </Tooltip>
          <Tooltip content="Open the remote desktop in a new browser tab">
            <button
              onClick={() => window.open(resolvedVncUrl, '_blank')}
              className="text-xs text-compeek-text-dim hover:text-compeek-text px-2 py-1 rounded transition-colors"
            >
              New Tab ↗
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Desktop display */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {isVncOnly || useVnc ? (
          <iframe
            src={resolvedVncUrl}
            className="w-full h-full border-0"
            title="Desktop VNC"
          />
        ) : screenshot ? (
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Desktop screenshot"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-compeek-text-dim">
            <div className="text-center">
              <img src={emptyDesktopImg} alt="" className="w-40 h-40 mx-auto mb-4 opacity-40" />
              <p className="text-sm">Waiting for agent activity...</p>
              <p className="text-xs mt-1 opacity-50">Start a workflow to see the agent in action</p>
            </div>
          </div>
        )}

        {/* Agent overlay canvas */}
        {!isVncOnly && overlayVisible && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
          />
        )}

        {/* Running indicator */}
        {!isVncOnly && isRunning && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5 pulse-glow" style={{ zIndex: 20 }}>
            <div className="w-2 h-2 rounded-full bg-compeek-accent animate-pulse" />
            <span className="text-xs font-medium text-compeek-accent">Agent working...</span>
          </div>
        )}
      </div>
    </div>
  );
}
