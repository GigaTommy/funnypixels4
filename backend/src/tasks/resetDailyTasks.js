/**
 * 每日任务重置定时任务
 * 每天凌晨0点执行
 *
 * 功能：
 * 1. 清理昨日未完成的任务
 * 2. 为活跃用户预生成今日任务
 * 3. 发送连续完成任务的奖励通知
 */

const cron = require('node-cron');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const pushNotificationService = require('../services/pushNotificationService');
const { getStreakRewardNotification } = require('../utils/notificationI18n');

/**
 * 清理昨日任务并生成今日任务
 */
async function resetDailyTasks() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  try {
    logger.info('🔄 开始重置每日任务...');

    // 1. 统计昨日任务完成情况
    const yesterdayStats = await db('user_daily_tasks')
      .select('user_id')
      .where('task_date', yesterday)
      .groupBy('user_id')
      .select(
        db.raw('COUNT(*) as total_tasks'),
        db.raw('SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed_tasks')
      );

    logger.info(`📊 昨日任务统计: ${yesterdayStats.length}个用户`);

    // 2. 为连续完成任务的用户发送通知（P1功能）
    let streakNotificationsSent = 0;
    for (const stat of yesterdayStats) {
      if (stat.completed_tasks >= 5) {
        // 查询用户的连续完成天数
        const streakDays = await calculateUserStreak(stat.user_id);

        if (streakDays >= 3) {
          try {
            // 获取本地化的通知内容
            const notification = await getStreakRewardNotification(
              stat.user_id,
              streakDays
            );

            await pushNotificationService.sendToUser(
              stat.user_id,
              notification.title,
              notification.body,
              'daily_task_streak',
              {
                streakDays,
                bonusReward: streakDays * 10
              }
            );
            streakNotificationsSent++;
          } catch (error) {
            logger.error(`发送连续完成通知失败: userId=${stat.user_id}`, error);
          }
        }
      }
    }

    logger.info(`📲 已发送${streakNotificationsSent}个连续完成通知`);

    // 3. 删除7天前的旧任务记录（节省存储空间）
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const deleted = await db('user_daily_tasks')
      .where('task_date', '<', sevenDaysAgo)
      .del();

    logger.info(`🗑️ 已清理${deleted}条7天前的旧任务记录`);

    // 4. 为活跃用户预生成今日任务（提升首次打开速度）
    // 定义"活跃用户"：昨天有登录或绘制记录的用户
    const activeUsers = await db('pixels_history')
      .distinct('user_id')
      .where('history_date', yesterday)
      .union([
        db('drawing_sessions')
          .distinct('user_id')
          .whereRaw("DATE(created_at) = ?", [yesterday])
      ]);

    logger.info(`👥 检测到${activeUsers.length}个活跃用户，开始预生成今日任务...`);

    let preGeneratedCount = 0;
    const DailyTaskController = require('../controllers/dailyTaskController');

    for (const user of activeUsers) {
      try {
        // 检查是否已生成今日任务
        const existingTasks = await db('user_daily_tasks')
          .where({ user_id: user.user_id, task_date: today });

        if (existingTasks.length === 0) {
          await DailyTaskController.generateDailyTasks(user.user_id, today);
          preGeneratedCount++;
        }
      } catch (error) {
        logger.error(`预生成任务失败: userId=${user.user_id}`, error);
      }
    }

    logger.info(`✅ 已为${preGeneratedCount}个用户预生成今日任务`);

    logger.info('✅ 每日任务重置完成', {
      date: today,
      activeUsers: activeUsers.length,
      preGenerated: preGeneratedCount,
      streakNotifications: streakNotificationsSent,
      deletedOldRecords: deleted
    });

    return {
      success: true,
      activeUsers: activeUsers.length,
      preGenerated: preGeneratedCount,
      streakNotifications: streakNotificationsSent,
      deletedOldRecords: deleted
    };

  } catch (error) {
    logger.error('❌ 每日任务重置失败:', error);
    throw error;
  }
}

/**
 * 计算用户的连续完成天数
 */
async function calculateUserStreak(userId) {
  try {
    // 查询最近30天的任务完成情况
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const recentTasks = await db('user_daily_tasks')
      .select('task_date')
      .where('user_id', userId)
      .where('task_date', '>=', thirtyDaysAgo)
      .groupBy('task_date')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed')
      )
      .orderBy('task_date', 'desc');

    // 计算连续完成天数
    let streak = 0;
    for (const day of recentTasks) {
      // 认为一天完成了至少80%的任务才算"全勤"
      if (day.completed >= day.total * 0.8) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    logger.error(`计算连续完成天数失败: userId=${userId}`, error);
    return 0;
  }
}

/**
 * 启动每日任务重置定时任务
 */
function startDailyTaskResetJob() {
  // 每天 00:00:00 执行
  cron.schedule('0 0 * * *', async () => {
    logger.info('🔄 触发每日任务重置定时任务...');

    try {
      const result = await resetDailyTasks();
      logger.info('✅ 每日任务重置定时任务完成', result);
    } catch (error) {
      logger.error('❌ 每日任务重置定时任务失败:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'  // 使用中国时区
  });

  logger.info('✅ 每日任务重置定时任务已启动 (00:00 Asia/Shanghai)');
}

module.exports = {
  startDailyTaskResetJob,
  resetDailyTasks,  // 导出供手动调用
  calculateUserStreak  // 导出供其他模块使用
};
