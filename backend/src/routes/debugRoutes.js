const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const DebugController = require('../controllers/debugController');

// 调试路由 - 只在开发环境启用
if (process.env.NODE_ENV === 'development') {
  // 测试数据库表结构
  router.get('/tables', DebugController.testDatabaseTables);

  // 测试conversation查询 - 需要认证
  router.get('/conversation/:conversationId', authenticateToken, DebugController.testConversationQuery);
}

module.exports = router;