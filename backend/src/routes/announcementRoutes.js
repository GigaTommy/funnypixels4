const express = require('express');
const router = express.Router();
const AnnouncementController = require('../controllers/announcementController');
const { authenticateToken } = require('../middleware/auth');

// 公开的公告查看路由（不需要认证）
// 获取全局公告列表
router.get('/global', AnnouncementController.getGlobalAnnouncements);

// 获取系统公告列表
router.get('/system', AnnouncementController.getSystemAnnouncements);

// 获取公告详情
router.get('/:id', AnnouncementController.getAnnouncementDetails);

// 需要认证的路由
// 创建公告
router.post('/', authenticateToken, AnnouncementController.createAnnouncement);

// 获取用户可见的所有公告（全局+系统+联盟）
router.get('/', authenticateToken, AnnouncementController.getAllUserVisibleAnnouncements);

// 获取联盟公告列表（需要验证用户是否为联盟成员）
router.get('/alliance/:alliance_id', authenticateToken, AnnouncementController.getAllianceAnnouncements);

// 更新公告
router.put('/:id', authenticateToken, AnnouncementController.updateAnnouncement);

// 删除公告
router.delete('/:id', authenticateToken, AnnouncementController.deleteAnnouncement);

module.exports = router;
