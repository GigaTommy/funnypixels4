const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// JWT密钥 - 必须从环境变量设置，不允许使用默认值
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// 启动时验证 JWT 密钥是否已设置
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  const error = new Error(
    'FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables. ' +
    'Server cannot start without secure JWT keys.'
  );
  logger.error('JWT configuration error', {
    hasJwtSecret: !!JWT_SECRET,
    hasRefreshSecret: !!JWT_REFRESH_SECRET
  });
  throw error;
}

// 验证密钥长度（至少32字符）
if (JWT_SECRET.length < 32 || JWT_REFRESH_SECRET.length < 32) {
  logger.warn('JWT secrets should be at least 32 characters long for security', {
    jwtSecretLength: JWT_SECRET.length,
    refreshSecretLength: JWT_REFRESH_SECRET.length
  });
}

// 用户缓存：避免每个请求都查 DB（TTL 60秒）
const AUTH_CACHE_TTL = 60 * 1000;
const userCache = new Map();

function getCachedUser(userId) {
  const entry = userCache.get(userId);
  if (entry && Date.now() - entry.ts < AUTH_CACHE_TTL) {
    return entry.user;
  }
  userCache.delete(userId);
  return null;
}

function setCachedUser(userId, user) {
  // 限制缓存大小
  if (userCache.size > 1000) {
    const oldest = userCache.keys().next().value;
    userCache.delete(oldest);
  }
  userCache.set(userId, { user, ts: Date.now() });
}

// 当用户信息更新时调用此函数清除缓存
function invalidateUserCache(userId) {
  userCache.delete(userId);
}

// 生成访问令牌
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_admin: user.role === 'admin' || user.role === 'super_admin'
    },
    JWT_SECRET,
    { expiresIn: '1h' } // 1小时
  );
};

// 生成刷新令牌
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      type: 'refresh'
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // 7天
  );
};

// 验证访问令牌
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// 验证刷新令牌
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

// 认证中间件（支持自动续期）
const authenticateToken = async (req, res, next) => {
  logger.debug('认证中间件被调用', {
    path: req.path,
    method: req.method,
    hasAuthHeader: !!req.headers['authorization'],
    // 安全：只记录 token 类型，不记录完整 token
    authHeaderType: req.headers['authorization']?.split(' ')[0],
    origin: req.headers['origin'],
    userAgent: req.headers['user-agent']
  });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const refreshToken = req.headers['x-refresh-token']; // 刷新令牌

  if (!token) {
    logger.warn('访问令牌缺失', { headers: req.headers });
    return res.status(401).json({ error: '访问令牌缺失' });
  }

  // 安全：不记录 token 内容
  logger.debug('Token验证开始', { hasToken: !!token });

  let decoded = verifyAccessToken(token);
  logger.debug('Token验证结果', {
    isValid: !!decoded,
    // 安全：只记录用户 ID，不记录完整 decoded 内容
    userId: decoded?.id,
    // 安全：完全移除 token 前缀记录
  });

  // 如果访问令牌过期且有刷新令牌，尝试自动续期
  if (!decoded && refreshToken) {
    try {
      const refreshDecoded = verifyRefreshToken(refreshToken);
      if (refreshDecoded && refreshDecoded.id) {
        // 验证刷新令牌有效，生成新的访问令牌
        const user = await User.findById(refreshDecoded.id);
        if (user) {
          const newAccessToken = generateAccessToken(user);

          // 在响应头中返回新的访问令牌
          res.setHeader('X-New-Access-Token', newAccessToken);
          res.setHeader('X-Token-Refreshed', 'true');

          // 继续处理请求
          user.role = user.role || 'user';
          user.is_admin = user.role === 'admin' || user.role === 'super_admin';
          req.user = user;
          return next();
        }
      }
    } catch (error) {
      logger.error('刷新令牌验证失败', { error: error.message });
    }
  }

  if (!decoded) {
    return res.status(403).json({ error: '访问令牌无效或已过期' });
  }

  try {
    // 获取用户信息（优先从缓存读取）
    let user = getCachedUser(decoded.id);
    if (!user) {
      user = await User.findById(decoded.id);
      if (user) setCachedUser(decoded.id, user);
    }
    if (!user) {
      return res.status(403).json({ error: '用户不存在' });
    }

    // 确保role信息从JWT token中获取
    const originalRole = user.role;
    user.role = decoded.role || user.role;
    user.is_admin = user.role === 'admin' || user.role === 'super_admin';
    req.user = user;

    // 安全：生产环境不记录详细用户信息
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('认证成功', {
        userId: user.id,
        username: user.username,
        role: user.role,
        is_admin: user.is_admin
      });
    }
    next();
  } catch (error) {
    logger.error('认证中间件错误', { error: error.message });
    return res.status(500).json({ error: '服务器内部错误' });
  }
};

// 可选认证中间件（不强制要求认证）
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      try {
        const user = await User.findById(decoded.id);
        if (user) {
          req.user = user;
        }
      } catch (error) {
        logger.error('可选认证错误', { error: error.message });
      }
    }
  }

  // 如果没有认证用户，检查是否为游客模式
  if (!req.user) {
    // 从多个来源获取游客ID：请求体、查询参数、请求头
    const guestId = req.body.userId ||
      req.query.userId ||
      req.headers['x-guest-id'];
    if (guestId && guestId.startsWith('guest_')) {
      req.user = {
        id: guestId,
        username: '游客',
        role: 'guest',
        isGuest: true
      };
      logger.debug('🔍 游客认证成功', { guestId, path: req.path });
    } else if (guestId === 'anonymous') {
      // 处理特殊的匿名用户
      req.user = {
        id: 'anonymous',
        username: '匿名用户',
        role: 'anonymous',
        isGuest: true,
        isAnonymous: true
      };
      logger.debug('🔍 匿名用户认证成功', { path: req.path });
    }
  }

  next();
};

// 管理员权限中间件
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    logger.warn('❌ requireAdmin: req.user不存在');
    return res.status(401).json({ error: '需要认证' });
  }

  // 调试信息：记录用户权限检查
  logger.debug('🔍 管理员权限检查:', {
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    is_admin: req.user.is_admin,
    userObjectType: typeof req.user,
    userKeys: Object.keys(req.user),
    path: req.path,
    originalUrl: req.originalUrl,
    method: req.method
  });

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    logger.warn('❌ 权限不足 - 详细信息:', {
      userId: req.user.id,
      role: req.user.role,
      is_admin: req.user.is_admin,
      roleType: typeof req.user.role,
      roleAsString: String(req.user.role),
      path: req.path,
      fullUser: JSON.stringify(req.user, null, 2)
    });
    return res.status(403).json({ success: false, message: '无权限访问' });
  }

  logger.debug('✅ 管理员权限验证通过:', {
    userId: req.user.id,
    role: req.user.role,
    username: req.user.username
  });
  next();
};

module.exports = {
  authMiddleware: authenticateToken,  // 添加与前端路由期望一致的命名
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  authenticateToken,
  optionalAuth,
  requireAdmin,
  invalidateUserCache,
  JWT_SECRET,
  JWT_REFRESH_SECRET
};
