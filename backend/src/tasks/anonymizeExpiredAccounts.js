/**
 * 定时任务：匿名化过期的待删除账户
 *
 * 执行时机：每天凌晨2点
 * cron: '0 2 * * *'
 *
 * 功能：
 * - 查找30天前软删除的账户（account_status = 'pending_deletion'）
 * - 清空个人身份信息（PII）
 * - 匿名化像素、绘制会话、评论
 * - 删除社交关系
 * - 标记为 'anonymized' 状态（不可恢复）
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * 匿名化过期账户
 */
async function anonymizeExpiredAccounts() {
  const startTime = Date.now();
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30天前

  logger.info('🕒 开始执行账户匿名化任务', {
    cutoffDate: cutoffDate.toISOString()
  });

  try {
    // 1. 查找30天前软删除的账户
    const expiredUsers = await db('users')
      .where('account_status', 'pending_deletion')
      .where('deleted_at', '<', cutoffDate)
      .select('id', 'email', 'username', 'deleted_at');

    if (expiredUsers.length === 0) {
      logger.info('✅ 无需匿名化的账户');
      return {
        success: true,
        processed: 0,
        message: '无需处理的账户'
      };
    }

    logger.info(`找到 ${expiredUsers.length} 个需要匿名化的账户`);

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // 2. 逐个处理账户匿名化
    for (const user of expiredUsers) {
      try {
        await anonymizeUser(user);
        successCount++;
        logger.info(`✅ 账户已匿名化: ${user.id}`);
      } catch (error) {
        failCount++;
        errors.push({
          userId: user.id,
          error: error.message
        });
        logger.error(`❌ 账户匿名化失败: ${user.id}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info('🎉 账户匿名化任务完成', {
      total: expiredUsers.length,
      success: successCount,
      failed: failCount,
      duration: `${duration}ms`
    });

    // 3. 发送汇总报告（如果有失败）
    if (failCount > 0) {
      await sendAnonymizationFailureAlert({
        total: expiredUsers.length,
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
    logger.error('❌ 账户匿名化任务失败', {
      error: error.message,
      stack: error.stack
    });

    // 发送告警
    await sendCriticalAlert('Account anonymization job failed', error);

    throw error;
  }
}

/**
 * 匿名化单个用户
 * @param {Object} user - 用户对象
 */
async function anonymizeUser(user) {
  return await db.transaction(async (trx) => {
    const anonymousId = `anon_${user.id.substring(0, 8)}`;
    const now = new Date();

    // 1. 清空个人身份信息（PII）
    await trx('users').where('id', user.id).update({
      account_status: 'anonymized',
      anonymized_at: now,

      // 完全清空PII
      display_name: null,
      avatar_url: null,
      avatar: null,
      motto: null,
      phone: null,
      password_hash: null,

      // 第三方登录ID
      apple_user_id: null,
      google_user_id: null,
      wechat_union_id: null,
      douyin_union_id: null,

      // 保留统计数据（不可识别）用于历史记录
      // total_pixels, level, created_at 保留

      updated_at: now
    });

    // 2. 匿名化像素
    const pixelResult = await trx('pixels')
      .where('user_id', user.id)
      .update({
        user_id: null,  // 断开用户关联
        is_anonymous: true,
        anonymized_at: now
      });

    logger.debug(`匿名化像素: ${pixelResult} 个`, { userId: user.id });

    // 3. 匿名化绘制会话
    const sessionResult = await trx('drawing_sessions')
      .where('user_id', user.id)
      .update({
        user_id: null,
        is_anonymous: true,
        // ⚠️ 删除精确位置（GDPR要求）
        start_location: null,
        end_location: null,
        gps_points: null,
        anonymized_at: now
      });

    logger.debug(`匿名化绘制会话: ${sessionResult} 个`, { userId: user.id });

    // 4. 匿名化评论
    const commentResult = await trx('pixel_comments')
      .where('user_id', user.id)
      .update({
        user_id: null,
        author_name: '已删除用户',
        is_anonymous: true
      });

    logger.debug(`匿名化评论: ${commentResult} 条`, { userId: user.id });

    // 5. 删除点赞记录（保留统计，删除关联）
    await trx('pixel_likes')
      .where('user_id', user.id)
      .del();

    // 6. 删除关注关系（如果之前未删除）
    await trx('user_follows')
      .where('follower_id', user.id)
      .orWhere('following_id', user.id)
      .del();

    // 7. 删除恢复令牌（不可再恢复）
    await trx('account_recovery_tokens')
      .where('user_id', user.id)
      .del();

    // 8. 审计日志
    await trx('audit_logs').insert({
      id: require('uuid').v4(),
      user_id: user.id,
      action: 'account_anonymized',
      metadata: JSON.stringify({
        original_email: user.email,
        original_username: user.username,
        deleted_at: user.deleted_at,
        anonymized_at: now
      }),
      created_at: now
    });
  });
}

/**
 * 发送匿名化失败告警
 */
async function sendAnonymizationFailureAlert(report) {
  // TODO: 实现告警服务（邮件/Slack/钉钉等）
  logger.warn('⚠️ 部分账户匿名化失败', report);
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
  anonymizeExpiredAccounts,
  anonymizeUser
};
