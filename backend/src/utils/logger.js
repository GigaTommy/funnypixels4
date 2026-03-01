const pino = require('pino');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';
const isDevelopment = env === 'development';

// 检测是否 Windows 平台
const isWindows = process.platform === 'win32';

// ✅ Windows 下确保 UTF-8 输出
if (isWindows) {
  try {
    // 设置控制台为 UTF-8 代码页 (65001)
    // 注意：仅在 CMD / PowerShell 有效
    require('child_process').execSync('chcp 65001 > nul');
  } catch (err) {
    // 忽略错误，不影响运行
  }
}

// ✅ 定义日志目标
let transport = undefined;
if (isDevelopment) {
  transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
      destination: 1, // stdout
    },
  };
}

// ✅ 如果写入文件，确保 UTF-8
const destination =
  process.env.LOG_TO_FILE === 'true'
    ? fs.createWriteStream('app.log', { flags: 'a', encoding: 'utf8' })
    : undefined;

const level = isDevelopment ? process.env.LOG_LEVEL || 'debug' : 'error';

// ✅ 创建 logger
const logger = pino(
  {
    level,
    transport,
    base: {
      env,
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  },
  destination
);

const normalizeArgs = (args) => {
  if (!args.length) {
    return { msg: '', obj: {} };
  }

  const [first, ...rest] = args;

  if (typeof first === 'string') {
    if (rest.length === 0) {
      return { msg: first, obj: {} };
    }

    if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null) {
      return { msg: first, obj: rest[0] };
    }

    return { msg: first, obj: { data: rest } };
  }

  return { msg: undefined, obj: { data: [first, ...rest] } };
};

const createConsoleForwarder = (level, devOnly = false) => {
  if (devOnly && !isDevelopment) {
    return () => undefined;
  }

  return (...args) => {
    const { msg, obj } = normalizeArgs(args);
    logger[level](obj, msg);
  };
};

const consoleForwarders = {
  log: createConsoleForwarder('info', true),
  info: createConsoleForwarder('info', true),
  debug: createConsoleForwarder('debug', true),
  warn: createConsoleForwarder('warn', true),
  error: createConsoleForwarder('error'),
};

Object.assign(console, consoleForwarders);

module.exports = {
  trace: (msg, obj) => logger.trace(obj || {}, msg),
  debug: (msg, obj) => logger.debug(obj || {}, msg),
  info: (msg, obj) => logger.info(obj || {}, msg),
  warn: (msg, obj) => logger.warn(obj || {}, msg),
  error: (msg, obj) => logger.error(obj || {}, msg),
  fatal: (msg, obj) => logger.fatal(obj || {}, msg),
};
