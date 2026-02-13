type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LABELS: Record<LogLevel, string> = { debug: 'DEBUG', info: 'INFO ', warn: 'WARN ', error: 'ERROR' };

const currentLevel: number = LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? LEVELS.info;

function ts(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function write(level: LogLevel, component: string, message: string, data?: unknown): void {
  if (LEVELS[level] < currentLevel) return;
  const tag = component.padEnd(7);
  const line = `[${ts()}] [${LABELS[level]}] [${tag}] ${message}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(line);
  if (data !== undefined) {
    fn(typeof data === 'string' ? `  ${data}` : `  ${JSON.stringify(data, null, 2)}`);
  }
}

export const log = {
  debug: (component: string, message: string, data?: unknown) => write('debug', component, message, data),
  info:  (component: string, message: string, data?: unknown) => write('info', component, message, data),
  warn:  (component: string, message: string, data?: unknown) => write('warn', component, message, data),
  error: (component: string, message: string, data?: unknown) => write('error', component, message, data),
  isDebug: () => currentLevel <= LEVELS.debug,
};
