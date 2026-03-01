const express = require('express');
const router = express.Router();
const DriftBottlePerformanceController = require('../controllers/driftBottlePerformanceController');
const { authenticateToken } = require('../middleware/auth');

/**
 * 漂流瓶性能监控路由
 * 提供系统性能监控、健康检查和优化接口
 */

// 公开接口 - 健康检查（不需要认证）
router.get('/health', DriftBottlePerformanceController.getHealthStatus);

// 需要认证的接口
router.use(authenticateToken);

// 性能监控接口
router.get('/report', DriftBottlePerformanceController.getPerformanceReport);
router.get('/stats', DriftBottlePerformanceController.getCacheStats);
router.get('/trends', DriftBottlePerformanceController.getPerformanceTrends);

// 系统控制接口
router.post('/optimize', DriftBottlePerformanceController.optimizeSystem);
router.post('/reset-metrics', DriftBottlePerformanceController.resetMetrics);

// 熔断器接口
router.get('/circuit-breaker', DriftBottlePerformanceController.getCircuitBreakerStatus);
router.post('/circuit-breaker/test', DriftBottlePerformanceController.testCircuitBreaker);

// 降级策略接口
router.get('/degradation', DriftBottlePerformanceController.getDegradationStatus);

module.exports = router;