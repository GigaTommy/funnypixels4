const PatternBomb = require('../models/PatternBomb');
const Store = require('../models/Store');

class PatternBombController {
  // 获取预设图案列表
  static async getPresetPatterns(req, res) {
    try {
      const patterns = await PatternBomb.getPresetPatterns();
      
      res.json({
        success: true,
        patterns: patterns
      });
    } catch (error) {
      console.error('获取预设图案失败:', error);
      res.status(500).json({
        success: false,
        message: '获取预设图案失败',
        error: error.message
      });
    }
  }

  // 创建图案炸弹
  static async createBomb(req, res) {
    try {
      const { pattern_name, pattern_data, center_lat, center_lng, color, area_size } = req.body;
      const userId = req.user.id;
      const logger = require('../utils/logger');

      // 验证必需字段
      if (!pattern_name || !pattern_data || !center_lat || !center_lng || !color) {
        return res.status(400).json({
          success: false,
          message: '缺少必需字段'
        });
      }

      // 验证图案数据格式
      if (!Array.isArray(pattern_data) || pattern_data.length === 0) {
        return res.status(400).json({
          success: false,
          message: '图案数据格式无效'
        });
      }

      // 检查用户是否有颜色炸弹道具
      const hasBomb = await Store.hasItem(userId, 9); // 颜色炸弹的ID
      if (!hasBomb) {
        return res.status(400).json({
          success: false,
          message: '您没有颜色炸弹道具'
        });
      }

      // 🆕 获取中心点逆地理信息（统一用于所有像素）
      let centerLocationInfo = {
        country: null,
        province: null,
        city: null,
        district: null,
        adcode: null,
        formatted_address: null,
        geocoded: false,
        geocoded_at: null
      };

      try {
        logger.info(`🗺️ 获取图案炸弹中心点地理信息: (${center_lat}, ${center_lng})`);
        const geocodingService = require('../services/geocodingService');
        centerLocationInfo = await geocodingService.reverseGeocodeWithTimeout(
          parseFloat(center_lat),
          parseFloat(center_lng),
          3000
        );
        logger.info(`✅ 图案炸弹中心点地理信息获取成功: ${centerLocationInfo.province} ${centerLocationInfo.city}`);
      } catch (geoError) {
        logger.warn(`⚠️ 图案炸弹中心点地理信息获取失败，使用默认值:`, geoError.message);
        const geocodingService = require('../services/geocodingService');
        centerLocationInfo = geocodingService.getDefaultLocationInfo();
      }

      // 开始事务
      const { db } = require('../config/database');
      await db.transaction(async (trx) => {
        // 创建图案炸弹（包含地理信息）
        const bomb = await PatternBomb.create({
          user_id: userId,
          pattern_name,
          pattern_data,
          center_lat,
          center_lng,
          color,
          area_size: area_size || 6
        });

        // 🆕 使用PatternBombPixelRenderer处理像素渲染
        const PatternBombPixelRenderer = require('../services/PatternBombPixelRenderer');
        await PatternBombPixelRenderer.renderPatternBomb({
          bombId: bomb.id,
          userId: userId,
          centerLat: parseFloat(center_lat),
          centerLng: parseFloat(center_lng),
          patternData: pattern_data,
          color: color,
          areaSize: area_size || 6,
          locationInfo: centerLocationInfo, // 🆕 传入中心点地理信息
          transaction: trx
        });

        // 消耗颜色炸弹道具
        await Store.useItemWithTransaction(userId, 9, 1, trx);
      });

      logger.info(`✅ 图案炸弹创建成功:`, {
        userId,
        patternName: pattern_name,
        centerLat: center_lat,
        centerLng: center_lng,
        color: color,
        areaSize: area_size || 6,
        locationInfo: `${centerLocationInfo.province} ${centerLocationInfo.city}`
      });

      res.json({
        success: true,
        message: '图案炸弹创建成功',
        locationInfo: {
          province: centerLocationInfo.province,
          city: centerLocationInfo.city,
          geocoded: centerLocationInfo.geocoded
        }
      });
    } catch (error) {
      console.error('创建图案炸弹失败:', error);
      res.status(500).json({
        success: false,
        message: '创建图案炸弹失败',
        error: error.message
      });
    }
  }

  // 获取用户的图案炸弹
  static async getUserBombs(req, res) {
    try {
      const userId = req.user.id;
      const bombs = await PatternBomb.getUserBombs(userId);
      
      res.json({
        success: true,
        bombs: bombs
      });
    } catch (error) {
      console.error('获取用户图案炸弹失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户图案炸弹失败',
        error: error.message
      });
    }
  }

  // 应用图案炸弹效果
  static async applyBombEffect(req, res) {
    try {
      const { bombId, centerLat, centerLng } = req.body;
      const userId = req.user.id;

      // 验证必需字段
      if (!bombId || !centerLat || !centerLng) {
        return res.status(400).json({
          success: false,
          message: '缺少必需字段'
        });
      }

      // 应用炸弹效果
      const result = await PatternBomb.applyBombEffect(userId, bombId, centerLat, centerLng);

      res.json({
        success: true,
        message: '图案炸弹效果应用成功',
        result: result
      });
    } catch (error) {
      console.error('应用图案炸弹效果失败:', error);
      res.status(500).json({
        success: false,
        message: '应用图案炸弹效果失败',
        error: error.message
      });
    }
  }

  // 获取用户的图案炸弹使用历史
  static async getBombHistory(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 20;
      const history = await PatternBomb.getUserBombHistory(userId, limit);
      
      res.json({
        success: true,
        history: history
      });
    } catch (error) {
      console.error('获取图案炸弹历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取图案炸弹历史失败',
        error: error.message
      });
    }
  }

  // 删除图案炸弹
  static async deleteBomb(req, res) {
    try {
      const { bombId } = req.params;
      const userId = req.user.id;

      await PatternBomb.deleteBomb(userId, bombId);

      res.json({
        success: true,
        message: '图案炸弹删除成功'
      });
    } catch (error) {
      console.error('删除图案炸弹失败:', error);
      res.status(500).json({
        success: false,
        message: '删除图案炸弹失败',
        error: error.message
      });
    }
  }

  // 检查用户是否有可用的图案炸弹
  static async checkAvailableBomb(req, res) {
    try {
      const userId = req.user.id;
      const hasBomb = await PatternBomb.hasAvailableBomb(userId);
      
      res.json({
        success: true,
        hasAvailableBomb: hasBomb
      });
    } catch (error) {
      console.error('检查可用图案炸弹失败:', error);
      res.status(500).json({
        success: false,
        message: '检查可用图案炸弹失败',
        error: error.message
      });
    }
  }

  // 预览图案效果
  static async previewPattern(req, res) {
    try {
      const { pattern_data, center_lat, center_lng, color, area_size } = req.body;

      // 验证必需字段
      if (!pattern_data || !center_lat || !center_lng || !color) {
        return res.status(400).json({
          success: false,
          message: '缺少必需字段'
        });
      }

      // 计算图案像素位置
      const pixels = [];
      const patternRows = pattern_data.length;
      const patternCols = pattern_data[0].length;
      
      for (let row = 0; row < patternRows; row++) {
        for (let col = 0; col < patternCols; col++) {
          if (pattern_data[row][col] === 1) {
            // 计算像素位置
            const pixelLat = center_lat + ((row - Math.floor(patternRows / 2)) * 0.0001);
            const pixelLng = center_lng + ((col - Math.floor(patternCols / 2)) * 0.0001);
            
            pixels.push({
              lat: pixelLat,
              lng: pixelLng,
              color: color
            });
          }
        }
      }

      res.json({
        success: true,
        preview: {
          pixels: pixels,
          totalPixels: pixels.length,
          pattern: pattern_data
        }
      });
    } catch (error) {
      console.error('预览图案失败:', error);
      res.status(500).json({
        success: false,
        message: '预览图案失败',
        error: error.message
      });
    }
  }
}

module.exports = PatternBombController;
