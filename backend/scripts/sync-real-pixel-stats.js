const { db } = require('../src/config/database');
const PixelStatsService = require('../src/services/pixelStatsService');
const logger = require('../src/utils/logger');

/**
 * 同步真实像素统计数据脚本
 * 用于初始化和定期同步用户和联盟的真实绘制像素统计
 * 剔除广告、图案炸弹等道具类像素
 */
class RealPixelStatsSyncer {

  /**
   * 执行完整同步流程
   */
  static async syncAll() {
    logger.info('🚀 开始同步真实像素统计数据');

    try {
      const results = {};

      // 1. 同步用户真实像素统计
      results.users = await this.syncUserRealStats();

      // 2. 同步联盟真实像素统计
      results.alliances = await this.syncAllianceRealStats();

      // 3. 更新排行榜数据
      results.leaderboard = await this.regenerateLeaderboard();

      logger.info('✅ 真实像素统计数据同步完成:', results);

      return {
        success: true,
        results
      };

    } catch (error) {
      logger.error('❌ 真实像素统计数据同步失败:', error);
      throw error;
    }
  }

  /**
   * 同步用户真实像素统计
   */
  static async syncUserRealStats() {
    logger.info('🔄 开始同步用户真实像素统计');

    try {
      const startTime = Date.now();

      // 使用PixelStatsService批量更新
      const result = await PixelStatsService.batchUpdateUserRealStats();

      const processingTime = Date.now() - startTime;

      logger.info(`✅ 用户真实像素统计同步完成:`, {
        updatedUsers: result.updatedUsers,
        totalUsers: result.totalUsers,
        processingTime: `${processingTime}ms`
      });

      return result;

    } catch (error) {
      logger.error('❌ 用户真实像素统计同步失败:', error);
      throw error;
    }
  }

  /**
   * 同步联盟真实像素统计
   */
  static async syncAllianceRealStats() {
    logger.info('🔄 开始同步联盟真实像素统计');

    try {
      const startTime = Date.now();

      // 获取所有活跃联盟
      const alliances = await db('alliances')
        .where('is_active', true)
        .select('id');

      let processedAlliances = 0;
      let updatedAlliances = 0;

      for (const alliance of alliances) {
        try {
          // 获取联盟成员
          const members = await db('alliance_members')
            .where('alliance_id', alliance.id)
            .select('user_id');

          const memberIds = members.map(m => m.user_id);

          if (memberIds.length > 0) {
            // 计算真实像素统计
            const realStats = await PixelStatsService.getAllianceRealPixelStats(
              alliance.id,
              memberIds,
              {
                includeToday: true,
                includeWeek: true,
                includeAllTime: true
              }
            );

            // 更新联盟统计表（如果有的话）
            await this.updateAllianceStats(alliance.id, realStats);

            updatedAlliances++;
          }

          processedAlliances++;

          // 添加延迟避免数据库压力
          await this.sleep(10);

        } catch (error) {
          logger.error(`❌ 同步联盟 ${alliance.id} 失败:`, error);
        }
      }

      const processingTime = Date.now() - startTime;

      logger.info(`✅ 联盟真实像素统计同步完成:`, {
        processedAlliances,
        updatedAlliances,
        processingTime: `${processingTime}ms`
      });

      return {
        processedAlliances,
        updatedAlliances,
        processingTime
      };

    } catch (error) {
      logger.error('❌ 联盟真实像素统计同步失败:', error);
      throw error;
    }
  }

  /**
   * 更新联盟统计数据
   */
  static async updateAllianceStats(allianceId, realStats) {
    try {
      // 如果有联盟统计表，更新真实统计数据
      const allianceStatsExists = await db.schema.hasTable('alliance_stats');

      if (allianceStatsExists) {
        await db('alliance_stats')
          .where('alliance_id', allianceId)
          .update({
            real_total_pixels: realStats.totalPixels,
            real_current_pixels: realStats.currentOwnership,
            real_today_pixels: realStats.todayPixels,
            real_week_pixels: realStats.weekPixels,
            updated_at: new Date()
          });
      }

    } catch (error) {
      logger.warn(`更新联盟 ${allianceId} 统计数据失败:`, error);
    }
  }

  /**
   * 重新生成排行榜数据
   */
  static async regenerateLeaderboard() {
    logger.info('🔄 开始重新生成排行榜数据');

    try {
      const startTime = Date.now();

      const Leaderboard = require('../models/Leaderboard');

      // 生成不同周期的排行榜
      const periods = ['daily', 'weekly', 'monthly'];
      const results = {};

      for (const period of periods) {
        try {
          // 生成个人排行榜
          const userLeaderboard = await Leaderboard.generateUserLeaderboard(period);
          const userCount = userLeaderboard.length;

          // 生成联盟排行榜
          const allianceLeaderboard = await Leaderboard.generateAllianceLeaderboard(period);
          const allianceCount = allianceLeaderboard.length;

          results[period] = {
            userCount,
            allianceCount
          };

          logger.debug(`✅ ${period} 排行榜生成完成: 用户${userCount}个, 联盟${allianceCount}个`);

        } catch (error) {
          logger.error(`❌ 生成 ${period} 排行榜失败:`, error);
          results[period] = { error: error.message };
        }
      }

      const processingTime = Date.now() - startTime;

      logger.info(`✅ 排行榜重新生成完成:`, {
        results,
        processingTime: `${processingTime}ms`
      });

      return {
        results,
        processingTime
      };

    } catch (error) {
      logger.error('❌ 排行榜重新生成失败:', error);
      throw error;
    }
  }

  /**
   * 获取同步统计信息
   */
  static async getSyncStats() {
    try {
      // 用户统计对比
      const userComparison = await db.raw(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN real_total_pixels IS NOT NULL THEN 1 END) as users_with_real_stats,
          SUM(total_pixels) as total_pixels,
          SUM(real_total_pixels) as real_total_pixels,
          SUM(current_pixels) as current_pixels,
          SUM(real_current_pixels) as real_current_pixels
        FROM users
      `);

      // 像素类型统计
      const pixelTypeStats = await db('pixels')
        .select('pixel_type')
        .count('* as count')
        .groupBy('pixel_type');

      // 统计结果
      const userStats = userComparison.rows[0];
      const stats = {
        users: {
          total: parseInt(userStats.total_users),
          withRealStats: parseInt(userStats.users_with_real_stats),
          syncPercentage: userStats.total_users > 0
            ? ((userStats.users_with_real_stats / userStats.total_users) * 100).toFixed(2) + '%'
            : '0%',
          comparison: {
            totalPixels: parseInt(userStats.total_pixels) || 0,
            realTotalPixels: parseInt(userStats.real_total_pixels) || 0,
            currentPixels: parseInt(userStats.current_pixels) || 0,
            realCurrentPixels: parseInt(userStats.real_current_pixels) || 0,
            deltaTotal: (parseInt(userStats.total_pixels) || 0) - (parseInt(userStats.real_total_pixels) || 0),
            deltaCurrent: (parseInt(userStats.current_pixels) || 0) - (parseInt(userStats.real_current_pixels) || 0)
          }
        },
        pixelTypes: {}
      };

      // 像素类型统计
      for (const typeStat of pixelTypeStats) {
        stats.pixelTypes[typeStat.pixel_type] = parseInt(typeStat.count);
      }

      return stats;

    } catch (error) {
      logger.error('❌ 获取同步统计信息失败:', error);
      return null;
    }
  }

  /**
   * 延迟函数
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  console.log('📊 获取当前同步统计信息...');

  RealPixelStatsSyncer.getSyncStats().then(stats => {
    console.log('📊 当前同步统计信息:', JSON.stringify(stats, null, 2));

    if (stats && stats.users.syncPercentage !== '100.00%') {
      console.log('\n🚀 开始同步真实像素统计数据...');
      return RealPixelStatsSyncer.syncAll();
    } else {
      console.log('\n✅ 所有用户已同步，无需执行同步操作');
      return { success: true, message: '已同步' };
    }
  }).then(result => {
    console.log('✅ 同步完成:', JSON.stringify(result, null, 2));
    process.exit(0);
  }).catch(error => {
    console.error('❌ 同步失败:', error);
    process.exit(1);
  });
}

module.exports = RealPixelStatsSyncer;