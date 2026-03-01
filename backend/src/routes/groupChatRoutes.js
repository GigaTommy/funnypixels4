const express = require('express');
const GroupChatController = require('../controllers/groupChatController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 所有群聊路由都需要认证
router.use(authenticateToken);

// 创建群聊
router.post('/', GroupChatController.createGroup);

// 获取用户的群聊列表
router.get('/', GroupChatController.getUserGroups);

// 搜索群聊
router.get('/search', GroupChatController.searchGroups);

// 通过邀请码加入群聊
router.post('/join', GroupChatController.joinGroupByInvite);

// 获取群聊详情
router.get('/:groupId', GroupChatController.getGroupDetails);

// 更新群聊信息
router.put('/:groupId', GroupChatController.updateGroup);

// 解散群聊
router.delete('/:groupId', GroupChatController.deleteGroup);

// 退出群聊
router.post('/:groupId/leave', GroupChatController.leaveGroup);

// 获取群聊成员列表
router.get('/:groupId/members', GroupChatController.getGroupMembers);

// 踢出成员
router.delete('/:groupId/members/:memberId', GroupChatController.removeMember);

// 发送群聊消息
router.post('/:groupId/messages', GroupChatController.sendMessage);

// 获取群聊消息
router.get('/:groupId/messages', GroupChatController.getGroupMessages);

module.exports = router;