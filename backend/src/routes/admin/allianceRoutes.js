const express = require('express');
const router = express.Router();
const AllianceAdminController = require('../../controllers/allianceAdminController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/:id/detail', AllianceAdminController.getAllianceDetail);
router.get('/:id/moderation-logs', AllianceAdminController.getModerationLogs);
router.put('/:id/edit', AllianceAdminController.adminEditAlliance);
router.post('/:id/warn', AllianceAdminController.adminWarnAlliance);
router.post('/:id/suspend', AllianceAdminController.adminSuspendAlliance);
router.post('/:id/ban', AllianceAdminController.adminBanAlliance);
router.post('/:id/unban', AllianceAdminController.adminUnbanAlliance);
router.post('/:id/disband', AllianceAdminController.adminDisbandAlliance);
router.post('/:id/kick/:userId', AllianceAdminController.adminKickMember);

module.exports = router;
