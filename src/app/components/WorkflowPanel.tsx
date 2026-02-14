import { useState, useCallback } from 'react';
import { extractDocument } from '../agent/loop';
import Tooltip from './Tooltip';

interface Props {
  isRunning: boolean;
  onStart: (goal: string, model?: string, documentBase64?: string, documentMimeType?: string, extractedData?: Record<string, string>) => void;
  onStop: () => void;
  apiKey?: string;
  initialModel?: string;
}

export default function WorkflowPanel({ isRunning, onStart, onStop, apiKey, initialModel }: Props) {
  const [goal, setGoal] = useState('');
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [documentBase64, setDocumentBase64] = useState<string | null>(null);
  const [documentMimeType, setDocumentMimeType] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Record<string, string> | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [mode, setMode] = useState<'general' | 'document'>('general');
  const [model, setModel] = useState(initialModel || 'claude-sonnet-4-5');

  const models = [
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5', tip: 'Fastest and cheapest. Good for simple, quick tasks.' },
    { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5', tip: 'Best balance of speed and quality. Recommended for most tasks.' },
    { id: 'claude-opus-4-6', label: 'Opus 4.6', tip: 'Most powerful. Best for complex multi-step workflows.' },
  ];

  const handleDocumentUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setDocumentPreview(dataUrl);
      const base64 = dataUrl.split(',')[1];
      setDocumentBase64(base64);
      setDocumentMimeType(file.type);
      setExtractedData(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!documentBase64 || !documentMimeType || !apiKey) return;

    setIsExtracting(true);
    try {
      const result = await extractDocument(apiKey, documentBase64, documentMimeType);
      if ('fields' in result) {
        setExtractedData(result.fields);
        setGoal(`Navigate to the form at http://localhost:8080 and fill it with the extracted document data. The form is a Client Onboarding form. After filling all fields, check the consent checkbox and submit the form.`);
      }
    } catch (err) {
      console.error('Extraction failed:', err);
    } finally {
      setIsExtracting(false);
    }
  }, [documentBase64, documentMimeType, apiKey]);

  const handleStart = () => {
    if (!goal.trim()) return;
    onStart(goal, model, documentBase64 || undefined, documentMimeType || undefined, extractedData || undefined);
  };

  const presetGoals = [
    { label: 'Test a form', goal: `You are a QA tester. Test the form at http://localhost:8080 for proper validation behavior.\n\nTEST 1 — Empty submission:\n1. Navigate to http://localhost:8080 in Firefox\n2. Without filling any fields, click the "Submit Application" button\n3. Take a screenshot to capture the error states\n4. Verify that error messages appear for required fields\n\nTEST 2 — Successful submission:\n1. Reload the page (Ctrl+Shift+R)\n2. Fill ALL required fields with valid data (First Name: QA, Last Name: Tester, DOB: 01/15/1990, etc.)\n3. Check the consent checkbox and click Submit\n4. Take a screenshot and verify success\n\nAfter all tests, provide a summary of which tests passed and which failed.` },
    { label: 'Test special characters', goal: `Test data integrity of the form at http://localhost:8080.\n\n1. Navigate to http://localhost:8080\n2. Fill the form with special characters: First Name: O'Brien, Last Name: García-López, Address: 42 Rue de l'Église\n3. Fill remaining required fields, check consent, submit\n4. Zoom into the success page values and verify special characters are preserved correctly.` },
    { label: 'Open a text editor', goal: 'Open the text editor (mousepad or gedit), create a new file, and type "Hello from compeek!"' },
    { label: 'Browse the web', goal: 'Open Firefox, navigate to example.com, and take a screenshot of the page' },
  ];

  return (
    <div className="p-3 border-b border-compeek-border space-y-3 shrink-0">
      {/* Mode selector */}
      <div className="flex gap-1 bg-compeek-bg rounded-lg p-0.5">
        <Tooltip content="Tell the AI what to do in plain language">
          <button
            onClick={() => setMode('general')}
            className={`flex-1 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
              mode === 'general' ? 'bg-compeek-accent text-white' : 'text-compeek-text-dim hover:text-compeek-text'
            }`}
          >
            General Goal
          </button>
        </Tooltip>
        <Tooltip content="Upload a photo of a document, and the AI will fill a form with the extracted data">
          <button
            onClick={() => setMode('document')}
            className={`flex-1 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
              mode === 'document' ? 'bg-compeek-accent text-white' : 'text-compeek-text-dim hover:text-compeek-text'
            }`}
          >
            Document &rarr; Form
          </button>
        </Tooltip>
      </div>

      {/* Model selector */}
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
      </div>

      {mode === 'document' && (
        <div className="space-y-2">
          {/* Document upload */}
          <div className="border border-dashed border-compeek-border rounded-lg p-3 text-center">
            {documentPreview ? (
              <div className="relative">
                <img src={documentPreview} alt="Document" className="max-h-32 mx-auto rounded" />
                <button
                  onClick={() => { setDocumentPreview(null); setDocumentBase64(null); setExtractedData(null); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                >
                  x
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <div className="text-compeek-text-dim text-xs">
                  <div className="text-2xl mb-1 opacity-40">&#128196;</div>
                  Drop document photo or click to upload
                </div>
                <input type="file" accept="image/*" onChange={handleDocumentUpload} className="hidden" />
              </label>
            )}
          </div>

          {documentBase64 && !extractedData && (
            <button
              onClick={handleExtract}
              disabled={isExtracting || !apiKey}
              className="w-full py-2 text-xs font-medium rounded-lg bg-compeek-accent/20 text-compeek-accent hover:bg-compeek-accent/30 transition-colors disabled:opacity-50"
            >
              {isExtracting ? 'Extracting...' : !apiKey ? 'Set API key first' : 'Extract Data from Document'}
            </button>
          )}

          {extractedData && (
            <div className="bg-compeek-bg rounded-lg p-2 max-h-40 overflow-y-auto">
              <div className="text-xs font-medium text-compeek-success mb-1">Extracted Fields:</div>
              {Object.entries(extractedData).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs py-0.5">
                  <span className="text-compeek-text-dim">{key}</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Goal input */}
      <div>
        <textarea
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder={mode === 'document' ? 'Goal will be auto-filled after extraction...' : "Tell the AI what to do, e.g. 'Fill out the form with my name and address'"}
          rows={3}
          className="w-full bg-compeek-bg border border-compeek-border rounded-lg p-2 text-sm resize-none focus:border-compeek-accent outline-none"
        />
      </div>

      {/* Preset goals (general mode only) */}
      {mode === 'general' && (
        <div className="flex flex-wrap gap-1">
          {presetGoals.map(p => (
            <Tooltip key={p.label} content="Click to use this pre-written task" position="bottom">
              <button
                onClick={() => setGoal(p.goal)}
                className="text-[10px] px-2 py-1 rounded-full bg-compeek-bg border border-compeek-border text-compeek-text-dim hover:text-compeek-text hover:border-compeek-accent/50 transition-colors"
              >
                {p.label}
              </button>
            </Tooltip>
          ))}
        </div>
      )}

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
