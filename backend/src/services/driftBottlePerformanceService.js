const logger = require('../utils/logger');
const cacheService = require('./driftBottleCacheService');

/**
 * 漂流瓶性能监控和降级服务
 * 提供缓存性能监控、熔断机制和降级策略
 */
class DriftBottlePerformanceService {
  static getInstance() {
    if (!DriftBottlePerformanceService.instance) {
      DriftBottlePerformanceService.instance = new DriftBottlePerformanceService();
    }
    return DriftBottlePerformanceService.instance;
  }

  constructor() {
    // 性能监控配置
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheErrors: 0,
      dbQueries: 0,
      dbErrors: 0,
      responseTime: [],
      errorRate: 0,
      lastErrorTime: null
    };

    // 熔断器配置
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0,
      failureThreshold: 5,
      resetTimeout: 30000, // 30秒
      nextAttemptTime: 0,
      state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
    };

    // 降级策略配置
    this.degradation = {
      enabled: false,
      cacheOnlyMode: false,
      reducedTTL: false,
      batchSize: 10,
      timeoutMs: 5000
    };

    // 性能阈值
    this.thresholds = {
      responseTime: 2000, // 2秒
      errorRate: 0.1, // 10%
      cacheHitRate: 0.5 // 50%
    };

    // 定期重置计数器
    this.resetMetricsInterval = setInterval(() => {
      this.resetMetrics();
    }, 300000); // 5分钟重置一次
  }

  /**
   * 包装缓存操作，添加性能监控
   */
  async withCacheMonitoring(operation, operationName, fallbackOperation = null) {
    const startTime = Date.now();

    try {
      // 检查熔断器状态
      if (this.isCircuitBreakerOpen()) {
        logger.warn('熔断器开启，跳过缓存操作', { operationName });
        if (fallbackOperation) {
          return await fallbackOperation();
        }
        throw new Error('服务暂时不可用');
      }

      const result = await operation();

      // 记录成功指标
      this.recordSuccess(startTime);
      this.metrics.cacheHits++;

      return result;

    } catch (error) {
      // 记录失败指标
      this.recordFailure();
      this.metrics.cacheErrors++;

      // 检查是否需要开启熔断器
      this.checkCircuitBreaker();

      // 执行降级策略
      if (this.degradation.enabled && fallbackOperation) {
        logger.warn('执行降级策略', { operationName, error: error.message });
        return await fallbackOperation();
      }

      throw error;
    }
  }

  /**
   * 包装数据库操作，添加性能监控
   */
  async withDatabaseMonitoring(operation, operationName) {
    const startTime = Date.now();

    try {
      const result = await operation();

      // 记录成功指标
      this.recordSuccess(startTime);
      this.metrics.dbQueries++;

      return result;

    } catch (error) {
      // 记录失败指标
      this.recordFailure();
      this.metrics.dbErrors++;

      logger.error('数据库操作失败', {
        operationName,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * 记录成功操作
   */
  recordSuccess(startTime) {
    const responseTime = Date.now() - startTime;
    this.metrics.responseTime.push(responseTime);

    // 只保留最近100次的响应时间
    if (this.metrics.responseTime.length > 100) {
      this.metrics.responseTime.shift();
    }
  }

  /**
   * 记录失败操作
   */
  recordFailure() {
    this.metrics.lastErrorTime = new Date();

    // 更新错误率（基于最近的操作）
    const totalOperations = this.metrics.cacheHits + this.metrics.cacheMisses + this.metrics.dbQueries;
    if (totalOperations > 0) {
      this.metrics.errorRate = (this.metrics.cacheErrors + this.metrics.dbErrors) / totalOperations;
    }
  }

  /**
   * 检查熔断器是否应该开启
   */
  checkCircuitBreaker() {
    if (this.metrics.failureCount >= this.circuitBreaker.failureThreshold) {
      this.openCircuitBreaker();
    }
  }

  /**
   * 开启熔断器
   */
  openCircuitBreaker() {
    this.circuitBreaker.isOpen = true;
    this.circuitBreaker.state = 'OPEN';
    this.circuitBreaker.nextAttemptTime = Date.now() + this.circuitBreaker.resetTimeout;

    logger.warn('熔断器已开启', {
      failureCount: this.metrics.failureCount,
      threshold: this.circuitBreaker.failureThreshold,
      resetTimeout: this.circuitBreaker.resetTimeout
    });
  }

  /**
   * 关闭熔断器
   */
  closeCircuitBreaker() {
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.state = 'CLOSED';
    this.circuitBreaker.failureCount = 0;

    logger.info('熔断器已关闭');
  }

  /**
   * 检查熔断器是否开启
   */
  isCircuitBreakerOpen() {
    if (this.circuitBreaker.state === 'OPEN') {
      if (Date.now() >= this.circuitBreaker.nextAttemptTime) {
        this.circuitBreaker.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * 启用降级模式
   */
  enableDegradation(mode = 'cache_only') {
    this.degradation.enabled = true;

    switch (mode) {
      case 'cache_only':
        this.degradation.cacheOnlyMode = true;
        break;
      case 'reduced_ttl':
        this.degradation.reducedTTL = true;
        break;
      default:
        this.degradation.cacheOnlyMode = true;
    }

    logger.warn('降级模式已启用', { mode });
  }

  /**
   * 禁用降级模式
   */
  disableDegradation() {
    this.degradation.enabled = false;
    this.degradation.cacheOnlyMode = false;
    this.degradation.reducedTTL = false;

    logger.info('降级模式已禁用');
  }

  /**
   * 获取动态TTL
   */
  getDynamicTTL(baseTTL) {
    if (this.degradation.reducedTTL) {
      return Math.floor(baseTTL * 0.5); // 减少TTL到原来的50%
    }

    // 根据当前性能调整TTL
    const avgResponseTime = this.getAverageResponseTime();
    const cacheHitRate = this.getCacheHitRate();

    if (avgResponseTime > this.thresholds.responseTime) {
      return Math.floor(baseTTL * 1.5); // 响应慢时增加TTL
    }

    if (cacheHitRate < this.thresholds.cacheHitRate) {
      return Math.floor(baseTTL * 1.2); // 命中率低时增加TTL
    }

    return baseTTL;
  }

  /**
   * 获取平均响应时间
   */
  getAverageResponseTime() {
    if (this.metrics.responseTime.length === 0) {
      return 0;
    }

    const sum = this.metrics.responseTime.reduce((a, b) => a + b, 0);
    return sum / this.metrics.responseTime.length;
  }

  /**
   * 获取缓存命中率
   */
  getCacheHitRate() {
    const totalCacheOperations = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (totalCacheOperations === 0) {
      return 0;
    }

    return this.metrics.cacheHits / totalCacheOperations;
  }

  /**
   * 检查系统健康状况
   */
  getHealthStatus() {
    const avgResponseTime = this.getAverageResponseTime();
    const cacheHitRate = this.getCacheHitRate();
    const errorRate = this.metrics.errorRate;

    const status = {
      healthy: true,
      issues: [],
      metrics: {
        responseTime: avgResponseTime,
        cacheHitRate: cacheHitRate,
        errorRate: errorRate,
        circuitBreakerOpen: this.circuitBreaker.isOpen,
        degradationEnabled: this.degradation.enabled
      }
    };

    // 检查各项指标
    if (avgResponseTime > this.thresholds.responseTime) {
      status.healthy = false;
      status.issues.push(`响应时间过长: ${avgResponseTime.toFixed(2)}ms`);
    }

    if (cacheHitRate < this.thresholds.cacheHitRate) {
      status.healthy = false;
      status.issues.push(`缓存命中率过低: ${(cacheHitRate * 100).toFixed(1)}%`);
    }

    if (errorRate > this.thresholds.errorRate) {
      status.healthy = false;
      status.issues.push(`错误率过高: ${(errorRate * 100).toFixed(1)}%`);
    }

    if (this.circuitBreaker.isOpen) {
      status.healthy = false;
      status.issues.push('熔断器已开启');
    }

    return status;
  }

  /**
   * 自动调整策略
   */
  autoAdjust() {
    const health = this.getHealthStatus();

    if (!health.healthy) {
      // 根据具体问题自动调整
      if (health.metrics.responseTime > this.thresholds.responseTime) {
        this.enableDegradation('reduced_ttl');
      }

      if (health.metrics.cacheHitRate < this.thresholds.cacheHitRate) {
        // 可以考虑预热缓存
        logger.info('建议预热缓存以提高命中率');
      }

      if (health.metrics.errorRate > this.thresholds.errorRate) {
        this.enableDegradation('cache_only');
      }
    } else {
      // 系统健康，尝试恢复正常模式
      if (this.degradation.enabled) {
        this.disableDegradation();
      }

      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.closeCircuitBreaker();
      }
    }
  }

  /**
   * 重置性能指标
   */
  resetMetrics() {
    const oldMetrics = { ...this.metrics };

    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheErrors: 0,
      dbQueries: 0,
      dbErrors: 0,
      responseTime: [],
      errorRate: 0,
      lastErrorTime: oldMetrics.lastErrorTime
    };

    // 记录重置前的统计
    logger.debug('性能指标已重置', {
      previousMetrics: {
        cacheHits: oldMetrics.cacheHits,
        cacheMisses: oldMetrics.cacheMisses,
        cacheErrors: oldMetrics.cacheErrors,
        dbQueries: oldMetrics.dbQueries,
        dbErrors: oldMetrics.dbErrors,
        avgResponseTime: this.getAverageResponseTime.call({ metrics: oldMetrics }),
        errorRate: oldMetrics.errorRate
      }
    });
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    const health = this.getHealthStatus();

    return {
      timestamp: new Date().toISOString(),
      health: health,
      detailedMetrics: this.metrics,
      circuitBreaker: this.circuitBreaker,
      degradation: this.degradation,
      recommendations: this.getRecommendations()
    };
  }

  /**
   * 获取优化建议
   */
  getRecommendations() {
    const recommendations = [];
    const health = this.getHealthStatus();

    if (!health.healthy) {
      health.issues.forEach(issue => {
        if (issue.includes('响应时间')) {
          recommendations.push('考虑启用降级模式或增加缓存TTL');
        }
        if (issue.includes('缓存命中率')) {
          recommendations.push('考虑预热缓存或调整缓存策略');
        }
        if (issue.includes('错误率')) {
          recommendations.push('检查Redis连接和数据库性能');
        }
      });
    } else {
      recommendations.push('系统运行良好，继续保持当前配置');
    }

    return recommendations;
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this.resetMetricsInterval) {
      clearInterval(this.resetMetricsInterval);
    }
  }
}

// 导出单例实例
module.exports = DriftBottlePerformanceService.getInstance();