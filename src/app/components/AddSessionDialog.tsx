import { useState, useRef } from 'react';
import Tooltip from './Tooltip';
import CopyButton from './CopyButton';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (config: { name: string; type: 'compeek' | 'vnc-only'; apiHost: string; apiPort: number; vncHost: string; vncPort: number; vncPassword?: string }) => void;
}

export default function AddSessionDialog({ open, onClose, onAdd }: Props) {
  const [mode, setMode] = useState<'compeek' | 'vnc-only'>('compeek');
  const [name, setName] = useState('');
  const [host, setHost] = useState(window.location.hostname || 'localhost');
  const [apiPort, setApiPort] = useState('3001');
  const [vncPort, setVncPort] = useState('6081');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [connectionString, setConnectionString] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showDocker, setShowDocker] = useState(false);
  const [vncPassword, setVncPassword] = useState('');
  const testHostRef = useRef('');
  const testPortRef = useRef('');

  const doTest = async (h: string, p: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`http://${h}:${p}/api/health`, { signal: AbortSignal.timeout(5000) });
      setTestResult(res.ok ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  const parseConnectionString = (input: string) => {
    setConnectionError('');
    setPasteSuccess(false);
    try {
      let b64 = input.trim();
      const hashIdx = b64.indexOf('#config=');
      if (hashIdx !== -1) {
        b64 = b64.slice(hashIdx + '#config='.length);
      }
      const json = JSON.parse(atob(b64));
      if (json.name && json.apiHost && json.apiPort && json.vncHost && json.vncPort) {
        setName(json.name);
        setHost(json.apiHost);
        setApiPort(String(json.apiPort));
        setVncPort(String(json.vncPort));
        setMode(json.type === 'vnc-only' ? 'vnc-only' : 'compeek');
        setVncPassword(json.vncPassword || '');
        setConnectionString('');
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 3000);
        // Auto-test connection
        if (json.type !== 'vnc-only') {
          testHostRef.current = json.apiHost;
          testPortRef.current = String(json.apiPort);
          doTest(json.apiHost, String(json.apiPort));
        }
        return;
      }
      setConnectionError('Missing required fields in config');
    } catch {
      setConnectionError('Invalid connection code — check that you copied the full string');
    }
  };

  if (!open) return null;

  const handleTest = () => doTest(host, apiPort);

  const handleSubmit = () => {
    const sessionName = name.trim() || (mode === 'compeek' ? `Desktop (${apiPort})` : `VNC (${host}:${vncPort})`);
    onAdd({
      name: sessionName,
      type: mode,
      apiHost: host,
      apiPort: parseInt(apiPort) || 3000,
      vncHost: host,
      vncPort: parseInt(vncPort) || 6080,
      ...(vncPassword ? { vncPassword } : {}),
    });
    setName('');
    setApiPort('3001');
    setVncPort('6081');
    setTestResult(null);
    setPasteSuccess(false);
    setShowManual(false);
    setShowDocker(false);
    setVncPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in" onClick={onClose}>
      <div className="bg-compeek-surface border border-compeek-border rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto p-6 animate-dialog-in" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-compeek-text mb-5">Connect a Desktop</h2>

        {/* Step 1: Start a desktop */}
        <div className="mb-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-6 h-6 rounded-full bg-compeek-accent/15 text-compeek-accent flex items-center justify-center text-xs font-bold shrink-0">1</div>
            <h3 className="text-sm font-semibold text-compeek-text">Start a virtual desktop</h3>
          </div>
          <div className="ml-[2.125rem]">
            <p className="text-sm text-compeek-text-dim leading-relaxed mb-2.5">
              Run this in your terminal to start a virtual Linux desktop:
            </p>
            <div className="flex items-center gap-2 bg-compeek-bg border border-compeek-border rounded-lg px-3.5 py-2.5 font-mono">
              <code className="flex-1 text-sm select-all text-compeek-text">npx @rmbk/compeek start</code>
              <CopyButton text="npx @rmbk/compeek start" />
            </div>
            <p className="text-xs text-compeek-text-dim/70 mt-2 leading-relaxed">
              It downloads a virtual desktop, starts it, and prints a connection code.
            </p>

            <button
              onClick={() => setShowDocker(!showDocker)}
              className="text-xs text-compeek-text-dim/60 hover:text-compeek-text-dim mt-2 transition-colors"
            >
              {showDocker ? '\u25BE' : '\u25B8'} Using Docker directly?
            </button>
            {showDocker && (
              <div className="mt-2">
                <div className="flex items-start gap-2 bg-compeek-bg border border-compeek-border rounded-lg px-3.5 py-2.5 font-mono">
                  <code className="flex-1 text-xs select-all leading-relaxed whitespace-pre-wrap text-compeek-text-dim">docker run -d \{'\n'}  -p 3001:3000 -p 6081:6080 \{'\n'}  --shm-size=512m \{'\n'}  ghcr.io/uburuntu/compeek</code>
                  <CopyButton text="docker run -d -p 3001:3000 -p 6081:6080 --shm-size=512m ghcr.io/uburuntu/compeek" className="shrink-0 mt-0.5" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-compeek-border mb-5" />

        {/* Step 2: Connect */}
        <div className="mb-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
              pasteSuccess ? 'bg-compeek-success/20 text-compeek-success' : 'bg-compeek-accent/15 text-compeek-accent'
            }`}>{pasteSuccess ? '\u2713' : '2'}</div>
            <h3 className="text-sm font-semibold text-compeek-text">Paste the connection code</h3>
          </div>
          <div className="ml-[2.125rem]">
            <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
              pasteSuccess
                ? 'border-compeek-success/50 bg-compeek-success/5'
                : 'border-compeek-border hover:border-compeek-accent/40 focus-within:border-compeek-accent'
            }`}>
              {pasteSuccess ? (
                <div className="flex items-center justify-center gap-2 py-1">
                  <span className="text-compeek-success text-lg">&#10003;</span>
                  <span className="text-sm text-compeek-success font-medium">Connected! Session: {name}</span>
                </div>
              ) : (
                <>
                  <textarea
                    value={connectionString}
                    onChange={e => setConnectionString(e.target.value)}
                    onPaste={e => {
                      const text = e.clipboardData.getData('text');
                      if (text) {
                        e.preventDefault();
                        setConnectionString(text);
                        parseConnectionString(text);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && connectionString.trim()) {
                        e.preventDefault();
                        parseConnectionString(connectionString);
                      }
                    }}
                    placeholder="Paste your connection code here..."
                    rows={2}
                    className="w-full bg-transparent text-center text-sm font-mono resize-none outline-none text-compeek-text placeholder:text-compeek-text-dim/60"
                  />
                  <p className="text-xs text-compeek-text-dim/50 mt-1">
                    Looks like <code className="text-compeek-text-dim/70">eyJuYW1lIj...</code> or a dashboard URL
                  </p>
                </>
              )}
            </div>
            {connectionError && (
              <p className="text-xs text-compeek-error mt-1.5">{connectionError}</p>
            )}
          </div>
        </div>

        {/* Manual configuration — collapsed by default */}
        <div className="mb-5">
          <button
            onClick={() => setShowManual(!showManual)}
            className="w-full flex items-center gap-2 text-xs text-compeek-text-dim/60 hover:text-compeek-text-dim transition-colors py-1"
          >
            <div className="flex-1 border-t border-compeek-border/50" />
            <span>{showManual ? '\u25BE' : '\u25B8'} Configure manually</span>
            <div className="flex-1 border-t border-compeek-border/50" />
          </button>

          {showManual && (
            <div className="mt-4 space-y-3 animate-slide-in">
              {/* Mode toggle */}
              <div className="flex gap-1 bg-compeek-bg rounded-lg p-0.5">
                <Tooltip content="Full AI agent control with a virtual desktop">
                  <button
                    onClick={() => { setMode('compeek'); setVncPort('6081'); }}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
                      mode === 'compeek' ? 'bg-compeek-accent text-white' : 'text-compeek-text-dim hover:text-compeek-text'
                    }`}
                  >
                    compeek Container
                  </button>
                </Tooltip>
                <Tooltip content="View a remote desktop without AI control">
                  <button
                    onClick={() => { setMode('vnc-only'); setVncPort('6080'); }}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
                      mode === 'vnc-only' ? 'bg-compeek-accent text-white' : 'text-compeek-text-dim hover:text-compeek-text'
                    }`}
                  >
                    Watch-only (VNC)
                  </button>
                </Tooltip>
              </div>

              {/* VNC-only help */}
              {mode === 'vnc-only' && (
                <div className="bg-compeek-bg rounded-lg p-3 text-xs text-compeek-text-dim">
                  <p className="font-medium text-compeek-text mb-1">How to connect</p>
                  <p className="mb-1.5">If your Linux has a VNC server (e.g. x11vnc on :5900), bridge it with websockify:</p>
                  <div className="flex items-center gap-2 bg-compeek-surface border border-compeek-border rounded px-2.5 py-2 font-mono">
                    <code className="flex-1 select-all">websockify 6080 localhost:5900</code>
                    <CopyButton text="websockify 6080 localhost:5900" />
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={mode === 'compeek' ? 'Desktop 2' : 'Remote Server'}
                  className="w-full bg-compeek-bg border border-compeek-border rounded-lg px-3 py-2 text-sm focus:border-compeek-accent outline-none"
                />
              </div>

              {/* Host */}
              <div>
                <Tooltip content="The IP address or web address where your virtual desktop is running">
                  <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1 cursor-help">
                    Desktop address
                  </label>
                </Tooltip>
                <input
                  type="text"
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full bg-compeek-bg border border-compeek-border rounded-lg px-3 py-2 text-sm focus:border-compeek-accent outline-none"
                />
              </div>

              {mode === 'compeek' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Tooltip content="The port compeek uses to send commands to the desktop (you usually don't need to change this)">
                      <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1 cursor-help">
                        Control port
                      </label>
                    </Tooltip>
                    <input
                      type="text"
                      value={apiPort}
                      onChange={e => setApiPort(e.target.value)}
                      placeholder="3001"
                      className="w-full bg-compeek-bg border border-compeek-border rounded-lg px-3 py-2 text-sm focus:border-compeek-accent outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <Tooltip content="The port for watching the live desktop in your browser (you usually don't need to change this)">
                      <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1 cursor-help">
                        View port
                      </label>
                    </Tooltip>
                    <input
                      type="text"
                      value={vncPort}
                      onChange={e => setVncPort(e.target.value)}
                      placeholder="6081"
                      className="w-full bg-compeek-bg border border-compeek-border rounded-lg px-3 py-2 text-sm focus:border-compeek-accent outline-none"
                    />
                  </div>
                </div>
              )}

              {mode === 'vnc-only' && (
                <div>
                  <Tooltip content="The port for watching the live desktop in your browser">
                    <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1 cursor-help">
                      View port
                    </label>
                  </Tooltip>
                  <input
                    type="text"
                    value={vncPort}
                    onChange={e => setVncPort(e.target.value)}
                    placeholder="6080"
                    className="w-full bg-compeek-bg border border-compeek-border rounded-lg px-3 py-2 text-sm focus:border-compeek-accent outline-none"
                  />
                </div>
              )}

              {/* Test connection (compeek mode only) */}
              {mode === 'compeek' && (
                <Tooltip content="Check if the desktop container is reachable">
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className={`w-full py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                      testResult === 'ok'
                        ? 'bg-compeek-success/10 border-compeek-success/30 text-compeek-success'
                        : testResult === 'fail'
                          ? 'bg-compeek-error/10 border-compeek-error/30 text-compeek-error'
                          : 'bg-compeek-bg border-compeek-border text-compeek-text-dim hover:text-compeek-text hover:border-compeek-accent/50'
                    }`}
                  >
                    {testing ? 'Testing...' : testResult === 'ok' ? 'Connected' : testResult === 'fail' ? 'Connection failed — retry?' : 'Test Connection'}
                  </button>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-compeek-bg border border-compeek-border text-compeek-text-dim hover:text-compeek-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-compeek-accent text-white hover:bg-compeek-accent-bright transition-colors"
          >
            Add Session
          </button>
        </div>
      </div>
    </div>
  );
}
