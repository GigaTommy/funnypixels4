const { db } = require('../config/database');
const { snapToGrid } = require('../utils/gridUtils');
const { PIXEL_TYPES } = require('../constants/pixelTypes');
const pixelsHistoryService = require('./pixelsHistoryService');
const logger = require('../utils/logger');
const geocodingService = require('./geocodingService');

/**
 * 特殊道具像素渲染服务
 * 负责为漂流瓶、QR宝藏等特殊道具创建地图像素显示
 * 确保特殊道具能在地图上正确渲染
 */
class SpecialItemPixelRenderer {

  /**
   * 为漂流瓶创建像素
   * @param {Object} bottle - 漂流瓶对象
   * @param {Object} options - 渲染选项
   */
  static async renderDriftBottlePixel(bottle, options = {}) {
    try {
      const {
        currentLat = bottle.current_lat,
        currentLng = bottle.current_lng,
        bottleId = bottle.bottle_id,
        color = '#4A90E2', // 漂流瓶主题色：蓝色
        pixelSize = 1, // 单个像素
        icon = '🍾' // 漂流瓶图标
      } = options;

      logger.info(`🍾 开始创建漂流瓶像素:`, { bottleId, currentLat, currentLng });

      // 1. 获取地理位置信息
      const locationInfo = await geocodingService.reverseGeocode(
        parseFloat(currentLat),
        parseFloat(currentLng)
      );

      // 2. 计算网格坐标
      const gridCoord = snapToGrid(currentLat, currentLng);

      // 3. 创建图案数据（简单的1x1漂流瓶图标）
      const patternData = [[1]]; // 1x1图案

      // 4. 转换为像素坐标
      const pixelCoordinates = this.convertPatternToPixels(
        currentLat,
        currentLng,
        patternData,
        bottleId,
        bottle.original_owner_id || null,
        'drift_bottle',
        color
      );

      // 5. 创建emoji图案资源
      await this.createEmojiPatternAsset(bottleId, 'drift_bottle', icon, color);

      // 6. 写入像素数据库
      const result = await this.batchWriteSpecialItemPixels(
        pixelCoordinates,
        locationInfo,
        'drift_bottle'
      );

      logger.info(`✅ 漂流瓶像素创建完成:`, {
        bottleId,
        pixelCount: pixelCoordinates.length,
        result
      });

      return {
        success: true,
        pixelCount: pixelCoordinates.length,
        result
      };

    } catch (error) {
      logger.error(`❌ 漂流瓶像素创建失败:`, error);
      throw error;
    }
  }

  /**
   * 为QR宝藏创建像素
   * @param {Object} treasure - QR宝藏对象
   * @param {Object} options - 渲染选项
   */
  static async renderQRTreasurePixel(treasure, options = {}) {
    try {
      const {
        hideLat = treasure.hide_lat,
        hideLng = treasure.hide_lng,
        treasureId = treasure.treasure_id,
        color = '#FFD700', // 宝藏主题色：金色
        icon = '💎', // 宝藏图标
        treasureType = treasure.treasure_type // 'fixed' or 'moving'
      } = options;

      // 移动宝藏可能没有固定位置
      if (!hideLat || !hideLng) {
        logger.warn(`⚠️ 移动宝藏无法创建固定像素:`, { treasureId, treasureType });
        return { success: true, pixelCount: 0, note: 'moving_treasure_no_fixed_position' };
      }

      logger.info(`💎 开始创建QR宝藏像素:`, { treasureId, hideLat, hideLng, treasureType });

      // 1. 获取地理位置信息
      const locationInfo = await geocodingService.reverseGeocode(
        parseFloat(hideLat),
        parseFloat(hideLng)
      );

      // 2. 计算网格坐标
      const gridCoord = snapToGrid(hideLat, hideLng);

      // 3. 根据宝藏类型创建不同的图案
      let patternData;
      if (treasureType === 'moving') {
        patternData = [[1, 1], [1, 1]]; // 2x2图案，表示移动宝藏
      } else {
        patternData = [[1]]; // 1x1图案，表示固定宝藏
      }

      // 4. 转换为像素坐标
      const pixelCoordinates = this.convertPatternToPixels(
        hideLat,
        hideLng,
        patternData,
        treasureId,
        treasure.hider_id || null,
        'qr_treasure',
        color
      );

      // 5. 创建emoji图案资源
      await this.createEmojiPatternAsset(treasureId, 'qr_treasure', icon, color);

      // 6. 写入像素数据库
      const result = await this.batchWriteSpecialItemPixels(
        pixelCoordinates,
        locationInfo,
        'qr_treasure'
      );

      logger.info(`✅ QR宝藏像素创建完成:`, {
        treasureId,
        treasureType,
        pixelCount: pixelCoordinates.length,
        result
      });

      return {
        success: true,
        pixelCount: pixelCoordinates.length,
        result
      };

    } catch (error) {
      logger.error(`❌ QR宝藏像素创建失败:`, error);
      throw error;
    }
  }

  /**
   * 转换图案数据为像素坐标
   */
  static convertPatternToPixels(centerLat, centerLng, patternData, itemId, userId, pixelType, color) {
    const pixels = [];
    const centerGrid = snapToGrid(centerLat, centerLng);
    const baseGridLat = Math.floor(centerGrid.lat * 10000) / 10000;
    const baseGridLng = Math.floor(centerGrid.lng * 10000) / 10000;

    const patternHeight = patternData.length;
    const patternWidth = patternData[0].length;

    // 🔧 修复：related_id是UUID类型，特殊道具使用字符串ID不兼容
    // 暂时设置为null，后续可以通过pattern_id关联特殊道具
    const relatedId = null;

    for (let row = 0; row < patternHeight; row++) {
      for (let col = 0; col < patternWidth; col++) {
        if (patternData[row][col] === 1) {
          // 计算像素偏移（中心对齐）
          const offsetLat = (row - Math.floor(patternHeight / 2)) * 0.0001;
          const offsetLng = (col - Math.floor(patternWidth / 2)) * 0.0001;

          const pixelLat = baseGridLat + offsetLat;
          const pixelLng = baseGridLng + offsetLng;
          const pixelGridId = snapToGrid(pixelLat, pixelLng);

          pixels.push({
            grid_id: pixelGridId.gridId, // 🔧 修复：使用正确的属性名gridId
            latitude: pixelLat,
            longitude: pixelLng,
            color: color,
            user_id: userId,
            pixel_type: 'bomb', // 🔧 修复：使用允许的'bomb'类型表示特殊道具
            related_id: relatedId, // 🔧 修复：设置为null避免UUID约束错误
            // 🔧 使用pattern_id存储特殊道具信息，格式：itemType_itemId
            pattern_id: `${pixelType}_${itemId}`
          });
        }
      }
    }

    return pixels;
  }

  /**
   * 创建emoji图案资源
   */
  static async createEmojiPatternAsset(itemId, itemType, emoji, color) {
    try {
      const patternKey = `${itemType}_${itemId}`;

      // 检查是否已存在
      const existing = await db('pattern_assets')
        .where({ key: patternKey })
        .first();

      if (existing) {
        logger.debug(`📋 图案资源已存在: ${patternKey}`);
        return existing;
      }

      // 创建新的emoji图案资源
      const [patternAsset] = await db('pattern_assets').insert({
        key: patternKey,
        name: `${itemType} - ${itemId}`, // 🔧 修复：添加name字段
        render_type: 'emoji',
        unicode_char: emoji,
        color: color,
        description: `${itemType} - ${itemId}`,
        encoding: 'emoji',
        category: 'special_item',
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      logger.info(`✅ 创建emoji图案资源: ${patternKey} (${emoji})`);
      return patternAsset;

    } catch (error) {
      logger.error(`❌ 创建图案资源失败:`, error);
      throw error;
    }
  }

  /**
   * 批量写入特殊道具像素
   */
  static async batchWriteSpecialItemPixels(pixelCoordinates, locationInfo, pixelType) {
    const timestamp = new Date();
    const BATCH_SIZE = 100; // 批处理大小

    try {
      const batches = [];
      for (let i = 0; i < pixelCoordinates.length; i += BATCH_SIZE) {
        batches.push(pixelCoordinates.slice(i, i + BATCH_SIZE));
      }

      let totalInserted = 0;
      let totalUpdated = 0;

      // 使用事务确保数据一致性
      await db.transaction(async (trx) => {
        for (const batch of batches) {
          const result = await this.processBatchWithTransaction(
            batch,
            locationInfo,
            timestamp,
            trx
          );

          totalInserted += result.inserted;
          totalUpdated += result.updated;
        }
      });

      // 异步记录历史（不阻塞主流程）
      setImmediate(() => {
        this.recordPixelHistory(pixelCoordinates, locationInfo, pixelType)
          .catch(error => {
            logger.error(`❌ 记录${pixelType}像素历史失败:`, error);
          });
      });

      return {
        inserted: totalInserted,
        updated: totalUpdated,
        total: pixelCoordinates.length
      };

    } catch (error) {
      logger.error(`❌ 批量写入${pixelType}像素失败:`, error);
      throw error;
    }
  }

  /**
   * 使用事务处理单个批次
   */
  static async processBatchWithTransaction(batch, locationInfo, timestamp, transaction) {
    const insertData = batch.map(pixel => ({
      grid_id: pixel.grid_id,
      latitude: pixel.latitude,
      longitude: pixel.longitude,
      color: pixel.color,
      user_id: pixel.user_id,
      pixel_type: pixel.pixel_type,
      related_id: pixel.related_id,
      // 🔧 修复：添加pattern_id字段
      pattern_id: pixel.pattern_id,
      // 使用统一的地理信息
      country: locationInfo.country,
      province: locationInfo.province,
      city: locationInfo.city,
      district: locationInfo.district,
      adcode: locationInfo.adcode,
      formatted_address: locationInfo.formatted_address,
      geocoded: locationInfo.geocoded,
      geocoded_at: locationInfo.geocoded_at,
      created_at: timestamp,
      updated_at: timestamp
    }));

    // 高性能批量upsert
    const result = await transaction('pixels')
      .insert(insertData)
      .onConflict('grid_id')
      .merge({
        latitude: transaction.raw('EXCLUDED.latitude'),
        longitude: transaction.raw('EXCLUDED.longitude'),
        color: transaction.raw('EXCLUDED.color'),
        user_id: transaction.raw('EXCLUDED.user_id'),
        pixel_type: transaction.raw('EXCLUDED.pixel_type'),
        related_id: transaction.raw('EXCLUDED.related_id'),
        // 🔧 修复：更新pattern_id
        pattern_id: transaction.raw('EXCLUDED.pattern_id'),
        // 更新地理信息
        country: transaction.raw('EXCLUDED.country'),
        province: transaction.raw('EXCLUDED.province'),
        city: transaction.raw('EXCLUDED.city'),
        district: transaction.raw('EXCLUDED.district'),
        adcode: transaction.raw('EXCLUDED.adcode'),
        formatted_address: transaction.raw('EXCLUDED.formatted_address'),
        geocoded: transaction.raw('EXCLUDED.geocoded'),
        geocoded_at: transaction.raw('EXCLUDED.geocoded_at'),
        updated_at: timestamp
      })
      .returning('created_at');

    // 统计新插入 vs 更新
    const newInserts = result.filter(r => r.created_at.getTime() === timestamp.getTime()).length;
    const updates = result.length - newInserts;

    return { inserted: newInserts, updated: updates };
  }

  /**
   * 异步记录像素历史
   */
  static async recordPixelHistory(pixelBatch, locationInfo, pixelType) {
    try {
      const historyData = pixelBatch.map(pixel => ({
        latitude: pixel.latitude,
        longitude: pixel.longitude,
        color: pixel.color,
        user_id: pixel.user_id,
        grid_id: pixel.grid_id,
        pixel_type: pixel.pixel_type,
        related_id: pixel.related_id,
        // 使用统一的地理信息
        country: locationInfo.country,
        province: locationInfo.province,
        city: locationInfo.city,
        district: locationInfo.district,
        adcode: locationInfo.adcode,
        formatted_address: locationInfo.formatted_address,
        geocoded: locationInfo.geocoded,
        geocoded_at: locationInfo.geocoded_at,
        action_type: `${pixelType}_create`,
        created_at: new Date()
      }));

      // 批量插入历史记录
      await db('pixels_history').insert(historyData);

      logger.info(`✅ ${pixelType}历史记录完成: ${historyData.length}条`);
    } catch (error) {
      logger.error(`❌ 记录${pixelType}像素历史失败:`, error);
      throw error;
    }
  }

  /**
   * 清理特殊道具像素
   * @param {string} itemId - 道具ID
   * @param {string} pixelType - 像素类型
   */
  static async clearSpecialItemPixels(itemId, pixelType) {
    try {
      const deleted = await db('pixels')
        .where({
          pixel_type: pixelType,
          related_id: itemId
        })
        .del();

      logger.info(`🗑️ 清理${pixelType}像素:`, { itemId, deleted });

      return { deleted };
    } catch (error) {
      logger.error(`❌ 清理${pixelType}像素失败:`, error);
      throw error;
    }
  }

  /**
   * 移动特殊道具像素位置
   * @param {string} itemId - 道具ID
   * @param {string} pixelType - 像素类型
   * @param {number} newLat - 新纬度
   * @param {number} newLng - 新经度
   */
  static async moveSpecialItemPixels(itemId, pixelType, newLat, newLng, options = {}) {
    try {
      // 1. 清理旧位置像素
      await this.clearSpecialItemPixels(itemId, pixelType);

      // 2. 在新位置创建像素
      const item = await this.getSpecialItemById(itemId, pixelType);
      if (!item) {
        throw new Error(`${pixelType}不存在: ${itemId}`);
      }

      let result;
      if (pixelType === 'drift_bottle') {
        result = await this.renderDriftBottlePixel(item, options);
      } else if (pixelType === 'qr_treasure') {
        result = await this.renderQRTreasurePixel(item, options);
      }

      logger.info(`🚚 移动${pixelType}像素:`, { itemId, newLat, newLng, result });

      return result;
    } catch (error) {
      logger.error(`❌ 移动${pixelType}像素失败:`, error);
      throw error;
    }
  }

  /**
   * 根据ID获取特殊道具
   */
  static async getSpecialItemById(itemId, pixelType) {
    try {
      if (pixelType === 'drift_bottle') {
        return await db('drift_bottles').where({ bottle_id: itemId }).first();
      } else if (pixelType === 'qr_treasure') {
        return await db('qr_treasures').where({ treasure_id: itemId }).first();
      }
      return null;
    } catch (error) {
      logger.error(`❌ 获取${pixelType}失败:`, error);
      return null;
    }
  }
}

module.exports = SpecialItemPixelRenderer;