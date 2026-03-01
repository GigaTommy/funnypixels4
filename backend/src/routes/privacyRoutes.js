const express = require('express');
const PrivacyController = require('../controllers/privacyController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 获取指定用户的隐私设置（公开信息，用于像素卡片显示）- 不需要认证
router.get('/user/:user_id/settings', PrivacyController.getUserPrivacySettings);

// 以下隐私路由需要认证
router.use(authenticateToken);

// 获取隐私设置
router.get('/settings', PrivacyController.getPrivacySettings);

// 更新隐私设置
router.put('/settings', PrivacyController.updatePrivacySettings);

// 获取消息请求列表
router.get('/message-requests', PrivacyController.getMessageRequests);

// 处理消息请求
router.put('/message-requests/:request_id', PrivacyController.handleMessageRequest);

// 检查消息权限
router.get('/check-permission/:receiver_id', PrivacyController.checkMessagePermission);

// 发送消息请求
router.post('/message-requests/:receiver_id', PrivacyController.sendMessageRequest);

module.exports = router;