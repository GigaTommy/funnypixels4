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

// 敏感信息过滤器
const filterSensitiveInfo = (...args: unknown[]): unknown[] => {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      const filtered = { ...arg };

      // 过滤常见的敏感字段
      const sensitiveKeys = [
        'key', 'apiKey', 'api_key', 'secret', 'token', 'password',
        'authorization', 'auth', 'credentials', 'signature'
      ];

      for (const key of Object.keys(filtered)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          filtered[key] = '[FILTERED]';
        }
      }

      return filtered;
    }

    // 过滤字符串中的敏感信息
    if (typeof arg === 'string') {
      return arg.replace(/([a-zA-Z0-9_-]{20,})/g, '[FILTERED]');
    }

    return arg;
  });
};

const log = (level: LogLevel, ...args: unknown[]) => {
  if (!shouldLog(level)) {
    return;
  }

  const consoleMethod = consoleMap[level];
  const timestamp = new Date().toISOString();

  // 过滤敏感信息
  const filteredArgs = filterSensitiveInfo(...args);

  consoleMethod(`[${level.toUpperCase()}]`, timestamp, ...filteredArgs);
};

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};
