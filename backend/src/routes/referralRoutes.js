const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { rewardClaimLimiter } = require('../middleware/rateLimit');
const ReferralController = require('../controllers/referralController');

// All referral routes require authentication
router.use(authenticateToken);

router.get('/code', ReferralController.getMyCode);
router.post('/redeem', rewardClaimLimiter, ReferralController.redeemCode);
router.get('/stats', ReferralController.getStats);

module.exports = router;
