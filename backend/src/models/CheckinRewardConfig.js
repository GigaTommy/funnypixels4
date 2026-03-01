const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class CheckinRewardConfig {
  static async getActiveConfigs() {
    return db('checkin_reward_config')
      .where('is_active', true)
      .orderBy('priority', 'asc');
  }

  static async findAll(params = {}) {
    const { current = 1, pageSize = 50, config_type, is_active } = params;

    let query = db('checkin_reward_config');

    if (config_type) query = query.where('config_type', config_type);
    if (is_active !== undefined && is_active !== '') {
      query = query.where('is_active', is_active === 'true' || is_active === true);
    }

    const countResult = await query.clone().count('* as total').first();
    const total = parseInt(countResult.total);

    const offset = (current - 1) * pageSize;
    const list = await query.clone().orderBy('config_type').orderBy('priority', 'asc').offset(offset).limit(pageSize);

    return { list, total, current: parseInt(current), pageSize: parseInt(pageSize) };
  }

  static async create(data) {
    const config = {
      id: uuidv4(),
      config_type: data.config_type,
      day_number: data.day_number || null,
      min_day: data.min_day || null,
      max_day: data.max_day || null,
      reward_points: data.reward_points || 0,
      multiplier: data.multiplier || 1.0,
      bonus_points: data.bonus_points || 0,
      reward_items: JSON.stringify(data.reward_items || []),
      description: data.description || null,
      is_active: data.is_active !== false,
      priority: data.priority || 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    const [inserted] = await db('checkin_reward_config').insert(config).returning('*');
    return inserted;
  }

  static async update(id, data) {
    const updateData = { ...data, updated_at: new Date() };
    if (updateData.reward_items) updateData.reward_items = JSON.stringify(updateData.reward_items);

    const [updated] = await db('checkin_reward_config')
      .where('id', id)
      .update(updateData)
      .returning('*');
    return updated;
  }

  static async delete(id) {
    return db('checkin_reward_config').where('id', id).del();
  }

  /**
   * Calculate reward for a given consecutive day count
   * Returns { rewardPoints, multiplier, bonusReward, rewardItems }
   */
  static async calculateReward(consecutiveDays) {
    const configs = await this.getActiveConfigs();
    if (configs.length === 0) return null; // fallback signal

    let baseReward = 10;
    let multiplier = 1;
    let bonusReward = 0;
    const rewardItems = [];

    for (const config of configs) {
      switch (config.config_type) {
        case 'base':
          baseReward = config.reward_points;
          break;
        case 'streak_bonus':
          if (config.min_day && consecutiveDays >= config.min_day) {
            bonusReward += Math.floor(consecutiveDays / config.min_day) * (config.bonus_points || 0);
          }
          break;
        case 'milestone':
          if (config.day_number && consecutiveDays % config.day_number === 0) {
            multiplier = Math.max(multiplier, parseFloat(config.multiplier) || 1);
            const items = typeof config.reward_items === 'string'
              ? JSON.parse(config.reward_items)
              : (config.reward_items || []);
            rewardItems.push(...items);
          }
          break;
      }
    }

    const rewardPoints = (baseReward + bonusReward) * multiplier;

    return {
      rewardPoints: Math.floor(rewardPoints),
      multiplier,
      bonusReward,
      rewardItems
    };
  }

  /**
   * Preview reward for day N (for admin preview chart)
   */
  static async previewReward(day) {
    const result = await this.calculateReward(day);
    if (!result) {
      // Fallback to hardcoded
      const baseReward = 10;
      let multiplier = 1;
      if (day % 30 === 0) multiplier = 10;
      else if (day % 7 === 0) multiplier = 3;
      const bonusReward = Math.floor(day / 7) * 5;
      return {
        day,
        rewardPoints: (baseReward + bonusReward) * multiplier,
        multiplier,
        bonusReward,
        rewardItems: []
      };
    }
    return { day, ...result };
  }
}

module.exports = CheckinRewardConfig;
