import { useState } from 'react';
import type { Settings } from '../hooks/useSettings';
import Tooltip from './Tooltip';

interface Props {
  open: boolean;
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export default function SettingsDialog({ open, settings, onUpdate, onClose }: Props) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    onUpdate({ apiKey: apiKey.trim() });
    onClose();
  };

  const masked = apiKey ? apiKey.slice(0, 10) + '...' + apiKey.slice(-4) : '';
  const looksInvalid = apiKey.trim() && !apiKey.trim().startsWith('sk-ant-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in" onClick={onClose}>
      <div className="bg-compeek-surface border border-compeek-border rounded-xl shadow-2xl w-[420px] p-5 animate-dialog-in" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-compeek-text mb-4">Settings</h2>

        <div className="space-y-4">
          {/* API Key */}
          <div>
            <Tooltip content="Get your key at console.anthropic.com. It never leaves your browser.">
              <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1 cursor-help">
                Anthropic API Key
              </label>
            </Tooltip>

            {/* Get key link */}
            {!apiKey && (
              <div className="bg-compeek-accent/10 border border-compeek-accent/20 rounded-lg px-3 py-2 mb-2">
                <p className="text-xs text-compeek-accent">
                  Don't have a key?{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-compeek-accent-bright">
                    Get yours at console.anthropic.com
                  </a>
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 bg-compeek-bg border border-compeek-border rounded-lg px-3 py-2 text-sm font-mono focus:border-compeek-accent outline-none"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="px-2 text-xs text-compeek-text-dim hover:text-compeek-text rounded border border-compeek-border"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[10px] text-compeek-text-dim mt-1.5">
              Stored in your browser. Never sent to us — only to the AI when running tasks.
            </p>
            {apiKey && !showKey && (
              <p className="text-[10px] text-compeek-text-dim mt-1 font-mono">{masked}</p>
            )}
            {looksInvalid && (
              <p className="text-[10px] text-compeek-warning mt-1">
                This doesn't look like an Anthropic key (usually starts with sk-ant-). Double-check you copied the full key.
              </p>
            )}
          </div>

          {/* Model preference */}
          <div>
            <label className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider block mb-1.5">
              Default Model
            </label>
            <div className="flex gap-1 bg-compeek-bg rounded-lg p-0.5">
              {[
                { id: 'claude-haiku-4-5', label: 'Haiku 4.5', tip: 'Fastest and cheapest. Good for simple, quick tasks.' },
                { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5', tip: 'Best balance of speed and quality. Recommended for most tasks.' },
                { id: 'claude-opus-4-6', label: 'Opus 4.6', tip: 'Most powerful. Best for complex multi-step workflows.' },
              ].map(m => (
                <Tooltip key={m.id} content={m.tip}>
                  <button
                    onClick={() => onUpdate({ lastModel: m.id })}
                    className={`flex-1 text-xs py-1 rounded-md transition-colors font-medium ${
                      settings.lastModel === m.id
                        ? 'bg-compeek-accent/20 text-compeek-accent border border-compeek-accent/40'
                        : 'text-compeek-text-dim hover:text-compeek-text border border-transparent'
                    }`}
                  >
                    {m.label}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Storage info */}
          <div className="bg-compeek-bg rounded-lg p-3 text-[10px] text-compeek-text-dim space-y-1">
            <p className="font-medium text-compeek-text text-xs mb-1">What is stored locally</p>
            <p>API key, sessions, model preference — all in localStorage.</p>
            <p>Nothing is sent to GitHub Pages. Keys go only to your compeek backends.</p>
          </div>
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
            onClick={handleSave}
            className="flex-1 py-2 text-xs font-medium rounded-lg bg-compeek-accent text-white hover:bg-compeek-accent-bright transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
