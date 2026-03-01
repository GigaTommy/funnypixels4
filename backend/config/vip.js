/**
 * FunnyPixels VIP/会员体系配置
 */

module.exports = {
  tiers: {
    normal: {
      id: 'normal',
      name: 'VIP 会员',
      monthlyPrice: 9.88,
      yearlyPrice: 98.88, // 相当于8.3折
      color: '#3B82F6',
      icon: '⭐',
      benefits: [
        {
          type: 'discount',
          value: 0.1,
          label: '商城10%折扣',
          description: '商城所有道具享受9折优惠'
        },
        {
          type: 'daily_gift',
          value: 50,
          label: '每日赠送50积分',
          description: '每天登录即可领取50积分'
        },
        {
          type: 'badge',
          value: 'vip_normal',
          label: 'VIP徽章',
          description: '专属VIP徽章，彰显身份'
        },
        {
          type: 'feature',
          value: 'ad_free',
          label: '无广告体验',
          description: '移除所有第三方广告'
        }
      ]
    },

    premium: {
      id: 'premium',
      name: 'VIP+ 高级会员',
      monthlyPrice: 29.88,
      yearlyPrice: 298.88, // 相当于8.3折
      color: '#8B5CF6',
      icon: '💎',
      popular: true,
      benefits: [
        {
          type: 'discount',
          value: 0.2,
          label: '商城20%折扣',
          description: '商城所有道具享受8折优惠'
        },
        {
          type: 'daily_gift',
          value: 150,
          label: '每日赠送150积分',
          description: '每天登录即可领取150积分'
        },
        {
          type: 'free_item',
          value: 'bomb_random',
          label: '每日免费炸弹',
          description: '每天赠送1个随机炸弹道具'
        },
        {
          type: 'badge',
          value: 'vip_premium',
          label: 'VIP+徽章',
          description: '专属VIP+紫色徽章'
        },
        {
          type: 'exclusive_pattern',
          value: true,
          label: '专属图案库',
          description: '解锁100+专属高级图案模板'
        },
        {
          type: 'feature',
          value: 'ad_free',
          label: '无广告体验',
          description: '移除所有第三方广告'
        },
        {
          type: 'feature',
          value: 'priority_queue',
          label: '优先绘制权',
          description: '在高峰时段享受优先绘制权限'
        }
      ]
    },

    elite: {
      id: 'elite',
      name: 'VIP Elite 尊享会员',
      monthlyPrice: 68.88,
      yearlyPrice: 688.88, // 相当于8.3折
      color: '#F59E0B',
      icon: '👑',
      benefits: [
        {
          type: 'discount',
          value: 0.3,
          label: '商城30%折扣',
          description: '商城所有道具享受7折优惠'
        },
        {
          type: 'daily_gift',
          value: 500,
          label: '每日赠送500积分',
          description: '每天登录即可领取500积分'
        },
        {
          type: 'free_item',
          value: 'bomb_premium',
          label: '每日免费高级炸弹',
          description: '每天赠送1个高级炸弹道具'
        },
        {
          type: 'badge',
          value: 'vip_elite',
          label: 'VIP Elite徽章',
          description: '专属VIP Elite金色徽章'
        },
        {
          type: 'exclusive_pattern',
          value: true,
          label: '全部专属图案库',
          description: '解锁所有专属图案模板（200+）'
        },
        {
          type: 'priority_support',
          value: true,
          label: '优先客服',
          description: '专属客服通道，优先响应'
        },
        {
          type: 'ad_revenue_share',
          value: 0.1,
          label: '广告收益10%分成',
          description: '你的像素广告产生的收益，可获得10%分成'
        },
        {
          type: 'feature',
          value: 'ad_free',
          label: '无广告体验',
          description: '移除所有第三方广告'
        },
        {
          type: 'feature',
          value: 'priority_queue',
          label: '优先绘制权',
          description: '在高峰时段享受优先绘制权限'
        },
        {
          type: 'feature',
          value: 'custom_effects',
          label: '自定义特效',
          description: '自定义绘制时的粒子特效'
        }
      ]
    }
  },

  /**
   * VIP权益辅助函数
   */
  helpers: {
    /**
     * 获取用户的VIP等级
     */
    async getUserVipTier(userId) {
      const { db } = require('../config/database');
      const subscription = await db('vip_subscriptions')
        .where('user_id', userId)
        .where('is_active', true)
        .where('end_date', '>', new Date())
        .orderBy('created_at', 'desc')
        .first();

      return subscription ? subscription.tier : null;
    },

    /**
     * 检查用户是否有某个VIP权益
     */
    async hasVipBenefit(userId, benefitType, benefitValue = null) {
      const tier = await this.getUserVipTier(userId);
      if (!tier) return false;

      const tierConfig = this.tiers[tier];
      if (!tierConfig) return false;

      const benefit = tierConfig.benefits.find(b =>
        b.type === benefitType && (benefitValue === null || b.value === benefitValue)
      );

      return !!benefit;
    },

    /**
     * 获取用户的商城折扣率
     */
    async getUserDiscount(userId) {
      const tier = await this.getUserVipTier(userId);
      if (!tier) return 0;

      const tierConfig = this.tiers[tier];
      const discountBenefit = tierConfig.benefits.find(b => b.type === 'discount');
      return discountBenefit ? discountBenefit.value : 0;
    },

    /**
     * 获取用户的每日积分赠送
     */
    async getUserDailyGift(userId) {
      const tier = await this.getUserVipTier(userId);
      if (!tier) return 0;

      const tierConfig = this.tiers[tier];
      const giftBenefit = tierConfig.benefits.find(b => b.type === 'daily_gift');
      return giftBenefit ? giftBenefit.value : 0;
    },

    /**
     * 计算VIP订阅价格（考虑优惠）
     */
    calculateSubscriptionPrice(tierId, billingCycle = 'monthly', promoCode = null) {
      const tier = this.tiers[tierId];
      if (!tier) return 0;

      let price = billingCycle === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;

      // 应用促销码
      if (promoCode) {
        // TODO: 实现促销码逻辑
      }

      return price;
    },

    /**
     * 获取推荐的VIP等级
     */
    getRecommendedTier(userStats) {
      // 根据用户行为推荐合适的VIP等级
      // userStats: { totalPixels, dailyActiveTime, purchaseHistory, etc. }

      if (!userStats) return 'normal';

      const { totalPixels = 0, totalPurchases = 0, dailyActiveMinutes = 0 } = userStats;

      // 高活跃用户推荐Elite
      if (totalPixels > 100000 || totalPurchases > 10 || dailyActiveMinutes > 120) {
        return 'elite';
      }

      // 中度活跃用户推荐Premium
      if (totalPixels > 10000 || totalPurchases > 3 || dailyActiveMinutes > 60) {
        return 'premium';
      }

      // 轻度用户推荐Normal
      return 'normal';
    },

    /**
     * 比较两个VIP等级
     */
    compareTiers(tier1, tier2) {
      const tierOrder = { normal: 1, premium: 2, elite: 3 };
      return tierOrder[tier1] - tierOrder[tier2];
    }
  },

  /**
   * VIP试用配置
   */
  trial: {
    enabled: true,
    duration: 7, // 天数
    tier: 'premium', // 试用等级
    conditions: {
      newUserOnly: true, // 仅新用户
      minPixels: 100, // 最少绘制100像素
      minDays: 3 // 至少活跃3天
    }
  },

  /**
   * VIP升级路径
   */
  upgradePaths: {
    normal_to_premium: {
      discount: 0.2, // 升级8折
      label: '升级享8折优惠'
    },
    premium_to_elite: {
      discount: 0.15, // 升级85折
      label: '升级享85折优惠'
    }
  }
};
