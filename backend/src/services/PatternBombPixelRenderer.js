const { db } = require('../config/database');
const { snapToGrid } = require('../utils/gridUtils');
const { PIXEL_TYPES } = require('../constants/pixelTypes');
const pixelsHistoryService = require('./pixelsHistoryService');
const logger = require('../utils/logger');

/**
 * 图案炸弹像素渲染服务
 * 负责将图案炸弹的像素数据转换为标准像素格式并批量写入数据库
 * 使用中心点逆地理信息统一赋值给所有像素，减少API调用
 */
class PatternBombPixelRenderer {

  /**
   * 渲染图案炸弹到像素
   * @param {Object} params - 渲染参数
   * @param {string} params.bombId - 图案炸弹ID
   * @param {string} params.userId - 用户ID
   * @param {number} params.centerLat - 中心点纬度
   * @param {number} params.centerLng - 中心点经度
   * @param {Array} params.patternData - 图案数据
   * @param {string} params.color - 颜色
   * @param {number} params.areaSize - 区域大小
   * @param {Object} params.locationInfo - 中心点地理信息
   * @param {Object} params.transaction - 数据库事务
   */
  static async renderPatternBomb(params) {
    const {
      bombId,
      userId,
      centerLat,
      centerLng,
      patternData,
      color,
      areaSize = 6,
      locationInfo,
      transaction,
      allianceId = null
    } = params;

    const startTime = Date.now();
    logger.info(`🎨 开始渲染图案炸弹像素:`, {
      bombId,
      userId,
      centerLat,
      centerLng,
      color,
      areaSize,
      patternSize: patternData.length,
      locationProvided: !!locationInfo?.geocoded
    });

    try {
      // 1. 转换图案数据为像素坐标
      const pixelCoordinates = this.convertPatternToPixels(
        centerLat,
        centerLng,
        patternData,
        areaSize,
        userId,
        bombId,
        allianceId
      );

      // 2. 批量写入像素（使用统一的地理信息）
      const writeResult = await this.batchWriteBombPixels(
        pixelCoordinates,
        locationInfo,
        transaction
      );

      const processingTime = Date.now() - startTime;
      logger.info(`✅ 图案炸弹像素渲染完成:`, {
        bombId,
        pixelCount: pixelCoordinates.length,
        processingTime: `${processingTime}ms`,
        geocodingStrategy: 'center_point_unified',
        locationInfo: locationInfo?.geocoded ? `${locationInfo.province} ${locationInfo.city}` : 'default'
      });

      return {
        success: true,
        pixelCount: pixelCoordinates.length,
        writeResult,
        processingTime
      };

    } catch (error) {
      logger.error(`❌ 图案炸弹像素渲染失败:`, {
        bombId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 转换图案数据为像素坐标
   * @param {number} centerLat - 中心点纬度
   * @param {number} centerLng - 中心点经度
   * @param {Array} patternData - 图案数据 (二维数组)
   * @param {number} areaSize - 区域大小
   * @param {string} userId - 用户ID
   * @param {string} bombId - 图案炸弹ID
   * @returns {Array} 像素坐标数组
   */
  static convertPatternToPixels(centerLat, centerLng, patternData, areaSize, userId, bombId, allianceId = null) {
    const lat = parseFloat(centerLat);
    const lng = parseFloat(centerLng);
    const pixels = [];

    // 验证输入参数
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error(`无效的中心坐标: lat=${lat}, lng=${lng}`);
    }

    // 使用系统标准网格大小：0.0001度 ≈ 11米
    const GRID_SIZE_DEGREES = 0.0001;

    // 计算图案的原点偏移（中心对齐）
    const patternHeight = patternData.length;
    const patternWidth = Math.max(...patternData.map(row => row.length));
    const originOffsetX = -Math.floor(patternWidth / 2);
    const originOffsetY = -Math.floor(patternHeight / 2);

    logger.info(`📍 图案投影信息:`, {
      center: `(${lat.toFixed(6)}, ${lng.toFixed(6)})`,
      patternSize: `${patternWidth}x${patternHeight}`,
      areaSize,
      originOffset: `(${originOffsetX}, ${originOffsetY})`
    });

    let processedPixels = 0;

    // 遍历图案数据，转换每个像素
    for (let y = 0; y < patternData.length; y++) {
      const row = patternData[y];
      for (let x = 0; x < row.length; x++) {
        // 只处理值为1的像素（绘制像素）
        if (row[x] === 1) {
          // 计算相对于中心的偏移
          const pixelX = x + originOffsetX;
          const pixelY = y + originOffsetY;

          // 计算实际经纬度
          const longitude = lng + (pixelX * GRID_SIZE_DEGREES);
          const latitude = lat - (pixelY * GRID_SIZE_DEGREES); // 注意是减号

          // 使用 snapToGrid 生成标准 grid_id
          const { lat: snappedLat, lng: snappedLng, gridId } = snapToGrid(latitude, longitude);

          pixels.push({
            grid_id: gridId,
            latitude: snappedLat,
            longitude: snappedLng,
            color: color,
            user_id: userId,
            pixel_type: PIXEL_TYPES.BOMB,
            related_id: bombId,
            alliance_id: allianceId || null,
            _debug: {
              pattern_x: x,
              pattern_y: y,
              pixel_x: pixelX,
              pixel_y: pixelY,
              calculated_lat: latitude,
              calculated_lng: longitude,
              snapped_lat: snappedLat,
              snapped_lng: snappedLng
            }
          });

          processedPixels++;
        }
      }
    }

    logger.info(`📊 图案转换统计:`, {
      totalPatternPixels: processedPixels,
      outputPixels: pixels.length,
      uniqueGrids: new Set(pixels.map(p => p.grid_id)).size
    });

    return pixels;
  }

  /**
   * 批量写入图案炸弹像素
   * 使用中心点地理信息统一赋值给所有像素
   * @param {Array} pixelBatch - 像素批次
   * @param {Object} locationInfo - 地理信息
   * @param {Object} transaction - 数据库事务
   */
  static async batchWriteBombPixels(pixelBatch, locationInfo, transaction) {
    const startTime = Date.now();
    logger.info(`📦 开始批量写入图案炸弹像素: ${pixelBatch.length}个`);

    try {
      const BATCH_SIZE = 200; // 图案炸弹使用适中的批次大小
      let inserted = 0;
      let updated = 0;
      const timestamp = new Date();

      // 如果没有提供地理信息，使用默认值
      const finalLocationInfo = locationInfo || {
        country: null,
        province: null,
        city: null,
        district: null,
        adcode: null,
        formatted_address: null,
        geocoded: false,
        geocoded_at: null
      };

      // 使用提供的事务或创建新事务
      const dbClient = transaction || db;

      // 分批处理
      for (let i = 0; i < pixelBatch.length; i += BATCH_SIZE) {
        const batch = pixelBatch.slice(i, i + BATCH_SIZE);

        if (transaction) {
          // 使用现有事务
          const batchResult = await this.processBatchWithTransaction(
            batch, finalLocationInfo, timestamp, transaction
          );
          inserted += batchResult.inserted;
          updated += batchResult.updated;
        } else {
          // 创建新事务
          const batchResult = await db.transaction(async (trx) => {
            return this.processBatchWithTransaction(batch, finalLocationInfo, timestamp, trx);
          });
          inserted += batchResult.inserted;
          updated += batchResult.updated;
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info(`✅ 图案炸弹批量写入完成:`, {
        inserted,
        updated,
        total: pixelBatch.length,
        processingTime: `${processingTime}ms`,
        geocodingStrategy: 'center_point_unified',
        locationInfo: finalLocationInfo.geocoded ? `${finalLocationInfo.province} ${finalLocationInfo.city}` : 'default'
      });

      // 异步处理历史记录（不阻塞主流程）
      if (!transaction) {
        setImmediate(() => {
          this.recordPixelHistory(pixelBatch, finalLocationInfo).catch(error => {
            logger.error('❌ 记录图案炸弹像素历史失败:', error);
          });
        });
      }

      return { inserted, updated, processingTime };

    } catch (error) {
      logger.error('❌ 图案炸弹批量写入失败:', error);
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
      alliance_id: pixel.alliance_id || null,
      // 使用统一的地理信息（所有像素共享中心点的地理信息）
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
        alliance_id: transaction.raw('EXCLUDED.alliance_id'),
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
  static async recordPixelHistory(pixelBatch, locationInfo) {
    try {
      const historyData = pixelBatch.map(pixel => ({
        latitude: pixel.latitude,
        longitude: pixel.longitude,
        color: pixel.color,
        user_id: pixel.user_id,
        grid_id: pixel.grid_id,
        pixel_type: pixel.pixel_type,
        related_id: pixel.related_id,
        alliance_id: pixel.alliance_id || null,
        // 使用统一的地理信息
        country: locationInfo.country,
        province: locationInfo.province,
        city: locationInfo.city,
        district: locationInfo.district,
        adcode: locationInfo.adcode,
        formatted_address: locationInfo.formatted_address,
        geocoded: locationInfo.geocoded,
        geocoded_at: locationInfo.geocoded_at,
        action_type: 'bomb_draw',
        created_at: new Date()
      }));

      // 批量插入历史记录
      await db('pixels_history').insert(historyData);

      logger.info(`✅ 图案炸弹历史记录完成: ${historyData.length}条`);
    } catch (error) {
      logger.error('❌ 记录图案炸弹像素历史失败:', error);
      throw error;
    }
  }
}

module.exports = PatternBombPixelRenderer;