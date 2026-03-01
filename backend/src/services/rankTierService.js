const { RANK_TIERS } = require('../constants/rankTiers');

class RankTierService {
  /**
   * 根据总像素数计算段位信息
   * @param {number} totalPixels - 用户累计总像素数
   * @returns {object} 段位信息，包含当前段位和进度
   */
  static getTierForPixels(totalPixels) {
    const pixels = totalPixels || 0;

    // 找到当前段位（从高到低遍历，找到第一个 minPixels <= pixels 的段位）
    let currentTier = RANK_TIERS[0];
    let currentIndex = 0;

    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (pixels >= RANK_TIERS[i].minPixels) {
        currentTier = RANK_TIERS[i];
        currentIndex = i;
        break;
      }
    }

    // 计算到下一段位的进度
    const isMaxTier = currentIndex === RANK_TIERS.length - 1;
    const nextTier = isMaxTier ? null : RANK_TIERS[currentIndex + 1];
    const nextTierPixels = nextTier ? nextTier.minPixels : currentTier.minPixels;

    let progress = 0;
    if (!isMaxTier && nextTier) {
      const range = nextTier.minPixels - currentTier.minPixels;
      const current = pixels - currentTier.minPixels;
      progress = range > 0 ? Math.min(current / range, 1) : 0;
    } else {
      progress = 1; // 已达最高段位
    }

    return {
      id: currentTier.id,
      name: currentTier.name,
      nameEn: currentTier.nameEn,
      icon: currentTier.icon,
      color: currentTier.color,
      currentPixels: pixels,
      nextTierPixels: nextTierPixels,
      progress: Math.round(progress * 1000) / 1000 // 保留3位小数
    };
  }
}

module.exports = RankTierService;
