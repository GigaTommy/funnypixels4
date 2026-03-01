const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ReferralController = require('../controllers/referralController');

// All referral routes require authentication
router.use(authenticateToken);

router.get('/code', ReferralController.getMyCode);
router.post('/redeem', ReferralController.redeemCode);
router.get('/stats', ReferralController.getStats);

module.exports = router;
