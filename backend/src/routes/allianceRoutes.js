const express = require('express');
const router = express.Router();
const { AllianceController, generateInviteLink, joinByInviteLink, getInviteLinks, deleteInviteLink } = require('../controllers/allianceController');
const AllianceCheckinController = require('../controllers/allianceCheckinController');
const AllianceActivityController = require('../controllers/allianceActivityController');
const { authenticateToken } = require('../middleware/auth');

// 创建联盟
router.post('/', authenticateToken, AllianceController.createAlliance);

// 搜索联盟
router.get('/search', authenticateToken, AllianceController.searchAlliances);

// 获取用户所属联盟（必须在 /:id 之前）
router.get('/user/alliance', authenticateToken, AllianceController.getUserAlliance);

// 获取用户所加入的所有联盟列表
router.get('/user/alliances', authenticateToken, AllianceController.getUserAlliances);

// 获取用户联盟颜色
router.get('/user/color', authenticateToken, AllianceController.getUserAllianceColor);

// 获取用户联盟旗帜信息
router.get('/user/flag', authenticateToken, AllianceController.getUserAllianceFlag);

// 获取可用的联盟旗帜图案
router.get('/flag-patterns', authenticateToken, AllianceController.getAvailableFlagPatterns);

// 获取联盟详情
router.get('/:id', authenticateToken, AllianceController.getAllianceDetails);

// 获取联盟成员列表
router.get('/:id/members', authenticateToken, AllianceController.getAllianceMembers);

// 获取联盟统计数据
router.get('/:id/stats', authenticateToken, AllianceController.getAllianceStats);

// 踢出联盟成员
router.post('/:id/kick-member', authenticateToken, AllianceController.kickMember);

// 更新成员角色
router.post('/:id/update-member-role', authenticateToken, AllianceController.updateMemberRole);

// 转让盟主
router.post('/:id/transfer-leadership', authenticateToken, AllianceController.transferLeadership);

// 申请加入联盟
router.post('/:id/apply', authenticateToken, AllianceController.applyToAlliance);

// 加入联盟（别名，与前端保持一致）
router.post('/:id/join', authenticateToken, AllianceController.applyToAlliance);

// 获取联盟申请列表
router.get('/:id/applications', authenticateToken, AllianceController.getApplications);

// 审批联盟申请
router.post('/:id/review-application', authenticateToken, AllianceController.reviewApplication);

// 退出联盟
router.post('/:id/leave', authenticateToken, AllianceController.leaveAlliance);

// 更新联盟信息（仅盟主和管理员）
router.put('/:id', authenticateToken, AllianceController.updateAlliance);

// 转让盟主（仅盟主）
router.post('/:id/transfer-leadership', authenticateToken, AllianceController.transferLeadership);

// 解散联盟（仅盟主）
router.delete('/:id', authenticateToken, AllianceController.disbandAlliance);

// 邀请链接相关路由
// 生成邀请链接
router.post('/:allianceId/invite', authenticateToken, generateInviteLink);

// 通过邀请链接加入联盟
router.post('/join-by-invite', authenticateToken, joinByInviteLink);

// 获取联盟邀请链接列表
router.get('/:allianceId/invites', authenticateToken, getInviteLinks);

// 删除邀请链接
router.delete('/:allianceId/invites/:inviteId', authenticateToken, deleteInviteLink);

// 联盟签到
router.post('/:id/checkin', authenticateToken, AllianceCheckinController.checkin);
router.get('/:id/checkin-status', authenticateToken, AllianceCheckinController.getCheckinStatus);

// 联盟贡献排行
router.get('/:id/contributions', authenticateToken, AllianceController.getMemberContributions);

// 联盟活动日志
router.get('/:id/activity-log', authenticateToken, AllianceActivityController.getActivityLog);

module.exports = router;
