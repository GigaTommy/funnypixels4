const { RANK_TIERS } = require('../constants/rankTiers');
const { getTierBenefits } = require('../constants/rankTierBenefits');
const logger = require('../utils/logger');

class RankTierController {
  /**
   * 获取所有段位列表（含福利说明）
   * GET /api/rank-tiers
   */
  static async getAllTiers(req, res) {
    try {
      const tiers = RANK_TIERS.map((tier, index) => {
        const benefits = getTierBenefits(tier.id);
        const nextTier = index < RANK_TIERS.length - 1 ? RANK_TIERS[index + 1] : null;

        return {
          id: tier.id,
          name: tier.name,
          nameEn: tier.nameEn,
          icon: tier.icon,
          color: tier.color,
          minPixels: tier.minPixels,
          pixelsRequired: nextTier ? nextTier.minPixels - tier.minPixels : 0,
          isMaxTier: index === RANK_TIERS.length - 1,
          order: index,
          benefits: {
            badges: benefits.badges || [],
            features: benefits.features || [],
            limits: benefits.limits || {}
          }
        };
      });

      res.json({
        success: true,
        data: {
          tiers,
          totalCount: tiers.length
        }
      });
    } catch (error) {
      logger.error('获取段位列表失败:', error);
      res.status(500).json({ success: false, message: '获取段位列表失败' });
    }
  }

  /**
   * 获取当前用户的段位详情
   * GET /api/rank-tiers/me
   */
  static async getMyTier(req, res) {
    try {
      const userId = req.user.id;

      // 获取用户总像素数（这里需要从数据库查询）
      const { db } = require('../config/database');
      const user = await db('users')
        .where('id', userId)
        .select('total_pixels')
        .first();

      const totalPixels = user?.total_pixels || 0;

      // 计算当前段位
      const RankTierService = require('../services/rankTierService');
      const tierInfo = RankTierService.getTierForPixels(totalPixels);

      // 添加福利信息
      const benefits = getTierBenefits(tierInfo.id);

      res.json({
        success: true,
        data: {
          ...tierInfo,
          benefits: {
            badges: benefits.badges || [],
            features: benefits.features || [],
            limits: benefits.limits || {}
          }
        }
      });
    } catch (error) {
      logger.error('获取用户段位失败:', error);
      res.status(500).json({ success: false, message: '获取用户段位失败' });
    }
  }
}

module.exports = RankTierController;
