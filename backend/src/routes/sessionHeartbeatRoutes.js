const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const sessionHeartbeatController = require('../controllers/sessionHeartbeatController');

const router = express.Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 心跳相关路由
router.post('/heartbeat', sessionHeartbeatController.updateHeartbeat);
router.get('/heartbeat/:sessionId/active', sessionHeartbeatController.checkSessionActive);
router.post('/visibility', sessionHeartbeatController.handleVisibilityChange);

// 会话管理路由
router.post('/end/:sessionId', sessionHeartbeatController.endSessionGracefully);
router.get('/active', sessionHeartbeatController.getActiveSessionWithHeartbeat);

module.exports = router;