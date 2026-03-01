// Logger 使用示例
import logger from './logger.js';

// 示例 1: 基本用法
export function basicUsage() {
  logger.info('用户登录成功', { userId: 123, username: 'testuser' });
  logger.warn('Redis 连接超时', { host: 'localhost', port: 6379 });
  logger.error('数据库查询失败', { error: 'Connection timeout', query: 'SELECT * FROM users' });
}

// 示例 2: 像素绘制相关日志
export function pixelDrawLogging(userId, pixelId, color) {
  logger.debug('进入像素绘制逻辑', { userId, pixelId });
  logger.info('用户完成绘制', { userId, pixelId, color });
  logger.warn('Redis 缓存未命中', { key: `pixel:${pixelId}` });
}

// 示例 3: 错误处理日志
export function errorHandlingLogging(error, context) {
  logger.error('像素写入数据库失败', { 
    error: error.message, 
    stack: error.stack,
    context 
  });
}

// 示例 4: 性能监控日志
export function performanceLogging(operation, duration, metadata) {
  if (duration > 1000) {
    logger.warn('操作耗时过长', { operation, duration, metadata });
  } else {
    logger.debug('操作完成', { operation, duration, metadata });
  }
}

// 示例 5: 安全相关日志
export function securityLogging(event, details) {
  logger.warn('安全事件', { event, details, timestamp: new Date().toISOString() });
}
