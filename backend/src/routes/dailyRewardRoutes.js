const express = require('express');
const DailyRewardController = require('../controllers/dailyRewardController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/summary', DailyRewardController.getSummary);
router.post('/acknowledge', DailyRewardController.acknowledge);

module.exports = router;
