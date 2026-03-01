const performanceService = require('../services/driftBottlePerformanceService');
const cacheService = require('../services/driftBottleCacheService');
const logger = require('../utils/logger');

/**
 * 漂流瓶性能监控控制器
 * 提供性能监控、健康检查和系统优化接口
 */
class DriftBottlePerformanceController {
  /**
   * 获取性能报告
   */
  static async getPerformanceReport(req, res) {
    try {
      const report = performanceService.getPerformanceReport();

      res.json({
        success: true,
        data: { report }
      });

    } catch (error) {
      logger.error('获取性能报告失败:', error);
      res.status(500).json({
        success: false,
        message: '获取性能报告失败',
        error: error.message
      });
    }
  }

  /**
   * 获取系统健康状态
   */
  static async getHealthStatus(req, res) {
    try {
      const health = performanceService.getHealthStatus();

      // 检查Redis连接
      const { redis } = require('../config/redis');
      const redisStatus = await redis.ping().catch(() => 'DISCONNECTED');
      health.redisConnected = redisStatus === 'PONG';

      // 检查数据库连接
      const { db } = require('../config/database');
      const dbStatus = await db.raw('SELECT 1').then(() => 'CONNECTED').catch(() => 'DISCONNECTED');
      health.databaseConnected = dbStatus === 'CONNECTED';

      // 总体状态
      health.overallHealthy = health.healthy && health.redisConnected && health.databaseConnected;

      const statusCode = health.overallHealthy ? 200 : 503;

      res.status(statusCode).json({
        success: health.overallHealthy,
        data: { health }
      });

    } catch (error) {
      logger.error('获取健康状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取健康状态失败',
        error: error.message
      });
    }
  }

  /**
   * 手动调整系统性能
   */
  static async optimizeSystem(req, res) {
    try {
      const { action } = req.body;

      switch (action) {
        case 'auto_adjust':
          performanceService.autoAdjust();
          break;

        case 'enable_degradation':
          const { mode = 'cache_only' } = req.body;
          performanceService.enableDegradation(mode);
          break;

        case 'disable_degradation':
          performanceService.disableDegradation();
          break;

        case 'reset_circuit_breaker':
          performanceService.closeCircuitBreaker();
          break;

        case 'clear_cache':
          await cacheService.clearAllCache();
          break;

        case 'warmup_cache':
          const { bottleIds = [] } = req.body;
          await cacheService.warmupCache(bottleIds);
          break;

        default:
          return res.status(400).json({
            success: false,
            message: '不支持的操作',
            supportedActions: [
              'auto_adjust',
              'enable_degradation',
              'disable_degradation',
              'reset_circuit_breaker',
              'clear_cache',
              'warmup_cache'
            ]
          });
      }

      // 返回优化后的状态
      const health = performanceService.getHealthStatus();

      res.json({
        success: true,
        message: `操作 "${action}" 执行成功`,
        data: {
          action,
          health
        }
      });

      logger.info('系统优化操作执行', { action, userId: req.user?.id });

    } catch (error) {
      logger.error('系统优化失败:', error);
      res.status(500).json({
        success: false,
        message: '系统优化失败',
        error: error.message
      });
    }
  }

  /**
   * 获取缓存统计信息
   */
  static async getCacheStats(req, res) {
    try {
      const cacheStats = await cacheService.getCacheStats();
      const performanceMetrics = performanceService.metrics;

      res.json({
        success: true,
        data: {
          cache: cacheStats,
          performance: performanceMetrics,
          hitRate: performanceService.getCacheHitRate(),
          avgResponseTime: performanceService.getAverageResponseTime()
        }
      });

    } catch (error) {
      logger.error('获取缓存统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取缓存统计失败',
        error: error.message
      });
    }
  }

  /**
   * 重置性能指标
   */
  static async resetMetrics(req, res) {
    try {
      performanceService.resetMetrics();

      res.json({
        success: true,
        message: '性能指标已重置'
      });

      logger.info('性能指标已重置', { userId: req.user?.id });

    } catch (error) {
      logger.error('重置性能指标失败:', error);
      res.status(500).json({
        success: false,
        message: '重置性能指标失败',
        error: error.message
      });
    }
  }

  /**
   * 获取熔断器状态
   */
  static async getCircuitBreakerStatus(req, res) {
    try {
      const circuitBreaker = performanceService.circuitBreaker;

      res.json({
        success: true,
        data: { circuitBreaker }
      });

    } catch (error) {
      logger.error('获取熔断器状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取熔断器状态失败',
        error: error.message
      });
    }
  }

  /**
   * 手动测试熔断器
   */
  static async testCircuitBreaker(req, res) {
    try {
      const { action } = req.body;

      switch (action) {
        case 'trigger':
          // 模拟连续失败来触发熔断器
          for (let i = 0; i < performanceService.circuitBreaker.failureThreshold; i++) {
            performanceService.recordFailure();
          }
          performanceService.checkCircuitBreaker();
          break;

        case 'reset':
          performanceService.closeCircuitBreaker();
          break;

        default:
          return res.status(400).json({
            success: false,
            message: '不支持的操作',
            supportedActions: ['trigger', 'reset']
          });
      }

      const status = performanceService.circuitBreaker;

      res.json({
        success: true,
        message: `熔断器测试 "${action}" 执行成功`,
        data: { status }
      });

      logger.info('熔断器测试操作', { action, userId: req.user?.id });

    } catch (error) {
      logger.error('熔断器测试失败:', error);
      res.status(500).json({
        success: false,
        message: '熔断器测试失败',
        error: error.message
      });
    }
  }

  /**
   * 获取降级策略状态
   */
  static async getDegradationStatus(req, res) {
    try {
      const degradation = performanceService.degradation;

      res.json({
        success: true,
        data: { degradation }
      });

    } catch (error) {
      logger.error('获取降级策略状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取降级策略状态失败',
        error: error.message
      });
    }
  }

  /**
   * 获取性能趋势数据
   */
  static async getPerformanceTrends(req, res) {
    try {
      const { hours = 24 } = req.query;

      // 这里可以从数据库或日志中获取历史趋势数据
      // 暂时返回模拟数据
      const trends = {
        timeRange: `${hours} hours`,
        data: {
          responseTime: [],
          cacheHitRate: [],
          errorRate: [],
          throughput: []
        }
      };

      res.json({
        success: true,
        data: { trends }
      });

    } catch (error) {
      logger.error('获取性能趋势失败:', error);
      res.status(500).json({
        success: false,
        message: '获取性能趋势失败',
        error: error.message
      });
    }
  }
}

module.exports = DriftBottlePerformanceController;