/**
 * 炸弹冷却时间管理服务
 * 统一管理所有类型炸弹的冷却时间逻辑
 */

const { redisUtils } = require('../config/redis');

class BombCooldownService {
  /**
   * 检查炸弹冷却时间
   * @param {string} userId - 用户ID
   * @param {string} bombType - 炸弹类型 (color_bomb, emoji_bomb, alliance_bomb)
   * @returns {Promise<{canUse: boolean, remainingSeconds: number, remainingMinutes: number}>}
   */
  static async checkCooldown(userId, bombType = 'general') {
    try {
      const cooldownKey = `bomb_cooldown:${userId}`;
      const cooldownExists = await redisUtils.exists(cooldownKey);
      
      if (!cooldownExists) {
        return {
          canUse: true,
          remainingSeconds: 0,
          remainingMinutes: 0
        };
      }
      
      const ttl = await redisUtils.ttl(cooldownKey);
      const remainingMinutes = Math.ceil(ttl / 60);
      
      return {
        canUse: false,
        remainingSeconds: ttl,
        remainingMinutes: remainingMinutes
      };
    } catch (error) {
      console.error('检查炸弹冷却时间失败:', error);
      // 出错时允许使用，避免阻塞用户
      return {
        canUse: true,
        remainingSeconds: 0,
        remainingMinutes: 0
      };
    }
  }

  /**
   * 设置炸弹冷却时间
   * @param {string} userId - 用户ID
   * @param {number} cooldownMinutes - 冷却时间（分钟）
   * @param {string} bombType - 炸弹类型
   */
  static async setCooldown(userId, cooldownMinutes, bombType = 'general') {
    try {
      const cooldownKey = `bomb_cooldown:${userId}`;
      const cooldownSeconds = cooldownMinutes * 60;
      
      await redisUtils.setex(cooldownKey, cooldownSeconds, '1');
      console.log(`💣 设置炸弹冷却时间: 用户=${userId}, 类型=${bombType}, 冷却=${cooldownMinutes}分钟`);
    } catch (error) {
      console.error('设置炸弹冷却时间失败:', error);
      throw error;
    }
  }

  /**
   * 清除炸弹冷却时间（管理员功能）
   * @param {string} userId - 用户ID
   */
  static async clearCooldown(userId) {
    try {
      const cooldownKey = `bomb_cooldown:${userId}`;
      await redisUtils.del(cooldownKey);
      console.log(`💣 清除炸弹冷却时间: 用户=${userId}`);
    } catch (error) {
      console.error('清除炸弹冷却时间失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有炸弹类型的冷却时间配置
   * @returns {Object} 炸弹冷却时间配置
   */
  static getBombCooldownConfig() {
    return {
      color_bomb: 30,    // 30分钟
      emoji_bomb: 30,    // 30分钟
      alliance_bomb: 30, // 30分钟
      pattern_bomb: 30,  // 30分钟
      clear_bomb: 30     // 30分钟
    };
  }

  /**
   * 根据炸弹类型获取冷却时间
   * @param {string} bombType - 炸弹类型
   * @returns {number} 冷却时间（分钟）
   */
  static getCooldownMinutes(bombType) {
    const config = this.getBombCooldownConfig();
    return config[bombType] || 30; // 默认30分钟
  }

  /**
   * 验证炸弹使用权限
   * @param {string} userId - 用户ID
   * @param {string} bombType - 炸弹类型
   * @returns {Promise<{canUse: boolean, error?: string}>}
   */
  static async validateBombUsage(userId, bombType) {
    try {
      const cooldownCheck = await this.checkCooldown(userId, bombType);
      
      if (!cooldownCheck.canUse) {
        return {
          canUse: false,
          error: `炸弹冷却中，还需等待${cooldownCheck.remainingMinutes}分钟`
        };
      }
      
      return {
        canUse: true
      };
    } catch (error) {
      console.error('验证炸弹使用权限失败:', error);
      return {
        canUse: false,
        error: '炸弹冷却时间检查失败'
      };
    }
  }
}

module.exports = BombCooldownService;
