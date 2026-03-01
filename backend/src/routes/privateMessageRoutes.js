const express = require('express');
const PrivateMessageController = require('../controllers/privateMessageController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 所有私信路由都需要认证
router.use(authenticateToken);

// 发送私信
router.post('/', PrivateMessageController.sendMessage);

// 获取对话列表
router.get('/conversations', PrivateMessageController.getConversationList);

// 获取与特定用户的对话
router.get('/conversations/:other_user_id', PrivateMessageController.getConversation);

// 标记消息为已读
router.put('/messages/:message_id/read', PrivateMessageController.markAsRead);

// 标记对话为已读
router.put('/conversations/:other_user_id/read', PrivateMessageController.markConversationAsRead);

// 删除消息
router.delete('/messages/:message_id', PrivateMessageController.deleteMessage);

// 编辑消息
router.put('/messages/:message_id/edit', PrivateMessageController.editMessage);

// 获取消息编辑历史
router.get('/messages/:message_id/edit-history', PrivateMessageController.getMessageEditHistory);

// 置顶对话
router.post('/conversations/:other_user_id/pin', PrivateMessageController.pinConversation);

// 取消置顶对话
router.delete('/conversations/:other_user_id/pin', PrivateMessageController.unpinConversation);

// 获取置顶对话列表
router.get('/pinned-conversations', PrivateMessageController.getPinnedConversations);

// 静音对话
router.post('/conversations/:other_user_id/mute', PrivateMessageController.muteConversation);

// 取消静音对话
router.delete('/conversations/:other_user_id/mute', PrivateMessageController.unmuteConversation);

// 获取静音对话列表
router.get('/muted-conversations', PrivateMessageController.getMutedConversations);

// 获取每日限制状态
router.get('/daily-limits', PrivateMessageController.getDailyLimitStatus);

// 获取未读消息数量
router.get('/unread-count', PrivateMessageController.getUnreadCount);

module.exports = router;
