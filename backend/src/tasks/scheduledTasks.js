/**
 * 定时任务调度器
 *
 * 管理所有后台定时任务的注册和执行
 */

const cron = require('node-cron');
const logger = require('../utils/logger');

// 导入定时任务
const { anonymizeExpiredAccounts } = require('./anonymizeExpiredAccounts');
const { hardDeleteAnonymizedAccounts } = require('./hardDeleteAnonymizedAccounts');

/**
 * 注册所有定时任务
 */
function registerScheduledTasks() {
  logger.info('📅 注册定时任务...');

  // 1. 账户匿名化任务 - 每天凌晨2点执行
  cron.schedule('0 2 * * *', async () => {
    logger.info('⏰ 触发账户匿名化任务');
    try {
      const result = await anonymizeExpiredAccounts();
      logger.info('✅ 账户匿名化任务完成', result);
    } catch (error) {
      logger.error('❌ 账户匿名化任务失败', {
        error: error.message,
        stack: error.stack
      });
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'  // 设置时区
  });

  logger.info('✅ 已注册：账户匿名化任务 (每天 02:00)');

  // 2. 账户硬删除任务 - 每周日凌晨3点执行
  cron.schedule('0 3 * * 0', async () => {
    logger.info('⏰ 触发账户硬删除任务');
    try {
      const result = await hardDeleteAnonymizedAccounts();
      logger.info('✅ 账户硬删除任务完成', result);
    } catch (error) {
      logger.error('❌ 账户硬删除任务失败', {
        error: error.message,
        stack: error.stack
      });
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });

  logger.info('✅ 已注册：账户硬删除任务 (每周日 03:00)');

  // 3. 可选：开发环境手动触发（用于测试）
  if (process.env.NODE_ENV === 'development') {
    logger.info('🔧 开发模式：可通过 API 手动触发定时任务');
  }

  logger.info('🎉 所有定时任务注册完成');
}

/**
 * 手动触发匿名化任务（用于测试）
 */
async function triggerAnonymizationManually() {
  logger.info('🔧 手动触发账户匿名化任务');
  return await anonymizeExpiredAccounts();
}

/**
 * 手动触发硬删除任务（用于测试）
 */
async function triggerHardDeleteManually() {
  logger.info('🔧 手动触发账户硬删除任务');
  return await hardDeleteAnonymizedAccounts();
}

module.exports = {
  registerScheduledTasks,
  triggerAnonymizationManually,
  triggerHardDeleteManually
};
