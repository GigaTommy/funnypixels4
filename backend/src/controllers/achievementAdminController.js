const { db } = require('../config/database');
const logger = require('../utils/logger');

class AchievementAdminController {
  static async listAchievements(req, res) {
    try {
      const { current = 1, pageSize = 20, category, type, is_active, keyword } = req.query;

      let query = db('achievements');

      if (category) query = query.where('category', category);
      if (type) query = query.where('type', type);
      if (is_active !== undefined && is_active !== '') {
        query = query.where('is_active', is_active === 'true');
      }
      if (keyword) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${keyword}%`)
            .orWhere('description', 'ilike', `%${keyword}%`);
        });
      }

      const countResult = await query.clone().count('* as total').first();
      const total = parseInt(countResult.total);

      const offset = (parseInt(current) - 1) * parseInt(pageSize);
      const list = await query.clone().orderBy('display_priority', 'desc').orderBy('created_at', 'desc').offset(offset).limit(parseInt(pageSize));

      res.json({
        success: true,
        data: { list, total, current: parseInt(current), pageSize: parseInt(pageSize) }
      });
    } catch (error) {
      logger.error('List achievements error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAchievementById(req, res) {
    try {
      const achievement = await db('achievements').where('id', req.params.id).first();
      if (!achievement) {
        return res.status(404).json({ success: false, message: '成就不存在' });
      }
      res.json({ success: true, data: achievement });
    } catch (error) {
      logger.error('Get achievement error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createAchievement(req, res) {
    try {
      const { name, description, icon_url, category, type, requirement, reward_points,
              reward_items, repeat_cycle, display_priority, is_active } = req.body;

      const [achievement] = await db('achievements').insert({
        name,
        description,
        icon_url,
        category,
        type,
        requirement: requirement || 1,
        reward_points: reward_points || 0,
        reward_items: reward_items ? JSON.stringify(reward_items) : '[]',
        repeat_cycle: repeat_cycle || 'permanent',
        display_priority: display_priority || 0,
        is_active: is_active !== false,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      res.json({ success: true, data: achievement, message: '成就创建成功' });
    } catch (error) {
      logger.error('Create achievement error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateAchievement(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body, updated_at: new Date() };
      if (updateData.reward_items) {
        updateData.reward_items = JSON.stringify(updateData.reward_items);
      }
      // Remove id from update data
      delete updateData.id;

      const [updated] = await db('achievements')
        .where('id', id)
        .update(updateData)
        .returning('*');

      if (!updated) {
        return res.status(404).json({ success: false, message: '成就不存在' });
      }

      res.json({ success: true, data: updated, message: '成就更新成功' });
    } catch (error) {
      logger.error('Update achievement error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteAchievement(req, res) {
    try {
      const { id } = req.params;
      await db('achievements').where('id', id).update({ is_active: false, updated_at: new Date() });
      res.json({ success: true, message: '成就已禁用' });
    } catch (error) {
      logger.error('Delete achievement error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async toggleActive(req, res) {
    try {
      const { id } = req.params;
      const achievement = await db('achievements').where('id', id).first();
      if (!achievement) {
        return res.status(404).json({ success: false, message: '成就不存在' });
      }

      const [updated] = await db('achievements')
        .where('id', id)
        .update({ is_active: !achievement.is_active, updated_at: new Date() })
        .returning('*');

      res.json({ success: true, data: updated, message: `成就已${updated.is_active ? '启用' : '禁用'}` });
    } catch (error) {
      logger.error('Toggle achievement error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAchievementStats(req, res) {
    try {
      const [totalCount] = await db('achievements').count('* as count');
      const [activeCount] = await db('achievements').where('is_active', true).count('* as count');

      const categoryStats = await db('achievements')
        .select('category')
        .count('* as count')
        .groupBy('category')
        .orderBy('count', 'desc');

      const completionStats = await db('user_achievements')
        .count('* as total_completions')
        .countDistinct('user_id as unique_users')
        .first();

      res.json({
        success: true,
        data: {
          total: parseInt(totalCount.count),
          active: parseInt(activeCount.count),
          category_stats: categoryStats,
          total_completions: parseInt(completionStats?.total_completions || 0),
          unique_users: parseInt(completionStats?.unique_users || 0)
        }
      });
    } catch (error) {
      logger.error('Get achievement stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = AchievementAdminController;
