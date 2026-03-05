const express = require('express');
const router = express.Router();
const performanceMetrics = require('../monitoring/performanceMetrics');
const clientPerformanceController = require('../controllers/clientPerformanceController');

/**
 * 性能监控API路由
 * 提供系统性能指标查询接口 + 客户端性能数据收集
 */

// ===== 客户端性能监控（iOS/Android） =====

// POST /api/performance/client - 提交客户端性能数据（无需认证）
router.post('/client', clientPerformanceController.submitPerformanceData);

// GET /api/performance/client/metrics - 获取客户端性能指标（需要管理员权限）
router.get('/client/metrics', clientPerformanceController.getPerformanceMetrics);

// GET /api/performance/client/stats - 获取客户端性能统计（需要管理员权限）
router.get('/client/stats', clientPerformanceController.getPerformanceStats);

// GET /api/performance/client/startup - 获取启动性能指标（需要管理员权限）
router.get('/client/startup', clientPerformanceController.getStartupMetrics);

// ===== 服务器端性能监控 =====

// GET /api/performance/metrics - 获取性能指标
router.get('/metrics', (req, res) => {
  try {
    const metrics = performanceMetrics.getPerformanceReport();
    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ 获取性能指标失败:', error);
    res.status(500).json({
      success: false,
      error: '获取性能指标失败',
      details: error.message
    });
  }
});

// GET /api/performance/realtime - 获取实时指标
router.get('/realtime', (req, res) => {
  try {
    const metrics = performanceMetrics.getRealtimeMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ 获取实时指标失败:', error);
    res.status(500).json({
      success: false,
      error: '获取实时指标失败',
      details: error.message
    });
  }
});

// GET /api/performance/export - 导出性能数据
router.get('/export', (req, res) => {
  try {
    const data = performanceMetrics.export();
    res.json({
      success: true,
      data,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ 导出性能数据失败:', error);
    res.status(500).json({
      success: false,
      error: '导出性能数据失败',
      details: error.message
    });
  }
});

// POST /api/performance/reset - 重置性能指标
router.post('/reset', (req, res) => {
  try {
    performanceMetrics.reset();
    res.json({
      success: true,
      message: '性能指标已重置',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ 重置性能指标失败:', error);
    res.status(500).json({
      success: false,
      error: '重置性能指标失败',
      details: error.message
    });
  }
});

// GET /api/performance/health - 健康检查
router.get('/health', (req, res) => {
  try {
    const metrics = performanceMetrics.getRealtimeMetrics();
    const health = {
      status: 'healthy',
      timestamp: Date.now(),
      uptime: metrics.uptime,
      memory: {
        usage: metrics.memory.heapUsed / metrics.memory.heapTotal,
        rss: metrics.memory.rss,
        heapUsed: metrics.memory.heapUsed,
        heapTotal: metrics.memory.heapTotal
      },
      database: {
        pool: metrics.dbPool,
        status: metrics.dbPool.total > 0 ? 'connected' : 'disconnected'
      },
      websocket: {
        connections: metrics.wsConnections,
        rooms: metrics.wsRooms,
        status: 'active'
      }
    };
    
    // 检查健康状态
    if (health.memory.usage > 0.9) {
      health.status = 'warning';
      health.message = '内存使用率过高';
    }
    
    if (health.database.status === 'disconnected') {
      health.status = 'error';
      health.message = '数据库连接异常';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'warning' ? 200 : 500;
    
    res.status(statusCode).json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('❌ 健康检查失败:', error);
    res.status(500).json({
      success: false,
      error: '健康检查失败',
      details: error.message
    });
  }
});

module.exports = router;
