const QRTreasure = require('../models/QRTreasure');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// 配置图片上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/treasures');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'treasure-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif, webp)'));
    }
  }
});

class QRTreasureController {
  /**
   * 扫一扫 - 统一入口
   */
  static async scanQRCode(req, res) {
    try {
      const { qrContent, lat, lng } = req.body;
      const userId = req.user.id;

      if (!qrContent || !lat || !lng) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：qrContent, lat, lng'
        });
      }

      const result = await QRTreasure.handleQRScan(
        qrContent,
        { lat: parseFloat(lat), lng: parseFloat(lng) },
        userId
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('扫描二维码失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '扫描失败'
      });
    }
  }

  /**
   * 藏宝
   */
  static async hideTreasure(req, res) {
    try {
      const {
        qrContent,
        lat,
        lng,
        title,
        description,
        hint,
        rewardPoints
      } = req.body;
      const userId = req.user.id;

      if (!qrContent || !lat || !lng || !title) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数：qrContent, lat, lng, title'
        });
      }

      // 验证奖励积分范围
      const points = parseInt(rewardPoints) || 50;
      if (points < 50 || points > 1000) {
        return res.status(400).json({
          success: false,
          message: '奖励积分必须在 50-1000 之间'
        });
      }

      // 获取上传的图片URL（如果有）
      let imageUrl = null;
      if (req.file) {
        imageUrl = `/uploads/treasures/${req.file.filename}`;
      }

      const result = await QRTreasure.quickHideTreasure(
        userId,
        qrContent,
        { lat: parseFloat(lat), lng: parseFloat(lng) },
        {
          title,
          description,
          hint,
          rewardPoints: points,
          image_url: imageUrl
        }
      );

      res.json(result);
    } catch (error) {
      logger.error('藏宝失败:', error);

      // 如果上传了文件但藏宝失败，删除文件
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          logger.error('删除失败的上传文件错误:', unlinkError);
        }
      }

      res.status(500).json({
        success: false,
        message: error.message || '藏宝失败'
      });
    }
  }

  /**
   * 领取宝藏
   */
  static async claimTreasure(req, res) {
    try {
      const { treasureId } = req.params;
      const { lat, lng } = req.body;
      const userId = req.user.id;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: '缺少位置信息'
        });
      }

      const result = await QRTreasure.claimTreasure(
        userId,
        treasureId,
        parseFloat(lat),
        parseFloat(lng)
      );

      res.json(result);
    } catch (error) {
      logger.error('领取宝藏失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '领取失败'
      });
    }
  }

  /**
   * 获取我的藏宝记录
   */
  static async getMyHiddenTreasures(req, res) {
    try {
      const userId = req.user.id;
      const { db } = require('../config/database');

      const treasures = await db('qr_treasures')
        .where({ hider_id: userId })
        .orderBy('hidden_at', 'desc')
        .select('*');

      res.json({
        success: true,
        treasures
      });
    } catch (error) {
      logger.error('获取藏宝记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取失败'
      });
    }
  }

  /**
   * 获取我的寻宝记录
   */
  static async getMyFoundTreasures(req, res) {
    try {
      const userId = req.user.id;
      const { db } = require('../config/database');

      const treasures = await db('qr_treasures')
        .where({ finder_id: userId })
        .orderBy('found_at', 'desc')
        .select('*');

      res.json({
        success: true,
        treasures
      });
    } catch (error) {
      logger.error('获取寻宝记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取失败'
      });
    }
  }

  /**
   * 获取宝藏详情
   */
  static async getTreasureDetail(req, res) {
    try {
      const { treasureId } = req.params;
      const { db } = require('../config/database');

      const treasure = await db('qr_treasures')
        .where({ treasure_id: treasureId })
        .first();

      if (!treasure) {
        return res.status(404).json({
          success: false,
          message: '宝藏不存在'
        });
      }

      res.json({
        success: true,
        treasure
      });
    } catch (error) {
      logger.error('获取宝藏详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取失败'
      });
    }
  }

  /**
   * 获取附近的宝藏列表
   */
  static async getNearbyTreasures(req, res) {
    try {
      const { lat, lng, radius = 5, limit = 50, includeFound = false, treasureType = 'all' } = req.body;
      const userId = req.user.id;

      // 参数验证
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          message: '坐标参数无效'
        });
      }

      if (radius < 0.1 || radius > 100) {
        return res.status(400).json({
          success: false,
          message: '搜索半径应在0.1-100公里之间'
        });
      }

      // 计算边界范围（将公里转换为度数）
      const latDelta = radius / 111; // 1度纬度约等于111公里
      const lngDelta = radius / (111 * Math.cos(lat * Math.PI / 180)); // 经度根据纬度调整

      const minLat = lat - latDelta;
      const maxLat = lat + latDelta;
      const minLng = lng - lngDelta;
      const maxLng = lng + lngDelta;

      logger.debug(`🗺️ 查询附近宝藏:`, {
        userLocation: { lat, lng },
        radius,
        bounds: { minLat, maxLat, minLng, maxLng },
        treasureType,
        includeFound
      });

      // 使用模型方法查询附近宝藏
      const treasures = await QRTreasure.getNearbyTreasures(lat, lng, radius, {
        limit,
        includeFound,
        treasureType,
        userId
      });

      // 计算距离和区域信息
      const treasuresWithDistance = treasures.map(treasure => {
        const distance = QRTreasure.calculateDistance(lat, lng, treasure.hide_lat, treasure.hide_lng);
        return {
          ...treasure,
          distance_from_user: Math.round(distance * 1000), // 转换为米
          direction: QRTreasureController.calculateDirection(lat, lng, treasure.hide_lat, treasure.hide_lng)
        };
      });

      // 按距离排序
      treasuresWithDistance.sort((a, b) => a.distance_from_user - b.distance_from_user);

      // 获取区域信息
      const area = QRTreasureController.getAreaName(lat, lng);

      logger.info(`🗺️ 查询附近宝藏完成:`, {
        found: treasuresWithDistance.length,
        total: treasures.length,
        area,
        radius
      });

      res.json({
        success: true,
        data: {
          treasures: treasuresWithDistance,
          total: treasuresWithDistance.length,
          area: area || '未知区域'
        }
      });

    } catch (error) {
      logger.error('获取附近宝藏失败:', error);
      logger.error('错误堆栈:', error.stack);
      res.status(500).json({
        success: false,
        message: '获取附近宝藏失败: ' + error.message
      });
    }
  }

  /**
   * 获取指定区域内的宝藏
   */
  static async getTreasuresInBounds(req, res) {
    try {
      const { northEast, southWest } = req.body;
      const { includeFound = false, treasureType = 'all' } = req.body;
      const userId = req.user.id;

      // 参数验证
      if (!northEast || !southWest ||
          !northEast.lat || !northEast.lng ||
          !southWest.lat || !southWest.lng) {
        return res.status(400).json({
          success: false,
          message: '边界参数无效'
        });
      }

      const minLat = Math.min(southWest.lat, northEast.lat);
      const maxLat = Math.max(southWest.lat, northEast.lat);
      const minLng = Math.min(southWest.lng, northEast.lng);
      const maxLng = Math.max(southWest.lng, northEast.lng);

      // 构建查询
      let query = QRTreasure.query()
        .whereBetween('hide_lat', [minLat, maxLat])
        .whereBetween('hide_lng', [minLng, maxLng])
        .where('status', 'active');

      // 宝藏类型过滤
      if (treasureType !== 'all') {
        query = query.where('qr_code_type', treasureType === 'fixed' ? 'fixed' : 'mobile');
      }

      // 是否包含已找到的宝藏
      if (!includeFound) {
        query = query.andWhere(function() {
          this.where('finder_id', null).orWhere('finder_id', '!=', userId);
        });
      }

      const treasures = await query
        .orderBy('created_at', 'desc')
        .limit(200); // 区域查询限制数量

      // 过滤过期的宝藏
      const validTreasures = treasures.filter(treasure => {
        if (treasure.expires_at && new Date(treasure.expires_at) < new Date()) {
          return false;
        }
        return true;
      });

      logger.info(`🗺️ 查询区域宝藏完成:`, {
        bounds: { northEast, southWest },
        found: validTreasures.length
      });

      res.json({
        success: true,
        data: {
          treasures: validTreasures,
          total: validTreasures.length,
          area: '指定区域'
        }
      });

    } catch (error) {
      logger.error('获取区域宝藏失败:', error);
      res.status(500).json({
        success: false,
        message: '获取区域宝藏失败'
      });
    }
  }

  /**
   * 获取移动宝藏轨迹
   */
  static async getTreasureTrail(req, res) {
    try {
      const { treasureId } = req.params;

      if (!treasureId) {
        return res.status(400).json({
          success: false,
          message: '宝藏ID不能为空'
        });
      }

      // 获取宝藏信息
      const treasure = await QRTreasure.query()
        .where('treasure_id', treasureId)
        .first();

      if (!treasure) {
        return res.status(404).json({
          success: false,
          message: '宝藏不存在'
        });
      }

      // 如果是固定宝藏，返回简单信息
      if (treasure.qr_code_type === 'fixed') {
        return res.json({
          success: true,
          data: {
            trail: [{
              location: {
                lat: treasure.hide_lat,
                lng: treasure.hide_lng
              },
              timestamp: treasure.created_at,
              action: 'hide',
              actor: treasure.hider_id
            }],
            total_moves: 0,
            treasure_type: 'fixed'
          }
        });
      }

      // 对于移动宝藏，查询历史记录（这里简化处理，实际可以从日志表查询）
      // 由于当前没有专门的历史表，我们返回当前位置和首次位置
      const trail = [
        {
          location: {
            lat: treasure.first_hide_lat || treasure.hide_lat,
            lng: treasure.first_hide_lng || treasure.hide_lng
          },
          timestamp: treasure.created_at,
          action: 'hide',
          actor: treasure.hider_id
        }
      ];

      // 如果有移动记录，添加当前位置
      if (treasure.first_hide_lat && treasure.first_hide_lng &&
          (treasure.first_hide_lat !== treasure.hide_lat || treasure.first_hide_lng !== treasure.hide_lng)) {
        trail.push({
          location: {
            lat: treasure.hide_lat,
            lng: treasure.hide_lng
          },
          timestamp: treasure.updated_at || treasure.created_at,
          action: 'move',
          actor: 'system' // 或者从日志中获取实际移动者
        });
      }

      res.json({
        success: true,
        data: {
          trail: trail,
          total_moves: trail.length - 1,
          treasure_type: treasure.qr_code_type
        }
      });

    } catch (error) {
      logger.error('获取宝藏轨迹失败:', error);
      res.status(500).json({
        success: false,
        message: '获取宝藏轨迹失败'
      });
    }
  }

  /**
   * 计算两点间距离（公里）
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径（公里）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 计算方向
   */
  static calculateDirection(fromLat, fromLng, toLat, toLng) {
    const dLng = this.toRadians(toLng - fromLng);
    const lat1 = this.toRadians(fromLat);
    const lat2 = this.toRadians(toLat);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    const bearing = Math.atan2(y, x);
    const degrees = bearing * (180 / Math.PI);
    const normalizedDegrees = (degrees + 360) % 360;

    // 转换为方向描述
    if (normalizedDegrees >= 337.5 || normalizedDegrees < 22.5) return '北';
    if (normalizedDegrees >= 22.5 && normalizedDegrees < 67.5) return '东北';
    if (normalizedDegrees >= 67.5 && normalizedDegrees < 112.5) return '东';
    if (normalizedDegrees >= 112.5 && normalizedDegrees < 157.5) return '东南';
    if (normalizedDegrees >= 157.5 && normalizedDegrees < 202.5) return '南';
    if (normalizedDegrees >= 202.5 && normalizedDegrees < 247.5) return '西南';
    if (normalizedDegrees >= 247.5 && normalizedDegrees < 292.5) return '西';
    if (normalizedDegrees >= 292.5 && normalizedDegrees < 337.5) return '西北';

    return '未知';
  }

  /**
   * 角度转弧度
   */
  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 获取区域名称（简化版本，实际可以集成逆地理编码）
   */
  static getAreaName(lat, lng) {
    // 这里可以集成高德地图的逆地理编码API
    // 暂时返回简化的区域描述
    const latRounded = Math.round(lat);
    const lngRounded = Math.round(lng);
    return `${latRounded}°${lngRounded > 0 ? 'E' : 'W'}${Math.abs(lngRounded)}`;
  }
}

module.exports = {
  QRTreasureController,
  upload
};
