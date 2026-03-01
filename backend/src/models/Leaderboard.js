const { db } = require('../config/database');

class Leaderboard {
  // 生成个人排行榜
  static async generateUserLeaderboard(period = 'daily', date = null) {
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }
    
    let startDate, endDate;
    const targetDate = new Date(date);
    
    switch (period) {
    case 'daily':
      startDate = targetDate.toISOString().split('T')[0];
      endDate = startDate;
      break;
    case 'weekly':
      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - targetDate.getDay());
      startDate = weekStart.toISOString().split('T')[0];
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      endDate = weekEnd.toISOString().split('T')[0];
      break;
    case 'monthly':
      startDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-01`;
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      endDate = monthEnd.toISOString().split('T')[0];
      break;
    default:
      throw new Error('无效的排行榜周期');
    }
    
    // 获取用户在指定时间段内的像素统计（真实绘制统计，剔除道具类像素）
    const rankings = await db('users')
      .select(
        'users.id',
        'users.username',
        'users.avatar_url',
        // 🆕 只统计真实绘制的像素（pixel_type = 'basic'）
        db.raw('COALESCE(SUM(CASE WHEN pixels.created_at::date BETWEEN ? AND ? AND pixels.pixel_type = \'basic\' THEN 1 ELSE 0 END), 0) as period_pixels', [startDate, endDate]),
        db.raw('COALESCE(COUNT(CASE WHEN pixels.pixel_type = \'basic\' THEN pixels.id END), 0) as total_pixels'),
        db.raw('COALESCE(COUNT(DISTINCT CASE WHEN pixels.created_at::date BETWEEN ? AND ? AND pixels.pixel_type = \'basic\' THEN pixels.grid_id END), 0) as current_pixels', [startDate, endDate])
      )
      .leftJoin('pixels', 'users.id', 'pixels.user_id')
      .groupBy('users.id', 'users.username', 'users.avatar_url')
      .orderBy('period_pixels', 'desc')
      .orderBy('total_pixels', 'desc')
      .limit(100);
    
    // 保存排行榜数据
    await this.saveLeaderboard('user', period, date, rankings);
    
    return rankings;
  }

  // 生成联盟排行榜
  static async generateAllianceLeaderboard(period = 'daily', date = null) {
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }
    
    let startDate, endDate;
    const targetDate = new Date(date);
    
    switch (period) {
    case 'daily':
      startDate = targetDate.toISOString().split('T')[0];
      endDate = startDate;
      break;
    case 'weekly':
      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - targetDate.getDay());
      startDate = weekStart.toISOString().split('T')[0];
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      endDate = weekEnd.toISOString().split('T')[0];
      break;
    case 'monthly':
      startDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-01`;
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      endDate = monthEnd.toISOString().split('T')[0];
      break;
    default:
      throw new Error('无效的排行榜周期');
    }
    
    // 获取联盟在指定时间段内的像素统计（真实绘制统计，剔除道具类像素）
    const rankings = await db('alliances')
      .select(
        'alliances.id',
        'alliances.name',
        'alliances.color',
        'alliances.banner_url',
        // 🆕 只统计真实绘制的像素（pixel_type = 'basic'）
        db.raw('COALESCE(SUM(CASE WHEN pixels.created_at::date BETWEEN ? AND ? AND pixels.pixel_type = \'basic\' THEN 1 ELSE 0 END), 0) as period_pixels', [startDate, endDate]),
        db.raw('COALESCE(COUNT(CASE WHEN pixels.pixel_type = \'basic\' THEN pixels.id END), 0) as total_pixels'),
        db.raw('COALESCE(COUNT(DISTINCT CASE WHEN pixels.created_at::date BETWEEN ? AND ? AND pixels.pixel_type = \'basic\' THEN pixels.grid_id END), 0) as current_pixels', [startDate, endDate]),
        db.raw('COUNT(DISTINCT alliance_members.user_id) as member_count')
      )
      .leftJoin('alliance_members', 'alliances.id', 'alliance_members.alliance_id')
      .leftJoin('pixels', 'alliance_members.user_id', 'pixels.user_id')
      .where('alliances.is_active', true)
      .groupBy('alliances.id', 'alliances.name', 'alliances.color', 'alliances.banner_url')
      .orderBy('period_pixels', 'desc')
      .orderBy('total_pixels', 'desc')
      .limit(50);
    
    // 保存排行榜数据
    await this.saveLeaderboard('alliance', period, date, rankings);
    
    return rankings;
  }

  // 保存排行榜数据（已废弃，使用专门的排行榜表）
  static async saveLeaderboard(type, period, date, rankings) {
    // 此方法已废弃，排行榜数据直接存储在 leaderboard_personal 和 leaderboard_alliance 表中
    console.log('saveLeaderboard方法已废弃，排行榜数据由维护服务直接管理');
    return true;
  }

  // 获取排行榜
  static async getLeaderboard(type, period, date = null, limit = 20) {
    try {
      if (type === 'user') {
        const leaderboard = await db('leaderboard_personal')
          .where('period', period)
          .orderBy('rank', 'asc')
          .limit(limit)
          .select('user_id as id', 'username', 'display_name', 'avatar_url', 'avatar', 'pixel_count', 'rank');

        return leaderboard;
      } else if (type === 'alliance') {
        const leaderboard = await db('leaderboard_alliance')
          .where('period', period)
          .orderBy('rank', 'asc')
          .limit(limit)
          .select('alliance_id as id', 'alliance_name as name', 'alliance_flag', 'pattern_id', 'color', 'member_count', 'total_pixels', 'rank');

        return leaderboard;
      }

      return [];
    } catch (error) {
      console.error('获取排行榜失败:', error);
      return [];
    }
  }

  // 获取用户排名
  static async getUserRank(userId, type = 'user', period = 'daily', date = null) {
    try {
      if (type === 'user') {
        const userRank = await db('leaderboard_personal')
          .where({
            user_id: userId,
            period: period
          })
          .first();

        if (!userRank) {
          return null;
        }

        return {
          rank: userRank.rank,
          data: {
            id: userRank.user_id,
            username: userRank.username,
            display_name: userRank.display_name,
            avatar_url: userRank.avatar_url,
            pixel_count: userRank.pixel_count
          }
        };
      }

      return null;
    } catch (error) {
      console.error('获取用户排名失败:', error);
      return null;
    }
  }

  // 获取联盟排名
  static async getAllianceRank(allianceId, period = 'daily', date = null) {
    try {
      const allianceRank = await db('leaderboard_alliance')
        .where({
          alliance_id: allianceId,
          period: period
        })
        .first();

      if (!allianceRank) {
        return null;
      }

      return {
        rank: allianceRank.rank,
        data: {
          id: allianceRank.alliance_id,
          name: allianceRank.alliance_name,
          alliance_flag: allianceRank.alliance_flag,
          pattern_id: allianceRank.pattern_id,
          color: allianceRank.color,
          member_count: allianceRank.member_count,
          total_pixels: allianceRank.total_pixels
        }
      };
    } catch (error) {
      console.error('获取联盟排名失败:', error);
      return null;
    }
  }

  // 获取排行榜历史
  static async getLeaderboardHistory(type, period, limit = 7) {
    try {
      if (type === 'user') {
        const history = await db('leaderboard_personal')
          .where('period', period)
          .select(
            db.raw('DATE(period_start) as date'),
            'user_id as id',
            'username',
            'pixel_count',
            'rank'
          )
          .orderBy('period_start', 'desc')
          .orderBy('rank', 'asc')
          .limit(limit * 10);

        // 按日期分组
        const groupedHistory = {};
        history.forEach(item => {
          const date = item.date;
          if (!groupedHistory[date]) {
            groupedHistory[date] = [];
          }
          if (groupedHistory[date].length < 10) {
            groupedHistory[date].push(item);
          }
        });

        return Object.entries(groupedHistory).map(([date, rankings]) => ({
          date,
          rankings
        })).slice(0, limit);
      } else if (type === 'alliance') {
        const history = await db('leaderboard_alliance')
          .where('period', period)
          .select(
            db.raw('DATE(period_start) as date'),
            'alliance_id as id',
            'alliance_name as name',
            'total_pixels',
            'rank'
          )
          .orderBy('period_start', 'desc')
          .orderBy('rank', 'asc')
          .limit(limit * 10);

        // 按日期分组
        const groupedHistory = {};
        history.forEach(item => {
          const date = item.date;
          if (!groupedHistory[date]) {
            groupedHistory[date] = [];
          }
          if (groupedHistory[date].length < 10) {
            groupedHistory[date].push(item);
          }
        });

        return Object.entries(groupedHistory).map(([date, rankings]) => ({
          date,
          rankings
        })).slice(0, limit);
      }

      return [];
    } catch (error) {
      console.error('获取排行榜历史失败:', error);
      return [];
    }
  }

  // 清理旧排行榜数据
  static async cleanupOldLeaderboards(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      let totalDeleted = 0;

      // 清理个人排行榜旧数据
      const deletedPersonal = await db('leaderboard_personal')
        .where('created_at', '<', cutoffDate)
        .del();

      // 清理联盟排行榜旧数据
      const deletedAlliance = await db('leaderboard_alliance')
        .where('created_at', '<', cutoffDate)
        .del();

      totalDeleted = deletedPersonal + deletedAlliance;
      console.log(`清理了 ${totalDeleted} 条旧排行榜记录`);

      return totalDeleted;
    } catch (error) {
      console.error('清理旧排行榜数据失败:', error);
      return 0;
    }
  }
}

module.exports = Leaderboard;
