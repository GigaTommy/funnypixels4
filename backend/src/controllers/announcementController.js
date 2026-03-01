const Announcement = require('../models/Announcement');
const Alliance = require('../models/Alliance');

class AnnouncementController {
  // 创建公告
  static async createAnnouncement(req, res) {
    try {
      const { title, content, type, alliance_id, is_pinned, priority, expire_at } = req.body;
      const userId = req.user.id;

      // 验证输入
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: '公告标题和内容不能为空'
        });
      }

      // 验证类型
      if (!['global', 'alliance', 'system'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: '无效的公告类型'
        });
      }

      // 权限验证
      if (type === 'global') {
        // 检查用户是否有发布全局公告的权限
        const userRole = req.user.role || 'user';
        if (userRole !== 'admin' && userRole !== 'super_admin') {
          return res.status(403).json({
            success: false,
            message: '权限不足，只有管理员可以发布全局公告'
          });
        }
      }

      if (type === 'system') {
        // 检查用户是否有发布系统公告的权限
        const userRole = req.user.role || 'user';
        if (userRole !== 'super_admin') {
          return res.status(403).json({
            success: false,
            message: '权限不足，只有超级管理员可以发布系统公告'
          });
        }
      }

      if (type === 'alliance' && alliance_id) {
        // 检查用户是否是联盟的管理员或盟主
        const alliance = await Alliance.findById(alliance_id);
        if (!alliance) {
          return res.status(404).json({
            success: false,
            message: '联盟不存在'
          });
        }

        // 超级管理员可以发布任何联盟公告
        const userRole = req.user.role || 'user';
        if (userRole === 'super_admin') {
          // 超级管理员有权限发布任何联盟公告
        } else {
          // 普通用户需要检查联盟权限
          const allianceRole = await alliance.getUserRole(userId);
          if (allianceRole !== 'leader' && allianceRole !== 'admin') {
            return res.status(403).json({
              success: false,
              message: '权限不足，只有联盟管理员可以发布联盟公告'
            });
          }
        }
      }

      // 创建公告
      const announcement = await Announcement.create({
        author_id: userId,
        title,
        content,
        type,
        alliance_id: type === 'alliance' ? alliance_id : null,
        is_pinned: is_pinned || false,
        priority: priority || 0,
        expire_at: expire_at || null
      });

      res.status(201).json({
        success: true,
        message: '公告发布成功',
        announcement: {
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          alliance_id: announcement.alliance_id,
          is_pinned: announcement.is_pinned,
          priority: announcement.priority,
          publish_at: announcement.publish_at,
          expire_at: announcement.expire_at
        }
      });
    } catch (error) {
      console.error('创建公告失败:', error);
      res.status(500).json({
        success: false,
        message: '创建公告失败',
        error: error.message
      });
    }
  }

  // 获取全局公告列表
  static async getGlobalAnnouncements(req, res) {
    try {
      const { limit = 10, offset = 0 } = req.query;

      const announcements = await Announcement.getGlobalAnnouncements(
        parseInt(limit),
        parseInt(offset)
      );

      const total = await Announcement.getCount('global');

      res.json({
        success: true,
        announcements: announcements.map(announcement => ({
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          is_pinned: announcement.is_pinned,
          priority: announcement.priority,
          publish_at: announcement.publish_at,
          expire_at: announcement.expire_at,
          author_name: announcement.author_name,
          author_avatar: announcement.author_avatar
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total
        }
      });
    } catch (error) {
      console.error('获取全局公告失败:', error);
      res.status(500).json({
        success: false,
        message: '获取全局公告失败',
        error: error.message
      });
    }
  }

  // 获取联盟公告列表
  static async getAllianceAnnouncements(req, res) {
    try {
      const { alliance_id } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      const userId = req.user.id;

      // 检查用户是否是联盟成员
      const alliance = await Alliance.findById(alliance_id);
      if (!alliance) {
        return res.status(404).json({
          success: false,
          message: '联盟不存在'
        });
      }

      const isMember = await alliance.isMember(userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: '您不是该联盟成员'
        });
      }

      const announcements = await Announcement.getAllianceAnnouncements(
        alliance_id,
        parseInt(limit),
        parseInt(offset)
      );

      const total = await Announcement.getCount('alliance', alliance_id);

      res.json({
        success: true,
        announcements: announcements.map(announcement => ({
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          is_pinned: announcement.is_pinned,
          priority: announcement.priority,
          publish_at: announcement.publish_at,
          expire_at: announcement.expire_at,
          author_name: announcement.author_name,
          author_avatar: announcement.author_avatar
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total
        }
      });
    } catch (error) {
      console.error('获取联盟公告失败:', error);
      res.status(500).json({
        success: false,
        message: '获取联盟公告失败',
        error: error.message
      });
    }
  }

  // 获取系统公告列表
  static async getSystemAnnouncements(req, res) {
    try {
      const { limit = 10, offset = 0 } = req.query;

      const announcements = await Announcement.getSystemAnnouncements(
        parseInt(limit),
        parseInt(offset)
      );

      const total = await Announcement.getCount('system');

      res.json({
        success: true,
        announcements: announcements.map(announcement => ({
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          is_pinned: announcement.is_pinned,
          priority: announcement.priority,
          publish_at: announcement.publish_at,
          expire_at: announcement.expire_at,
          author_name: announcement.author_name,
          author_avatar: announcement.author_avatar
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total
        }
      });
    } catch (error) {
      console.error('获取系统公告失败:', error);
      res.status(500).json({
        success: false,
        message: '获取系统公告失败',
        error: error.message
      });
    }
  }

  // 获取公告详情
  static async getAnnouncementDetails(req, res) {
    try {
      const { id } = req.params;

      const announcement = await Announcement.findById(id);
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: '公告不存在'
        });
      }

      res.json({
        success: true,
        announcement: {
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          alliance_id: announcement.alliance_id,
          is_pinned: announcement.is_pinned,
          priority: announcement.priority,
          publish_at: announcement.publish_at,
          expire_at: announcement.expire_at,
          author_name: announcement.author_name,
          author_avatar: announcement.author_avatar
        }
      });
    } catch (error) {
      console.error('获取公告详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取公告详情失败',
        error: error.message
      });
    }
  }

  // 更新公告
  static async updateAnnouncement(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const announcement = await Announcement.findById(id);
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: '公告不存在'
        });
      }

      // 权限验证：只有作者或管理员可以编辑
      const userRole = req.user.role || 'user';
      if (announcement.author_id !== userId && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足，只有作者或管理员可以编辑公告'
        });
      }

      const updatedAnnouncement = await announcement.update(updateData);

      res.json({
        success: true,
        message: '公告更新成功',
        announcement: {
          id: updatedAnnouncement.id,
          title: updatedAnnouncement.title,
          content: updatedAnnouncement.content,
          type: updatedAnnouncement.type,
          alliance_id: updatedAnnouncement.alliance_id,
          is_pinned: updatedAnnouncement.is_pinned,
          priority: updatedAnnouncement.priority,
          publish_at: updatedAnnouncement.publish_at,
          expire_at: updatedAnnouncement.expire_at
        }
      });
    } catch (error) {
      console.error('更新公告失败:', error);
      res.status(500).json({
        success: false,
        message: '更新公告失败',
        error: error.message
      });
    }
  }

  // 获取用户可见的所有公告
  static async getAllUserVisibleAnnouncements(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const userId = req.user.id;

      // 获取全局公告
      const globalAnnouncements = await Announcement.getGlobalAnnouncements(
        parseInt(limit),
        parseInt(offset)
      );

      // 获取系统公告
      const systemAnnouncements = await Announcement.getSystemAnnouncements(
        parseInt(limit),
        parseInt(offset)
      );

      let allAnnouncements = [];

      // 添加全局公告
      allAnnouncements = allAnnouncements.concat(globalAnnouncements || []);

      // 添加系统公告
      allAnnouncements = allAnnouncements.concat(systemAnnouncements || []);

      // 获取用户联盟信息并添加联盟公告
      try {
        const Alliance = require('../models/Alliance');
        const userAlliance = await Alliance.getUserAlliance(userId);
        if (userAlliance) {
          const allianceAnnouncements = await Announcement.getAllianceAnnouncements(
            userAlliance.id,
            parseInt(limit),
            parseInt(offset)
          );
          allAnnouncements = allAnnouncements.concat(allianceAnnouncements || []);
        }
      } catch (error) {
        console.log('用户未加入联盟或获取联盟公告失败:', error.message);
      }

      // 排序：置顶 > 优先级 > 发布时间
      allAnnouncements.sort((a, b) => {
        // 首先按是否置顶排序
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;

        // 然后按优先级排序（数字越大优先级越高）
        const priorityDiff = (b.priority || 0) - (a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;

        // 最后按发布时间排序
        const aTime = new Date(a.publish_at || a.created_at).getTime();
        const bTime = new Date(b.publish_at || b.created_at).getTime();
        return bTime - aTime;
      });

      // 应用分页
      const startIndex = parseInt(offset);
      const endIndex = startIndex + parseInt(limit);
      const paginatedAnnouncements = allAnnouncements.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedAnnouncements.map(announcement => ({
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          is_pinned: announcement.is_pinned,
          priority: announcement.priority,
          publish_at: announcement.publish_at,
          expire_at: announcement.expire_at,
          created_at: announcement.created_at,
          updated_at: announcement.updated_at,
          author_name: announcement.author_name,
          author_avatar: announcement.author_avatar,
          alliance_id: announcement.alliance_id,
          author_id: announcement.author_id,
          is_active: announcement.is_active
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: allAnnouncements.length
        }
      });
    } catch (error) {
      console.error('获取用户可见公告失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户可见公告失败',
        error: error.message
      });
    }
  }

  // 删除公告
  static async deleteAnnouncement(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const announcement = await Announcement.findById(id);
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: '公告不存在'
        });
      }

      // 权限验证：只有作者或管理员可以删除
      const userRole = req.user.role || 'user';
      if (announcement.author_id !== userId && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足，只有作者或管理员可以删除公告'
        });
      }

      await announcement.delete();

      res.json({
        success: true,
        message: '公告删除成功'
      });
    } catch (error) {
      console.error('删除公告失败:', error);
      res.status(500).json({
        success: false,
        message: '删除公告失败',
        error: error.message
      });
    }
  }
}

module.exports = AnnouncementController;
