const Referral = require('../models/Referral');
const logger = require('../utils/logger');

class ReferralController {
  /**
   * GET /api/referral/code — Get or generate user's referral code
   */
  static async getMyCode(req, res) {
    try {
      const code = await Referral.getOrCreateCode(req.user.id);
      res.json({ success: true, code });
    } catch (error) {
      logger.error('Get referral code failed', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to get referral code' });
    }
  }

  /**
   * POST /api/referral/redeem — Redeem a referral code
   */
  static async redeemCode(req, res) {
    try {
      const { code } = req.body;
      if (!code || code.length !== 8) {
        return res.status(400).json({ error: 'Invalid referral code format' });
      }

      const result = await Referral.redeemCode(req.user.id, code.toUpperCase());
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json(result);
    } catch (error) {
      logger.error('Redeem referral code failed', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to redeem referral code' });
    }
  }

  /**
   * GET /api/referral/stats — Get user's referral stats
   */
  static async getStats(req, res) {
    try {
      const stats = await Referral.getStats(req.user.id);
      res.json({ success: true, ...stats });
    } catch (error) {
      logger.error('Get referral stats failed', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to get referral stats' });
    }
  }
}

module.exports = ReferralController;
