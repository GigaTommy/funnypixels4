const { db } = require('../config/database');

class Announcement {
  constructor(data) {
    this.id = data.id;
    this.author_id = data.author_id;
    this.title = data.title;
    this.content = data.content;
    this.type = data.type;
    this.alliance_id = data.alliance_id;
    this.is_active = data.is_active;
    this.is_pinned = data.is_pinned;
    this.priority = data.priority;
    this.display_style = data.display_style;
    this.publish_at = data.publish_at;
    this.expire_at = data.expire_at;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 创建公告
  static async create(announcementData) {
    try {
      const [announcement] = await db('announcements')
        .insert(announcementData)
        .returning('*');

      // Refresh global broadcast timestamp so lazy fan-out picks up the new announcement
      try {
        const { redisUtils } = require('../config/redis');
        await redisUtils.set('inbox:last_broadcast_at', Date.now().toString());
      } catch (_) { /* ignore Redis errors */ }

      return new Announcement(announcement);
    } catch (error) {
      throw error;
    }
  }

  // 根据ID获取公告
  static async findById(id) {
    try {
      const announcement = await db('announcements')
        .where('id', id)
        .where('is_active', true)
        .first();

      return announcement ? new Announcement(announcement) : null;
    } catch (error) {
      throw error;
    }
  }

  // 获取全局公告列表
  static async getGlobalAnnouncements(limit = 10, offset = 0) {
    try {
      const announcements = await db('announcements as a')
        .join('users as u', 'a.author_id', 'u.id')
        .where('a.type', 'global')
        .where('a.is_active', true)
        .where(function () {
          this.whereNull('a.expire_at')
            .orWhere('a.expire_at', '>', db.fn.now());
        })
        .select(
          'a.*',
          'u.username as author_name',
          'u.avatar_url as author_avatar'
        )
        .orderBy('a.is_pinned', 'desc')
        .orderBy('a.priority', 'desc')
        .orderBy('a.publish_at', 'desc')
        .limit(limit)
        .offset(offset);

      return announcements.map(announcement => new Announcement(announcement));
    } catch (error) {
      throw error;
    }
  }

  // 获取联盟公告列表
  static async getAllianceAnnouncements(allianceId, limit = 10, offset = 0) {
    try {
      const announcements = await db('announcements as a')
        .join('users as u', 'a.author_id', 'u.id')
        .where('a.alliance_id', allianceId)
        .where('a.is_active', true)
        .where(function () {
          this.whereNull('a.expire_at')
            .orWhere('a.expire_at', '>', db.fn.now());
        })
        .select(
          'a.*',
          'u.username as author_name',
          'u.avatar_url as author_avatar'
        )
        .orderBy('a.is_pinned', 'desc')
        .orderBy('a.priority', 'desc')
        .orderBy('a.publish_at', 'desc')
        .limit(limit)
        .offset(offset);

      return announcements.map(announcement => new Announcement(announcement));
    } catch (error) {
      throw error;
    }
  }

  // 获取系统公告列表
  static async getSystemAnnouncements(limit = 10, offset = 0) {
    try {
      const announcements = await db('announcements as a')
        .join('users as u', 'a.author_id', 'u.id')
        .where('a.type', 'system')
        .where('a.is_active', true)
        .where(function () {
          this.whereNull('a.expire_at')
            .orWhere('a.expire_at', '>', db.fn.now());
        })
        .select(
          'a.*',
          'u.username as author_name',
          'u.avatar_url as author_avatar'
        )
        .orderBy('a.is_pinned', 'desc')
        .orderBy('a.priority', 'desc')
        .orderBy('a.publish_at', 'desc')
        .limit(limit)
        .offset(offset);

      return announcements.map(announcement => new Announcement(announcement));
    } catch (error) {
      throw error;
    }
  }

  // 更新公告
  async update(updateData) {
    try {
      const allowedFields = ['title', 'content', 'is_active', 'is_pinned', 'priority', 'display_style', 'expire_at'];
      const filteredData = {};

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      filteredData.updated_at = db.fn.now();

      const [updated] = await db('announcements')
        .where('id', this.id)
        .update(filteredData)
        .returning('*');

      Object.assign(this, updated);
      return this;
    } catch (error) {
      throw error;
    }
  }

  // 删除公告（软删除）
  async delete() {
    try {
      const [deleted] = await db('announcements')
        .where('id', this.id)
        .update({
          is_active: false,
          updated_at: db.fn.now()
        })
        .returning('*');

      Object.assign(this, deleted);
      return this;
    } catch (error) {
      throw error;
    }
  }

  // 获取公告总数
  static async getCount(type = 'global', allianceId = null) {
    try {
      let query = db('announcements')
        .where('type', type)
        .where('is_active', true)
        .where(function () {
          this.whereNull('expire_at')
            .orWhere('expire_at', '>', db.fn.now());
        });

      if (allianceId) {
        query = query.where('alliance_id', allianceId);
      }

      const result = await query.count('* as count').first();
      return parseInt(result.count);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Announcement;
