/**
 * HTTPS开发服务器
 * 仅用于抖音小游戏开发（抖音要求HTTPS）
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 统一环境配置加载
const { loadEnvConfig } = require('./config/env');
loadEnvConfig();
const logger = require('./utils/logger');

// 创建自签名证书（如果不存在）
const certDir = path.join(__dirname, '../certs');
const keyPath = path.join(certDir, 'server.key');
const certPath = path.join(certDir, 'server.cert');

function generateSelfSignedCert() {
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    logger.info('生成自签名证书...');

    try {
      // 使用OpenSSL生成自签名证书
      execSync(
        `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=CN/ST=State/L=City/O=FunnyPixels/CN=localhost"`,
        { stdio: 'inherit' }
      );
      logger.info('✅ 证书生成成功');
    } catch (error) {
      logger.error('❌ 证书生成失败，请确保已安装 OpenSSL');
      logger.info('Windows用户可以下载: https://slproweb.com/products/Win32OpenSSL.html');
      logger.info('或使用 Git Bash 运行此脚本');
      process.exit(1);
    }
  }
}

// 生成证书
generateSelfSignedCert();

// 导入原始的app
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// CORS配置 - 允许抖音小游戏访问
app.use(cors({
  origin: true, // 开发环境允许所有源
  credentials: true
}));

// 安全headers
app.use(helmet({
  contentSecurityPolicy: false // 开发环境禁用CSP
}));

// JSON解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: '请求过于频繁，请稍后再试'
});
app.use(limiter);

// 导入路由
const authRoutes = require('./routes/auth');
const pixelRoutes = require('./routes/pixelRoutes');
const allianceRoutes = require('./routes/allianceRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/pixels', pixelRoutes);
app.use('/api/alliances', allianceRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', protocol: 'https' });
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 读取证书
const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

// 创建HTTPS服务器
const PORT = process.env.HTTPS_PORT || 3443;
const server = https.createServer(httpsOptions, app);

server.listen(PORT, () => {
  logger.info(`🔒 HTTPS服务器运行在 https://127.0.0.1:${PORT}`);
  logger.info(`⚠️ 使用自签名证书，仅用于开发环境`);
  logger.info(`📱 抖音开发者工具需要允许不安全的本地连接`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    logger.info('HTTPS服务器已关闭');
    process.exit(0);
  });
});
