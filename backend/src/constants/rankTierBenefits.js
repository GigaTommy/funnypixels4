/**
 * 段位福利系统
 * 每个段位解锁的专属权益
 */

const TIER_BENEFITS = {
  recruit: {
    badges: [],
    features: [
      { id: 'basic_draw', nameZh: '基础绘制', nameEn: 'Basic Drawing' },
      { id: 'profile', nameZh: '个人主页', nameEn: 'Profile' }
    ],
    limits: {
      dailyPixelQuota: 500,           // 每日像素配额
      maxDrawingSessionTime: 30,      // 单次绘画时长（分钟）
      profileCustomization: 'basic'   // 资料自定义级别
    }
  },

  private: {
    badges: ['🎖️'],
    features: [
      { id: 'alliance_join', nameZh: '加入联盟', nameEn: 'Join Alliance' },
      { id: 'daily_tasks', nameZh: '每日任务', nameEn: 'Daily Tasks' }
    ],
    limits: {
      dailyPixelQuota: 800,
      maxDrawingSessionTime: 45,
      profileCustomization: 'basic'
    }
  },

  corporal: {
    badges: ['🥉', '⚔️'],
    features: [
      { id: 'custom_avatar', nameZh: '自定义头像', nameEn: 'Custom Avatar' },
      { id: 'feed_post', nameZh: '发布动态', nameEn: 'Post Feed' }
    ],
    limits: {
      dailyPixelQuota: 1200,
      maxDrawingSessionTime: 60,
      profileCustomization: 'standard'
    }
  },

  sergeant: {
    badges: ['🥈', '🛡️'],
    features: [
      { id: 'alliance_create', nameZh: '创建联盟', nameEn: 'Create Alliance' },
      { id: 'drift_bottle', nameZh: '漂流瓶', nameEn: 'Drift Bottle' }
    ],
    limits: {
      dailyPixelQuota: 2000,
      maxDrawingSessionTime: 90,
      profileCustomization: 'standard'
    }
  },

  lieutenant: {
    badges: ['🥇', '⭐'],
    features: [
      { id: 'custom_flag', nameZh: '自定义旗帜', nameEn: 'Custom Flag' },
      { id: 'vip_badge', nameZh: 'VIP徽章', nameEn: 'VIP Badge' }
    ],
    limits: {
      dailyPixelQuota: 3500,
      maxDrawingSessionTime: 120,
      profileCustomization: 'advanced'
    }
  },

  captain: {
    badges: ['👑', '🌟'],
    features: [
      { id: 'priority_support', nameZh: '优先客服', nameEn: 'Priority Support' },
      { id: 'exclusive_patterns', nameZh: '专属图案', nameEn: 'Exclusive Patterns' }
    ],
    limits: {
      dailyPixelQuota: 6000,
      maxDrawingSessionTime: 180,
      profileCustomization: 'advanced'
    }
  },

  major: {
    badges: ['💎', '🏆'],
    features: [
      { id: 'advanced_analytics', nameZh: '高级数据分析', nameEn: 'Advanced Analytics' },
      { id: 'custom_effects', nameZh: '自定义特效', nameEn: 'Custom Effects' }
    ],
    limits: {
      dailyPixelQuota: 10000,
      maxDrawingSessionTime: 240,
      profileCustomization: 'premium'
    }
  },

  colonel: {
    badges: ['🔱', '⚡'],
    features: [
      { id: 'unlimited_storage', nameZh: '无限存储', nameEn: 'Unlimited Storage' },
      { id: 'api_access', nameZh: 'API访问', nameEn: 'API Access' }
    ],
    limits: {
      dailyPixelQuota: 20000,
      maxDrawingSessionTime: 360,
      profileCustomization: 'premium'
    }
  },

  general: {
    badges: ['🌈', '🎭'],
    features: [
      { id: 'early_access', nameZh: '新功能抢先体验', nameEn: 'Early Access' },
      { id: 'influence_votes', nameZh: '功能投票权', nameEn: 'Feature Votes' }
    ],
    limits: {
      dailyPixelQuota: 50000,
      maxDrawingSessionTime: 600,
      profileCustomization: 'ultimate'
    }
  },

  marshal: {
    badges: ['👑', '🌟', '💫', '🏅'],
    features: [
      { id: 'all_features', nameZh: '所有功能', nameEn: 'All Features' },
      { id: 'lifetime_vip', nameZh: '终身VIP', nameEn: 'Lifetime VIP' },
      { id: 'hall_of_fame', nameZh: '名人堂', nameEn: 'Hall of Fame' }
    ],
    limits: {
      dailyPixelQuota: 999999,        // 无限制
      maxDrawingSessionTime: 9999,    // 无限制
      profileCustomization: 'ultimate'
    }
  }
};

/**
 * 获取段位福利
 * @param {string} tierId - 段位ID
 * @returns {object} 福利信息
 */
function getTierBenefits(tierId) {
  return TIER_BENEFITS[tierId] || TIER_BENEFITS.recruit;
}

module.exports = { TIER_BENEFITS, getTierBenefits };
