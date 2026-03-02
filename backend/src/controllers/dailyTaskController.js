const { db } = require('../config/database');
const logger = require('../utils/logger');
const pushNotificationService = require('../services/pushNotificationService');
const mapTaskGenerationService = require('../services/mapTaskGenerationService');
const {
  getTaskCompletedNotification,
  getAllTasksCompletedNotification
} = require('../utils/notificationI18n');

// 任务模板：每日从中随机选取5个
const TASK_TEMPLATES = [
  { type: 'draw_pixels', title: '像素画家', titleEn: 'Pixel Painter', description: '绘制像素', descriptionEn: 'Draw pixels', target: 50, reward: 10 },
  { type: 'draw_pixels', title: '勤奋画家', titleEn: 'Diligent Painter', description: '绘制更多像素', descriptionEn: 'Draw more pixels', target: 100, reward: 15 },
  { type: 'draw_pixels', title: '像素大师', titleEn: 'Pixel Master', description: '大量绘制像素', descriptionEn: 'Draw lots of pixels', target: 200, reward: 25 },
  { type: 'draw_sessions', title: '开始创作', titleEn: 'Start Creating', description: '完成绘画会话', descriptionEn: 'Complete drawing sessions', target: 1, reward: 10 },
  { type: 'draw_sessions', title: '多次创作', titleEn: 'Multiple Sessions', description: '完成多次绘画', descriptionEn: 'Complete multiple sessions', target: 3, reward: 20 },
  { type: 'checkin', title: '联盟签到', titleEn: 'Alliance Check-in', description: '在联盟签到', descriptionEn: 'Check in to alliance', target: 1, reward: 10 },
  { type: 'social_interact', title: '社交达人', titleEn: 'Social Star', description: '点赞或评论动态', descriptionEn: 'Like or comment on feed', target: 3, reward: 15 },
  { type: 'explore_map', title: '探索地图', titleEn: 'Map Explorer', description: '在地图上活动', descriptionEn: 'Be active on the map', target: 1, reward: 10 },
];

class DailyTaskController {
  /**
   * 获取今日任务列表
   * GET /api/daily-tasks
   */
  static async getTasks(req, res) {
    try {
      const userId = req.user.id;
      const today = new Date().toISOString().split('T')[0];

      // 检查是否已生成今日任务
      let tasks = await db('user_daily_tasks')
        .where({ user_id: userId, task_date: today })
        .orderBy('id', 'asc');

      // 如果没有，自动生成
      if (tasks.length === 0) {
        tasks = await DailyTaskController.generateDailyTasks(userId, today);
      }

      // 检查全部完成奖励状态
      const allCompleted = tasks.every(t => t.is_completed);
      const bonus = await db('user_daily_task_bonus')
        .where({ user_id: userId, bonus_date: today })
        .first();

      const completedCount = tasks.filter(t => t.is_completed).length;

      res.json({
        success: true,
        data: {
          tasks: tasks.map(t => ({
            id: t.id,
            type: t.type,
            title: t.title,
            description: t.description,
            target: t.target,
            current: t.current,
            is_completed: t.is_completed,
            is_claimed: t.is_claimed,
            reward_points: t.reward_points,
            progress: Math.min(t.current / t.target, 1.0),
            // Map task fields
            task_category: t.task_category || 'basic',
            difficulty: t.difficulty || 'normal',
            location_lat: t.location_lat,
            location_lng: t.location_lng,
            location_radius: t.location_radius,
            location_name: t.location_name,
            metadata: t.metadata
          })),
          completed_count: completedCount,
          total_count: tasks.length,
          all_completed: allCompleted,
          bonus_available: allCompleted && (!bonus || !bonus.is_claimed),
          bonus_claimed: bonus ? bonus.is_claimed : false,
          bonus_points: 50
        }
      });
    } catch (error) {
      console.error('获取每日任务失败:', error);
      res.status(500).json({ success: false, message: '获取每日任务失败' });
    }
  }

  /**
   * 领取任务奖励
   * POST /api/daily-tasks/:id/claim
   */
  static async claimReward(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const task = await db('user_daily_tasks')
        .where({ id, user_id: userId })
        .first();

      if (!task) {
        return res.status(404).json({ success: false, message: '任务不存在' });
      }

      if (!task.is_completed) {
        return res.status(400).json({ success: false, message: '任务尚未完成' });
      }

      if (task.is_claimed) {
        return res.status(400).json({ success: false, message: '奖励已领取' });
      }

      await db.transaction(async trx => {
        await trx('user_daily_tasks')
          .where('id', id)
          .update({ is_claimed: true, claimed_at: trx.fn.now() });

        await trx('users')
          .where('id', userId)
          .increment('points', task.reward_points);
      });

      res.json({
        success: true,
        message: '奖励已领取',
        data: { points_earned: task.reward_points }
      });
    } catch (error) {
      console.error('领取任务奖励失败:', error);
      res.status(500).json({ success: false, message: '领取奖励失败' });
    }
  }

  /**
   * 领取全部完成奖励
   * POST /api/daily-tasks/bonus/claim
   */
  static async claimBonus(req, res) {
    try {
      const userId = req.user.id;
      const today = new Date().toISOString().split('T')[0];
      const bonusPoints = 50;

      // 检查是否所有任务已完成
      const tasks = await db('user_daily_tasks')
        .where({ user_id: userId, task_date: today });

      const allCompleted = tasks.length > 0 && tasks.every(t => t.is_completed);
      if (!allCompleted) {
        return res.status(400).json({ success: false, message: '尚未完成所有任务' });
      }

      // 检查是否已领取
      const existing = await db('user_daily_task_bonus')
        .where({ user_id: userId, bonus_date: today })
        .first();

      if (existing && existing.is_claimed) {
        return res.status(400).json({ success: false, message: '奖励已领取' });
      }

      await db.transaction(async trx => {
        if (existing) {
          await trx('user_daily_task_bonus')
            .where('id', existing.id)
            .update({ is_claimed: true, claimed_at: trx.fn.now() });
        } else {
          await trx('user_daily_task_bonus').insert({
            user_id: userId,
            bonus_date: today,
            bonus_points: bonusPoints,
            is_claimed: true,
            claimed_at: trx.fn.now()
          });
        }

        await trx('users')
          .where('id', userId)
          .increment('points', bonusPoints);
      });

      res.json({
        success: true,
        message: '全勤奖励已领取',
        data: { points_earned: bonusPoints }
      });
    } catch (error) {
      console.error('领取全勤奖励失败:', error);
      res.status(500).json({ success: false, message: '领取全勤奖励失败' });
    }
  }

  /**
   * 自动生成每日任务（混合系统：2个基础任务 + 3个地图任务）
   */
  static async generateDailyTasks(userId, date) {
    const allTasks = [];

    // Part 1: Generate 2 basic tasks (from existing templates)
    const shuffled = [...TASK_TEMPLATES].sort(() => Math.random() - 0.5);
    const basicTasks = shuffled.slice(0, 2);

    for (const tpl of basicTasks) {
      allTasks.push({
        user_id: userId,
        type: tpl.type,
        title: tpl.title,
        description: tpl.description,
        target: tpl.target,
        current: 0,
        is_completed: false,
        is_claimed: false,
        reward_points: tpl.reward,
        task_date: date,
        task_category: 'basic',
        difficulty: 'normal'
      });
    }

    // Part 2: Generate 3 map tasks (location-based)
    try {
      const mapTasks = await mapTaskGenerationService.generateMapTasks(userId, 'normal', 3);

      for (const mapTask of mapTasks) {
        allTasks.push({
          user_id: userId,
          task_date: date,
          ...mapTask,
          metadata: mapTask.metadata ? JSON.stringify(mapTask.metadata) : null
        });
      }

      logger.info(`✅ 为用户 ${userId} 生成混合任务: ${basicTasks.length}个基础 + ${mapTasks.length}个地图`);
    } catch (error) {
      logger.error(`❌ 生成地图任务失败，仅使用基础任务: userId=${userId}`, error);

      // Fallback: If map task generation fails, add 3 more basic tasks
      const fallbackTasks = shuffled.slice(2, 5);
      for (const tpl of fallbackTasks) {
        allTasks.push({
          user_id: userId,
          type: tpl.type,
          title: tpl.title,
          description: tpl.description,
          target: tpl.target,
          current: 0,
          is_completed: false,
          is_claimed: false,
          reward_points: tpl.reward,
          task_date: date,
          task_category: 'basic',
          difficulty: 'normal'
        });
      }
    }

    await db('user_daily_tasks').insert(allTasks);

    return db('user_daily_tasks')
      .where({ user_id: userId, task_date: date })
      .orderBy('id', 'asc');
  }

  /**
   * 🔧 新增：确保用户有今日任务（如果没有则创建）
   */
  static async ensureTodayTasks(userId) {
    const today = new Date().toISOString().split('T')[0];

    // 检查是否已存在今日任务
    const existingTasks = await db('user_daily_tasks')
      .where({ user_id: userId, task_date: today });

    if (existingTasks.length === 0) {
      logger.info(`📝 为用户 ${userId} 生成今日任务: ${today}`);
      return await this.generateDailyTasks(userId, today);
    }

    return existingTasks;
  }

  /**
   * 更新任务进度（由其他系统调用）
   */
  static async updateTaskProgress(userId, taskType, increment = 1) {
    const today = new Date().toISOString().split('T')[0];

    try {
      const tasks = await db('user_daily_tasks')
        .where({ user_id: userId, task_date: today, type: taskType, is_completed: false });

      // 🔧 FIX: 增强日志，便于排查问题
      if (tasks.length === 0) {
        logger.warn(`⚠️ 任务未找到: userId=${userId}, type=${taskType}, date=${today} - 可能任务尚未生成`);

        // 尝试自动生成今日任务
        try {
          await this.ensureTodayTasks(userId);
          logger.info(`✅ 已自动生成用户 ${userId} 的今日任务，重新尝试更新`);

          // 重新查询任务
          const retryTasks = await db('user_daily_tasks')
            .where({ user_id: userId, task_date: today, type: taskType, is_completed: false });

          if (retryTasks.length === 0) {
            logger.error(`❌ 重新生成任务后仍未找到: userId=${userId}, type=${taskType}`);
            return;
          }

          // 使用重新查询的任务继续更新
          for (const task of retryTasks) {
            const newCurrent = Math.min(task.current + increment, task.target);
            const isCompleted = newCurrent >= task.target;

            await db('user_daily_tasks')
              .where('id', task.id)
              .update({
                current: newCurrent,
                is_completed: isCompleted,
                completed_at: isCompleted ? db.fn.now() : null
              });

            logger.info(`✅ 更新任务进度: userId=${userId}, type=${taskType}, ${task.current}→${newCurrent}/${task.target}`);
          }
        } catch (genError) {
          logger.error(`❌ 自动生成任务失败: userId=${userId}`, genError);
        }
        return;
      }

      for (const task of tasks) {
        const newCurrent = Math.min(task.current + increment, task.target);
        const isCompleted = newCurrent >= task.target;

        await db('user_daily_tasks')
          .where('id', task.id)
          .update({
            current: newCurrent,
            is_completed: isCompleted,
            completed_at: isCompleted ? db.fn.now() : null
          });

        // 🔧 FIX: 添加详细日志
        logger.info(`✅ 更新任务进度: userId=${userId}, type=${taskType}, ${task.current}→${newCurrent}/${task.target} ${isCompleted ? '✓已完成' : ''}`);

        // 🆕 实时通知：通过Socket.IO推送任务进度更新
        try {
          const { getIO } = require('../socket');
          const io = getIO();
          if (io) {
            io.to(`user:${userId}`).emit('dailyTaskUpdated', {
              taskId: task.id,
              type: task.type,
              current: newCurrent,
              target: task.target,
              isCompleted: isCompleted
            });
            logger.debug(`📡 已发送任务更新通知: userId=${userId}, taskId=${task.id}`);
          }
        } catch (socketErr) {
          logger.warn('发送任务更新Socket通知失败（不影响主流程）:', socketErr.message);
        }

        // 🆕 P0功能：任务完成时发送推送通知（多语言支持）
        if (isCompleted && task.current < task.target) {
          try {
            // 获取本地化的通知内容
            const notification = await getTaskCompletedNotification(userId, {
              title: task.title,
              reward: task.reward_points
            });

            await pushNotificationService.sendToUser(
              userId,
              notification.title,
              notification.body,
              'daily_task_completed',
              {
                taskId: task.id,
                taskType: task.type,
                reward: task.reward_points
              }
            );
            logger.info(`📲 已发送任务完成通知: userId=${userId}, taskId=${task.id}`);
          } catch (pushError) {
            logger.error(`❌ 发送任务完成通知失败: userId=${userId}, taskId=${task.id}`, pushError);
            // 推送失败不影响主流程
          }

          // 🆕 P1功能：检查是否所有任务都完成（额外奖励）
          const allTasksToday = await db('user_daily_tasks')
            .where({ user_id: userId, task_date: today });

          const allCompleted = allTasksToday.every(t => t.is_completed);

          if (allCompleted) {
            try {
              // 获取本地化的通知内容
              const notification = await getAllTasksCompletedNotification(
                userId,
                allTasksToday.length
              );

              await pushNotificationService.sendToUser(
                userId,
                notification.title,
                notification.body,
                'daily_task_all_completed',
                {
                  completedCount: allTasksToday.length,
                  bonusReward: 50
                }
              );
              logger.info(`📲 已发送全勤奖励通知: userId=${userId}`);
            } catch (pushError) {
              logger.error(`❌ 发送全勤奖励通知失败: userId=${userId}`, pushError);
            }
          }
        }
      }
    } catch (error) {
      // 🔧 FIX: 增强错误日志，包含上下文信息
      logger.error(`❌ 更新任务进度失败: userId=${userId}, type=${taskType}, increment=${increment}`, error);

      // 重新抛出错误，让上层感知（但不影响主流程）
      throw error;
    }
  }
}

module.exports = DailyTaskController;
