const mode = import.meta.env.MODE ?? 'development';
const isProduction = mode === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type ConsoleMethod = typeof console.log;

const consoleMap: Record<LogLevel, ConsoleMethod> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const noop: ConsoleMethod = () => undefined;

export const applyConsoleLoggingPolicy = () => {
  if (!isProduction) {
    return;
  }

  console.debug = noop;
  console.log = noop;
  console.info = noop;
  console.warn = noop;
};

const shouldLog = (level: LogLevel) => {
  if (!isProduction) {
    return true;
  }

  return level === 'error';
};

const log = (level: LogLevel, ...args: unknown[]) => {
  if (!shouldLog(level)) {
    return;
  }

  const consoleMethod = consoleMap[level];
  const timestamp = new Date().toISOString();
  consoleMethod(`[${level.toUpperCase()}]`, timestamp, ...args);
};

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};