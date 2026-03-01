const UserPixelState = require('../models/UserPixelState');

/**
 * 自然累计处理服务
 * 负责处理用户的自然累计点数增长
 */
class NaturalAccumulationService {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.checkInterval = 10000; // 10秒检查一次
  }

  /**
   * 启动自然累计处理服务
   */
  start() {
    if (this.isRunning) {
      console.log('自然累计服务已在运行中');
      return;
    }

    this.isRunning = true;
    this.interval = setInterval(async () => {
      await this.processAllUsers();
    }, this.checkInterval);

    console.log(`✅ 自然累计服务已启动，检查间隔: ${this.checkInterval}ms`);
  }

  /**
   * 停止自然累计处理服务
   */
  stop() {
    if (!this.isRunning) {
      console.log('自然累计服务未在运行');
      return;
    }

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('✅ 自然累计服务已停止');
  }

  /**
   * 处理所有用户的自然累计
   */
  async processAllUsers() {
    try {
      // 这里可以添加获取所有活跃用户的逻辑
      // 目前先处理已知的用户
      console.log('🔄 开始处理自然累计...');
      
      // 可以在这里添加获取所有在自然累计阶段的用户的逻辑
      // 例如：从Redis或数据库中获取所有 is_in_natural_accumulation = true 的用户
      
    } catch (error) {
      console.error('❌ 处理自然累计失败:', error);
    }
  }

  /**
   * 处理单个用户的自然累计
   */
  async processUserNaturalAccumulation(userId) {
    try {
      const result = await UserPixelState.processNaturalAccumulation(userId);
      if (result) {
        console.log(`✅ 用户 ${userId} 自然累计处理完成`);
      }
      return result;
    } catch (error) {
      console.error(`❌ 处理用户 ${userId} 自然累计失败:`, error);
      return null;
    }
  }

  /**
   * 手动触发用户活动（用于测试）
   */
  async triggerUserActivity(userId) {
    try {
      await UserPixelState.updateActivityTime(userId);
      console.log(`✅ 用户 ${userId} 活动时间已更新`);
    } catch (error) {
      console.error(`❌ 更新用户 ${userId} 活动时间失败:`, error);
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      lastCheck: new Date().toISOString()
    };
  }
}

// 创建全局实例
const naturalAccumulationService = new NaturalAccumulationService();

module.exports = naturalAccumulationService;
