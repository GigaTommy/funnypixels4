const express = require('express');
const multer = require('multer');
const AdminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const adminAuditMiddleware = require('../middleware/adminAudit');

const router = express.Router();

// 配置multer用于内存处理
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// 管理员认证路由
router.post('/auth/login', AdminController.login);
router.post('/auth/logout', authenticateToken, AdminController.logout);
router.get('/auth/me', authenticateToken, requireAdmin, AdminController.getCurrentUser);
router.post('/auth/refresh', AdminController.refreshToken);

// Audit middleware - intercept all write operations after auth
router.use(adminAuditMiddleware);

// Audit log routes
router.get('/audit-logs', authenticateToken, requireAdmin, AdminController.getAuditLogs);
router.get('/audit-logs/stats', authenticateToken, requireAdmin, AdminController.getAuditLogStats);

// Dashboard统计数据路由
router.get('/dashboard/stats', authenticateToken, requireAdmin, AdminController.getDashboardStats);
router.get('/dashboard/recent-activities', authenticateToken, requireAdmin, AdminController.getRecentActivities);

// 用户管理路由
router.get('/users', authenticateToken, requireAdmin, AdminController.getUsers);
router.post('/users', authenticateToken, requireAdmin, AdminController.createUser);
router.get('/users/banned-count', authenticateToken, requireAdmin, AdminController.getBannedUsersCount);
router.get('/users/:id', authenticateToken, requireAdmin, AdminController.getUserById);

// 角色管理路由
router.get('/roles', authenticateToken, requireAdmin, AdminController.getRoles);
router.post('/roles', authenticateToken, requireAdmin, AdminController.createRole);
router.get('/roles/:id', authenticateToken, requireAdmin, AdminController.getRoleById);
router.put('/roles/:id', authenticateToken, requireAdmin, AdminController.updateRole);
router.delete('/roles/:id', authenticateToken, requireAdmin, AdminController.deleteRole);

// 权限管理路由
router.get('/permissions', authenticateToken, requireAdmin, AdminController.getPermissions);
router.get('/permissions/tree', authenticateToken, requireAdmin, AdminController.getPermissionsTree);

// 联盟管理路由
router.get('/alliances', authenticateToken, requireAdmin, AdminController.getAlliances);
router.get('/alliances/:id/members', authenticateToken, requireAdmin, AdminController.getAllianceMembers);

// 图案资源管理路由
router.get('/pattern-assets', authenticateToken, requireAdmin, AdminController.getPatternAssets);
router.post('/pattern-assets/analyze', authenticateToken, requireAdmin, upload.single('image'), AdminController.analyzePattern);
router.post('/pattern-assets/batch', authenticateToken, requireAdmin, AdminController.batchCreatePatterns);

// 广告审批路由
router.get('/ads/pending', authenticateToken, requireAdmin, AdminController.getPendingAds);
router.get('/ads', authenticateToken, requireAdmin, AdminController.getAllAds);
router.get('/ads/:id', authenticateToken, requireAdmin, AdminController.getAdById);
router.post('/ads/approve/:id', authenticateToken, requireAdmin, AdminController.approveAd);
router.post('/ads/reject/:id', authenticateToken, requireAdmin, AdminController.rejectAd);

// 系统配置路由
router.use('/system-config', require('./admin/systemConfig'));

// 举报管理路由
router.get('/reports', authenticateToken, requireAdmin, AdminController.getReports);
router.get('/reports/:id', authenticateToken, requireAdmin, AdminController.getReportById);
router.put('/reports/:id', authenticateToken, requireAdmin, AdminController.updateReport);
router.get('/reports/stats', authenticateToken, requireAdmin, AdminController.getReportStats);

// 自定义联盟旗帜审批路由
router.get('/custom-flags/pending', authenticateToken, requireAdmin, AdminController.getPendingCustomFlags);
router.get('/custom-flags', authenticateToken, requireAdmin, AdminController.getAllCustomFlags);
router.get('/custom-flags/:id', authenticateToken, requireAdmin, AdminController.getCustomFlagById);
router.post('/custom-flags/approve/:id', authenticateToken, requireAdmin, AdminController.approveCustomFlag);
router.post('/custom-flags/reject/:id', authenticateToken, requireAdmin, AdminController.rejectCustomFlag);

// 商店订单管理路由
router.get('/store-orders', authenticateToken, requireAdmin, AdminController.getAllStoreOrders);
router.get('/store-orders/:id', authenticateToken, requireAdmin, AdminController.getStoreOrderById);
router.put('/store-orders/:id/status', authenticateToken, requireAdmin, AdminController.updateStoreOrderStatus);

// 数据统计和分析路由
router.get('/stats/comprehensive', authenticateToken, requireAdmin, AdminController.getComprehensiveStats);
router.get('/stats/trends', authenticateToken, requireAdmin, AdminController.getTrendStats);
router.get('/stats/popular-products', authenticateToken, requireAdmin, AdminController.getPopularProducts);

// 运营管理路由 - 公告
router.get('/announcements', authenticateToken, requireAdmin, AdminController.getAnnouncements);
router.post('/announcements', authenticateToken, requireAdmin, AdminController.createAnnouncement);
router.put('/announcements/:id', authenticateToken, requireAdmin, AdminController.updateAnnouncement);
router.delete('/announcements/:id', authenticateToken, requireAdmin, AdminController.deleteAnnouncement);

// 运营管理路由 - 系统邮件
router.post('/system-messages/send', authenticateToken, requireAdmin, AdminController.sendSystemMail);
router.get('/system-messages/sent', authenticateToken, requireAdmin, AdminController.getSentMails);

// 系统监控路由
router.get('/system/logs', authenticateToken, requireAdmin, AdminController.getSystemLogs);
router.get('/system/metrics', authenticateToken, requireAdmin, AdminController.getSystemMetrics);

module.exports = router;