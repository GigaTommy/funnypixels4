const express = require('express');
const router = express.Router();
const ChallengeAdminController = require('../../controllers/challengeAdminController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/templates', ChallengeAdminController.listTemplates);
router.get('/templates/stats', ChallengeAdminController.getStats);
router.get('/templates/:id', ChallengeAdminController.getTemplateById);
router.post('/templates', ChallengeAdminController.createTemplate);
router.put('/templates/:id', ChallengeAdminController.updateTemplate);
router.delete('/templates/:id', ChallengeAdminController.deleteTemplate);
router.put('/templates/:id/toggle', ChallengeAdminController.toggleActive);

module.exports = router;
