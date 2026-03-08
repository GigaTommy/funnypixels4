const { db } = require('../config/database');
const logger = require('../utils/logger');
const pushNotificationService = require('../services/pushNotificationService');
const mapTaskGenerationService = require('../services/mapTaskGenerationService');
const UserPoints = require('../models/UserPoints');
const {
  getTaskCompletedNotification,
  getAllTasksCompletedNotification
} = require('../utils/notificationI18n');
const rewardConfigService = require('../services/rewardConfigService');

// 任务模板：每日从中随机选取5个（支持6种语言）
const TASK_TEMPLATES = [
  { type: 'draw_pixels', title: '像素画家', titleEn: 'Pixel Painter', titleEs: 'Pintor de Píxeles', titleJa: 'ピクセルペインター', titleKo: '픽셀 화가', titlePt: 'Pintor de Pixels', description: '绘制像素', descriptionEn: 'Draw pixels', descriptionEs: 'Dibuja píxeles', descriptionJa: 'ピクセルを描画', descriptionKo: '픽셀 그리기', descriptionPt: 'Desenhe pixels', target: 50, reward: 10 },
  { type: 'draw_pixels', title: '勤奋画家', titleEn: 'Diligent Painter', titleEs: 'Pintor Diligente', titleJa: '勤勉なペインター', titleKo: '부지런한 화가', titlePt: 'Pintor Diligente', description: '绘制更多像素', descriptionEn: 'Draw more pixels', descriptionEs: 'Dibuja más píxeles', descriptionJa: 'より多くのピクセルを描画', descriptionKo: '더 많은 픽셀 그리기', descriptionPt: 'Desenhe mais pixels', target: 100, reward: 15 },
  { type: 'draw_pixels', title: '像素大师', titleEn: 'Pixel Master', titleEs: 'Maestro de Píxeles', titleJa: 'ピクセルマスター', titleKo: '픽셀 마스터', titlePt: 'Mestre de Pixels', description: '大量绘制像素', descriptionEn: 'Draw lots of pixels', descriptionEs: 'Dibuja muchos píxeles', descriptionJa: '大量のピクセルを描画', descriptionKo: '많은 픽셀 그리기', descriptionPt: 'Desenhe muitos pixels', target: 200, reward: 25 },
  { type: 'draw_sessions', title: '开始创作', titleEn: 'Start Creating', titleEs: 'Comenzar a Crear', titleJa: '創作を始める', titleKo: '창작 시작', titlePt: 'Começar a Criar', description: '完成绘画会话', descriptionEn: 'Complete drawing sessions', descriptionEs: 'Completa sesiones de dibujo', descriptionJa: '描画セッションを完了', descriptionKo: '그리기 세션 완료', descriptionPt: 'Complete sessões de desenho', target: 1, reward: 10 },
  { type: 'draw_sessions', title: '多次创作', titleEn: 'Multiple Sessions', titleEs: 'Múltiples Sesiones', titleJa: '複数のセッション', titleKo: '여러 세션', titlePt: 'Múltiplas Sessões', description: '完成多次绘画', descriptionEn: 'Complete multiple sessions', descriptionEs: 'Completa múltiples sesiones', descriptionJa: '複数の描画を完了', descriptionKo: '여러 번 그리기', descriptionPt: 'Complete múltiplas sessões', target: 3, reward: 20 },
  { type: 'collect_treasures', title: '寻宝探险', titleEn: 'Treasure Hunter', titleEs: 'Cazador de Tesoros', titleJa: 'トレジャーハンター', titleKo: '보물 사냥꾼', titlePt: 'Caçador de Tesouros', description: '收集宝箱', descriptionEn: 'Collect treasure chests', descriptionEs: 'Recoge cofres del tesoro', descriptionJa: '宝箱を回収', descriptionKo: '보물 상자 수집', descriptionPt: 'Colete baús de tesouro', target: 1, reward: 10 },
  { type: 'collect_treasures', title: '寻宝达人', titleEn: 'Treasure Master', titleEs: 'Maestro de Tesoros', titleJa: 'トレジャーマスター', titleKo: '보물 달인', titlePt: 'Mestre de Tesouros', description: '收集多个宝箱', descriptionEn: 'Collect multiple chests', descriptionEs: 'Recoge múltiples cofres', descriptionJa: '複数の宝箱を回収', descriptionKo: '여러 상자 수집', descriptionPt: 'Colete múltiplos baús', target: 3, reward: 20 },
  { type: 'use_drift_bottle', title: '瓶中信使', titleEn: 'Bottle Messenger', titleEs: 'Mensajero de Botella', titleJa: 'ボトルメッセンジャー', titleKo: '병 메신저', titlePt: 'Mensageiro da Garrafa', description: '扔出或捡起漂流瓶', descriptionEn: 'Throw or pick up drift bottles', descriptionEs: 'Lanza o recoge botellas a la deriva', descriptionJa: '漂流瓶を投げるまたは拾う', descriptionKo: '표류병 던지기 또는 줍기', descriptionPt: 'Jogue ou pegue garrafas à deriva', target: 1, reward: 10 },
  { type: 'social_interact', title: '社交达人', titleEn: 'Social Star', titleEs: 'Estrella Social', titleJa: 'ソーシャルスター', titleKo: '소셜 스타', titlePt: 'Estrela Social', description: '点赞或评论动态', descriptionEn: 'Like or comment on feed', descriptionEs: 'Dale me gusta o comenta en el feed', descriptionJa: 'フィードにいいねまたはコメント', descriptionKo: '피드에 좋아요 또는 댓글', descriptionPt: 'Curta ou comente no feed', target: 3, reward: 15 },
  { type: 'explore_map', title: '探索地图', titleEn: 'Map Explorer', titleEs: 'Explorador del Mapa', titleJa: 'マップ探索', titleKo: '지도 탐험', titlePt: 'Explorador de Mapa', description: '在地图上活动', descriptionEn: 'Be active on the map', descriptionEs: 'Sé activo en el mapa', descriptionJa: 'マップで活動', descriptionKo: '지도에서 활동', descriptionPt: 'Seja ativo no mapa', target: 1, reward: 10 },
];

/**
 * 根据用户语言获取本地化文本
 * @param {Object} task - 任务对象（包含所有语言的title和description）
 * @param {string} lang - 语言代码（zh-Hans, en, es, ja, ko, pt-BR）
 * @returns {Object} - 包含本地化的title和description
 */
function getLocalizedTask(task, lang) {
  // 语言映射
  const langMap = {
    'zh-Hans': { titleKey: 'title', descKey: 'description' },
    'zh-CN': { titleKey: 'title', descKey: 'description' },
    'zh': { titleKey: 'title', descKey: 'description' },
    'en': { titleKey: 'titleEn', descKey: 'descriptionEn' },
    'en-US': { titleKey: 'titleEn', descKey: 'descriptionEn' },
    'es': { titleKey: 'titleEs', descKey: 'descriptionEs' },
    'es-ES': { titleKey: 'titleEs', descKey: 'descriptionEs' },
    'ja': { titleKey: 'titleJa', descKey: 'descriptionJa' },
    'ja-JP': { titleKey: 'titleJa', descKey: 'descriptionJa' },
    'ko': { titleKey: 'titleKo', descKey: 'descriptionKo' },
    'ko-KR': { titleKey: 'titleKo', descKey: 'descriptionKo' },
    'pt-BR': { titleKey: 'titlePt', descKey: 'descriptionPt' },
    'pt': { titleKey: 'titlePt', descKey: 'descriptionPt' }
  };

  const keys = langMap[lang] || langMap['en']; // 默认英语

  return {
    title: task[keys.titleKey] || task.title || task.titleEn,
    description: task[keys.descKey] || task.description || task.descriptionEn
  };
}

class DailyTaskController {
  /**
   * 获取今日任务列表
   * GET /api/daily-tasks
   */
  static async getTasks(req, res) {
    try {
      const userId = req.user.id;
      const today = new Date().toISOString().split('T')[0];

      // 获取用户语言偏好（从 Accept-Language header 或用户设置）
      const userLang = req.headers['accept-language']?.split(',')[0]?.trim() || 'en';

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
          tasks: tasks.map(t => {
            let localized = { title: t.title, description: t.description };

            // 如果是基础每日任务，从 TASK_TEMPLATES 获取多语言
            if (t.task_category === 'basic' || !t.task_category) {
              const template = TASK_TEMPLATES.find(tpl => tpl.type === t.type && tpl.target === t.target);
              if (template) {
                localized = getLocalizedTask(template, userLang);
              }
            }
            // 如果是地图任务，从 mapTaskGenerationService 获取多语言
            else if (t.task_category === 'map') {
              try {
                const mapTemplates = mapTaskGenerationService.getTaskTemplates();
                if (mapTemplates[t.type]) {
                  const template = mapTemplates[t.type].find(tpl => tpl.target === t.target);
                  if (template) {
                    localized = mapTaskGenerationService.getLocalizedTask(template, userLang);
                  }
                }
              } catch (err) {
                logger.error('Failed to localize map task:', err);
              }
            }

            return {
              id: t.id,
              type: t.type,
              title: localized.title,
              description: localized.description,
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
            };
          }),
          completed_count: completedCount,
          total_count: tasks.length,
          all_completed: allCompleted,
          bonus_available: allCompleted && (!bonus || !bonus.is_claimed),
          bonus_claimed: bonus ? bonus.is_claimed : false,
          bonus_points: rewardConfigService.get('reward_config.daily_bonus_points', 50)
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

      await db('user_daily_tasks')
        .where('id', id)
        .update({ is_claimed: true, claimed_at: db.fn.now() });

      // 通过 UserPoints 正确发放积分（写入 user_points + wallet_ledger）
      await UserPoints.addPoints(userId, task.reward_points, '每日任务奖励', `daily_task_${id}`);

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
      const bonusPoints = rewardConfigService.get('reward_config.daily_bonus_points', 50);

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

      if (existing) {
        await db('user_daily_task_bonus')
          .where('id', existing.id)
          .update({ is_claimed: true, claimed_at: db.fn.now() });
      } else {
        await db('user_daily_task_bonus').insert({
          user_id: userId,
          bonus_date: today,
          bonus_points: bonusPoints,
          is_claimed: true,
          claimed_at: db.fn.now()
        });
      }

      // 通过 UserPoints 正确发放积分（写入 user_points + wallet_ledger）
      await UserPoints.addPoints(userId, bonusPoints, '每日任务全勤奖励', `daily_bonus_${today}`);

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
                  bonusReward: rewardConfigService.get('reward_config.daily_bonus_points', 50)
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
