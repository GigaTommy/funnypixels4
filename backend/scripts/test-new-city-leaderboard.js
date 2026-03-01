const CityLeaderboardService = require('../src/services/cityLeaderboardService');
const logger = require('../src/utils/logger');

/**
 * 测试新的城市排行榜服务
 * 验证基于OpenStreetMap PostGIS的排行榜生成功能
 */
async function testCityLeaderboard() {
  try {
    logger.info('🧪 开始测试新的城市排行榜服务...\n');

    const date = new Date().toISOString().split('T')[0];

    // 测试所有时间周期
    const periods = ['daily', 'weekly', 'monthly', 'yearly', 'allTime'];

    for (const period of periods) {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`📅 测试 ${period} 排行榜...`);
      logger.info('='.repeat(60));

      const startTime = Date.now();

      try {
        const leaderboard = await CityLeaderboardService.generateLeaderboard(
          period,
          date,
          { forceRefresh: true } // 强制刷新缓存以测试实际查询
        );

        const elapsed = Date.now() - startTime;

        logger.info(`✅ ${period} 排行榜生成成功`);
        logger.info(`⏱️  耗时: ${elapsed}ms`);
        logger.info(`📊 城市总数: ${leaderboard.length}`);

        if (leaderboard.length > 0) {
          logger.info(`\n🏆 前10名城市:`);
          leaderboard.slice(0, 10).forEach((city, index) => {
            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const cityName = city.city || city.name || '未知';
            const province = city.province ? `(${city.province})` : '';
            const pixels = city.pixel_count.toLocaleString().padStart(6);
            const users = city.user_count.toLocaleString().padStart(5);
            const source = city.source || 'unknown';
            const quality = city.match_quality?.perfect || 0;

            logger.info(`  ${rankIcon.padEnd(4)} ${cityName.padEnd(12)} ${province.padEnd(10)} - ${pixels} 像素, ${users} 用户 [${source}, perfect:${quality}]`);
          });

          // 统计数据质量
          const qualityStats = {};
          leaderboard.forEach(city => {
            const source = city.source || 'unknown';
            qualityStats[source] = (qualityStats[source] || 0) + 1;
          });

          logger.info(`\n📊 数据源分布:`);
          Object.entries(qualityStats).forEach(([source, count]) => {
            const percentage = ((count / leaderboard.length) * 100).toFixed(1);
            logger.info(`  ${source}: ${count} (${percentage}%)`);
          });

        } else {
          logger.warn(`⚠️  ${period} 排行榜数据为空`);
        }

      } catch (error) {
        logger.error(`❌ ${period} 排行榜测试失败:`, error.message);
      }
    }

    // 测试缓存功能
    logger.info(`\n${'='.repeat(60)}`);
    logger.info('🧪 测试缓存功能...');
    logger.info('='.repeat(60));

    const cacheTestPeriod = 'daily';

    // 第一次查询（未缓存）
    const startTime1 = Date.now();
    await CityLeaderboardService.generateLeaderboard(cacheTestPeriod, date, { forceRefresh: true });
    const elapsed1 = Date.now() - startTime1;
    logger.info(`⏱️  第一次查询（未缓存）: ${elapsed1}ms`);

    // 第二次查询（使用缓存）
    const startTime2 = Date.now();
    await CityLeaderboardService.generateLeaderboard(cacheTestPeriod, date, { forceRefresh: false });
    const elapsed2 = Date.now() - startTime2;
    logger.info(`⏱️  第二次查询（使用缓存）: ${elapsed2}ms`);

    const speedup = (elapsed1 / elapsed2).toFixed(2);
    logger.info(`🚀 缓存加速: ${speedup}x`);

    // 测试服务状态
    logger.info(`\n${'='.repeat(60)}`);
    logger.info('📊 服务状态信息');
    logger.info('='.repeat(60));

    const status = await CityLeaderboardService.getServiceStatus();
    logger.info(JSON.stringify(status, null, 2));

    // 测试缓存清理
    logger.info(`\n${'='.repeat(60)}`);
    logger.info('🧹 测试缓存清理...');
    logger.info('='.repeat(60));

    const clearedCount = await CityLeaderboardService.clearCache();
    logger.info(`✅ 已清理 ${clearedCount} 个缓存项`);

    logger.info('\n' + '='.repeat(60));
    logger.info('🎉 所有测试完成！');
    logger.info('='.repeat(60));

    process.exit(0);

  } catch (error) {
    logger.error('❌ 测试失败:', error);
    logger.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
testCityLeaderboard();
