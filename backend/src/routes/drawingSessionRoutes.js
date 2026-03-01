const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const drawingSessionController = require('../controllers/drawingSessionController');

const router = express.Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 绘制会话管理
router.post('/start', drawingSessionController.startSession);              // 开始会话
router.post('/:sessionId/end', drawingSessionController.endSession);       // 结束会话
router.post('/:sessionId/pause', drawingSessionController.pauseSession);   // 暂停会话
router.post('/:sessionId/resume', drawingSessionController.resumeSession); // 恢复会话
router.post('/:sessionId/pixels', drawingSessionController.recordPixel);   // 记录像素
router.post('/:sessionId/heartbeat', require('../controllers/sessionHeartbeatController').updateHeartbeat); // 心跳


// 查询接口
router.get('/active', drawingSessionController.getActiveSession);           // 获取活跃会话
router.get('/', drawingSessionController.getUserSessions);                  // 获取会话列表
router.post('/batch-pixels', drawingSessionController.getBatchPixels);      // 批量获取像素（优化）
router.get('/:sessionId', drawingSessionController.getSessionDetails);     // 获取会话详情
router.get('/:sessionId/pixels', drawingSessionController.getSessionPixels); // 获取会话像素列表
router.get('/:sessionId/statistics', drawingSessionController.getSessionStatistics); // 获取会话统计

module.exports = router;