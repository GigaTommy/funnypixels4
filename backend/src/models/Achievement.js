const { db } = require('../config/database');
const UserPoints = require('./UserPoints');
const NotificationController = require('../controllers/notificationController');

class Achievement {
  // 统计行 sentinel ID
  static STATS_ACHIEVEMENT_ID = 0;

  static async getAllAchievements() {
    try {
      return await db('achievements').where('is_active', true).orderBy('display_priority', 'desc');
    } catch (error) {
      console.error('获取所有成就定义失败:', error);
      return [];
    }
  }

  static async getUserCompletedAchievements(userId) {
    try {
      return await db('user_achievements as ua')
        .join('achievements as a', 'ua.achievement_id', 'a.id')
        .where('ua.user_id', userId)
        .where('ua.is_completed', true)
        .select('a.*', 'ua.is_claimed', 'ua.completed_at', 'ua.claimed_at');
    } catch (error) {
      console.error('获取用户已完成成就失败:', error);
      return [];
    }
  }

  static async getUserStats(userId) {
    return this.getUserAchievementStats(userId);
  }

  static async getUserAchievementStats(userId) {
    try {
      await this.ensureUserAchievementExists(userId);
      const statsRow = await db('user_achievements')
        .where({ user_id: userId, achievement_id: this.STATS_ACHIEVEMENT_ID })
        .first();

      const [totalCount, completedCount, claimedCount, points] = await Promise.all([
        db('achievements').where('is_active', true).count('* as count').first(),
        db('user_achievements').where({ user_id: userId, is_completed: true }).whereNot('achievement_id', this.STATS_ACHIEVEMENT_ID).count('* as count').first(),
        db('user_achievements').where({ user_id: userId, is_claimed: true }).whereNot('achievement_id', this.STATS_ACHIEVEMENT_ID).count('* as count').first(),
        UserPoints.getUserPoints(userId)
      ]);

      return {
        total_points: points.total_points,
        like_received_count: parseInt(statsRow?.like_received_count || 0),
        like_given_count: parseInt(statsRow?.like_given_count || 0),
        pixels_drawn_count: parseInt(statsRow?.pixels_drawn_count || 0),
        days_active_count: parseInt(statsRow?.days_active_count || 0),
        pm_sent_count: parseInt(statsRow?.pm_sent_count || 0),
        total_messages_count: parseInt(statsRow?.total_messages_count || 0),
        total_spent_gold: parseInt(statsRow?.total_spent_gold || 0),
        alliance_join_count: parseInt(statsRow?.alliance_join_count || 0),
        alliance_contributions: parseInt(statsRow?.alliance_contributions || 0),
        creations_count: parseInt(statsRow?.creations_count || 0),
        gps_sessions_count: parseInt(statsRow?.gps_sessions_count || 0),
        shop_purchases_count: parseInt(statsRow?.shop_purchases_count || 0),
        achievements_unlocked: statsRow?.achievements_unlocked || [],
        total_achievements: parseInt(totalCount?.count || 0),
        completed_count: parseInt(completedCount?.count || 0),
        claimed_count: parseInt(claimedCount?.count || 0)
      };
    } catch (error) {
      console.error(`获取用户 ${userId} 成就统计失败:`, error);
      throw error;
    }
  }

  static async getUserAchievements(userId) {
    try {
      await this.ensureUserAchievementExists(userId);

      // Get all active achievements
      const allDefs = await this.getAllAchievements();

      // Get user progress
      const progressRows = await db('user_achievements')
        .where('user_id', userId)
        .whereNot('achievement_id', this.STATS_ACHIEVEMENT_ID);

      const progressMap = {};
      progressRows.forEach(row => {
        progressMap[row.achievement_id] = row;
      });

      return allDefs.map(def => {
        const progress = progressMap[def.id] || {};
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          icon_url: def.icon_url,
          reward_points: def.reward_points,
          category: def.category,
          type: def.type,
          requirement: def.requirement,
          metadata: def.metadata,
          current_progress: progress.progress || 0,
          target_progress: def.requirement,
          is_completed: progress.is_completed || false,
          is_claimed: progress.is_claimed || false,
          completed_at: progress.completed_at,
          claimed_at: progress.claimed_at
        };
      });
    } catch (error) {
      console.error('获取用户成就列表失败:', error);
      return [];
    }
  }

  static async claimAchievementReward(userId, achievementId) {
    const trx = await db.transaction();
    try {
      const achievement = await trx('achievements').where('id', achievementId).first();
      if (!achievement) throw new Error('成就不存在');

      const userProgress = await trx('user_achievements')
        .where({ user_id: userId, achievement_id: achievementId })
        .first();

      if (!userProgress || !userProgress.is_completed) {
        throw new Error('成就尚未完成');
      }

      if (userProgress.is_claimed) {
        throw new Error('奖励已领取');
      }

      // Update claim status
      await trx('user_achievements')
        .where({ user_id: userId, achievement_id: achievementId })
        .update({
          is_claimed: true,
          claimed_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });

      // Award points
      if (achievement.reward_points > 0) {
        await UserPoints.addPoints(userId, achievement.reward_points, `成就奖励: ${achievement.name}`, achievement.id);
      }

      await trx.commit();

      // 确保items字段格式正确（数组或null，不能是JSONB字符串）
      let items = achievement.reward_items;
      if (items && typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = null;
        }
      }
      // 如果是空数组、空对象、或null，统一返回null（iOS端期望[RewardItem]?）
      if (!items || (Array.isArray(items) && items.length === 0) ||
          (typeof items === 'object' && !Array.isArray(items) && Object.keys(items).length === 0)) {
        items = null;
      }
      // 如果是非空的单个对象（非数组），包装为数组
      if (items && !Array.isArray(items)) {
        items = [items];
      }

      return {
        points: achievement.reward_points || 0,
        items: items
      };
    } catch (error) {
      await trx.rollback();
      console.error('领取成就奖励失败:', error);
      throw error;
    }
  }

  static async updateUserStats(userId, statsUpdate) {
    try {
      await this.ensureUserAchievementExists(userId);
      const updateData = { updated_at: db.fn.now() };

      // 允许更新的列名
      const allowedStats = [
        'like_received_count', 'like_given_count', 'pixels_drawn_count',
        'days_active_count', 'pm_sent_count', 'total_messages_count',
        'total_spent_gold', 'alliance_join_count', 'creations_count',
        'gps_sessions_count', 'alliance_contributions', 'shop_purchases_count'
      ];

      for (const stat of allowedStats) {
        if (statsUpdate[stat] !== undefined) {
          // 如果是 days_active_count，通常是直接设置值，其他是累加
          if (stat === 'days_active_count') {
            updateData[stat] = statsUpdate[stat];
          } else {
            updateData[stat] = db.raw(`${stat} + ?`, [statsUpdate[stat]]);
          }
        }
      }

      await db('user_achievements')
        .where({ user_id: userId, achievement_id: this.STATS_ACHIEVEMENT_ID })
        .update(updateData);

      // 自动触发里程碑检查
      await this.checkAndUnlockAchievements(userId);
    } catch (error) {
      console.error('更新用户成就统计失败:', error);
      throw error;
    }
  }

  static async ensureUserAchievementExists(userId) {
    try {
      // Ensure stats row exists
      const existingStats = await db('user_achievements')
        .where({ user_id: userId, achievement_id: this.STATS_ACHIEVEMENT_ID })
        .first();

      if (!existingStats) {
        await db('user_achievements').insert({
          user_id: userId,
          achievement_id: this.STATS_ACHIEVEMENT_ID,
          like_received_count: 0,
          like_given_count: 0,
          pixels_drawn_count: 0,
          days_active_count: 0,
          pm_sent_count: 0,
          total_messages_count: 0,
          total_spent_gold: 0,
          alliance_join_count: 0,
          creations_count: 0,
          gps_sessions_count: 0,
          is_completed: false,
          is_claimed: false
        });
      }
    } catch (error) {
      console.error('确保用户成就统计行存在失败:', error);
      throw error;
    }
  }

  static async checkAndUnlockAchievements(userId) {
    try {
      const statsRow = await db('user_achievements')
        .where({ user_id: userId, achievement_id: this.STATS_ACHIEVEMENT_ID })
        .first();
      if (!statsRow) return [];

      const achievements = await db('achievements').where('is_active', true);
      const newlyUnlocked = [];

      for (const achievement of achievements) {
        // Check if already completed
        const existing = await db('user_achievements')
          .where({ user_id: userId, achievement_id: achievement.id })
          .first();

        if (existing && existing.is_completed) {
          // Handle daily/weekly repeat cycles
          if (achievement.repeat_cycle === 'daily') {
            const today = new Date().toISOString().split('T')[0];
            const completedDay = new Date(existing.completed_at).toISOString().split('T')[0];
            if (completedDay === today) continue;
            // Reset claim status if it's a new day
            await db('user_achievements')
              .where({ user_id: userId, achievement_id: achievement.id })
              .update({ is_completed: false, is_claimed: false });
          } else if (achievement.repeat_cycle === 'weekly') {
            // Placeholder for weekly logic if needed
            continue;
          } else {
            continue;
          }
        }

        let currentVal = 0;

        // 映射成就到统计字段
        // 基于 category 和 achievement.name/description 进行模糊匹配，因为 legacy 表没有关键字段
        const category = achievement.category?.toLowerCase();
        const name = achievement.name || '';

        switch (category) {
          case 'likes':
            if (name.includes('被赞') || name.includes('收到')) {
              currentVal = statsRow.like_received_count;
            } else if (name.includes('点赞他人')) {
              currentVal = statsRow.like_given_count;
            }
            break;
          case 'pixels':
          case 'pixel':
            currentVal = statsRow.pixels_drawn_count;
            break;
          case 'activity':
            currentVal = statsRow.days_active_count;
            break;
          case 'social':
            if (name.includes('私信')) {
              currentVal = statsRow.pm_sent_count;
            } else {
              currentVal = statsRow.total_messages_count;
            }
            break;
          case 'shop':
            if (name.includes('消费') || name.includes('土豪')) {
              currentVal = statsRow.total_spent_gold;
            } else {
              currentVal = statsRow.shop_purchases_count;
            }
            break;
          case 'alliance':
            if (name.includes('创建')) {
              currentVal = statsRow.creations_count;
            } else if (name.includes('贡献') || name.includes('活跃')) {
              currentVal = statsRow.alliance_contributions;
            } else {
              currentVal = statsRow.alliance_join_count;
            }
            break;
          case 'special':
            if (name.includes('GPS')) {
              currentVal = statsRow.gps_sessions_count;
            } else if (name.includes('早起鸟')) {
              const hour = new Date().getHours();
              if (hour >= 6 && hour < 9) currentVal = 1;
            } else if (name.includes('夜猫子')) {
              const hour = new Date().getHours();
              if (hour >= 22) currentVal = 1; // 22:00-23:59
            }
            break;
        }

        if (currentVal >= achievement.requirement) {
          await this.completeAchievement(userId, achievement.id);
          newlyUnlocked.push(achievement);
        }
      }
      return newlyUnlocked;
    } catch (error) {
      console.error('检查成就完成失败:', error);
      return [];
    }
  }

  static async completeAchievement(userId, achievementId) {
    try {
      await db('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievementId,
          is_completed: true,
          completed_at: db.fn.now(),
          updated_at: db.fn.now(),
          progress: 100 // Legacy compatibility
        })
        .onConflict(['user_id', 'achievement_id'])
        .merge({
          is_completed: true,
          completed_at: db.fn.now(),
          updated_at: db.fn.now(),
          progress: 100
        });

      // ✅ 发送成就解锁通知
      try {
        const achievement = await db('achievements')
          .where('id', achievementId)
          .first();

        if (achievement) {
          const rewardText = achievement.points > 0
            ? `+${achievement.points}积分`
            : '';

          await NotificationController.createNotification(
            userId,
            'achievement',
            '🏆 成就解锁',
            `恭喜！你解锁了成就「${achievement.name}」${rewardText ? '，获得' + rewardText : ''}`,
            {
              achievement_id: achievementId,
              achievement_name: achievement.name,
              points: achievement.points,
              icon_url: achievement.icon_url
            }
          );

          console.log(`✅ 成就通知已发送: userId=${userId}, achievement=${achievement.name}`);
        }
      } catch (notificationError) {
        // 通知失败不应影响成就完成
        console.error('发送成就通知失败:', notificationError);
      }
    } catch (error) {
      console.error('标记成就完成失败:', error);
    }
  }

  static async getUserAchievementHighlights(userId) {
    try {
      const achievements = await this.getUserAchievements(userId);
      // Filter for in-progress or recently completed
      return achievements.sort((a, b) => {
        if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
        return (b.current_progress / b.target_progress) - (a.current_progress / a.target_progress);
      }).slice(0, 5);
    } catch (error) {
      console.error('获取成就亮点失败:', error);
      return [];
    }
  }

  static async initializeUserAchievements(userId) {
    return await this.ensureUserAchievementExists(userId);
  }

  static async updateUserAchievementProgress(userId, achievementId, progress) {
    try {
      const achievement = await db('achievements').where('id', achievementId).first();
      if (!achievement) return null;

      const isCompleted = progress >= achievement.requirement;

      const [record] = await db('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievementId,
          progress: progress,
          is_completed: isCompleted,
          completed_at: isCompleted ? db.fn.now() : null,
          updated_at: db.fn.now()
        })
        .onConflict(['user_id', 'achievement_id'])
        .merge({
          progress: progress,
          is_completed: isCompleted,
          completed_at: isCompleted ? db.fn.now() : null,
          updated_at: db.fn.now()
        })
        .returning('*');

      return record;
    } catch (error) {
      console.error('更新成就进度失败:', error);
      throw error;
    }
  }

  static async getUserRank(userId, type = 'like_received_count') {
    try {
      const statsRow = await db('user_achievements')
        .where({ user_id: userId, achievement_id: this.STATS_ACHIEVEMENT_ID })
        .first();

      const score = statsRow ? statsRow[type] : 0;
      const result = await db('user_achievements')
        .where('achievement_id', this.STATS_ACHIEVEMENT_ID)
        .where(type, '>', score)
        .count('* as higher_count')
        .first();

      return {
        rank: parseInt(result.higher_count) + 1,
        score,
        type
      };
    } catch (error) {
      console.error('获取排名失败:', error);
      return { rank: 0, score: 0, type };
    }
  }
}

module.exports = Achievement;