import emptyValidationImg from '../assets/empty-validation.png';

interface Props {
  events: any[];
}

export default function ValidationReport({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-compeek-text-dim">
        <div className="text-center text-xs">
          <img src={emptyValidationImg} alt="" className="w-32 h-32 mx-auto mb-3 opacity-40" />
          <p>No validation results yet</p>
          <p className="mt-1 opacity-50">Results will appear after form verification</p>
        </div>
      </div>
    );
  }

  const latestValidation = events[events.length - 1];
  const results = latestValidation.data.results || [];
  const allCorrect = results.every((r: any) => r.match);
  const passCount = results.filter((r: any) => r.match).length;

  return (
    <div className="p-3 space-y-3">
      {/* Summary */}
      <div className={`p-3 rounded-lg text-center ${
        allCorrect
          ? 'bg-compeek-success/10 border border-compeek-success/30'
          : 'bg-compeek-warning/10 border border-compeek-warning/30'
      }`}>
        <div className={`text-2xl mb-1 ${allCorrect ? 'text-compeek-success' : 'text-compeek-warning'}`}>
          {allCorrect ? '\u2713' : '\u26A0'}
        </div>
        <div className={`text-sm font-semibold ${allCorrect ? 'text-compeek-success' : 'text-compeek-warning'}`}>
          {passCount}/{results.length} fields verified
        </div>
        <div className="text-xs text-compeek-text-dim mt-1">
          {allCorrect ? 'All fields match expected values' : 'Some fields need attention'}
        </div>
      </div>

      {/* Field-by-field results */}
      <div className="space-y-1">
        {results.map((result: any, i: number) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-2 rounded text-xs ${
              result.match ? 'bg-compeek-success/5' : 'bg-compeek-error/5'
            }`}
          >
            <span className={`text-sm shrink-0 ${result.match ? 'text-compeek-success' : 'text-compeek-error'}`}>
              {result.match ? '\u2713' : '\u2717'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{result.field}</div>
              {!result.match && (
                <div className="text-[10px] text-compeek-text-dim mt-0.5">
                  Expected: <span className="font-mono">{result.expected}</span>
                  {' | '}
                  Actual: <span className="font-mono text-compeek-error">{result.actual}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
