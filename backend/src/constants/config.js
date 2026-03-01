/**
 * 应用配置常量
 * 集中管理所有魔法数字和配置值
 */

// ============================================
// 认证和安全配置
// ============================================
const AUTH = {
  // JWT 配置
  JWT_ACCESS_TOKEN_EXPIRY: '1h',           // 访问令牌过期时间
  JWT_REFRESH_TOKEN_EXPIRY: '7d',          // 刷新令牌过期时间
  JWT_MIN_SECRET_LENGTH: 32,               // JWT 密钥最小长度

  // 用户缓存配置
  USER_CACHE_TTL: 60 * 1000,               // 60秒
  USER_CACHE_MAX_SIZE: 1000,               // 最大缓存用户数
};

// ============================================
// 批量处理配置
// ============================================
const BATCH = {
  // 像素批量处理
  PIXEL_CHUNK_SIZE: 100,                   // 每次处理的像素数
  DEFAULT_BATCH_SIZE: 100,                 // 默认批次大小
  MAX_BATCH_SIZE: 500,                     // 最大批次大小
  FLUSH_INTERVAL: 5000,                    // 5秒自动刷新
  MAX_FLUSH_ITERATIONS: 10,                // 最大刷新迭代次数

  // Redis 批量操作
  REDIS_BATCH_SIZE: 100,                   // Redis 批量操作大小
  REDIS_FLUSH_INTERVAL: 300000,            // 5分钟
};

// ============================================
// 缓存配置
// ============================================
const CACHE = {
  // Redis TTL（秒）
  PIXEL_TTL: 3600,                         // 1小时
  PIXEL_GRID_TTL: 1800,                    // 30分钟
  LEADERBOARD_TTL: 600,                    // 10分钟
  LEADERBOARD_COUNT_TTL: 3600000,          // 1小时（毫秒）
  CHAT_MESSAGE_TTL: 300,                   // 5分钟
  CHAT_HOT_MESSAGE_TTL: 1800,              // 30分钟
  ALLIANCE_TTL: 1800,                      // 30分钟
  USER_PROFILE_TTL: 3600,                  // 1小时
  REGION_STATS_TTL: 1800,                  // 30分钟
  TILE_SNAPSHOT_TTL: 3600,                 // 1小时
  SESSION_LIST_TTL: 60,                    // 会话列表缓存（秒）
  SESSION_COUNT_TTL: 30,                   // 会话总数缓存（秒）

  // HTTP 客户端缓存
  HTTP_CACHE_MAX_AGE: 60,                  // 60秒
};

// ============================================
// 排行榜配置
// ============================================
const LEADERBOARD = {
  // 增量排行榜
  SYNC_INTERVAL: 30000,                    // 30秒同步一次
  MAX_CONSECUTIVE_FAILURES: 5,             // 最大连续失败次数

  // 维护配置
  MAINTENANCE_HOUR: 2,                     // 凌晨2点维护
  RETENTION_DAYS: 30,                      // 数据保留30天

  // 周期配置
  PERIODS: ['daily', 'weekly', 'monthly', 'yearly', 'allTime'],
};

// ============================================
// 限流配置
// ============================================
const RATE_LIMIT = {
  // 认证相关
  AUTH_WINDOW: 15 * 60 * 1000,             // 15分钟
  AUTH_MAX: 5,                             // 5次尝试

  REGISTER_WINDOW: 60 * 60 * 1000,         // 1小时
  REGISTER_MAX: 3,                         // 3次尝试

  // API 限流
  API_WINDOW: 60 * 1000,                   // 1分钟
  API_MAX: 200,                            // 200次请求

  LEADERBOARD_WINDOW: 60 * 1000,           // 1分钟
  LEADERBOARD_MAX: 60,                     // 60次请求

  PIXEL_WINDOW: 60 * 1000,                 // 1分钟
  PIXEL_MAX: 2000,                         // 2000次请求

  CHAT_WINDOW: 10 * 1000,                  // 10秒
  CHAT_MAX: 10,                            // 10条消息

  UPLOAD_WINDOW: 60 * 1000,                // 1分钟
  UPLOAD_MAX: 5,                           // 5次上传

  ADMIN_WINDOW: 60 * 1000,                 // 1分钟
  ADMIN_MAX: 1000,                         // 1000次请求
};

// ============================================
// 性能监控配置
// ============================================
const PERFORMANCE = {
  // 慢请求阈值（毫秒）
  SLOW_REQUEST_THRESHOLD: 200,             // 200ms
  SLOW_LEADERBOARD_THRESHOLD: 500,         // 500ms

  // 压缩配置
  COMPRESSION_THRESHOLD: 1024,             // 1KB
  COMPRESSION_LEVEL: 6,                    // 压缩级别
};

// ============================================
// Redis 配置
// ============================================
const REDIS = {
  // 连接配置
  RECONNECT_MAX_RETRIES: 10,               // 最大重连次数
  RECONNECT_INITIAL_DELAY: 100,            // 初始延迟（毫秒）
  RECONNECT_MAX_DELAY: 3000,               // 最大延迟（毫秒）
  CONNECTION_TIMEOUT: 10000,               // 连接超时（毫秒）

  // SCAN 配置
  SCAN_COUNT: 100,                         // 每次扫描的键数量
};

// ============================================
// 数据库配置
// ============================================
const DATABASE = {
  // 连接池
  POOL_MIN: 2,                             // 开发环境最小连接数
  POOL_MAX: 10,                            // 开发环境最大连接数
  POOL_MIN_PRODUCTION: 5,                  // 生产环境最小连接数
  POOL_MAX_PRODUCTION: 25,                 // 生产环境最大连接数

  // 超时配置
  ACQUIRE_TIMEOUT: 30000,                  // 30秒
  IDLE_TIMEOUT: 30000,                     // 30秒
  IDLE_TIMEOUT_PRODUCTION: 20000,          // 20秒
  REAP_INTERVAL: 1000,                     // 1秒
};

// ============================================
// 文件上传配置
// ============================================
const UPLOAD = {
  // 文件大小限制
  MAX_FILE_SIZE: 5 * 1024 * 1024,          // 5MB
  MAX_REQUEST_SIZE: 10 * 1024 * 1024,      // 10MB

  // 允许的文件类型
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ],

  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
};

// ============================================
// 隐私和本地化
// ============================================
const PRIVACY = {
  // 默认显示名称
  ANONYMOUS_DISPLAY_NAME: '匿名像素师',
  ANONYMOUS_USERNAME: '匿名',
  UNKNOWN_LOCATION: '未知地点',
};

// ============================================
// WebSocket 配置
// ============================================
const WEBSOCKET = {
  // 连接配置
  PING_TIMEOUT: 60000,                     // 60秒
  PING_INTERVAL: 25000,                    // 25秒
  CONNECT_TIMEOUT: 45000,                  // 45秒
  MAX_HTTP_BUFFER_SIZE: 1024 * 1024,       // 1MB

  // 压缩配置
  PER_MESSAGE_DEFLATE_THRESHOLD: 1024,     // 1KB

  // 心跳检测
  HEARTBEAT_INTERVAL: 30000,               // 30秒
};

// ============================================
// 会话配置
// ============================================
const SESSION = {
  // 会话超时
  ACTIVE_SESSION_TTL: 3600,                // 1小时（秒）
  EXPIRED_SESSION_HOURS: 24,               // 24小时未活动则过期

  // 批量查询限制
  MAX_BATCH_SESSIONS: 50,                  // 最多批量查询50个会话
  SESSION_PREVIEW_PIXELS: 10,              // 会话预览显示的像素数
};

// ============================================
// 导出所有配置
// ============================================
module.exports = {
  AUTH,
  BATCH,
  CACHE,
  LEADERBOARD,
  RATE_LIMIT,
  PERFORMANCE,
  REDIS,
  DATABASE,
  UPLOAD,
  PRIVACY,
  WEBSOCKET,
  SESSION,
};
