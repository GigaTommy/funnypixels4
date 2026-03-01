const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

/**
 * 获取客户端真实 IP 地址
 * 优先级：X-Forwarded-For (第一个) > X-Real-IP > req.ip
 * @param {object} req - Express 请求对象
 * @returns {string} 客户端 IP 地址
 */
function getClientIP(req) {
  // 1. 检查 X-Forwarded-For（可能有多个代理，取第一个）
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }

  // 2. 检查 X-Real-IP（nginx 常用）
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }

  // 3. 回退到 req.ip（Express 内置，依赖 trust proxy 设置）
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

// 🔧 修复：使用条件配置替代函数式配置
// 根据环境变量决定 CSP 策略
const isProduction = process.env.NODE_ENV === 'production';

// 安全头配置
const securityHeaders = helmet({
  // 内容安全策略
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      // 🔒 安全：生产环境移除 unsafe-inline，开发环境保留
      styleSrc: isProduction
        ? ['\'self\'']
        : ['\'self\'', '\'unsafe-inline\''],
      fontSrc: ['\'self\'', 'data:'],
      imgSrc: ['\'self\'', 'data:', 'https:', 'blob:'],
      // 🔒 安全：生产环境移除 unsafe-inline 和 unsafe-eval
      scriptSrc: isProduction
        ? ['\'self\'']
        : ['\'self\'', '\'unsafe-inline\'', '\'unsafe-eval\''],
      // 🔒 安全：开发环境允许内联事件处理器，生产环境禁用
      scriptSrcAttr: isProduction ? ['\'none\''] : ['\'unsafe-inline\''],
      connectSrc: ['\'self\'', 'ws:', 'wss:', 'https:'],
      frameSrc: ['\'self\''],
      objectSrc: ['\'none\''],
      baseUri: ['\'self\''],
      formAction: ['\'self\''],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  // 跨域资源策略 - 允许跨域加载（用于前后端分离开发）
  crossOriginResourcePolicy: {
    policy: 'cross-origin'
  },
  // 严格传输安全
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  // 防止点击劫持
  frameguard: {
    action: 'deny'
  },
  // 防止MIME类型嗅探
  noSniff: true,
  // 防止XSS攻击
  xssFilter: true,
  // 隐藏服务器信息
  hidePoweredBy: true,
  // 防止IE打开下载的文件
  ieNoOpen: true,
  // 防止DNS预取
  dnsPrefetchControl: {
    allow: false
  }
});

// CSRF保护中间件
const csrfProtection = (req, res, next) => {
  // 跳过GET请求和健康检查
  if (req.method === 'GET' || req.path === '/api/health') {
    return next();
  }

  // 对于像素战争游戏，我们采用简化的CSRF保护
  // 检查请求来源和Referer头
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = [
    process.env.CORS_ORIGIN || 'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];

  // 检查Origin头
  if (origin && !allowedOrigins.includes(origin)) {
    console.warn(`🚨 可疑的Origin: ${origin} from ${getClientIP(req)}`);
    return res.status(403).json({
      success: false,
      error: 'CSRF_TOKEN_INVALID',
      message: '请求来源不被允许'
    });
  }

  // 检查Referer头（如果存在）
  if (referer) {
    const refererUrl = new URL(referer);
    const isAllowedReferer = allowedOrigins.some(allowedOrigin => {
      const allowedUrl = new URL(allowedOrigin);
      return refererUrl.origin === allowedUrl.origin;
    });

    if (!isAllowedReferer) {
      console.warn(`🚨 可疑的Referer: ${referer} from ${getClientIP(req)}`);
      return res.status(403).json({
        success: false,
        error: 'CSRF_TOKEN_INVALID',
        message: '请求来源不被允许'
      });
    }
  }

  next();
};

// 生成CSRF令牌
const generateCSRFToken = () => {
  return uuidv4();
};

// 输入验证和清理中间件
const inputValidation = (req, res, next) => {
  // 清理请求体
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }

  // 清理查询参数
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }

  // 清理URL参数
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }

  next();
};

// 输入清理函数
const sanitizeInput = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }

  const cleaned = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeInput(value);
    } else {
      cleaned[key] = sanitizeString(value);
    }
  }

  return cleaned;
};

// 字符串清理函数
const sanitizeString = (str) => {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replace(/[<>]/g, '') // 移除尖括号
    .replace(/javascript:/gi, '') // 移除javascript协议
    .replace(/on\w+=/gi, '') // 移除事件处理器
    .trim();
};

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  // 记录错误日志
  console.error('错误详情:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: getClientIP(req),
    userAgent: req.get('User-Agent'),
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // 不暴露敏感信息
  const errorResponse = {
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message
  };

  // 根据错误类型返回不同的状态码
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      ...errorResponse,
      error: 'VALIDATION_ERROR',
      message: '输入验证失败'
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      ...errorResponse,
      error: 'UNAUTHORIZED',
      message: '未授权访问'
    });
  }

  res.status(500).json(errorResponse);
};

// 请求日志中间件（含慢请求告警）
const SLOW_REQUEST_THRESHOLD = 200; // ms
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const clientIP = getClientIP(req);

  // 记录请求开始
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${clientIP}`);

  // 记录响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > SLOW_REQUEST_THRESHOLD) {
      console.warn(`[SLOW] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - ${clientIP}`);
    } else {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - ${clientIP}`);
    }
  });

  next();
};

// 安全日志中间件
const securityLogger = (req, res, next) => {
  // 开发环境跳过严格检查，避免误报
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // 检测可疑请求 - 仅在生产环境启用
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /union\s+select/i,
    /drop\s+table/i,
    /delete\s+from/i
  ];

  // 只检查用户输入数据，不检查 headers（避免误报 User-Agent 等合法头部）
  const requestString = JSON.stringify({
    url: req.url,
    body: req.body,
    query: req.query
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      console.warn(`🚨 检测到可疑请求: ${getClientIP(req)} - ${req.method} ${req.url}`);
      // 这里可以添加告警通知
      break;
    }
  }

  next();
};

// 会话安全中间件
const sessionSecurity = (req, res, next) => {
  // 设置安全的cookie选项
  const sessionId = req.sessionID || uuidv4();
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  });

  // 初始化session对象（如果不存在）
  if (!req.session) {
    req.session = {};
  }

  // 生成CSRF令牌
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }

  next();
};

// 文件上传安全检查
const fileUploadSecurity = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  const maxFileSize = 5 * 1024 * 1024; // 5MB

  const files = req.file ? [req.file] : req.files;

  for (const file of files) {
    // 检查文件类型
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_FILE_TYPE',
        message: '不支持的文件类型'
      });
    }

    // 检查文件大小
    if (file.size > maxFileSize) {
      return res.status(400).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: '文件大小超过限制'
      });
    }

    // 检查文件扩展名
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = file.originalname.toLowerCase().substring(
      file.originalname.lastIndexOf('.')
    );

    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_FILE_EXTENSION',
        message: '不支持的文件扩展名'
      });
    }
  }

  next();
};

module.exports = {
  getClientIP,
  securityHeaders,
  csrfProtection,
  generateCSRFToken,
  inputValidation,
  errorHandler,
  requestLogger,
  securityLogger,
  sessionSecurity,
  fileUploadSecurity
};
