const express = require('express');
const router = express.Router();
const ChallengeController = require('../controllers/challengeController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// 获取今日挑战
router.get('/today', ChallengeController.getTodayChallenge);

// 领取奖励
router.post('/:challengeId/claim', ChallengeController.claimReward);

module.exports = router;
