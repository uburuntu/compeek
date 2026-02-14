import logoImg from '../assets/logo.png';

interface Props {
  onAddSession: () => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
  hasConnectedSession: boolean;
}

export default function WelcomeGuide({ onAddSession, onOpenSettings, hasApiKey, hasConnectedSession }: Props) {
  return (
    <div className="flex-1 flex overflow-y-auto bg-compeek-bg relative">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-[40%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-compeek-accent rounded-full blur-[160px] animate-hero-glow" />
      </div>

      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className="max-w-6xl w-full px-12 py-16 flex gap-20 items-center">

          {/* Left: Hero */}
          <div className="flex-1 min-w-0">
            <div className="animate-step-in" style={{ animationDelay: '0ms' }}>
              <img src={logoImg} alt="compeek" className="w-20 h-20 mb-8 rounded-2xl" />
            </div>
            <h1
              className="text-6xl font-bold text-compeek-text tracking-tight leading-[1.1] mb-6 animate-step-in"
              style={{ animationDelay: '50ms' }}
            >
              AI eyes & hands<br />
              <span className="text-compeek-accent">for any desktop</span>
            </h1>
            <p
              className="text-xl text-compeek-text-dim leading-relaxed mb-10 max-w-lg animate-step-in"
              style={{ animationDelay: '100ms' }}
            >
              Tell the AI what to do in plain language. It sees any application through screenshots, clicks, types, and validates its own work.
            </p>

            {/* Feature pills */}
            <div
              className="flex flex-wrap gap-2.5 mb-10 animate-step-in"
              style={{ animationDelay: '150ms' }}
            >
              {[
                { label: 'See', desc: 'Screenshots & zoom' },
                { label: 'Think', desc: 'Step-by-step reasoning' },
                { label: 'Act', desc: 'Mouse & keyboard' },
                { label: 'Read', desc: 'Documents & IDs' },
                { label: 'Validate', desc: 'Self-checking' },
              ].map(f => (
                <div key={f.label} className="px-4 py-2 rounded-full bg-compeek-surface border border-compeek-border text-sm">
                  <span className="text-compeek-text font-semibold">{f.label}</span>
                  <span className="text-compeek-text-dim ml-2">{f.desc}</span>
                </div>
              ))}
            </div>

            {/* Architecture summary */}
            <div
              className="text-base text-compeek-text-dim leading-relaxed max-w-lg animate-step-in"
              style={{ animationDelay: '200ms' }}
            >
              <p>
                The AI runs <strong className="text-compeek-text font-semibold">in your browser</strong>.
                Each container is just a virtual Linux desktop — no AI inside, no data leaves your machine.
              </p>
            </div>
          </div>

          {/* Right: Get Started card */}
          <div
            className="w-[400px] shrink-0 animate-step-in"
            style={{ animationDelay: '150ms' }}
          >
            <div className="bg-compeek-surface border border-compeek-border rounded-2xl p-8 shadow-2xl shadow-compeek-accent/[0.03]">
              <h2 className="text-2xl font-bold text-compeek-text mb-6">Get started</h2>

              <div className="space-y-6">
                {/* Step 1: API Key */}
                <Step n={1} title="Add your AI key" done={hasApiKey}>
                  <p className="text-base text-compeek-text-dim leading-relaxed">
                    Get yours at{' '}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-compeek-accent hover:underline font-medium"
                    >
                      console.anthropic.com
                    </a>
                  </p>
                  {!hasApiKey && (
                    <button
                      onClick={onOpenSettings}
                      className="mt-3 px-5 py-2.5 text-sm font-semibold rounded-lg bg-compeek-accent/15 text-compeek-accent border border-compeek-accent/30 hover:bg-compeek-accent/25 transition-colors"
                    >
                      Open Settings
                    </button>
                  )}
                </Step>

                <div className="border-t border-compeek-border" />

                {/* Step 2: Start & connect a virtual desktop */}
                <Step n={2} title="Connect a virtual desktop" done={hasConnectedSession}>
                  <p className="text-base text-compeek-text-dim leading-relaxed mb-3">
                    Start a desktop and connect to it — we'll walk you through it.
                  </p>
                  <button
                    onClick={onAddSession}
                    className="w-full py-3 text-base font-semibold rounded-lg bg-compeek-accent text-white hover:bg-compeek-accent-bright transition-colors"
                  >
                    Connect Desktop
                  </button>
                </Step>
              </div>
            </div>

            {/* Privacy note */}
            <p className="text-sm text-compeek-text-dim/50 mt-4 text-center leading-relaxed">
              Your API key stays in this browser. Nothing is sent to us.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 transition-colors ${
        done ? 'bg-compeek-success/20 text-compeek-success' : 'bg-compeek-accent/15 text-compeek-accent'
      }`}>
        {done ? '\u2713' : n}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-base font-semibold mb-1.5 transition-colors ${done ? 'text-compeek-success' : 'text-compeek-text'}`}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
