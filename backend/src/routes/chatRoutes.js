// backend/src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ChatController = require('../controllers/chatController');
const PrivateMessageController = require('../controllers/privateMessageController');

// 所有路由都需要认证
router.use(authenticateToken);

// 会话系统
router.get('/conversations', ChatController.getConversations);
router.get('/conversations/:conversationId/messages', ChatController.getConversationMessages);
router.post('/conversations/:conversationId/mark-read', ChatController.markConversationAsRead);
router.post('/private/create-conversation', ChatController.createPrivateConversation);

// 私信相关路由
router.get('/private/conversations', PrivateMessageController.getConversationList);
router.get('/private/conversation/:userId', PrivateMessageController.getConversation);
router.post('/private/send', PrivateMessageController.sendMessage);
router.put('/private/read/:messageId', PrivateMessageController.markAsRead);
router.delete('/private/message/:messageId', PrivateMessageController.deleteMessage);

// 联盟聊天相关路由 - 使用现有的ChatController
router.get('/alliance/:allianceId/messages', ChatController.getChannelMessages);
router.post('/alliance/send', ChatController.sendMessage);

// 通用聊天路由
router.get('/channel/:channelType/:channelId', ChatController.getChannelMessages);
router.post('/send', ChatController.sendMessage);
router.get('/search', ChatController.searchMessages);
router.delete('/message/:messageId', ChatController.deleteMessage);

// 私信限额相关路由
router.get('/private-message-limits', ChatController.getPrivateMessageLimits);

module.exports = router;