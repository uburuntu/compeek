import { useState, useCallback, useRef } from 'react';
import Tooltip from './Tooltip';

interface Attachment {
  base64: string;
  mimeType: string;
  name: string;
  preview: string;
}

interface Props {
  isRunning: boolean;
  onStart: (goal: string, model?: string, attachments?: Array<{ base64: string; mimeType: string }>, maxSteps?: number) => void;
  onStop: () => void;
  apiKey?: string;
  initialModel?: string;
}

export default function WorkflowPanel({ isRunning, onStart, onStop, apiKey, initialModel }: Props) {
  const [goal, setGoal] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [model, setModel] = useState(initialModel || 'claude-sonnet-4-5');
  const [maxSteps, setMaxSteps] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const models = [
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5', tip: 'Fastest and cheapest. Good for simple, quick tasks.' },
    { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5', tip: 'Best balance of speed and quality. Recommended for most tasks.' },
    { id: 'claude-opus-4-6', label: 'Opus 4.6', tip: 'Most powerful. Best for complex multi-step workflows.' },
  ];

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        setAttachments(prev => [...prev, {
          base64,
          mimeType: file.type,
          name: file.name,
          preview: dataUrl,
        }]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStart = () => {
    if (!goal.trim()) return;
    const atts = attachments.length > 0
      ? attachments.map(a => ({ base64: a.base64, mimeType: a.mimeType }))
      : undefined;
    onStart(goal, model, atts, maxSteps);
  };

  const presetGoals = [
    { label: 'Fill a form', goal: `Navigate to http://localhost:8080/client-onboarding/ and fill the onboarding form with the attached document data. If no document is attached, use realistic test data. Check the consent checkbox and submit.` },
    { label: 'Test a form', goal: `You are a QA tester. Test the form at http://localhost:8080/client-onboarding/ for proper validation behavior.\n\nTEST 1 — Empty submission:\n1. Navigate to http://localhost:8080/client-onboarding/ in Firefox\n2. Without filling any fields, click the "Submit Application" button\n3. Take a screenshot to capture the error states\n\nTEST 2 — Successful submission:\n1. Reload the page (Ctrl+Shift+R)\n2. Fill ALL required fields with valid data\n3. Check the consent checkbox and click Submit\n4. Take a screenshot and verify success\n\nProvide a summary of which tests passed and which failed.` },
    { label: 'Open a text editor', goal: 'Open the text editor (mousepad or gedit), create a new file, and type "Hello from compeek!"' },
    { label: 'Browse the web', goal: 'Open Firefox, navigate to example.com, and take a screenshot of the page' },
  ];

  return (
    <div className="p-3 border-b border-compeek-border space-y-3 shrink-0">
      {/* Model selector + Max steps */}
      <div className="flex items-center gap-2">
        <Tooltip content="Which AI model to use for this task">
          <span className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider cursor-help">Model</span>
        </Tooltip>
        <div className="flex gap-1 flex-1 bg-compeek-bg rounded-lg p-0.5">
          {models.map(m => (
            <Tooltip key={m.id} content={m.tip}>
              <button
                onClick={() => setModel(m.id)}
                className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                  model === m.id
                    ? 'bg-compeek-accent/20 text-compeek-accent border border-compeek-accent/40'
                    : 'text-compeek-text-dim hover:text-compeek-text border border-transparent'
                }`}
              >
                {m.label}
              </button>
            </Tooltip>
          ))}
        </div>
        <Tooltip content="Maximum number of agent steps before stopping">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={maxSteps}
              onChange={e => setMaxSteps(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
              className="w-12 bg-compeek-bg border border-compeek-border rounded-md px-1.5 py-1 text-xs text-center text-compeek-text outline-none focus:border-compeek-accent/50"
              min="1"
              max="200"
            />
            <span className="text-[10px] text-compeek-text-dim font-medium uppercase tracking-wider cursor-help">Steps</span>
          </div>
        </Tooltip>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              <img
                src={att.preview}
                alt={att.name}
                className="h-12 rounded border border-compeek-border object-cover"
              />
              <button
                onClick={() => removeAttachment(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-compeek-error text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white px-1 truncate rounded-b">
                {att.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Goal input */}
      <div>
        <textarea
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="Tell the AI what to do, e.g. 'Fill the form using the attached passport photo' or 'Open Firefox and search for...'"
          rows={3}
          className="w-full bg-compeek-bg border border-compeek-border rounded-lg p-2 text-sm resize-none focus:border-compeek-accent outline-none"
        />
      </div>

      {/* Actions row: Attach + Start */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Tooltip content="Attach images (documents, screenshots, photos) as context for the AI">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-compeek-bg border border-compeek-border text-compeek-text-dim hover:text-compeek-text hover:border-compeek-accent/50 transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            Attach
            {attachments.length > 0 && (
              <span className="bg-compeek-accent/20 text-compeek-accent rounded-full px-1.5 text-[10px] font-medium">
                {attachments.length}
              </span>
            )}
          </button>
        </Tooltip>

        {/* Preset goals */}
        <div className="flex gap-1.5 flex-1 flex-wrap">
          {presetGoals.map(p => (
            <Tooltip key={p.label} content="Click to use this pre-written task" position="bottom">
              <button
                onClick={() => setGoal(p.goal)}
                className="text-[10px] px-2 py-1 rounded-full bg-compeek-bg border border-compeek-border text-compeek-text-dim hover:text-compeek-text hover:border-compeek-accent/50 transition-colors whitespace-nowrap"
              >
                {p.label}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Start/Stop button */}
      {isRunning ? (
        <button
          onClick={onStop}
          className="w-full py-2.5 rounded-lg bg-compeek-error/20 text-compeek-error font-medium text-sm hover:bg-compeek-error/30 transition-colors"
        >
          Stop Agent
        </button>
      ) : !apiKey ? (
        <Tooltip content="Set your API key in Settings first">
          <button
            disabled
            className="w-full py-2.5 rounded-lg bg-compeek-accent/30 text-compeek-text-dim font-medium text-sm cursor-not-allowed"
          >
            Set API key to start
          </button>
        </Tooltip>
      ) : (
        <button
          onClick={handleStart}
          disabled={!goal.trim()}
          className="w-full py-2.5 rounded-lg bg-compeek-accent text-white font-medium text-sm hover:bg-compeek-accent-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start Agent
        </button>
      )}
    </div>
  );
}
