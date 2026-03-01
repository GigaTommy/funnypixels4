const { db } = require('../config/database');

class UserPoints {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.total_points = data.total_points;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 获取用户积分
  static async getUserPoints(userId) {
    const userPoints = await db('user_points')
      .where('user_id', userId)
      .first();

    if (!userPoints) {
      // 如果用户没有积分记录，创建一个默认记录
      return await this.createUserPoints(userId, 0);
    }

    return new UserPoints(userPoints);
  }

  // 创建用户积分记录
  static async createUserPoints(userId, initialPoints = 0) {
    const [userPoints] = await db('user_points')
      .insert({
        user_id: userId,
        total_points: initialPoints,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return new UserPoints(userPoints);
  }

  // 增加用户积分
  static async addPoints(userId, points, reason = '系统奖励', refId = null) {
    const trx = await db.transaction();

    try {
      // 获取或创建用户积分记录
      let userPoints = await trx('user_points')
        .where('user_id', userId)
        .first();

      if (!userPoints) {
        const [newUserPoints] = await trx('user_points')
          .insert({
            user_id: userId,
            total_points: points,
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning('*');
        userPoints = newUserPoints;
      } else {
        // 更新积分
        const [updatedUserPoints] = await trx('user_points')
          .where('user_id', userId)
          .update({
            total_points: userPoints.total_points + points,
            updated_at: new Date()
          })
          .returning('*');
        userPoints = updatedUserPoints;
      }

      // 记录积分变动到账本
      await trx('wallet_ledger').insert({
        user_id: userId,
        delta_points: points,
        reason: reason,
        ref_id: refId,
        created_at: new Date()
      });

      await trx.commit();
      return new UserPoints(userPoints);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // 扣除用户积分
  static async deductPoints(userId, points, reason = '消费', refId = null, existingTrx = null) {
    const trx = existingTrx || await db.transaction();
    const shouldCommit = !existingTrx;

    try {
      // 获取用户积分记录并锁定行 (SELECT FOR UPDATE)
      const userPoints = await trx('user_points')
        .where('user_id', userId)
        .forUpdate()
        .first();

      if (!userPoints) {
        throw new Error('用户积分记录不存在');
      }

      // 再次检查余额（防止并发会导致负数）
      if (userPoints.total_points < points) {
        throw new Error(`积分不足，当前积分: ${userPoints.total_points}, 需要: ${points}`);
      }

      // 更新积分
      const [updatedUserPoints] = await trx('user_points')
        .where('user_id', userId)
        .update({
          total_points: userPoints.total_points - points,
          updated_at: new Date()
        })
        .returning('*');

      // 记录积分变动到账本
      await trx('wallet_ledger').insert({
        user_id: userId,
        delta_points: -points,
        reason: reason,
        ref_id: refId,
        created_at: new Date()
      });

      if (shouldCommit) await trx.commit();
      return new UserPoints(updatedUserPoints);
    } catch (error) {
      if (shouldCommit) await trx.rollback();
      throw error;
    }
  }

  // 获取用户积分历史记录
  static async getPointsHistory(userId, limit = 50, offset = 0) {
    const history = await db('wallet_ledger')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return history;
  }

  // 获取用户积分统计
  static async getPointsStats(userId) {
    const stats = await db('wallet_ledger')
      .where('user_id', userId)
      .select(
        db.raw('SUM(CASE WHEN delta_points > 0 THEN delta_points ELSE 0 END) as total_earned'),
        db.raw('SUM(CASE WHEN delta_points < 0 THEN ABS(delta_points) ELSE 0 END) as total_spent'),
        db.raw('COUNT(*) as total_transactions')
      )
      .first();

    const userPoints = await this.getUserPoints(userId);

    return {
      current_points: userPoints.total_points,
      total_earned: parseInt(stats.total_earned) || 0,
      total_spent: parseInt(stats.total_spent) || 0,
      total_transactions: parseInt(stats.total_transactions) || 0
    };
  }

  // 批量更新用户积分（用于成就奖励等）
  static async batchUpdatePoints(updates) {
    const trx = await db.transaction();

    try {
      for (const update of updates) {
        const { userId, points, reason, refId } = update;

        if (points > 0) {
          await this.addPoints(userId, points, reason, refId);
        } else if (points < 0) {
          await this.deductPoints(userId, Math.abs(points), reason, refId);
        }
      }

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}

module.exports = UserPoints;
