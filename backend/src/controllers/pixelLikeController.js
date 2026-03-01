const PixelLike = require('../models/PixelLike');
const Achievement = require('../models/Achievement');
const User = require('../models/User');
const { db } = require('../config/database');
const { calculateGridId } = require('../../shared/utils/gridUtils');
const NotificationService = require('../services/notificationService');
const { getSocketManager, hasSocketManager } = require('../services/socketManagerInstance');
const tileUpdateHandler = require('../websocket/tileUpdateHandler');

class PixelLikeController {
  // 广播点赞更新
  static async broadcastLikeUpdate(pixel, likeCount, likerId) {
    try {
      if (!pixel) return;

      const gridId = pixel.grid_id || pixel.gridId;
      if (!gridId) return;

      const pixelUpdate = {
        id: gridId,
        lat: parseFloat(pixel.latitude),
        lng: parseFloat(pixel.longitude),
        color: pixel.color,
        type: pixel.pattern_id ? 'complex' : 'color',
        pattern_id: pixel.pattern_id,
        user_id: pixel.user_id,
        like_count: parseInt(likeCount), // Include like count
        timestamp: Date.now()
      };

      // 1. Tile-based Rooms Broadcast (Zoom 12-18)
      const zoomLevels = [12, 13, 14, 15, 16, 17, 18];
      for (const zoom of zoomLevels) {
        tileUpdateHandler.broadcastPixelUpdate(pixelUpdate, zoom);
      }

      // 2. SocketManager Broadcast
      if (hasSocketManager()) {
        const socketManager = getSocketManager();
        const tileId = socketManager.calculateTileId(pixelUpdate.lat, pixelUpdate.lng);

        socketManager.broadcastTilePixelUpdate(tileId, {
          ...pixelUpdate,
          gridId: gridId, // Ensure gridId is present
          optimization: 'real_time_like'
        });
      }
    } catch (error) {
      console.error('广播点赞更新失败:', error);
    }
  }


  // 点赞像素
  static async likePixel(req, res) {
    try {
      const { pixelId } = req.params;
      const { pixelOwnerId } = req.body;
      const userId = req.user.id;

      if (!pixelOwnerId) {
        return res.status(400).json({
          success: false,
          message: '需要提供像素所有者ID'
        });
      }

      // 执行点赞
      const like = await PixelLike.likePixel(pixelId, userId, pixelOwnerId);

      // 获取最新点赞数
      const likeCount = await PixelLike.getPixelLikeCount(pixelId);

      // 获取像素信息用于通知和广播
      const pixel = await db('pixels').where('grid_id', pixelId).first();

      // 发送推送通知
      try {
        const owner = await User.findById(pixelOwnerId);
        if (owner && owner.device_token && userId !== pixelOwnerId) {
          const liker = await User.findById(userId);
          const likerName = liker ? (liker.display_name || liker.username) : '有人';

          await NotificationService.sendPushNotification(
            owner.device_token,
            '收到新点赞! ❤️',
            `${likerName} 赞了你的像素!`,
            {
              type: 'like',
              pixelId,
              lat: pixel ? pixel.latitude : null,
              lng: pixel ? pixel.longitude : null
            }
          );
        }
      } catch (notifyError) {
        console.error('发送点赞通知失败:', notifyError);
      }

      // 广播更新
      if (pixel) {
        PixelLikeController.broadcastLikeUpdate(pixel, likeCount, userId);
      }

      // 更新成就统计
      await Promise.all([
        // 点赞者：给出点赞数+1
        Achievement.updateUserStats(userId, { like_given_count: 1 }),
        // 被点赞者：收到点赞数+1
        Achievement.updateUserStats(pixelOwnerId, { like_received_count: 1 })
      ]);

      res.json({
        success: true,
        message: '点赞成功',
        data: like
      });
    } catch (error) {
      console.error('点赞像素失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '点赞失败',
        error: error.message
      });
    }
  }

  // 取消点赞
  static async unlikePixel(req, res) {
    try {
      const { pixelId } = req.params;
      const userId = req.user.id;

      // 获取点赞记录以获取像素所有者ID
      const existingLike = await db('pixel_likes')
        .where({
          pixel_id: pixelId,
          user_id: userId,
          deleted_at: null
        })
        .first();

      if (!existingLike) {
        return res.status(404).json({
          success: false,
          message: '未找到点赞记录'
        });
      }

      const pixelOwnerId = existingLike.pixel_owner_id;

      // 执行取消点赞
      await PixelLike.unlikePixel(pixelId, userId);

      // 更新成就统计（减少计数）
      await Promise.all([
        // 点赞者：给出点赞数-1
        Achievement.updateUserStats(userId, { like_given_count: -1 }),
        // 被点赞者：收到点赞数-1
        Achievement.updateUserStats(pixelOwnerId, { like_received_count: -1 })
      ]);

      res.json({
        success: true,
        message: '取消点赞成功'
      });
    } catch (error) {
      console.error('取消点赞失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '取消点赞失败',
        error: error.message
      });
    }
  }

  // 检查点赞状态
  static async checkLikeStatus(req, res) {
    try {
      const { pixelId } = req.params;
      const userId = req.user.id;

      const isLiked = await PixelLike.isLiked(pixelId, userId);
      const likeCount = await PixelLike.getPixelLikeCount(pixelId);

      res.json({
        success: true,
        data: {
          isLiked,
          likeCount
        }
      });
    } catch (error) {
      console.error('检查点赞状态失败:', error);
      res.status(500).json({
        success: false,
        message: '检查点赞状态失败',
        error: error.message
      });
    }
  }

  // 批量检查多个像素的点赞状态
  static async checkMultipleLikeStatus(req, res) {
    try {
      const { pixelIds } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(pixelIds) || pixelIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '需要提供像素ID数组'
        });
      }

      const [likeStatus, likeCounts] = await Promise.all([
        PixelLike.checkMultiplePixelLikeStatus(pixelIds, userId),
        PixelLike.getMultiplePixelLikeCounts(pixelIds)
      ]);

      const result = {};
      pixelIds.forEach(pixelId => {
        result[pixelId] = {
          isLiked: likeStatus[pixelId] || false,
          likeCount: likeCounts[pixelId] || 0
        };
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('批量检查点赞状态失败:', error);
      res.status(500).json({
        success: false,
        message: '批量检查点赞状态失败',
        error: error.message
      });
    }
  }

  // 获取像素点赞用户列表
  static async getPixelLikers(req, res) {
    try {
      const { pixelId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const likers = await PixelLike.getPixelLikers(
        pixelId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: likers
      });
    } catch (error) {
      console.error('获取像素点赞用户列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取像素点赞用户列表失败',
        error: error.message
      });
    }
  }

  // 获取用户点赞统计
  static async getUserLikeStats(req, res) {
    try {
      const { userId } = req.params;
      const stats = await PixelLike.getUserLikeStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('获取用户点赞统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户点赞统计失败',
        error: error.message
      });
    }
  }

  // 获取热门像素
  static async getPopularPixels(req, res) {
    try {
      const { limit = 20, offset = 0, timeRange = null } = req.query;

      const popularPixels = await PixelLike.getPopularPixels(
        parseInt(limit),
        parseInt(offset),
        timeRange
      );

      res.json({
        success: true,
        data: popularPixels
      });
    } catch (error) {
      console.error('获取热门像素失败:', error);
      res.status(500).json({
        success: false,
        message: '获取热门像素失败',
        error: error.message
      });
    }
  }

  // 获取用户的点赞历史
  static async getUserLikes(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20, offset = 0 } = req.query;

      const likes = await PixelLike.getUserLikes(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: likes
      });
    } catch (error) {
      console.error('获取用户点赞历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户点赞历史失败',
        error: error.message
      });
    }
  }

  // 获取用户收到的点赞
  static async getUserReceivedLikes(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20, offset = 0 } = req.query;

      const likes = await PixelLike.getUserReceivedLikes(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: likes
      });
    } catch (error) {
      console.error('获取用户收到的点赞失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户收到的点赞失败',
        error: error.message
      });
    }
  }

  // 按坐标点赞像素
  static async likePixelByCoords(req, res) {
    try {
      const { lat, lng } = req.params;
      const userId = req.user.id;

      // 将坐标转换为网格ID
      const pixelId = calculateGridId(parseFloat(lat), parseFloat(lng));

      // 查找像素以获取像素所有者ID
      const pixel = await db('pixels')
        .where('grid_id', pixelId)
        .first();

      if (!pixel) {
        return res.status(404).json({
          success: false,
          message: '像素不存在'
        });
      }

      const pixelOwnerId = pixel.user_id;

      // 执行点赞
      const like = await PixelLike.likePixel(pixelId, userId, pixelOwnerId);

      // 获取最新点赞数
      const likeCount = await PixelLike.getPixelLikeCount(pixelId);

      // 发送推送通知
      try {
        const owner = await User.findById(pixelOwnerId);
        if (owner && owner.device_token && userId !== pixelOwnerId) {
          const liker = await User.findById(userId);
          const likerName = liker ? (liker.display_name || liker.username) : '有人';

          await NotificationService.sendPushNotification(
            owner.device_token,
            '收到新点赞! ❤️',
            `${likerName} 赞了你的像素!`,
            {
              type: 'like',
              pixelId,
              lat: parseFloat(lat),
              lng: parseFloat(lng)
            }
          );
        }
      } catch (notifyError) {
        console.error('发送点赞通知失败:', notifyError);
      }

      // 广播更新
      if (pixel) {
        PixelLikeController.broadcastLikeUpdate(pixel, likeCount, userId);
      }

      // 更新成就统计
      await Promise.all([
        // 点赞者：给出点赞数+1
        Achievement.updateUserStats(userId, { like_given_count: 1 }),
        // 被点赞者：收到点赞数+1
        Achievement.updateUserStats(pixelOwnerId, { like_received_count: 1 })
      ]);

      res.json({
        success: true,
        message: '点赞成功',
        data: like
      });
    } catch (error) {
      console.error('按坐标点赞像素失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '点赞失败',
        error: error.message
      });
    }
  }

  // 按坐标取消点赞
  static async unlikePixelByCoords(req, res) {
    try {
      const { lat, lng } = req.params;
      const userId = req.user.id;

      // 将坐标转换为网格ID
      const pixelId = calculateGridId(parseFloat(lat), parseFloat(lng));

      // 获取点赞记录以获取像素所有者ID
      const existingLike = await db('pixel_likes')
        .where({
          pixel_id: pixelId,
          user_id: userId,
          deleted_at: null
        })
        .first();

      if (!existingLike) {
        return res.status(404).json({
          success: false,
          message: '未找到点赞记录'
        });
      }

      const pixelOwnerId = existingLike.pixel_owner_id;

      // 执行取消点赞
      await PixelLike.unlikePixel(pixelId, userId);

      // 更新成就统计（减少计数）
      await Promise.all([
        // 点赞者：给出点赞数-1
        Achievement.updateUserStats(userId, { like_given_count: -1 }),
        // 被点赞者：收到点赞数-1
        Achievement.updateUserStats(pixelOwnerId, { like_received_count: -1 })
      ]);

      res.json({
        success: true,
        message: '取消点赞成功'
      });
    } catch (error) {
      console.error('按坐标取消点赞失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '取消点赞失败',
        error: error.message
      });
    }
  }

  // 按坐标检查点赞状态
  static async checkLikeStatusByCoords(req, res) {
    try {
      const { lat, lng } = req.params;
      const userId = req.user.id;

      // 将坐标转换为网格ID
      const pixelId = calculateGridId(parseFloat(lat), parseFloat(lng));

      const isLiked = await PixelLike.isLiked(pixelId, userId);
      const likeCount = await PixelLike.getPixelLikeCount(pixelId);

      res.json({
        success: true,
        data: {
          isLiked,
          likeCount
        }
      });
    } catch (error) {
      console.error('按坐标检查点赞状态失败:', error);
      res.status(500).json({
        success: false,
        message: '检查点赞状态失败',
        error: error.message
      });
    }
  }

  // 按坐标获取像素点赞用户列表
  static async getPixelLikersByCoords(req, res) {
    try {
      const { lat, lng } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // 将坐标转换为网格ID
      const pixelId = calculateGridId(parseFloat(lat), parseFloat(lng));

      const likers = await PixelLike.getPixelLikers(
        pixelId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: likers
      });
    } catch (error) {
      console.error('按坐标获取像素点赞用户列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取像素点赞用户列表失败',
        error: error.message
      });
    }
  }
}

module.exports = PixelLikeController;