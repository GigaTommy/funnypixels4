const { db } = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class AllianceAdminController {
  static async getAllianceDetail(req, res) {
    try {
      const { id } = req.params;

      const alliance = await db('alliances').where('id', id).first();
      if (!alliance) {
        return res.status(404).json({ success: false, message: '联盟不存在' });
      }

      const members = await db('alliance_members as am')
        .leftJoin('users as u', 'am.user_id', 'u.id')
        .select('am.*', 'u.username', 'u.display_name', 'u.avatar_url', 'u.role as user_role')
        .where('am.alliance_id', id)
        .orderBy('am.role', 'asc');

      const logs = await db('alliance_moderation_logs')
        .where('alliance_id', id)
        .orderBy('created_at', 'desc')
        .limit(50);

      res.json({
        success: true,
        data: { alliance, members, moderation_logs: logs }
      });
    } catch (error) {
      logger.error('Get alliance detail error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async adminEditAlliance(req, res) {
    try {
      const { id } = req.params;
      const { name, description, notice, max_members, is_public } = req.body;
      const updateData = {};

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (notice !== undefined) updateData.notice = notice;
      if (max_members !== undefined) updateData.max_members = max_members;
      if (is_public !== undefined) updateData.is_public = is_public;
      updateData.updated_at = new Date();

      const [updated] = await db('alliances')
        .where('id', id)
        .update(updateData)
        .returning('*');

      // Log moderation action
      await db('alliance_moderation_logs').insert({
        id: uuidv4(),
        alliance_id: id,
        admin_id: req.user.id,
        admin_name: req.user.display_name || req.user.username,
        action: 'edit',
        reason: `管理员编辑: ${Object.keys(updateData).filter(k => k !== 'updated_at').join(', ')}`,
        metadata: JSON.stringify(updateData),
        created_at: new Date()
      });

      res.json({ success: true, data: updated, message: '联盟信息已更新' });
    } catch (error) {
      logger.error('Admin edit alliance error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async adminWarnAlliance(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const [updated] = await db('alliances')
        .where('id', id)
        .update({
          ban_status: 'warned',
          warn_count: db.raw('COALESCE(warn_count, 0) + 1'),
          updated_at: new Date()
        })
        .returning('*');

      await db('alliance_moderation_logs').insert({
        id: uuidv4(),
        alliance_id: id,
        admin_id: req.user.id,
        admin_name: req.user.display_name || req.user.username,
        action: 'warn',
        reason: reason || '违规警告',
        created_at: new Date()
      });

      res.json({ success: true, data: updated, message: '已发出警告' });
    } catch (error) {
      logger.error('Admin warn alliance error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async adminSuspendAlliance(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const [updated] = await db('alliances')
        .where('id', id)
        .update({
          ban_status: 'suspended',
          ban_reason: reason,
          banned_by: req.user.id,
          banned_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      await db('alliance_moderation_logs').insert({
        id: uuidv4(),
        alliance_id: id,
        admin_id: req.user.id,
        admin_name: req.user.display_name || req.user.username,
        action: 'suspend',
        reason: reason || '暂停联盟活动',
        created_at: new Date()
      });

      res.json({ success: true, data: updated, message: '联盟已暂停' });
    } catch (error) {
      logger.error('Admin suspend alliance error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async adminBanAlliance(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const [updated] = await db('alliances')
        .where('id', id)
        .update({
          ban_status: 'banned',
          ban_reason: reason,
          banned_by: req.user.id,
          banned_at: new Date(),
          is_active: false,
          updated_at: new Date()
        })
        .returning('*');

      await db('alliance_moderation_logs').insert({
        id: uuidv4(),
        alliance_id: id,
        admin_id: req.user.id,
        admin_name: req.user.display_name || req.user.username,
        action: 'ban',
        reason: reason || '封禁联盟',
        created_at: new Date()
      });

      res.json({ success: true, data: updated, message: '联盟已封禁' });
    } catch (error) {
      logger.error('Admin ban alliance error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async adminUnbanAlliance(req, res) {
    try {
      const { id } = req.params;

      const [updated] = await db('alliances')
        .where('id', id)
        .update({
          ban_status: null,
          ban_reason: null,
          banned_by: null,
          banned_at: null,
          is_active: true,
          updated_at: new Date()
        })
        .returning('*');

      await db('alliance_moderation_logs').insert({
        id: uuidv4(),
        alliance_id: id,
        admin_id: req.user.id,
        admin_name: req.user.display_name || req.user.username,
        action: 'unban',
        reason: '解除封禁',
        created_at: new Date()
      });

      res.json({ success: true, data: updated, message: '联盟已解封' });
    } catch (error) {
      logger.error('Admin unban alliance error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async adminDisbandAlliance(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      await db.transaction(async (trx) => {
        // Remove all members
        await trx('alliance_members').where('alliance_id', id).del();

        // Deactivate alliance
        await trx('alliances')
          .where('id', id)
          .update({
            is_active: false,
            member_count: 0,
            ban_status: 'banned',
            ban_reason: reason || '管理员解散',
            banned_by: req.user.id,
            banned_at: new Date(),
            updated_at: new Date()
          });

        // Log
        await trx('alliance_moderation_logs').insert({
          id: uuidv4(),
          alliance_id: id,
          admin_id: req.user.id,
          admin_name: req.user.display_name || req.user.username,
          action: 'disband',
          reason: reason || '管理员解散联盟',
          created_at: new Date()
        });
      });

      res.json({ success: true, message: '联盟已解散' });
    } catch (error) {
      logger.error('Admin disband alliance error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async adminKickMember(req, res) {
    try {
      const { id, userId } = req.params;
      const { reason } = req.body;

      await db.transaction(async (trx) => {
        await trx('alliance_members')
          .where({ alliance_id: id, user_id: userId })
          .del();

        await trx('alliances')
          .where('id', id)
          .decrement('member_count', 1);

        // Clear user's alliance_id
        await trx('users')
          .where('id', userId)
          .update({ alliance_id: null });

        await trx('alliance_moderation_logs').insert({
          id: uuidv4(),
          alliance_id: id,
          admin_id: req.user.id,
          admin_name: req.user.display_name || req.user.username,
          action: 'kick_member',
          target_user_id: userId,
          reason: reason || '管理员踢出成员',
          created_at: new Date()
        });
      });

      res.json({ success: true, message: '成员已被踢出' });
    } catch (error) {
      logger.error('Admin kick member error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getModerationLogs(req, res) {
    try {
      const { id } = req.params;
      const { current = 1, pageSize = 20 } = req.query;

      const countResult = await db('alliance_moderation_logs')
        .where('alliance_id', id)
        .count('* as total')
        .first();

      const logs = await db('alliance_moderation_logs')
        .where('alliance_id', id)
        .orderBy('created_at', 'desc')
        .offset((parseInt(current) - 1) * parseInt(pageSize))
        .limit(parseInt(pageSize));

      res.json({
        success: true,
        data: {
          list: logs,
          total: parseInt(countResult.total),
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('Get moderation logs error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = AllianceAdminController;
