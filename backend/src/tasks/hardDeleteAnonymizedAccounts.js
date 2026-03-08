/**
 * 定时任务：硬删除已匿名化的账户
 *
 * 执行时机：每周日凌晨3点
 * cron: '0 3 * * 0'
 *
 * 功能：
 * - 查找90天前匿名化的账户（account_status = 'anonymized'）
 * - 删除敏感数据（私信、位置历史、活动日志）
 * - 删除过期的交易记录（保留7年后）
 * - 删除过期的审计日志（保留3年后）
 * - 标记为 'purged' 状态或完全删除用户记录
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * 硬删除已匿名化的账户
 */
async function hardDeleteAnonymizedAccounts() {
  const startTime = Date.now();
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90天前

  logger.info('🕒 开始执行账户硬删除任务', {
    cutoffDate: cutoffDate.toISOString()
  });

  try {
    // 1. 查找90天前匿名化的账户
    const accountsToDelete = await db('users')
      .where('account_status', 'anonymized')
      .where('anonymized_at', '<', cutoffDate)
      .select('id', 'anonymized_at');

    if (accountsToDelete.length === 0) {
      logger.info('✅ 无需硬删除的账户');
      return {
        success: true,
        processed: 0,
        message: '无需处理的账户'
      };
    }

    logger.info(`找到 ${accountsToDelete.length} 个需要硬删除的账户`);

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // 2. 逐个处理账户硬删除
    for (const user of accountsToDelete) {
      try {
        await hardDeleteUser(user);
        successCount++;
        logger.info(`✅ 账户已硬删除: ${user.id}`);
      } catch (error) {
        failCount++;
        errors.push({
          userId: user.id,
          error: error.message
        });
        logger.error(`❌ 账户硬删除失败: ${user.id}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info('🎉 账户硬删除任务完成', {
      total: accountsToDelete.length,
      success: successCount,
      failed: failCount,
      duration: `${duration}ms`
    });

    // 3. 发送汇总报告（如果有失败）
    if (failCount > 0) {
      await sendHardDeleteFailureAlert({
        total: accountsToDelete.length,
        failed: failCount,
        errors: errors
      });
    }

    return {
      success: true,
      processed: successCount,
      failed: failCount,
      duration
    };

  } catch (error) {
    logger.error('❌ 账户硬删除任务失败', {
      error: error.message,
      stack: error.stack
    });

    // 发送告警
    await sendCriticalAlert('Account hard deletion job failed', error);

    throw error;
  }
}

/**
 * 硬删除单个用户
 * @param {Object} user - 用户对象
 */
async function hardDeleteUser(user) {
  return await db.transaction(async (trx) => {
    const now = new Date();

    // 1. 删除私信（完全删除）
    const messageResult = await trx('private_messages')
      .where('sender_id', user.id)
      .orWhere('receiver_id', user.id)
      .del();

    logger.debug(`删除私信: ${messageResult} 条`, { userId: user.id });

    // 2. 删除位置历史记录
    if (await trx.schema.hasTable('location_history')) {
      const locationResult = await trx('location_history')
        .where('user_id', user.id)
        .del();

      logger.debug(`删除位置历史: ${locationResult} 条`, { userId: user.id });
    }

    // 3. 删除用户活动日志
    if (await trx.schema.hasTable('user_activity_logs')) {
      const activityResult = await trx('user_activity_logs')
        .where('user_id', user.id)
        .del();

      logger.debug(`删除活动日志: ${activityResult} 条`, { userId: user.id });
    }

    // 4. 删除IP日志
    if (await trx.schema.hasTable('ip_logs')) {
      await trx('ip_logs')
        .where('user_id', user.id)
        .del();
    }

    // 5. 删除设备信息
    if (await trx.schema.hasTable('user_devices')) {
      await trx('user_devices')
        .where('user_id', user.id)
        .del();
    }

    // 6. 删除过期的IAP交易记录（保留7年后）
    const sevenYearsAgo = new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000);
    if (await trx.schema.hasTable('store_purchases')) {
      const purchaseResult = await trx('store_purchases')
        .where('user_id', user.id)
        .where('created_at', '<', sevenYearsAgo)
        .del();

      logger.debug(`删除过期交易记录: ${purchaseResult} 条`, { userId: user.id });
    }

    // 7. 删除过期审计日志（保留3年后）
    const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
    const auditResult = await trx('audit_logs')
      .where('user_id', user.id)
      .where('created_at', '<', threeYearsAgo)
      .del();

    logger.debug(`删除过期审计日志: ${auditResult} 条`, { userId: user.id });

    // 8. 删除隐私设置
    if (await trx.schema.hasTable('privacy_settings')) {
      await trx('privacy_settings')
        .where('user_id', user.id)
        .del();
    }

    // 9. 删除用户积分记录
    if (await trx.schema.hasTable('user_points')) {
      await trx('user_points')
        .where('user_id', user.id)
        .del();
    }

    // 10. 删除用户像素状态
    if (await trx.schema.hasTable('user_pixel_states')) {
      await trx('user_pixel_states')
        .where('user_id', user.id)
        .del();
    }

    // 11. 处理用户记录本身
    // 选项A: 标记为 'purged'（推荐 - 保留外键完整性）
    await trx('users').where('id', user.id).update({
      account_status: 'purged',
      purged_at: now,
      updated_at: now
    });

    // 选项B: 完全删除用户记录（如果确定没有外键依赖）
    // await trx('users').where('id', user.id).del();

    // 12. 记录最终审计日志
    await trx('audit_logs').insert({
      id: require('uuid').v4(),
      user_id: user.id,
      action: 'account_purged',
      metadata: JSON.stringify({
        anonymized_at: user.anonymized_at,
        purged_at: now,
        retention_period_days: 90
      }),
      created_at: now
    });
  });
}

/**
 * 发送硬删除失败告警
 */
async function sendHardDeleteFailureAlert(report) {
  // TODO: 实现告警服务
  logger.warn('⚠️ 部分账户硬删除失败', report);
}

/**
 * 发送严重告警
 */
async function sendCriticalAlert(title, error) {
  // TODO: 实现告警服务
  logger.error(`🚨 ${title}`, {
    error: error.message,
    stack: error.stack
  });
}

module.exports = {
  hardDeleteAnonymizedAccounts,
  hardDeleteUser
};
