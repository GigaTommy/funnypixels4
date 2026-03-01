/**
 * 每日漂流瓶配额重置定时任务
 * 每天凌晨0点执行
 */

const cron = require('node-cron');
const quotaService = require('../services/driftBottleQuotaService');
const logger = require('../utils/logger');

/**
 * 启动每日配额重置任务
 */
function startDailyQuotaResetTask() {
  // 每天 00:00:00 执行
  cron.schedule('0 0 * * *', async () => {
    logger.info('🔄 Starting daily bottle quota reset task...');

    try {
      const deleted = await quotaService.resetDailyQuota();
      logger.info(`✅ Daily bottle quota reset completed. ${deleted} old records deleted.`);
    } catch (error) {
      logger.error('❌ Daily bottle quota reset failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'  // 使用中国时区
  });

  logger.info('✅ Daily bottle quota reset task scheduled (00:00 Asia/Shanghai)');
}

module.exports = {
  startDailyQuotaResetTask
};
