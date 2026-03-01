const { redis, redisUtils } = require('../config/redis');
const logger = require('../utils/logger');

class CacheService {
  // 缓存键前缀
  static get PREFIXES() {
    return {
      PIXEL: 'pixel:',
      PIXEL_GRID: 'pixel_grid:',
      USER_STATE: 'user_state:',
      LEADERBOARD: 'leaderboard:',
      CHAT_MESSAGE: 'chat:',
      CHAT_HOT_MESSAGE: 'chat_hot:', // 新增：热门消息缓存
      CHAT_USER_INFO: 'chat_user:', // 新增：聊天用户信息缓存
      ALLIANCE: 'alliance:',
      USER_PROFILE: 'user_profile:',
      REGION_STATS: 'region_stats:',
      TODAY_STATS: 'stats:today:', // 🔧 新增：今日统计缓存
      TILE_SNAPSHOT: 'tile:',
      STREAM_PIXELS: 'stream:pixels'
    };
  }

  // 缓存过期时间（秒）- 优化聊天相关缓存
  static TTL = {
    PIXEL: 3600, // 1小时
    PIXEL_GRID: 1800, // 30分钟
    USER_STATE: 300, // 5分钟
    LEADERBOARD: 600, // 10分钟
    CHAT_MESSAGE: 300, // 5分钟 - 优化：从24小时改为5分钟
    CHAT_HOT_MESSAGE: 1800, // 30分钟 - 新增：热门消息缓存时间
    CHAT_USER_INFO: 3600, // 1小时 - 新增：用户信息缓存时间
    ALLIANCE: 1800, // 30分钟
    USER_PROFILE: 3600, // 1小时
    REGION_STATS: 1800, // 30分钟
    TODAY_STATS: 30, // 🔧 新增：今日统计30秒（iOS客户端已有30秒节流）
    TILE_SNAPSHOT: 3600, // 1小时
    STREAM_PIXELS: 86400 // 24小时
  };

  /**
   * 设置缓存
   */
  static async set(key, value, ttl = 3600) {
    try {
      const serializedValue = JSON.stringify(value);
      await redisUtils.setex(key, ttl, serializedValue);
      logger.debug('缓存设置成功', { key });
    } catch (error) {
      logger.error('缓存设置失败', { error: error.message, key });
    }
  }

  /**
   * 获取缓存
   */
  static async get(key) {
    try {
      const value = await redisUtils.get(key);
      if (value) {
        logger.debug('缓存命中', { key });
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      logger.error('缓存获取失败', { error: error.message, key });
      return null;
    }
  }

  /**
   * 删除缓存
   */
  static async del(key) {
    try {
      await redisUtils.del(key);
      logger.debug('缓存删除成功', { key });
    } catch (error) {
      logger.error('缓存删除失败', { error: error.message, key });
    }
  }

  /**
   * 批量删除缓存
   */
  static async delPattern(pattern) {
    try {
      const keys = await redisUtils.keys(pattern);
      if (keys.length > 0) {
        await redisUtils.del(...keys);
        console.log(`批量删除缓存成功: ${pattern}, 删除数量: ${keys.length}`);
      }
    } catch (error) {
      console.error('批量删除缓存失败:', error);
    }
  }

  /**
   * 设置缓存（带默认TTL）
   */
  static async setWithDefaultTTL(key, value, prefix = 'CHAT_MESSAGE') {
    const ttl = this.TTL[prefix] || 300;
    return this.set(key, value, ttl);
  }

  /**
   * 聊天消息缓存预热 - 新增功能
   */
  static async warmupChatCache(channelType, channelId, limit = 50) {
    try {
      const cacheKey = `chat:${channelType}:${channelId || 'global'}:1:${limit}`;
      const hotCacheKey = `chat_hot:${channelType}:${channelId || 'global'}`;
      
      // 检查是否已经预热
      const isWarmed = await this.get(`${cacheKey}:warmed`);
      if (isWarmed) {
        console.log(`聊天缓存已预热: ${cacheKey}`);
        return;
      }

      // 预热热门消息缓存
      await this.set(hotCacheKey, [], this.TTL.CHAT_HOT_MESSAGE);
      
      // 标记已预热
      await this.set(`${cacheKey}:warmed`, true, 300);
      
      console.log(`聊天缓存预热完成: ${cacheKey}`);
    } catch (error) {
      console.error('聊天缓存预热失败:', error);
    }
  }

  /**
   * 获取聊天用户信息缓存 - 新增功能
   */
  static async getChatUserInfo(userId) {
    const cacheKey = `chat_user:${userId}`;
    return this.get(cacheKey);
  }

  /**
   * 设置聊天用户信息缓存 - 新增功能
   */
  static async setChatUserInfo(userId, userInfo) {
    const cacheKey = `chat_user:${userId}`;
    return this.set(cacheKey, userInfo, this.TTL.CHAT_USER_INFO);
  }

  /**
   * 批量设置聊天用户信息缓存 - 新增功能
   */
  static async setChatUserInfoBatch(userInfos) {
    try {
      const pipeline = redis.pipeline();
      
      userInfos.forEach(({ userId, userInfo }) => {
        const cacheKey = `chat_user:${userId}`;
        pipeline.setex(cacheKey, this.TTL.CHAT_USER_INFO, JSON.stringify(userInfo));
      });
      
      await pipeline.exec();
      console.log(`批量设置聊天用户信息缓存成功: ${userInfos.length}个用户`);
    } catch (error) {
      console.error('批量设置聊天用户信息缓存失败:', error);
    }
  }

  /**
   * 智能缓存清理 - 新增功能
   */
  static async smartCleanupChatCache(channelType, channelId) {
    try {
      // 清理相关缓存
      const patterns = [
        `chat:${channelType}:${channelId || 'global'}:*`,
        `chat_hot:${channelType}:${channelId || 'global'}`,
        `unread_messages:*:${channelType}:${channelId || 'global'}:*`
      ];
      
      for (const pattern of patterns) {
        await this.delPattern(pattern);
      }
      
      console.log(`智能清理聊天缓存完成: ${channelType}:${channelId || 'global'}`);
    } catch (error) {
      console.error('智能清理聊天缓存失败:', error);
    }
  }

  /**
   * 设置像素缓存
   */
  static async setPixel(gridId, pixelData) {
    const key = `${this.PREFIXES.PIXEL}${gridId}`;
    await this.set(key, pixelData, this.TTL.PIXEL);
  }

  /**
   * 获取像素缓存
   */
  static async getPixel(gridId) {
    const key = `${this.PREFIXES.PIXEL}${gridId}`;
    return await this.get(key);
  }

  /**
   * 设置用户状态缓存
   */
  static async setUserState(userId, stateData) {
    const key = `${this.PREFIXES.USER_STATE}${userId}`;
    await this.set(key, stateData, this.TTL.USER_STATE);
  }

  /**
   * 获取用户状态缓存
   */
  static async getUserState(userId) {
    const key = `${this.PREFIXES.USER_STATE}${userId}`;
    return await this.get(key);
  }

  /**
   * 设置排行榜缓存
   */
  static async setLeaderboard(type, period, data) {
    const key = `${this.PREFIXES.LEADERBOARD}${type}:${period}`;
    await this.set(key, data, this.TTL.LEADERBOARD);
  }

  /**
   * 获取排行榜缓存
   */
  static async getLeaderboard(type, period) {
    const key = `${this.PREFIXES.LEADERBOARD}${type}:${period}`;
    return await this.get(key);
  }

  /**
   * 设置瓦片快照缓存
   */
  static async setTileSnapshot(tileId, snapshot) {
    const key = `${this.PREFIXES.TILE_SNAPSHOT}${tileId}:snapshot`;
    await this.set(key, snapshot, this.TTL.TILE_SNAPSHOT);
  }

  /**
   * 获取瓦片快照缓存
   */
  static async getTileSnapshot(tileId) {
    const key = `${this.PREFIXES.TILE_SNAPSHOT}${tileId}:snapshot`;
    return await this.get(key);
  }

  /**
   * 删除瓦片快照缓存
   */
  static async deleteTileSnapshot(tileId) {
    const key = `${this.PREFIXES.TILE_SNAPSHOT}${tileId}:snapshot`;
    await this.del(key);
  }

  /**
   * 增加像素计数
   */
  static async incrementPixelCount() {
    try {
      const key = 'stats:global:pixelCount';
      await redisUtils.incr(key);
      console.log('像素计数增加成功');
    } catch (error) {
      console.error('增加像素计数失败:', error);
    }
  }

  /**
   * 获取像素计数
   */
  static async getPixelCount() {
    try {
      const key = 'stats:global:pixelCount';
      const count = await redisUtils.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('获取像素计数失败:', error);
      return 0;
    }
  }

  /**
   * 设置联盟统计缓存
   */
  static async setAllianceStats(allianceId, stats) {
    const key = `${this.PREFIXES.ALLIANCE}${allianceId}:stats`;
    await this.set(key, stats, this.TTL.ALLIANCE);
  }

  /**
   * 获取联盟统计缓存
   */
  static async getAllianceStats(allianceId) {
    const key = `${this.PREFIXES.ALLIANCE}${allianceId}:stats`;
    return await this.get(key);
  }

  /**
   * 设置用户资料缓存
   */
  static async setUserProfile(userId, profile) {
    const key = `${this.PREFIXES.USER_PROFILE}${userId}`;
    await this.set(key, profile, this.TTL.USER_PROFILE);
  }

  /**
   * 获取用户资料缓存
   */
  static async getUserProfile(userId) {
    const key = `${this.PREFIXES.USER_PROFILE}${userId}`;
    return await this.get(key);
  }

  /**
   * 设置地区统计缓存
   */
  static async setRegionStats(regionId, stats) {
    const key = `${this.PREFIXES.REGION_STATS}${regionId}`;
    await this.set(key, stats, this.TTL.REGION_STATS);
  }

  /**
   * 获取地区统计缓存
   */
  static async getRegionStats(regionId) {
    const key = `${this.PREFIXES.REGION_STATS}${regionId}`;
    return await this.get(key);
  }

  /**
   * 清除用户相关缓存
   */
  static async clearUserCache(userId) {
    try {
      const patterns = [
        `${this.PREFIXES.USER_STATE}${userId}`,
        `${this.PREFIXES.USER_PROFILE}${userId}`,
        `${this.PREFIXES.LEADERBOARD}*`
      ];

      for (const pattern of patterns) {
        await this.delPattern(pattern);
      }

      console.log(`用户缓存清除成功: ${userId}`);
    } catch (error) {
      console.error('清除用户缓存失败:', error);
    }
  }

  /**
   * 清除像素相关缓存
   */
  static async clearPixelCache(gridId) {
    try {
      const patterns = [
        `${this.PREFIXES.PIXEL}${gridId}`,
        `${this.PREFIXES.PIXEL_GRID}*`
      ];

      for (const pattern of patterns) {
        await this.delPattern(pattern);
      }

      console.log(`像素缓存清除成功: ${gridId}`);
    } catch (error) {
      console.error('清除像素缓存失败:', error);
    }
  }

  /**
   * 清除排行榜缓存
   */
  static async clearLeaderboardCache(type = null) {
    try {
      const pattern = type 
        ? `${this.PREFIXES.LEADERBOARD}${type}:*`
        : `${this.PREFIXES.LEADERBOARD}*`;
      
      await this.delPattern(pattern);
      console.log(`排行榜缓存清除成功: ${type || 'all'}`);
    } catch (error) {
      console.error('清除排行榜缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  static async getCacheStats() {
    try {
      const stats = {};
      
      for (const [prefixName, prefix] of Object.entries(this.PREFIXES)) {
        const pattern = `${prefix}*`;
        const keys = await redisUtils.keys(pattern);
        stats[prefixName] = keys.length;
      }

      return {
        totalKeys: Object.values(stats).reduce((sum, count) => sum + count, 0),
        byPrefix: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return null;
    }
  }

  /**
   * 预热排行榜缓存
   */
  static async warmupLeaderboardCache() {
    try {
      console.log('🔥 开始预热排行榜缓存...');
      
      // 这里可以添加预热逻辑
      // 例如：预先计算并缓存热门排行榜
      
      console.log('✅ 排行榜缓存预热完成');
      return true;
    } catch (error) {
      console.error('❌ 预热排行榜缓存失败:', error);
      return false;
    }
  }

  /**
   * 清理过期缓存
   */
  static async cleanupExpiredCache() {
    try {
      console.log('🧹 开始清理过期缓存...');
      
      // Redis会自动清理过期的键，这里可以添加额外的清理逻辑
      
      console.log('✅ 过期缓存清理完成');
      return true;
    } catch (error) {
      console.error('❌ 清理过期缓存失败:', error);
      return false;
    }
  }
}

module.exports = CacheService;
