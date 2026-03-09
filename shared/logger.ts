type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): number {
  // LOG_LEVEL override (server-only; guard against missing `process` in the browser)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `process` is absent at runtime in the browser
  if (typeof process !== 'undefined' && process.env?.LOG_LEVEL) {
    const explicit = process.env.LOG_LEVEL;
    if (explicit in LEVELS) return LEVELS[explicit as LogLevel];
  }

  // Vite replaces `process.env.NODE_ENV` at build time so this is safe client-side
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;
}

function isEnabled(level: LogLevel): boolean {
  return LEVELS[level] >= getMinLevel();
}

export const logger = {
  debug(...args: unknown[]): void {
    if (isEnabled('debug')) console.log(...args);
  },
  info(...args: unknown[]): void {
    if (isEnabled('info')) console.log(...args);
  },
  warn(...args: unknown[]): void {
    if (isEnabled('warn')) console.warn(...args);
  },
  error(...args: unknown[]): void {
    if (isEnabled('error')) console.error(...args);
  },
};
