/**
 * 头像控制器
 * 提供头像生成和管理API
 */

const AvatarService = require('../services/avatarService');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class AvatarController {
  /**
   * 为用户生成头像URL
   */
  static async generateAvatarUrl(req, res) {
    try {
      const userId = req.params.id || req.params.userId;
      const { pixel_data, size = 'medium' } = req.body;

      logger.info(`🎨 生成用户头像请求:`, { userId, size, pixelDataLength: pixel_data?.length });

      if (!pixel_data) {
        return res.status(400).json({
          success: false,
          message: '缺少像素数据'
        });
      }

      // 验证size参数
      const validSizes = ['small', 'medium', 'large'];
      if (!validSizes.includes(size)) {
        return res.status(400).json({
          success: false,
          message: `无效的尺寸参数，支持的尺寸: ${validSizes.join(', ')}`
        });
      }

      // 获取用户信息
      const userQuery = await db.raw('SELECT * FROM users WHERE id = ?', [userId]);
      const user = userQuery.rows[0];
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 创建头像服务实例
      const avatarService = new AvatarService();

      // 生成头像URL
      const avatarUrl = await avatarService.getAvatarUrl(pixel_data, size, userId);

      if (avatarUrl) {
        // 更新用户的avatar_url字段（仅限medium尺寸）
        if (size === 'medium') {
          await avatarService.updateUserAvatarUrl(userId, avatarUrl);
        }

        res.json({
          success: true,
          avatar_url: avatarUrl,
          size,
          user_id: userId,
          message: '头像生成成功'
        });
      } else {
        res.status(500).json({
          success: false,
          message: '头像生成失败'
        });
      }

    } catch (error) {
      logger.error('生成头像URL失败:', error);
      res.status(500).json({
        success: false,
        message: '头像生成失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
      });
    }
  }

  /**
   * 批量生成用户头像URL
   */
  static async batchGenerateAvatarUrls(req, res) {
    try {
      const { users, avatar_field = 'avatar', size = 'small' } = req.body;

      logger.info(`🎨 批量生成头像请求:`, {
        userCount: users?.length,
        avatar_field,
        size
      });

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
          success: false,
          message: '用户列表不能为空'
        });
      }

      // 验证size参数
      const validSizes = ['small', 'medium', 'large'];
      if (!validSizes.includes(size)) {
        return res.status(400).json({
          success: false,
          message: `无效的尺寸参数，支持的尺寸: ${validSizes.join(', ')}`
        });
      }

      // 创建头像服务实例
      const avatarService = new AvatarService();

      // 批量处理
      const processedUsers = await avatarService.batchProcessAvatars(users, avatar_field, size);

      res.json({
        success: true,
        users: processedUsers,
        processed_count: processedUsers.filter(u => u.avatar_processed).length,
        size,
        message: '批量头像生成完成'
      });

    } catch (error) {
      logger.error('批量生成头像URL失败:', error);
      res.status(500).json({
        success: false,
        message: '批量头像生成失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
      });
    }
  }

  /**
   * 获取用户头像信息
   */
  static async getUserAvatar(req, res) {
    try {
      const userId = req.params.id || req.params.userId;
      const { size = 'medium' } = req.query;

      logger.info('🔍 getUserAvatar 参数:', {
        params: req.params,
        userId,
        userIdType: typeof userId,
        url: req.url
      });

      // 获取用户信息
      const userQuery = await db.raw('SELECT id, username, avatar, avatar_url FROM users WHERE id = ?', [userId]);
      const user = userQuery.rows[0];

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 如果已有avatar_url且有效，直接返回
      if (user.avatar_url) {
        return res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            avatar_url: user.avatar_url
          },
          has_avatar: true
        });
      }

      // 如果有avatar数据，生成新的avatar_url
      if (user.avatar) {
        const avatarService = new AvatarService();
        const avatarUrl = await avatarService.getAvatarUrl(user.avatar, size, userId);

        if (avatarUrl && size === 'medium') {
          await avatarService.updateUserAvatarUrl(userId, avatarUrl);
          user.avatar_url = avatarUrl;
        }
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          avatar_url: user.avatar_url
        },
        has_avatar: !!user.avatar
      });

    } catch (error) {
      logger.error('获取用户头像信息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户头像失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
      });
    }
  }

  /**
   * 预热用户头像缓存
   */
  static async warmupUserAvatars(req, res) {
    try {
      const { user_ids } = req.body;

      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: '用户ID列表不能为空'
        });
      }

      // 获取用户信息
      const users = await db('users')
        .whereIn('id', user_ids)
        .select('id', 'avatar');

      if (users.length === 0) {
        return res.json({
          success: true,
          message: '没有找到需要预热的用户',
          warmed_count: 0
        });
      }

      // 过滤有avatar数据的用户
      const usersWithAvatar = users.filter(user => user.avatar);

      // 创建头像服务实例并预热
      const avatarService = new AvatarService();
      const sizes = ['small', 'medium', 'large'];
      let warmedCount = 0;

      for (const user of usersWithAvatar) {
        for (const size of sizes) {
          try {
            await avatarService.getAvatarUrl(user.avatar, size, user.id);
            warmedCount++;
          } catch (error) {
            logger.warn(`用户${user.id} ${size}尺寸头像预热失败:`, error);
          }
        }
      }

      res.json({
        success: true,
        message: '头像预热完成',
        users_with_avatar: usersWithAvatar.length,
        warmed_count: warmedCount
      });

    } catch (error) {
      logger.error('预热用户头像失败:', error);
      res.status(500).json({
        success: false,
        message: '头像预热失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
      });
    }
  }

  /**
   * 清理头像缓存
   */
  static async clearAvatarCache(req, res) {
    try {
      const avatarService = new AvatarService();
      avatarService.clearAvatarCache();

      res.json({
        success: true,
        message: '头像缓存已清理'
      });

    } catch (error) {
      logger.error('清理头像缓存失败:', error);
      res.status(500).json({
        success: false,
        message: '清理头像缓存失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
      });
    }
  }

  /**
   * 获取头像服务统计信息
   */
  static async getAvatarStats(req, res) {
    try {
      const avatarService = new AvatarService();
      const stats = avatarService.getStorageStats();

      res.json({
        success: true,
        stats,
        message: '头像服务统计信息获取成功'
      });

    } catch (error) {
      logger.error('获取头像服务统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取头像服务统计失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
      });
    }
  }
}

module.exports = AvatarController;