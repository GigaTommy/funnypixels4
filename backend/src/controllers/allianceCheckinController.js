const { db } = require('../config/database');
const Alliance = require('../models/Alliance');
const { getLevelForExp } = require('../constants/allianceLevels');
const AllianceActivityController = require('./allianceActivityController');

const CHECKIN_EXP = 10; // 每次签到获得的经验

class AllianceCheckinController {
  /**
   * 签到
   * POST /api/alliances/:id/checkin
   */
  static async checkin(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const today = new Date().toISOString().split('T')[0];

      // 验证联盟存在
      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({ success: false, message: '联盟不存在' });
      }

      // 验证用户是成员
      const isMember = await alliance.isMember(userId);
      if (!isMember) {
        return res.status(403).json({ success: false, message: '您不是该联盟的成员' });
      }

      // 检查是否已签到
      const existing = await db('alliance_checkins')
        .where({ alliance_id: id, user_id: userId, checkin_date: today })
        .first();

      if (existing) {
        return res.status(400).json({ success: false, message: '今日已签到' });
      }

      // 执行签到 + 增加联盟经验
      await db.transaction(async trx => {
        await trx('alliance_checkins').insert({
          alliance_id: id,
          user_id: userId,
          checkin_date: today,
          exp_earned: CHECKIN_EXP
        });

        await trx('alliances')
          .where('id', id)
          .increment('experience', CHECKIN_EXP);
      });

      // 获取更新后联盟经验和等级
      const updatedAlliance = await db('alliances').where('id', id).select('experience').first();
      const levelInfo = getLevelForExp(updatedAlliance.experience || 0);

      // 获取今日签到总数
      const todayCount = await db('alliance_checkins')
        .where({ alliance_id: id, checkin_date: today })
        .count('* as count')
        .first();

      // Record activity
      const checkinUser = await db('users').where('id', userId).select('username').first();
      AllianceActivityController.recordActivity(id, userId, checkinUser?.username, 'checkin');

      res.json({
        success: true,
        message: '签到成功',
        data: {
          exp_earned: CHECKIN_EXP,
          today_checkins: parseInt(todayCount.count),
          alliance_level: levelInfo.level,
          alliance_experience: updatedAlliance.experience,
          level_progress: levelInfo.progress
        }
      });
    } catch (error) {
      console.error('联盟签到失败:', error);
      res.status(500).json({ success: false, message: '签到失败', error: error.message });
    }
  }

  /**
   * 获取签到状态
   * GET /api/alliances/:id/checkin-status
   */
  static async getCheckinStatus(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const today = new Date().toISOString().split('T')[0];

      // 验证联盟存在
      const alliance = await Alliance.findById(id);
      if (!alliance) {
        return res.status(404).json({ success: false, message: '联盟不存在' });
      }

      // 检查用户今日签到状态
      const userCheckin = await db('alliance_checkins')
        .where({ alliance_id: id, user_id: userId, checkin_date: today })
        .first();

      // 获取今日已签到成员列表
      const checkedInMembers = await db('alliance_checkins')
        .join('users', 'alliance_checkins.user_id', 'users.id')
        .where({ alliance_id: id, checkin_date: today })
        .select(
          'users.id as user_id',
          'users.username',
          'users.display_name',
          'users.avatar_url',
          'users.avatar',
          'alliance_checkins.created_at as checkin_time'
        )
        .orderBy('alliance_checkins.created_at', 'asc');

      // 获取用户连续签到天数
      const streak = await AllianceCheckinController.getCheckinStreak(id, userId);

      res.json({
        success: true,
        data: {
          has_checked_in: !!userCheckin,
          streak,
          today_count: checkedInMembers.length,
          checked_in_members: checkedInMembers.map(m => ({
            user_id: m.user_id,
            username: m.username,
            display_name: m.display_name,
            avatar_url: m.avatar_url,
            avatar: m.avatar,
            checkin_time: m.checkin_time
          }))
        }
      });
    } catch (error) {
      console.error('获取签到状态失败:', error);
      res.status(500).json({ success: false, message: '获取签到状态失败', error: error.message });
    }
  }

  /**
   * 计算连续签到天数
   */
  static async getCheckinStreak(allianceId, userId) {
    const rows = await db('alliance_checkins')
      .where({ alliance_id: allianceId, user_id: userId })
      .orderBy('checkin_date', 'desc')
      .select('checkin_date')
      .limit(60);

    if (rows.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < rows.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      const expected = expectedDate.toISOString().split('T')[0];

      const checkinDate = typeof rows[i].checkin_date === 'string'
        ? rows[i].checkin_date
        : new Date(rows[i].checkin_date).toISOString().split('T')[0];

      if (checkinDate === expected) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}

module.exports = AllianceCheckinController;
