import logoImg from '../assets/logo.png';

interface Props {
  onAddSession: () => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export default function WelcomeGuide({ onAddSession, onOpenSettings, hasApiKey }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center bg-compeek-bg overflow-y-auto">
      <div className="max-w-lg w-full px-6 py-10">
        <div className="text-center mb-8">
          <img src={logoImg} alt="compeek" className="w-14 h-14 mx-auto mb-3 rounded-xl" />
          <h1 className="text-lg font-semibold text-compeek-text">Welcome to compeek</h1>
          <p className="text-xs text-compeek-text-dim mt-1">Connect to Linux desktops and let the AI agent work</p>
        </div>

        {/* Quick start steps */}
        <div className="space-y-3 mb-6">
          <Step n={1} title="Set your API key" done={hasApiKey}>
            <p className="text-[10px] text-compeek-text-dim">
              Your Anthropic API key stays in the browser — it calls the API directly.{' '}
              <button onClick={onOpenSettings} className="text-compeek-accent hover:underline">Open Settings</button>
            </p>
          </Step>

          <Step n={2} title="Start a desktop container" done={false}>
            <code className="block bg-compeek-bg border border-compeek-border rounded-lg p-2.5 text-[11px] font-mono text-compeek-text leading-relaxed select-all whitespace-pre-wrap">docker run -d --name compeek \{'\n'}  -p 3001:3000 -p 6081:6080 \{'\n'}  --shm-size=512m \{'\n'}  ghcr.io/uburuntu/compeek</code>
            <p className="text-[10px] text-compeek-text-dim mt-1.5">
              No API key needed in Docker — the container is just a desktop + tool server.
              Use <code>docker compose up</code> for 3 instances.
            </p>
          </Step>

          <Step n={3} title="Add a session" done={false}>
            <p className="text-[10px] text-compeek-text-dim mb-2">
              Click <strong>+</strong> in the tab bar. The container prints its Tool API and noVNC URLs on startup — use those.
            </p>
            <button
              onClick={onAddSession}
              className="w-full py-2 text-xs font-medium rounded-lg bg-compeek-accent text-white hover:bg-compeek-accent-bright transition-colors"
            >
              Add Session
            </button>
          </Step>
        </div>

        {/* Architecture note */}
        <div className="bg-compeek-surface border border-compeek-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-compeek-text mb-2">How it works</h3>
          <div className="space-y-2 text-[10px] text-compeek-text-dim">
            <p>
              <strong className="text-compeek-text">Browser-native agent</strong> — the AI loop runs in your browser. It calls the Anthropic API directly and sends mouse/keyboard commands to the container via HTTP.
            </p>
            <p>
              <strong className="text-compeek-text">Container = desktop only</strong> — each Docker container runs a virtual X11 desktop (Xvfb + Mutter + Firefox) and a lightweight tool server for executing actions.
            </p>
            <p>
              <strong className="text-compeek-text">Public access</strong> — containers auto-start <code>localtunnel</code> and print public URLs on boot. Use those URLs to connect from anywhere.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
        done ? 'bg-compeek-success/20 text-compeek-success' : 'bg-compeek-border text-compeek-text-dim'
      }`}>
        {done ? '\u2713' : n}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-xs font-medium mb-1 ${done ? 'text-compeek-success' : 'text-compeek-text'}`}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
