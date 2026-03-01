const express = require('express');
const router = express.Router();
const CheckinAdminController = require('../../controllers/checkinAdminController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/configs', CheckinAdminController.listConfigs);
router.get('/stats', CheckinAdminController.getCheckinStats);
router.get('/preview', CheckinAdminController.previewReward);
router.post('/configs', CheckinAdminController.createConfig);
router.put('/configs/:id', CheckinAdminController.updateConfig);
router.delete('/configs/:id', CheckinAdminController.deleteConfig);

module.exports = router;
