/**
 * FunnyPixels Pricing Configuration
 * 统一的定价体系配置
 */

module.exports = {
  // 充值档位 — 与 Apple IAP Tier 对齐
  // 基准汇率: $1 ≈ 100 积分 (≈ ¥7 ≈ 100 积分)
  // Apple 标准价格点: $0.99 / $2.99 / $4.99 / $9.99 / $29.99 / $49.99
  // RMB 等价由 Apple Tier 自动设定: ¥6 / ¥18 / ¥30 / ¥68 / ¥198 / ¥328
  rechargePackages: [
    {
      id: 'trial',
      amountUSD: 0.99,
      amountRMB: 6,
      appleProductId: 'com.funnypixels.points.100',
      points: 100,
      bonus: 0,
      bonusPercent: 0,
      label: '体验包',
      labelEn: 'Starter',
      icon: '🎁',
      popular: false
    },
    {
      id: 'starter',
      amountUSD: 2.99,
      amountRMB: 18,
      appleProductId: 'com.funnypixels.points.330',
      points: 300,
      bonus: 30,
      bonusPercent: 10,
      label: '入门包',
      labelEn: 'Basic',
      icon: '🌟',
      popular: false
    },
    {
      id: 'basic',
      amountUSD: 4.99,
      amountRMB: 30,
      appleProductId: 'com.funnypixels.points.580',
      points: 500,
      bonus: 80,
      bonusPercent: 16,
      label: '进阶包',
      labelEn: 'Plus',
      icon: '💎',
      popular: false
    },
    {
      id: 'advanced',
      amountUSD: 9.99,
      amountRMB: 68,
      appleProductId: 'com.funnypixels.points.1200',
      points: 1000,
      bonus: 200,
      bonusPercent: 20,
      label: '高级包',
      labelEn: 'Best Value',
      icon: '👑',
      popular: true
    },
    {
      id: 'premium',
      amountUSD: 29.99,
      amountRMB: 198,
      appleProductId: 'com.funnypixels.points.3800',
      points: 3000,
      bonus: 800,
      bonusPercent: 27,
      label: '豪华包',
      labelEn: 'Premium',
      icon: '💰',
      popular: false
    },
    {
      id: 'ultimate',
      amountUSD: 49.99,
      amountRMB: 328,
      appleProductId: 'com.funnypixels.points.6500',
      points: 5000,
      bonus: 1500,
      bonusPercent: 30,
      label: '至尊包',
      labelEn: 'Ultimate',
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
