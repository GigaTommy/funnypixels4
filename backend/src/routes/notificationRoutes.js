const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authenticateToken);

// 获取用户通知列表
router.get('/', NotificationController.getUserNotifications);

// 获取未读通知数量
router.get('/unread-count', NotificationController.getUnreadCount);

// 标记通知为已读
router.put('/:notificationId/read', NotificationController.markAsRead);

// 标记所有通知为已读
router.put('/mark-all-read', NotificationController.markAllAsRead);

// 删除通知
router.delete('/:notificationId', NotificationController.deleteNotification);

module.exports = router;
