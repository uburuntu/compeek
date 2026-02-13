import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (config: { name: string; type: 'compeek' | 'vnc-only'; apiHost: string; apiPort: number; vncHost: string; vncPort: number }) => void;
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

  const parseConnectionString = (input: string) => {
    setConnectionError('');
    try {
      // Extract base64 from URL or raw string
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
        setConnectionString('');
        return;
      }
      setConnectionError('Invalid config: missing required fields');
    } catch {
      setConnectionError('Invalid connection string');
    }
  };

  if (!open) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`http://${host}:${apiPort}/api/health`, { signal: AbortSignal.timeout(5000) });
      setTestResult(res.ok ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = () => {
    const sessionName = name.trim() || (mode === 'compeek' ? `Desktop (${apiPort})` : `VNC (${host}:${vncPort})`);
    onAdd({
      name: sessionName,
      type: mode,
      apiHost: host,
      apiPort: parseInt(apiPort) || 3000,
      vncHost: host,
      vncPort: parseInt(vncPort) || 6080,
    });
    setName('');
    setApiPort('3001');
    setVncPort('6081');
    setTestResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-compeek-surface border border-compeek-border rounded-xl shadow-2xl w-[440px] max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-compeek-text mb-4">Add Session</h2>

        {/* Connection string paste box */}
        <div className="mb-4">
          <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1">Paste connection string or URL</label>
          <input
            type="text"
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
                parseConnectionString(connectionString);
              }
            }}
            placeholder="eyJuYW1lIj... or https://compeek.rmbk.me/#config=..."
            className="w-full bg-compeek-bg border border-compeek-border rounded-lg px-3 py-2 text-xs font-mono focus:border-compeek-accent outline-none"
          />
          {connectionError && (
            <p className="text-[10px] text-compeek-error mt-1">{connectionError}</p>
          )}
        </div>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-compeek-border" />
          </div>
          <div className="relative flex justify-center text-[10px]">
            <span className="bg-compeek-surface px-2 text-compeek-text-dim">or configure manually</span>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-compeek-bg rounded-lg p-0.5 mb-4">
          <button
            onClick={() => { setMode('compeek'); setVncPort('6081'); }}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
              mode === 'compeek' ? 'bg-compeek-accent text-white' : 'text-compeek-text-dim hover:text-compeek-text'
            }`}
          >
            Docker Desktop
          </button>
          <button
            onClick={() => { setMode('vnc-only'); setVncPort('6080'); }}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
              mode === 'vnc-only' ? 'bg-compeek-accent text-white' : 'text-compeek-text-dim hover:text-compeek-text'
            }`}
          >
            Remote VNC
          </button>
        </div>

        {/* Quick setup hint */}
        <div className="bg-compeek-bg rounded-lg p-3 mb-4 text-[10px] text-compeek-text-dim">
          {mode === 'compeek' ? (
            <>
              <p className="font-medium text-compeek-text text-xs mb-1">Quick setup</p>
              <code className="block bg-compeek-surface border border-compeek-border rounded px-2 py-1.5 font-mono select-all leading-relaxed whitespace-pre-wrap mb-1.5">
                docker run -d \{'\n'}  -p 3001:3000 -p 6081:6080 \{'\n'}  --shm-size=512m \{'\n'}  ghcr.io/uburuntu/compeek
              </code>
              <p>No API key needed — the container is just a desktop. Check container logs for localtunnel URLs.</p>
            </>
          ) : (
            <>
              <p className="font-medium text-compeek-text text-xs mb-1">How to connect</p>
              <p className="mb-1">If your Linux has a VNC server (e.g. x11vnc on :5900), bridge it with websockify:</p>
              <code className="block bg-compeek-surface border border-compeek-border rounded px-2 py-1.5 font-mono select-all mb-1.5">
                websockify 6080 localhost:5900
              </code>
              <p>Or use any noVNC endpoint directly.</p>
            </>
          )}
        </div>

        <div className="space-y-3">
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
            <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1">Host</label>
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
                <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1">API Port</label>
                <input
                  type="text"
                  value={apiPort}
                  onChange={e => setApiPort(e.target.value)}
                  placeholder="3001"
                  className="w-full bg-compeek-bg border border-compeek-border rounded-lg px-3 py-2 text-sm focus:border-compeek-accent outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1">noVNC Port</label>
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
              <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1">noVNC Port</label>
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
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-medium rounded-lg bg-compeek-bg border border-compeek-border text-compeek-text-dim hover:text-compeek-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 text-xs font-medium rounded-lg bg-compeek-accent text-white hover:bg-compeek-accent-bright transition-colors"
          >
            Add Session
          </button>
        </div>
      </div>
    </div>
  );
}
