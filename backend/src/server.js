// 统一环境配置加载
const { loadEnvConfig } = require('./config/env');
loadEnvConfig();
const logger = require('./utils/logger');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression'); // 🚀 性能优化：响应压缩
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { calculateGridId } = require('../shared/utils/gridUtils');

// Cluster mode detection
const isClusterMode = process.env.CLUSTER_MODE === 'true';
const isPrimaryWorker = !isClusterMode || process.env.CLUSTER_WORKER_ID === '1';
const workerId = process.env.CLUSTER_WORKER_ID || '0';

// 强制设置正确的数据库环境变量（临时解决方案）
if (process.env.NODE_ENV === 'production') {
  // 检查是否在 Render 环境中
  if (process.env.RENDER) {
    logger.info('检测到 Render 环境，检查数据库配置');

    // 如果环境变量没有正确设置，显示警告但不强制设置
    if (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') {
      logger.warn('数据库环境变量可能未正确设置', {
        currentDbHost: process.env.DB_HOST,
        message: '请检查 render.yaml 中的数据库环境变量映射'
      });
    } else {
      logger.info('数据库环境变量已正确设置');
    }
  }
}

// 添加调试信息
logger.debug('服务器启动信息', {
  currentDirectory: __dirname,
  configFiles: require('fs').readdirSync(path.join(__dirname, 'config'))
});

// 导入数据库配置和模型
const { db } = require('./config/database');
const { initializeRedis, closeRedis, getHealthStatus } = require('./config/redis');
let redis = null; // 将在 initializeRedis 后赋值
let subscriber = null; // Pub/Sub 订阅客户端
const Pixel = require('./models/Pixel');
const TreasureSpawnService = require('./services/treasureSpawnService');
const UserPixelState = require('./models/UserPixelState');
const User = require('./models/User'); // Added missing import for User
const prometheusMetrics = require('./monitoring/prometheusMetrics');

// 导入性能优化服务
const SocketManager = require('./services/socketManager');
const { setSocketManager } = require('./services/socketManagerInstance');
const PixelBatchService = require('./services/pixelBatchService');
const PixelDrawService = require('./services/pixelDrawService');
const LeaderboardMaintenanceService = require('./services/leaderboardMaintenanceService');
const GeographicStatsMaintenanceService = require('./services/geographicStatsMaintenanceService');
const PartitionMaintenanceService = require('./services/partitionMaintenanceService');
const driftBottleService = require('./services/driftBottleService');
const DailyRewardService = require('./services/dailyRewardService');
const eventPixelLogListener = require('./events/eventPixelLogListener');
const { pixelLimiter, apiLimiter } = require('./middleware/rateLimit');


// 导入安全中间件
const {
  securityHeaders,
  csrfProtection,
  inputValidation,
  errorHandler,
  requestLogger,
  securityLogger,
  sessionSecurity,
  fileUploadSecurity
} = require('./middleware/security');

// 导入验证中间件
const { validators } = require('./middleware/validation');

// 导入安全监控服务
const securityMonitor = require('./services/securityMonitor');

// 导入路由
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const smsRoutes = require('./routes/sms');
const allianceRoutes = require('./routes/allianceRoutes');
const materialRoutes = require('./routes/materials');
const storeRoutes = require('./routes/store');
const storePaymentRoutes = require('./routes/storePayment');
const unifiedPaymentRoutes = require('./routes/unifiedPayment');
const chatRoutes = require('./routes/chatRoutes');
const socialRoutes = require('./routes/socialRoutes');
const profileRoutes = require('./routes/profileRoutes');
const reportRoutes = require('./routes/reportRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const advertisementRoutes = require('./routes/advertisementRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const privateMessageRoutes = require('./routes/privateMessageRoutes');
const groupChatRoutes = require('./routes/groupChatRoutes');
const privacyRoutes = require('./routes/privacyRoutes');
const securityRoutes = require('./routes/securityRoutes');
const patternBombRoutes = require('./routes/patternBombRoutes');
const cosmeticRoutes = require('./routes/cosmeticRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const regionRoutes = require('./routes/regionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const systemMessageRoutes = require('./routes/systemMessageRoutes');
const { optionalAuth, authenticateToken } = require('./middleware/auth');

// 导入分享功能
const shareRoutes = require('./routes/shareRoutes');
const patternRoutes = require('./routes/patternRoutes');
const shareImageRoutes = require('./routes/shareImageRoutes');
const bombRoutes = require('./routes/bombRoutes');
const adRoutes = require('./routes/adRoutes');
const patternUploadRoutes = require('./routes/patternUploadRoutes');
const patternReviewRoutes = require('./routes/patternReviewRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const timelapseRoutes = require('./routes/timelapseRoutes');
const challengeRoutes = require('./routes/challengeRoutes');
const eventRoutes = require('./routes/eventRoutes');
const pushNotificationRoutes = require('./routes/pushNotificationRoutes');
const referralRoutes = require('./routes/referralRoutes');
const dailyRewardRoutes = require('./routes/dailyRewardRoutes');

// 导入像素绘制路由
const { router: pixelDrawRoutes, setPixelDrawService } = require('./routes/pixelDrawRoutes');

// 导入像素路由
const pixelRoutes = require('./routes/pixelRoutes');

// 导入像素点赞路由
const pixelLikeRoutes = require('./routes/pixelLikeRoutes');

// 导入像素历史路由
const pixelsHistoryRoutes = require('./routes/pixelsHistory');

// 导入瓦片路由
// const tileRoutes = require('./routes/tiles'); // 已删除Canvas瓦片系统

// 导入像素BBOX查询路由
const pixelsBboxRoutes = require('./routes/pixelsBbox');

// 导入像素信息查询路由
const { getPixelInfo } = require('./routes/pixelInfo');

// 导入安全地图API路由
const secureMapAPIRoutes = require('./routes/secureMapAPI');

// 导入WebSocket处理器
const tileUpdateHandler = require('./websocket/tileUpdateHandler');

const app = express();

// 创建 HTTP 服务器
const server = http.createServer(app);

// 创建 HTTPS 服务器（用于抖音小游戏等需要 HTTPS 的场景）
let httpsServer = null;
if (process.env.ENABLE_HTTPS === 'true') {
  const https = require('https');
  const fs = require('fs');
  const { execSync } = require('child_process');

  // 证书路径
  const certDir = path.join(__dirname, '../certs');
  const keyPath = path.join(certDir, 'server.key');
  const certPath = path.join(certDir, 'server.cert');

  // 生成自签名证书（如果不存在）
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    logger.info('生成自签名 HTTPS 证书...');
    try {
      execSync(
        `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=CN/ST=State/L=City/O=FunnyPixels/CN=localhost"`,
        { stdio: 'inherit' }
      );
      logger.info('✅ HTTPS 证书生成成功');
    } catch (error) {
      logger.warn('⚠️ HTTPS 证书生成失败，将仅启动 HTTP 服务器');
      logger.info('Windows用户可以下载 OpenSSL: https://slproweb.com/products/Win32OpenSSL.html');
    }
  }

  // 如果证书存在，创建 HTTPS 服务器
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    httpsServer = https.createServer(httpsOptions, app);
    logger.info('✅ HTTPS 服务器已配置');
  }
}

// CORS配置 - 支持多种本地开发地址和生产环境
const corsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8000',  // 管理控制台端口
  'http://127.0.0.1:8000',  // 管理控制台端口
  'http://localhost:8002',  // 管理控制台端口（备用）
  'http://127.0.0.1:8002',  // 管理控制台端口（备用）
  // 生产环境域名
  'https://funnypixels.pages.dev',
  'https://funnypixels-frontend.pages.dev'
];

// 如果环境变量中指定了CORS_ORIGIN，则添加到允许列表中
if (process.env.CORS_ORIGIN) {
  corsOrigins.push(process.env.CORS_ORIGIN);
}

// CORS配置函数，动态处理origin
const corsOptions = {
  origin: function (origin, callback) {
    // 🔒 安全：生产环境要求必须有 Origin 头，开发环境允许无 Origin（Postman 等工具）
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        logger.warn('CORS拒绝: 生产环境要求 Origin 头');
        return callback(null, false);
      }
      return callback(null, true);
    }

    // 🔒 安全：严格白名单检查（字符串精确匹配或正则表达式匹配）
    const isAllowed = corsOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      // 🔒 安全：记录所有被拒绝的 origin，便于监控和调试
      logger.warn(`CORS拒绝origin: ${origin} (环境: ${process.env.NODE_ENV || 'development'})`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-idempotency-key', 'cache-control', 'Cache-Control', 'Pragma', 'x-force-refresh', 'X-Force-Refresh', 'X-Refresh-Token', 'X-New-Access-Token', 'X-Token-Refreshed', 'x-guest-id']
};

const io = socketIo(server, {
  cors: corsOptions,
  // OPTIMIZED: Enable native WebSocket for better performance and lower latency
  transports: ['websocket', 'polling'], // WebSocket primary, polling fallback
  allowUpgrades: true, // Allow protocol upgrade from polling to websocket
  rememberUpgrade: true, // Remember successful upgrades
  upgradeTimeout: 10000, // Timeout for upgrade attempts
  allowEIO3: true, // 允许 Engine.IO 3 协议，增加兼容性
  pingTimeout: 60000, // 客户端 ping 超时时间（60秒）
  pingInterval: 25000, // 服务端 ping 间隔（25秒）
  maxHttpBufferSize: 1e6, // 最大 HTTP 缓冲区大小（1MB）
  connectTimeout: 45000, // 连接超时时间（45秒）
  perMessageDeflate: {
    threshold: 1024 // Only compress messages larger than 1KB
  }
});

// 🔧 信任代理：正确获取客户端真实 IP（支持 nginx 等反向代理）
// 生产环境：只信任特定跳数的代理，避免 IP 欺骗
// 开发环境：信任所有代理（方便本地调试）
if (process.env.NODE_ENV === 'production') {
  // 生产环境：信任第一个代理（nginx/CDN）
  app.set('trust proxy', 1);
} else {
  // 开发环境：信任所有代理
  app.set('trust proxy', true);
}

// 安全中间件
app.use(securityHeaders);
app.use(requestLogger);
app.use(securityLogger);
app.use(inputValidation);

// 🚀 性能优化：启用 gzip 压缩（在解析 body 之前）
app.use(compression({
  // 只压缩大于 1KB 的响应
  threshold: 1024,
  // 压缩级别 6（平衡速度和压缩率）
  level: 6,
  // 过滤：只压缩 JSON 和文本
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// 基础中间件
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🔧 头像URL自动转换中间件（将相对路径转换为完整URL）
const avatarUrlMiddleware = require('./middleware/avatarUrlMiddleware');
app.use(avatarUrlMiddleware);

// 会话安全
app.use(sessionSecurity);

// 🌐 国际化中间件（i18n）
const { i18next, middleware: i18nMiddleware } = require('./config/i18n');
app.use(i18nMiddleware.handle(i18next));

// 语言检测中间件（保留以兼容现有代码）
const { extractLanguage } = require('./middleware/localization');
app.use(extractLanguage);

// 📊 Prometheus指标收集中间件
const metricsMiddleware = require('./middleware/metricsMiddleware');
app.use(metricsMiddleware);

// 静态文件服务 - 用于提供上传的图片和文档
// CORS由全局中间件处理，这里不再单独设置
// ✅ 修复：优先使用public/uploads（与UPLOAD_DIR环境变量一致）
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));
// 保留对旧uploads目录的兼容
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// 🔧 新增：添加 /assets 静态文件服务 - 用于emoji atlas等静态资源
// 确保emoji atlas文件可以被前端和后端正确访问，修复emoji渲染为黑色的问题
app.use('/assets', express.static(path.join(__dirname, '../public/assets'), {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// Apple App Site Association for Universal Links
app.use('/.well-known', express.static(path.join(__dirname, '../public/.well-known'), {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Content-Type', 'application/json');
  }
}));

// Deep link redirect — opens app or falls back to App Store
app.get('/link/*', (req, res) => {
  const deepPath = req.path.replace(/^\/link/, '');
  const query = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
  const appSchemeURL = `funnypixels:/${deepPath}${query ? '?' + query : ''}`;
  const appStoreURL = 'https://apps.apple.com/app/funnypixels/id0000000000';
  res.send(`<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>FunnyPixels</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>
window.location.href="${appSchemeURL}";
setTimeout(function(){window.location.href="${appStoreURL}"},1500);
</script>
</head><body><p>Opening FunnyPixels...</p></body></html>`);
});

// 🔌 健康检查端点 - 用于网络检测
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// 🔌 简单的 HEAD 请求健康检查 - 用于网络检测
app.head('/api/health', (req, res) => {
  res.status(200).end();
});

// 路由
app.use('/api/auth', authRoutes);
// 告警Webhook路由
app.use('/api/alerts', require('./routes/alerts'));
// Material系统路由
app.use('/api/materials', materialRoutes);
// Admin-specific routes for unified todo management (must be before general admin routes)
app.use('/api/admin/todos', require('./routes/todoRoutes'));
app.use('/api/admin/products', require('./routes/productRoutes'));
app.use('/api/admin/custom-flags', require('./routes/customFlagRoutes'));
app.use('/api/admin/ads', require('./routes/adRoutes'));
app.use('/api/admin/reports', require('./routes/reportRoutes'));
app.use('/api/admin/osm', require('./routes/adminOsmRoutes'));
app.use('/api/admin/events', require('./routes/admin/eventRoutes'));
app.use('/api/admin/regions', require('./routes/admin/regionRoutes'));
app.use('/api/admin/achievements', require('./routes/admin/achievementRoutes'));
app.use('/api/admin/challenges', require('./routes/admin/challengeRoutes'));
app.use('/api/admin/checkin', require('./routes/admin/checkinRoutes'));
app.use('/api/admin/payment', require('./routes/admin/paymentRoutes'));
app.use('/api/admin/alliances-mod', require('./routes/admin/allianceRoutes'));
app.use('/api/admin/feedback', require('./routes/admin/feedbackRoutes'));
app.use('/api/admin/system-alerts', require('./routes/admin/systemAlertRoutes'));
app.use('/api/admin/localization', require('./routes/admin/localizationRoutes'));
// General admin routes (must be after specific routes)
app.use('/api/admin', adminRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/alliances', allianceRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/store-payment', storePaymentRoutes);
app.use('/api/drift-bottles', require('./routes/driftBottleRoutes'));
app.use('/api/drift-bottles/performance', require('./routes/driftBottlePerformanceRoutes'));
app.use('/api/qr-treasures', require('./routes/qrTreasureRoutes'));
app.use('/api/history', require('./routes/historyRoutes'));
app.use('/api/payment', unifiedPaymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/feed', require('./routes/feedRoutes'));
app.use('/api/hashtags', require('./routes/hashtagRoutes'));
app.use('/api/stats', require('./routes/personalStatsRoutes'));
app.use('/api/stats', require('./routes/quickStatsRoutes'));
app.use('/api/daily-tasks', require('./routes/dailyTaskRoutes'));
app.use('/api/map-social', require('./routes/mapSocialRoutes'));
app.use('/api/map-notifications', require('./routes/mapNotificationRoutes'));
app.use('/api/treasure-chests', require('./routes/treasureChestRoutes'));
app.use('/api/profile', profileRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/advertisements', advertisementRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/private-messages', privateMessageRoutes);
app.use('/api/group-chats', groupChatRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/security', securityRoutes);

// 系统配置公开API（用于获取用户协议、隐私政策等）
app.use('/api/system-config', require('./routes/admin/systemConfig'));
// 客户端公共配置 (App Store links, etc)
app.use('/api/config', require('./routes/configRoutes'));
app.use('/api/pattern-bombs', patternBombRoutes);
app.use('/api/cosmetics', cosmeticRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/currency/achievements', require('./routes/achievementRoutes'));
app.use('/api/regions', regionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', systemMessageRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/share-image', shareImageRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/bomb', bombRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/pattern-uploads', patternUploadRoutes);
app.use('/api/images', require('./routes/imageUploadRoutes'));
app.use('/api/pattern-review', patternReviewRoutes);
app.use('/api/pixels-history', pixelsHistoryRoutes);
app.use('/api/custom-flags', require('./routes/customFlagRoutes'));
app.use('/api/pixels', pixelsBboxRoutes); // BBOX查询API
app.use('/api/timelapse', timelapseRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/push-notifications', pushNotificationRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/badges', require('./routes/badgeRoutes'));
app.use('/api/daily-reward', dailyRewardRoutes);

// Pixel info endpoint (optional authentication - guest users can view pixel info)
app.get('/api/pixels/:lat/:lng/info', optionalAuth, getPixelInfo);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/geographic', require('./routes/geographicRoutes'));
app.use('/api/geocoding', require('./routes/geocodingRoutes'));
// app.use('/api/tiles', tileRoutes); // 已删除Canvas瓦片系统
// app.use('/api/tiles/pixels', require('./routes/mvtTileRoutes')); // 旧MVT系统（已弃用）

// Production MVT and Sprite Routes
const productionMVTRoutes = require('./routes/productionMVTRoutes'); // PRODUCTION MVT + Sprite服务
app.use('/api/tiles/pixels', productionMVTRoutes);
app.use('/api/sprites', productionMVTRoutes);
app.use('/api/map', require('./routes/mapHeatmapRoutes')); // 热力图数据API
app.use('/api/map', secureMapAPIRoutes); // 安全地图API代理
app.use('/api/performance', require('./routes/performance'));
app.use('/api/drawing-sessions', require('./routes/drawingSessionRoutes'));
app.use('/api/session-heartbeat', require('./routes/sessionHeartbeatRoutes'));
app.use('/api/pixel-sessions', require('./routes/pixelSessionRoutes'));
app.use('/api/avatars', require('./routes/avatarRoutes'));
app.use('/api/debug', require('./routes/debugRoutes'));
app.use('/api/test', require('../scripts/tests/testAmapRoute'));
app.use('/api/battles', require('./routes/battleRoutes'));
app.use('/api/v1/localization', require('./routes/localizationRoutes'));
app.use('/api/rank-tiers', require('./routes/rankTierRoutes'));
app.use('/api/pixels-3d', require('./routes/pixel3DRoutes'));
app.use('/api/towers', require('./routes/towerRoutes')); // 🏗️  3D 像素塔 API

// 初始化WebSocket管理器
const socketManager = new SocketManager(io);
setSocketManager(socketManager);

// 初始化批量像素服务
const pixelBatchService = new PixelBatchService(socketManager);

// 初始化像素绘制服务
const pixelDrawService = new PixelDrawService(socketManager);

// 初始化排行榜维护服务
const leaderboardMaintenanceService = new LeaderboardMaintenanceService();
const geographicStatsMaintenanceService = new GeographicStatsMaintenanceService();

// 初始化地理编码服务
const geocodingService = require('./services/geocodingService');

// 初始化地区榜预加载服务
const regionLeaderboardPreloadService = require('./services/regionLeaderboardPreloadService');

// 初始化领土动态服务（战斗报告队列处理器，单例）
if (isPrimaryWorker) require('./services/battleReportService');

// 注意：MaxMind数据库更新器已移除，改用高德地图Web服务API

// 启动瓦片刷新Worker
const tileFlushWorker = require('./workers/tileFlushWorker');
tileFlushWorker.setSocketManager(socketManager);

// 启动瓦片渲染队列Worker（如果Redis可用）
const startTileRenderWorker = () => {
  // 检查是否使用真实Redis（非本地验证模式）
  if (process.env.LOCAL_VALIDATION === 'true') {
    logger.warn('⚠️ 本地验证模式 - 跳过瓦片渲染队列Worker启动');
    return;
  }

  // 检查是否有Upstash配置
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    logger.warn('⚠️ 检测到Upstash配置，但瓦片渲染队列需要标准Redis连接');
    return;
  }

  // 检查是否有传统Redis配置
  const hasRedisConfig = process.env.REDIS_HOST || process.env.REDIS_PORT || process.env.REDIS_PASSWORD;
  if (!hasRedisConfig) {
    logger.warn('⚠️ 未配置Redis - 跳过瓦片渲染队列Worker启动');
    return;
  }

  // 注意：已移除Canvas 2D瓦片渲染系统
  // 现在使用MapLibre GL + OFM架构，像素直接在客户端渲染
};

// 注意：已移除Canvas 2D瓦片渲染系统
// 现在使用MapLibre GL + OFM架构，像素直接在客户端渲染

// 设置PixelDrawService实例到路由
setPixelDrawService(pixelDrawService);

// 使用像素绘制路由
app.use('/api/pixel-draw', pixelDrawRoutes);

// 使用像素路由
app.use('/api/pixels', pixelRoutes);

// 使用MVT瓦片路由 - 仅保留生产级服务
// const mvtTileRoutes = require('./routes/mvtTileRoutes'); // 旧MVT系统（已弃用）
// const tileCompositionRoutes = require('./routes/tileCompositionRoutes'); // 旧Raster系统（已弃用）
// app.use('/api/tiles', mvtTileRoutes); // 已禁用
// app.use('/api/tiles', tileCompositionRoutes); // 已禁用

// 使用像素点赞路由
app.use('/api/pixels', pixelLikeRoutes);

// CSRF令牌端点
app.get('/api/csrf-token', (req, res) => {
  // 直接生成CSRF令牌，不依赖session
  const csrfToken = require('./middleware/security').generateCSRFToken();

  res.json({
    success: true,
    token: csrfToken
  });
});

// 为像素相关API添加可选认证中间件
app.use('/api/pixel', optionalAuth);
app.use('/api/pixels', optionalAuth);

// 像素点数配置
const PIXEL_POINTS_CONFIG = {
  MAX_POINTS: 64,
  INIT_POINTS: 64,
  ACCUM_INTERVAL: 10, // 10秒
  FREEZE_SECONDS: 10
};

// 用户状态管理
async function ensureUserState(userId) {
  return await UserPixelState.getOrCreate(userId);
}

async function updateUserPoints(userId) {
  const state = await UserPixelState.getOrCreate(userId);
  const now = Math.floor(Date.now() / 1000);

  // 检查冻结状态
  if (state.freeze_until > 0) {
    if (now >= state.freeze_until) {
      // 解冻，恢复1点自然累计
      const newNaturalPoints = Math.min(1, state.max_natural_pixel_points || 64);
      const totalPoints = (state.item_pixel_points || 0) + newNaturalPoints;

      return await UserPixelState.update(userId, {
        freeze_until: 0,
        natural_pixel_points: newNaturalPoints,
        pixel_points: totalPoints,
        last_accum_time: now
      });
    }
  } else {
    // 正常累计自然像素点数
    const timeDiff = now - state.last_accum_time;
    const accumCount = Math.floor(timeDiff / PIXEL_POINTS_CONFIG.ACCUM_INTERVAL);

    if (accumCount > 0) {
      const currentNaturalPoints = state.natural_pixel_points || state.pixel_points || 0;
      const maxNaturalPoints = state.max_natural_pixel_points || 64;
      const newNaturalPoints = Math.min(maxNaturalPoints, currentNaturalPoints + accumCount);
      const totalPoints = (state.item_pixel_points || 0) + newNaturalPoints;

      return await UserPixelState.update(userId, {
        natural_pixel_points: newNaturalPoints,
        pixel_points: totalPoints,
        last_accum_time: now
      });
    }
  }

  return state;
}

async function consumePoint(userId) {
  const result = await UserPixelState.consumePoint(userId);
  return result !== null;
}

// API 路由
app.post('/api/pixel/init', async (req, res) => {
  try {
    let userId = req.user ? req.user.id : req.body.userId;

    // 如果没有提供userId，生成一个新的UUID
    if (!userId) {
      userId = uuidv4();
      logger.info('生成新的用户ID', { userId });
    }

    logger.debug('初始化用户状态', { userId });

    // 对于游客用户，返回简化的状态
    if (userId.startsWith('guest_')) {
      logger.debug('游客用户，返回简化状态', { userId });
      res.json({
        success: true,
        userId,
        state: {
          user_id: userId,
          pixel_points: 0,
          last_accum_time: Math.floor(Date.now() / 1000),
          freeze_until: 0
        },
        config: PIXEL_POINTS_CONFIG,
        isGuest: true
      });
      return;
    }

    const state = await ensureUserState(userId);
    logger.info('用户状态创建成功', { userId, state });

    res.json({
      success: true,
      userId,
      state,
      config: PIXEL_POINTS_CONFIG,
      isGuest: false
    });
  } catch (error) {
    logger.error('初始化用户状态失败', { error: error.message, stack: error.stack });
    res.status(500).json({ error: '服务器内部错误', details: error.message });
  }
});

app.get('/api/pixel/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    logger.debug('获取用户状态', { userId });

    // 对于游客用户，返回简化的状态
    if (userId.startsWith('guest_')) {
      logger.debug('游客用户，返回简化状态', { userId });
      res.json({
        success: true,
        state: {
          user_id: userId,
          pixel_points: 0,
          last_accum_time: Math.floor(Date.now() / 1000),
          freeze_until: 0
        },
        canDraw: false,
        isGuest: true
      });
      return;
    }

    try {
      const state = await updateUserPoints(userId);
      logger.info('用户状态获取成功', { userId, state });

      res.json({
        success: true,
        state,
        canDraw: state.pixel_points > 0 && state.freeze_until === 0
      });
    } catch (userError) {
      logger.warn('用户不存在或数据库错误，返回默认状态', { userId, error: userError.message });

      // 如果用户不存在，返回默认状态而不是错误
      res.json({
        success: true,
        state: {
          user_id: userId,
          pixel_points: 0,
          last_accum_time: Math.floor(Date.now() / 1000),
          freeze_until: 0
        },
        canDraw: false,
        isNewUser: true
      });
    }
  } catch (error) {
    logger.error('获取用户状态失败', { error: error.message, stack: error.stack });

    // 返回更详细的错误信息用于调试
    res.status(500).json({
      error: '服务器内部错误',
      details: error.message,
      userId: req.params.userId
    });
  }
});

// 获取当前认证用户的状态
app.get('/api/pixel/status', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '需要认证' });
    }

    const state = await updateUserPoints(req.user.id);

    res.json({
      success: true,
      state,
      canDraw: state.pixel_points > 0 && state.freeze_until === 0
    });
  } catch (error) {
    logger.error('获取用户状态失败', { error: error.message });
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 像素相关API
app.post('/api/pixel', async (req, res) => {
  try {
    const {
      latitude: bodyLatitude,
      longitude: bodyLongitude,
      lat,
      lng,
      userId,
      gridId,
      patternId,
      patternAnchorX,
      patternAnchorY,
      patternRotation,
      patternMirror
    } = req.body;

    const latitude = bodyLatitude ?? lat;
    const longitude = bodyLongitude ?? lng;

    if (!latitude || !longitude || !userId || !gridId || !patternId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const pixel = await Pixel.createOrUpdate({
      gridId,
      latitude,
      longitude,
      userId,
      patternId,
      patternAnchorX,
      patternAnchorY,
      patternRotation,
      patternMirror,
      pixelType: 'basic', // API调用默认为basic类型
      relatedId: null
    });

    // 获取用户信息
    const user = await User.findById(userId);

    res.json({
      success: true,
      pixel: {
        ...pixel,
        username: user ? user.username : '未知用户'
      }
    });
  } catch (error) {
    logger.error('创建像素失败', { error: error.message });
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/pixels/batch',
  apiLimiter,
  async (req, res) => {
    try {
      const { gridIds } = req.body;

      logger.debug('收到批量获取像素请求', { gridIdsCount: gridIds.length });

      // 输入验证
      if (!gridIds) {
        logger.warn('批量获取像素: gridIds参数缺失');
        return res.json({});
      }

      if (!Array.isArray(gridIds)) {
        logger.warn('批量获取像素: gridIds不是数组');
        return res.json({});
      }

      if (gridIds.length === 0) {
        logger.debug('批量获取像素: gridIds为空数组');
        return res.json({});
      }

      // 限制批量查询的大小，防止过大的请求
      if (gridIds.length > 1000) {
        logger.warn('批量获取像素: gridIds数量过多，限制为1000个', { originalCount: gridIds.length });
        gridIds.splice(1000);
      }

      // 使用批量服务查询像素
      const pixels = await PixelBatchService.batchGetPixels(gridIds);
      res.json(pixels);
    } catch (error) {
      logger.error('批量获取像素失败', { error: error.message });

      // 记录安全事件
      try {
        await securityMonitor.logSuspiciousActivity(req.ip, req.user?.id, `批量像素查询失败: ${error.message}`);
      } catch (securityError) {
        logger.error('安全监控记录失败', { error: securityError.message });
      }

      // 返回空结果而不是500错误，避免前端崩溃
      res.json({});
    }
  }
);

// 🎨 获取pattern_assets批量数据
app.post('/api/pattern-assets/batch',
  apiLimiter,
  async (req, res) => {
    try {
      const { keys } = req.body;

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return res.json({});
      }

      // 限制批量查询大小
      const limitedKeys = keys.slice(0, 1000);

      logger.debug(`批量获取pattern_assets: ${limitedKeys.length}个`);

      const patterns = await db('pattern_assets')
        .whereIn('key', limitedKeys)
        .andWhere('deleted_at', null)
        .select('key', 'name', 'render_type', 'color', 'unicode_char', 'file_url', 'file_path', 'image_url', 'category');

      // 转换为key索引的对象
      const result = {};
      patterns.forEach(pattern => {
        result[pattern.key] = pattern;
      });

      logger.debug(`返回 ${Object.keys(result).length} 个pattern_assets`);
      res.json(result);

    } catch (error) {
      logger.error('批量获取pattern_assets失败:', error);
      res.json({});
    }
  }
);

app.get('/api/pixel', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    // 使用相同的网格算法
    const gridId = calculateGridId(lat, lng);

    const pixel = await Pixel.findByGridId(gridId);

    if (pixel) {
      // 获取用户信息
      const user = await User.findById(pixel.user_id);

      res.json({
        ...pixel,
        username: user ? user.username : '未知用户'
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    logger.error('获取像素失败', { error: error.message });
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/pixel/reset/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const newState = await UserPixelState.update(userId, {
      pixel_points: PIXEL_POINTS_CONFIG.INIT_POINTS,
      last_accum_time: Math.floor(Date.now() / 1000),
      freeze_until: 0
    });

    res.json({ success: true, state: newState });
  } catch (error) {
    logger.error('重置用户状态失败', { error: error.message });
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/pixels/all', async (req, res) => {
  try {
    // 获取所有像素（注意：这可能会很慢，建议分页）
    const pixels = await db('pixels').select('*');
    const pixelMap = {};

    pixels.forEach(pixel => {
      pixelMap[pixel.grid_id] = pixel;
    });

    res.json(pixelMap);
  } catch (error) {
    logger.error('获取所有像素失败', { error: error.message });
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 清理不活跃用户（可选）
app.post('/api/admin/cleanup', async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const inactiveThreshold = 3600; // 1小时

    // 清理不活跃的用户状态
    await db('user_pixel_states')
      .where('last_accum_time', '<', now - inactiveThreshold)
      .del();

    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    logger.error('清理失败', { error: error.message });
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 数据库健康检查
app.get('/api/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      database: 'unknown',
      redis: 'unknown',
      timestamp: new Date().toISOString()
    };

    // 检查数据库连接
    try {
      await db.raw('SELECT 1');
      healthStatus.database = 'connected';
    } catch (dbError) {
      logger.error('数据库连接失败', { error: dbError.message });
      healthStatus.database = 'disconnected';
      healthStatus.status = 'unhealthy';
    }

    // 检查Redis连接
    if (redis) {
      try {
        await redis.ping();
        healthStatus.redis = 'connected';
      } catch (redisError) {
        logger.error('Redis连接失败', { error: redisError.message });
        healthStatus.redis = 'disconnected';
        // Redis 连接失败不影响整体健康状态
      }
    } else {
      healthStatus.redis = 'not_initialized';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('健康检查失败', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Redis 详细健康检查端点
app.get('/api/health/redis', async (req, res) => {
  try {
    const redisStatus = await getHealthStatus();
    const statusCode = redisStatus.connected ? 200 : 503;
    res.status(statusCode).json(redisStatus);
  } catch (error) {
    logger.error('Redis健康检查失败', { error: error.message });
    res.status(503).json({
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', prometheusMetrics.register.contentType);
    const metrics = await prometheusMetrics.register.metrics();
    res.send(metrics);
  } catch (error) {
    logger.error('Prometheus metrics failed', { error: error.message });
    res.status(500).send(error.message);
  }
});

// 简单的健康检查端点（用于 Railway）
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket 连接处理
io.on('connection', (socket) => {
  logger.info('WebSocket客户端连接', { socketId: socket.id });

  socket.on('disconnect', () => {
    logger.info('WebSocket客户端断开连接', { socketId: socket.id });
  });

  // 可以添加更多 WebSocket 事件处理
});

// 错误处理中间件（必须在所有路由之后）
app.use(errorHandler);

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务器');

  try {
    // 关闭WebSocket服务
    await socketManager.gracefulShutdown();

    // 刷新所有批量队列
    await pixelBatchService.flushAll();

    // 关闭 Redis 连接
    await closeRedis();

    // 关闭数据库连接
    await db.destroy();

    server.close(() => {
      logger.info('服务器已关闭');
      process.exit(0);
    });
  } catch (error) {
    logger.error('关闭服务器时出错', { error: error.message });
    process.exit(1);
  }
});

// 启动服务器
const PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// 🔧 关键修复：iOS模拟器需要访问后端服务，必须监听0.0.0.0而不是127.0.0.1
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, async () => {
  logger.info(`🚀 HTTP 服务器启动成功${isClusterMode ? ` [Worker ${workerId}/${process.env.CLUSTER_WORKERS}]` : ''}`, {
    host: HOST,
    port: PORT,
    ...(isClusterMode && { worker: workerId, role: isPrimaryWorker ? 'primary' : 'worker' }),
    apiUrl: `http://localhost:${PORT}`,
    websocketUrl: `ws://localhost:${PORT}`,
    healthCheckUrl: `http://localhost:${PORT}/api/health`
  });
  if (!isClusterMode) logger.info('📱 iOS模拟器可以通过localhost或Mac的IP地址访问服务器');

  // 初始化Redis连接
  try {
    const redisClients = await initializeRedis();
    redis = redisClients.redis;
    subscriber = redisClients.subscriber;

    if (redis) {
      logger.info('✅ Redis 已就绪');

      // OPTIMIZATION: Set up Redis adapter for Socket.IO horizontal scaling
      // This requires @socket.io/redis-adapter package: npm install @socket.io/redis-adapter
      try {
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = redis;
        const subClient = subscriber;

        if (pubClient && subClient) {
          io.adapter(createAdapter(pubClient, subClient));
          logger.info('✅ Socket.IO Redis adapter 已启用 (支持多节点横向扩展)');
        }
      } catch (adapterError) {
        if (adapterError.code === 'MODULE_NOT_FOUND') {
          logger.warn('⚠️ Socket.IO Redis adapter 未安装，单节点运行');
          logger.warn('   安装方法: npm install @socket.io/redis-adapter');
        } else {
          logger.error('❌ Socket.IO Redis adapter 初始化失败:', adapterError.message);
        }
      }

      // 在 Redis 可用后才启动预加载服务（单例，仅主worker）
      if (isPrimaryWorker) {
        // 🎁 Initialize Treasure Spawn Service
        try {
          TreasureSpawnService.initializeScheduledSpawning();
          logger.info('✅ 宝箱自动刷新服务已启动');
        } catch (treasureError) {
          logger.error('❌ 宝箱服务启动失败（不影响主服务）:', treasureError);
        }

        try {
          regionLeaderboardPreloadService.start();
          logger.info('地区榜数据预加载服务已启动');
        } catch (preloadError) {
          logger.error('启动地区榜数据预加载服务失败', {
            message: preloadError.message
          });
        }
      }
    } else {
      logger.warn('⚠️  Redis 未连接，部分功能可能不可用（跳过预加载服务）');
    }
  } catch (redisError) {
    logger.error('❌ Redis 初始化失败', {
      error: redisError.message,
      note: '开发环境可继续运行，但某些功能将不可用'
    });
  }

  // 初始化 pattern_assets 内存缓存（消除 BBOX LEFT JOIN）
  try {
    const patternAssetsCache = require('./services/patternAssetsCacheService');
    await patternAssetsCache.init();
    logger.info(`✅ pattern_assets 内存缓存已加载 (${patternAssetsCache.size} 条)`);
  } catch (cacheError) {
    logger.error('❌ pattern_assets 缓存初始化失败:', cacheError.message);
  }

  // 初始化奖励参数配置缓存
  try {
    const rewardConfigService = require('./services/rewardConfigService');
    await rewardConfigService.init();
  } catch (rcError) {
    logger.error('❌ 奖励参数配置缓存初始化失败:', rcError.message);
  }

  // 初始化活动像素日志监听器（自动记录像素到活动）
  try {
    eventPixelLogListener.initialize();
    logger.info('✅ 活动像素日志监听器已启动 - 像素将自动记录到活动');
  } catch (eventListenerError) {
    logger.error('❌ 活动像素日志监听器启动失败:', eventListenerError.message);
  }

  // 注册定时任务（仅主worker执行）
  if (isPrimaryWorker) {
    try {
      const { registerScheduledTasks } = require('./tasks/scheduledTasks');
      registerScheduledTasks();
      logger.info('✅ 定时任务已注册（账户删除维护）');
    } catch (scheduledTaskError) {
      logger.error('❌ 定时任务注册失败:', scheduledTaskError.message);
    }
  }

  // Background warmup: load all pixels into Redis GEO for GEOSEARCH-based BBOX queries
  if (isPrimaryWorker && redis) {
    (async () => {
      try {
        const { c } = await db('pixels').whereNotNull('longitude').count('* as c').first();
        const total = parseInt(c);
        logger.info(`Warming up Redis GEO cache (${total} pixels)...`);

        let loaded = 0, lastId = 0;
        const CHUNK = 10000;

        while (true) {
          const rows = await db('pixels')
            .where('id', '>', lastId)
            .whereNotNull('longitude').whereNotNull('latitude')
            .select('id', 'grid_id', 'longitude', 'latitude', 'pattern_id')
            .orderBy('id', 'asc').limit(CHUNK);

          if (rows.length === 0) break;

          const multi = redis.multi();
          for (const row of rows) {
            multi.geoAdd('pixels:geo', {
              longitude: parseFloat(row.longitude),
              latitude: parseFloat(row.latitude),
              member: row.grid_id
            });
            multi.hSet('pixels:meta', row.grid_id, row.pattern_id || '');
          }
          await multi.exec();

          lastId = rows[rows.length - 1].id;
          loaded += rows.length;
          if (loaded % 50000 === 0) logger.info(`  Redis GEO warmup: ${loaded}/${total} pixels loaded`);
        }

        logger.info(`Redis GEO cache warmup complete: ${loaded} pixels`);
      } catch (err) {
        logger.error('Redis GEO cache warmup failed:', err.message);
      }
    })();
  }

  // 初始化WebSocket服务器（瓦片更新通知）
  tileUpdateHandler.initialize(server);
  tileUpdateHandler.startHeartbeat();
  logger.info('✅ WebSocket瓦片更新服务已启动', {
    path: '/ws/tile-updates'
  });

  // Start geocoding queue for async background processing (singleton)
  if (isPrimaryWorker) {
    try {
      const geocodingQueue = require('./services/geocodingQueue');
      geocodingQueue.start();
      logger.info('✅ 地理编码后台队列已启动');
    } catch (geoQueueError) {
      logger.error('❌ 地理编码队列启动失败:', geoQueueError.message);
    }
  }

  // 如果启用了 HTTPS，也启动 HTTPS 服务器
  if (httpsServer) {
    httpsServer.listen(HTTPS_PORT, HOST, () => {
      logger.info('🔒 HTTPS 服务器启动成功', {
        host: HOST,
        port: HTTPS_PORT,
        apiUrl: `https://localhost:${HTTPS_PORT}`,
        websocketUrl: `wss://localhost:${HTTPS_PORT}`,
        healthCheckUrl: `https://localhost:${HTTPS_PORT}/api/health`,
        note: '使用自签名证书，仅用于开发环境（如抖音小游戏）'
      });

      // 初始化HTTPS WebSocket服务器
      const httpsWsHandler = require('./websocket/tileUpdateHandler');
      // Note: 使用同一个handler实例，它会处理两个服务器的WebSocket连接
      logger.info('✅ HTTPS WebSocket服务已启动（共享HTTP WebSocket handler）');
    });
  }

  // 自动运行数据库迁移
  try {
    logger.info('开始自动数据库迁移');

    // 首先测试数据库连接
    logger.debug('测试数据库连接');
    const connectionTest = await db.raw('SELECT NOW() as current_time');
    logger.info('数据库连接成功', { currentTime: connectionTest.rows[0] });

    // 检查是否有待运行的迁移
    const migrations = await db.migrate.list();
    logger.info('迁移状态', {
      completed: migrations[0].length,
      pending: migrations[1].length
    });

    if (migrations[1].length > 0) {
      logger.info('发现待运行的迁移，开始执行');
      const [batchNo, log] = await db.migrate.latest();
      logger.info('迁移完成', { batchNo, migrations: log });
    } else {
      logger.info('所有迁移已完成');
    }

    // 检查数据库表状态
    logger.debug('检查数据库表状态');

    // 检查 users 表是否存在
    const usersTableExists = await db.schema.hasTable('users');
    logger.info('users 表检查', { exists: usersTableExists });

    if (!usersTableExists) {
      logger.warn('users 表不存在，迁移可能失败');
    } else {
      logger.info('users 表已存在，迁移成功');

      // 检查其他重要表
      const tables = ['pixels', 'chat_messages', 'alliances', 'store_items', 'pattern_assets'];
      for (const table of tables) {
        const exists = await db.schema.hasTable(table);
        logger.debug(`${table} 表检查`, { exists });
      }

      // 检查pattern_assets表的数据
      const patternAssetsExists = await db.schema.hasTable('pattern_assets');
      if (patternAssetsExists) {
        const patternCount = await db('pattern_assets').count('* as count').first();
        logger.info('pattern_assets 表数据量', { count: patternCount.count });

        if (parseInt(patternCount.count) === 0) {
          logger.warn('pattern_assets 表为空，需要运行种子数据', { suggestion: 'npm run seed' });
        }
      }
    }

    // 🔧 Cluster: 单例定时服务仅在主worker运行
    if (isPrimaryWorker) {
      // 启动排行榜维护服务
      try {
        leaderboardMaintenanceService.start();
        logger.info('排行榜维护服务已启动');
      } catch (leaderboardError) {
        logger.error('启动排行榜维护服务失败', {
          message: leaderboardError.message
        });
      }

      // 启动地理统计维护服务
      try {
        geographicStatsMaintenanceService.start();
        logger.info('地理统计维护服务已启动');
      } catch (geographicError) {
        logger.error('启动地理统计维护服务失败', {
          message: geographicError.message
        });
      }

      // 启动漂流瓶自动漂流服务
      try {
        driftBottleService.start();
        logger.info('🌊 漂流瓶自动漂流服务已启动');
      } catch (driftBottleError) {
        logger.error('启动漂流瓶服务失败', {
          message: driftBottleError.message
        });
      }

      // 启动每日排名奖励结算服务
      try {
        const dailyRewardService = new DailyRewardService();
        dailyRewardService.start();
        logger.info('🏆 每日排名奖励结算服务已启动');
      } catch (dailyRewardError) {
        logger.error('启动每日排名奖励结算服务失败', {
          message: dailyRewardError.message
        });
      }
    } // end isPrimaryWorker block 1

    // 初始化地理编码服务
    try {
      await geocodingService.initializeServices();
      logger.info('地理编码服务已启动');
    } catch (geocodingError) {
      logger.error('启动地理编码服务失败', {
        message: geocodingError.message
      });
    }

    // 启动像素历史队列处理服务（单例）
    if (isPrimaryWorker) {
      try {
        const pixelsHistoryService = require('./services/pixelsHistoryService');
        pixelsHistoryService.startQueueProcessor();
        logger.info('像素历史队列处理服务已启动');
      } catch (historyError) {
        logger.error('启动像素历史队列处理服务失败', {
          message: historyError.message
        });
      }
    }

    // 启动MaxMind数据库自动更新服务
    try {
      // 数据库更新器会在初始化时自动启动定时任务
      logger.info('MaxMind数据库自动更新服务已启动');
    } catch (updaterError) {
      logger.error('启动MaxMind数据库更新服务失败', {
        message: updaterError.message
      });
    }

    // ✅ 新增：预加载256色Pattern到内存缓存
    try {
      const AdPixelRenderer = require('./services/AdPixelRenderer');
      const patternCount = await AdPixelRenderer.preload256Patterns();
      logger.info('256色Pattern预加载完成', { count: patternCount });
    } catch (patternError) {
      logger.error('预加载256色Pattern失败', {
        message: patternError.message
      });
    }

    // 🔧 Cluster: 定时任务仅在主worker运行
    if (isPrimaryWorker) {
      // 启动广告定时投放服务
      try {
        const adSchedulingService = require('./services/adSchedulingService');
        adSchedulingService.start();
        logger.info('广告定时投放服务已启动');
      } catch (adSchedulingError) {
        logger.error('启动广告定时投放服务失败', {
          message: adSchedulingError.message
        });
      }

      // 启动每日漂流瓶配额重置任务
      try {
        const { startDailyQuotaResetTask } = require('./tasks/resetDailyBottleQuota');
        startDailyQuotaResetTask();
        logger.info('每日漂流瓶配额重置任务已启动');
      } catch (quotaResetError) {
        logger.error('启动配额重置任务失败', {
          message: quotaResetError.message
        });
      }

      // 🆕 P0功能：启动每日任务重置定时任务
      try {
        const { startDailyTaskResetJob } = require('./tasks/resetDailyTasks');
        startDailyTaskResetJob();
        logger.info('✅ 每日任务重置定时任务已启动');
      } catch (taskResetError) {
        logger.error('❌ 启动每日任务重置任务失败', {
          message: taskResetError.message
        });
      }

      // P1-4: 启动排名快照定时任务
      try {
        const { startRankingSnapshotTasks } = require('./tasks/saveRankingSnapshots');
        startRankingSnapshotTasks();
        logger.info('排名快照定时任务已启动');
      } catch (snapshotError) {
        logger.error('启动排名快照任务失败', {
          message: snapshotError.message
        });
      }

      // 启动积分余额对账定时任务
      try {
        const { startPointsReconciliationTask } = require('./tasks/reconcilePointsBalance');
        startPointsReconciliationTask();
        logger.info('✅ 积分余额对账定时任务已启动');
      } catch (reconcileError) {
        logger.error('❌ 启动积分余额对账任务失败', {
          message: reconcileError.message
        });
      }

      // 启动领地控制变更检测服务（World State Feed数据源）
      try {
        const territoryControlService = require('./services/territoryControlService');
        territoryControlService.start();
        logger.info('领地控制变更检测服务已启动');
      } catch (territoryError) {
        logger.error('启动领地控制变更检测服务失败', {
          message: territoryError.message
        });
      }

      // 启动世界状态Feed数据服务（定期生成区域活跃度和联盟动态事件）
      try {
        const worldStateFeedService = require('./services/worldStateFeedService');
        worldStateFeedService.start();
        logger.info('世界状态Feed数据服务已启动');
      } catch (worldStateError) {
        logger.error('启动世界状态Feed数据服务失败', {
          message: worldStateError.message
        });
      }
    } // end isPrimaryWorker block 2

  } catch (dbError) {
    logger.error('数据库迁移或检查失败', {
      message: dbError.message,
      code: dbError.code,
      detail: dbError.detail,
      hint: dbError.hint
    });

    // 如果是连接错误，显示更多调试信息
    if (dbError.code === 'ECONNREFUSED') {
      logger.error('连接被拒绝，可能的原因', {
        reasons: [
          '数据库服务器未运行',
          '数据库主机地址错误',
          '数据库端口错误',
          '防火墙阻止连接',
          '环境变量未正确设置'
        ]
      });
    }
  }
});


