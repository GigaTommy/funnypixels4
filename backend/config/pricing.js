/**
 * FunnyPixels Pricing Configuration
 * 统一的定价体系配置
 */

module.exports = {
  // 充值档位（人民币 → 积分）
  rechargePackages: [
    {
      id: 'trial',
      amountRMB: 1,
      points: 100,
      bonus: 0,
      bonusPercent: 0,
      label: '体验包',
      icon: '🎁',
      popular: false
    },
    {
      id: 'starter',
      amountRMB: 6,
      points: 600,
      bonus: 100,
      bonusPercent: 17,
      label: '入门包',
      icon: '🌟',
      popular: false
    },
    {
      id: 'basic',
      amountRMB: 12,
      points: 1200,
      bonus: 300,
      bonusPercent: 25,
      label: '进阶包',
      icon: '💎',
      popular: true
    },
    {
      id: 'advanced',
      amountRMB: 30,
      points: 3000,
      bonus: 1000,
      bonusPercent: 33,
      label: '高级包',
      icon: '👑',
      popular: false
    },
    {
      id: 'premium',
      amountRMB: 68,
      points: 6800,
      bonus: 3200,
      bonusPercent: 47,
      label: '豪华包',
      icon: '💰',
      popular: false
    },
    {
      id: 'ultimate',
      amountRMB: 128,
      points: 12800,
      bonus: 7200,
      bonusPercent: 56,
      label: '至尊包',
      icon: '🏆',
      popular: false
    }
  ],

  // 商品类型定价策略
  itemPricing: {
    consumable: {
      min: 50,
      max: 500,
      description: '消耗品（画笔、颜料等）'
    },
    bomb: {
      min: 500,
      max: 1500,
      description: '炸弹（区域清除）'
    },
    cosmetic: {
      min: 300,
      max: 3000,
      description: '装饰品（头像框、特效等）'
    },
    ad: {
      min: 2000,
      max: 10000,
      description: '广告（像素广告位）'
    },
    pattern: {
      min: 100,
      max: 1000,
      description: '图案模板'
    },
    speedup: {
      min: 200,
      max: 800,
      description: '加速道具'
    }
  },

  // 促销活动
  promotions: {
    firstPurchase: {
      id: 'first_purchase',
      bonusMultiplier: 1.5,
      label: '首充享50%额外积分',
      description: '首次充值可获得50%额外积分奖励',
      icon: '🎉',
      active: true
    },
    weeklySpecial: {
      id: 'weekly_special',
      discount: 0.2,
      label: '每周五晚8点全场8折',
      description: '每周五晚上8点到10点，商城全场8折优惠',
      icon: '⏰',
      active: true,
      schedule: {
        dayOfWeek: 5, // Friday
        startHour: 20,
        endHour: 22
      }
    },
    seasonalEvent: {
      id: 'seasonal_event',
      bonusMultiplier: 2.0,
      label: '节日双倍积分',
      description: '特定节日期间充值享受双倍积分',
      icon: '🎊',
      active: false,
      dates: [] // 配置特定日期
    },
    bulkDiscount: {
      id: 'bulk_discount',
      label: '大额充值优惠',
      description: '充值金额越高，赠送比例越高',
      icon: '💸',
      active: true
    }
  },

  // 定价策略辅助函数
  helpers: {
    /**
     * 计算实际获得的积分（含bonus）
     */
    calculateTotalPoints(packageId, isFirstPurchase = false) {
      const pkg = this.rechargePackages.find(p => p.id === packageId);
      if (!pkg) return 0;

      let total = pkg.points + pkg.bonus;

      // 首充额外奖励
      if (isFirstPurchase && this.promotions.firstPurchase.active) {
        total = Math.floor(total * this.promotions.firstPurchase.bonusMultiplier);
      }

      return total;
    },

    /**
     * 检查是否在促销时段
     */
    isPromotionActive(promotionId) {
      const promo = this.promotions[promotionId];
      if (!promo || !promo.active) return false;

      // 每周特惠检查
      if (promotionId === 'weeklySpecial') {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const hour = now.getHours();

        return (
          dayOfWeek === promo.schedule.dayOfWeek &&
          hour >= promo.schedule.startHour &&
          hour < promo.schedule.endHour
        );
      }

      // 节日活动检查
      if (promotionId === 'seasonalEvent') {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        return promo.dates.includes(today);
      }

      return true;
    },

    /**
     * 获取当前可用的促销列表
     */
    getActivePromotions() {
      return Object.entries(this.promotions)
        .filter(([key, promo]) => this.isPromotionActive(key))
        .map(([key, promo]) => ({ id: key, ...promo }));
    }
  }
};
