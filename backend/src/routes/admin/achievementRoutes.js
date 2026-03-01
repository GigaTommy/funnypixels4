const express = require('express');
const router = express.Router();
const AchievementAdminController = require('../../controllers/achievementAdminController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/', AchievementAdminController.listAchievements);
router.get('/stats', AchievementAdminController.getAchievementStats);
router.get('/:id', AchievementAdminController.getAchievementById);
router.post('/', AchievementAdminController.createAchievement);
router.put('/:id', AchievementAdminController.updateAchievement);
router.delete('/:id', AchievementAdminController.deleteAchievement);
router.put('/:id/toggle', AchievementAdminController.toggleActive);

module.exports = router;
