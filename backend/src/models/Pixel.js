const { db } = require('../config/database');
const CacheService = require('../services/cacheService');
const { PIXEL_TYPES } = require('../constants/pixelTypes');
const pixelsHistoryService = require('../services/pixelsHistoryService');
const tileChangeQueueService = require('../services/tileChangeQueueService');
const geocodingQueue = require('../services/geocodingQueue');
const TowerAggregationService = require('../services/towerAggregationService');

class Pixel {
  static tableName = 'pixels';

  /**
   * 创建或更新像素（统一使用pattern_id）
   * 改进：实时获取地理信息，确保数据完整性
   */
  static async createOrUpdate(pixelData) {
    const {
      gridId,
      userId,
      patternId,
      anchorX,
      anchorY,
      rotation,
      mirror,
      color,
      pixelType = PIXEL_TYPES.BASIC,
      relatedId = null
    } = pixelData;

    const rawLatitude = pixelData.latitude ?? pixelData.lat;
    const rawLongitude = pixelData.longitude ?? pixelData.lng;
    const latitude = typeof rawLatitude === 'string' ? parseFloat(rawLatitude) : rawLatitude;
    const longitude = typeof rawLongitude === 'string' ? parseFloat(rawLongitude) : rawLongitude;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Invalid latitude or longitude for pixel write');
    }

    try {
      console.log(`🔧 创建或更新像素: gridId=${gridId}, userId=${userId}, patternId=${patternId}`);

      const timestamp = new Date();

      // 🔧 修复：不应该使用'custom_pattern'作为颜色标识
      // color字段应该始终是有效的十六进制颜色值
      let finalColor = color;
      if (!finalColor) {
        // 如果没有颜色，使用默认红色
        finalColor = '#FF0000';
      }

      // 验证finalColor是否是有效的十六进制颜色
      if (!finalColor.match(/^#[0-9A-F]{6}$/i)) {
        console.warn(`⚠️ 无效的颜色值: ${finalColor}, 使用默认红色`);
        finalColor = '#FF0000';
      }

      // 🔧 PERFORMANCE OPTIMIZATION: Async geocoding (non-blocking)
      // Geocoding is now queued for background processing to eliminate 2000ms blocking
      // Pixel writes return immediately; geocoding data is filled in asynchronously
      const locationInfo = {
        country: null,
        province: null,
        city: null,
        district: null,
        adcode: null,
        formatted_address: null,
        geocoded: false,
        geocoded_at: null
      };
      // Note: Geocoding will be queued after pixel is persisted

      const insertData = {
        grid_id: gridId,
        latitude,
        longitude,
        user_id: userId,
        color: finalColor,
        pattern_id: patternId,
        pattern_anchor_x: anchorX || 0,
        pattern_anchor_y: anchorY || 0,
        pattern_rotation: rotation || 0,
        pattern_mirror: mirror || false,
        pixel_type: pixelType,
        related_id: relatedId,
        alliance_id: pixelData.allianceId || null,
        // 🆕 实时写入地理信息
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
      };

      const updateData = {
        latitude,
        longitude,
        user_id: userId,
        color: finalColor,
        pattern_id: patternId,
        pattern_anchor_x: anchorX || 0,
        pattern_anchor_y: anchorY || 0,
        pattern_rotation: rotation || 0,
        pattern_mirror: mirror || false,
        pixel_type: pixelType,
        related_id: relatedId,
        alliance_id: pixelData.allianceId || null,
        // 🆕 实时更新地理信息
        country: locationInfo.country,
        province: locationInfo.province,
        city: locationInfo.city,
        district: locationInfo.district,
        adcode: locationInfo.adcode,
        formatted_address: locationInfo.formatted_address,
        geocoded: locationInfo.geocoded,
        geocoded_at: locationInfo.geocoded_at,
        updated_at: timestamp
      };

      const [pixel] = await db(this.tableName)
        .insert(insertData)
        .onConflict('grid_id')
        .merge(updateData)
        .returning('*');

      const createdAt = pixel?.created_at ? new Date(pixel.created_at) : null;
      const updatedAt = pixel?.updated_at ? new Date(pixel.updated_at) : null;
      const isUpdate = createdAt && updatedAt && updatedAt.getTime() !== createdAt.getTime();

      console.log(`✅ 像素${isUpdate ? '更新' : '创建'}成功:`, {
        id: pixel.id,
        grid_id: pixel.grid_id,
        user_id: pixel.user_id,
        pattern_id: pixel.pattern_id,
        color: pixel.color
      });

      // 清除缓存
      await CacheService.clearPixelCache(gridId);

      // 将像素写入变更队列
      await tileChangeQueueService.enqueuePixelChange(pixel);

      // 🔧 ASYNC GEOCODING: Queue for background processing (non-blocking)
      geocodingQueue.enqueue(pixel);

      // 🆕 同步记录像素历史（包含完整地理信息）
      try {
        const historyData = {
          latitude: pixel.latitude,
          longitude: pixel.longitude,
          color: pixel.color,
          user_id: pixel.user_id,
          grid_id: pixel.grid_id,
          pattern_id: pixel.pattern_id,
          pattern_anchor_x: pixel.pattern_anchor_x || 0,
          pattern_anchor_y: pixel.pattern_anchor_y || 0,
          pattern_rotation: pixel.pattern_rotation || 0,
          pattern_mirror: pixel.pattern_mirror || false,
          pixel_type: pixel.pixel_type || 'basic',
          related_id: pixel.related_id || null,
          // 🆕 包含完整地理信息
          country: pixel.country,
          province: pixel.province,
          city: pixel.city,
          district: pixel.district,
          adcode: pixel.adcode,
          formatted_address: pixel.formatted_address,
          geocoded: pixel.geocoded,
          geocoded_at: pixel.geocoded_at
        };

        const historyResult = await pixelsHistoryService.recordPixelHistory(
          historyData,
          isUpdate ? 'update' : 'create',
          {
            originalPixelId: pixel.id,
            version: 1
          }
        );

        if (historyResult.success) {
          console.log(`📝 像素历史记录成功: ${pixel.id}`);
        } else {
          console.warn(`⚠️ 像素历史记录失败: ${historyResult.error}`);
        }
      } catch (error) {
        console.error('❌ 记录像素历史时发生错误:', error);
        // 不抛出错误，避免影响主流程
      }

      // 🏗️ 3D 塔聚合：更新 pixel_towers 和 user_tower_floors（异步，不阻塞主流程）
      try {
        TowerAggregationService.onPixelDrawn({
          lat: pixel.latitude,
          lng: pixel.longitude,
          user_id: pixel.user_id,
          color: pixel.color,
          created_at: timestamp,
          tile_id: pixel.tile_id  // 使用自动生成的 tile_id
        }).catch(error => {
          console.warn('⚠️  Tower聚合失败（不影响主流程）:', error.message);
        });
      } catch (error) {
        // Tower聚合失败不应影响主流程
        console.error('❌ Tower聚合调用失败:', error);
      }

      return pixel;
    } catch (error) {
      console.error('❌ 创建或更新像素失败:', error);
      throw error;
    }
  }

  /**
   * 根据网格ID更新像素
   */
  static async updateByGridId(gridId, updateData) {
    try {
      const [updatedPixel] = await db(this.tableName)
        .where({ grid_id: gridId })
        .update(updateData)
        .returning('*');

      // 清除缓存
      await CacheService.clearPixelCache(gridId);

      return updatedPixel;
    } catch (error) {
      console.error('更新像素失败:', error);
      throw error;
    }
  }

  /**
   * 根据网格ID查找像素
   */
  static async findByGridId(gridId) {
    try {
      // 先从缓存获取
      const cachedPixel = await CacheService.getPixel(gridId);
      if (cachedPixel) {
        return cachedPixel;
      }

      // 从数据库获取
      const pixel = await db(this.tableName)
        .where({ grid_id: gridId })
        .first();

      // 缓存结果
      if (pixel) {
        await CacheService.setPixel(gridId, pixel);
      }

      return pixel;
    } catch (error) {
      console.error('查找像素失败:', error);
      throw error;
    }
  }

  /**
   * 批量查找像素
   * 🔧 修复：返回前端期望的格式 {gridId: {pixels: [pixelArray]}}
   */
  static async findByGridIds(gridIds) {
    try {
      const result = {};
      const uncachedGridIds = [];

      // 先从缓存获取，并按grid_id分组
      const pixelsByGridId = {};

      for (const gridId of gridIds) {
        const cachedPixel = await CacheService.getPixel(gridId);
        if (cachedPixel) {
          // 将单个像素转换为数组格式
          result[gridId] = {
            pixels: [cachedPixel]
          };
        } else {
          uncachedGridIds.push(gridId);
        }
      }

      // 从数据库获取未缓存的像素
      if (uncachedGridIds.length > 0) {
        const pixels = await db(this.tableName)
          .whereIn('grid_id', uncachedGridIds)
          .select('*');

        // 收集所有需要查询pattern信息的pattern_id
        const patternIds = [...new Set(pixels
          .filter(p => p.pattern_id)
          .map(p => p.pattern_id)
        )];

        // 批量查询pattern_assets信息
        const patternAssetsMap = new Map();
        if (patternIds.length > 0) {
          const patternAssets = await db('pattern_assets')
            .whereIn('key', patternIds)
            .select('key', 'render_type', 'unicode_char', 'payload', 'color', 'file_url');

          patternAssets.forEach(pattern => {
            patternAssetsMap.set(pattern.key, pattern);
          });
        }

        // 按grid_id分组并添加pattern信息
        const pixelsByGridId = {};
        for (const pixel of pixels) {
          if (!pixelsByGridId[pixel.grid_id]) {
            pixelsByGridId[pixel.grid_id] = [];
          }

          // 如果像素有pattern_id，添加pattern渲染信息
          if (pixel.pattern_id && patternAssetsMap.has(pixel.pattern_id)) {
            const patternAsset = patternAssetsMap.get(pixel.pattern_id);
            pixel.pattern_info = {
              render_type: patternAsset.render_type,
              unicode_char: patternAsset.unicode_char,
              payload: patternAsset.payload,
              file_url: patternAsset.file_url,
              // 根据render_type提供渲染所需的信息
              render_data: patternAsset.render_type === 'emoji'
                ? patternAsset.unicode_char
                : patternAsset.render_type === 'complex'
                  ? {
                    file_url: patternAsset.file_url,
                    payload: patternAsset.payload
                  }
                  : patternAsset.render_type === 'color'
                    ? patternAsset.color
                    : null
            };
          }

          pixelsByGridId[pixel.grid_id].push(pixel);

          // 缓存单个像素（保持向后兼容）
          await CacheService.setPixel(pixel.grid_id, pixel);
        }

        // 转换为前端期望的格式
        for (const gridId of uncachedGridIds) {
          const gridPixels = pixelsByGridId[gridId] || [];
          result[gridId] = {
            pixels: gridPixels
          };
        }
      }

      return result;
    } catch (error) {
      console.error('批量查找像素失败:', error);
      throw error;
    }
  }



  /**
   * 删除像素
   */
  static async deleteByGridId(gridId) {
    try {
      const deletedCount = await db(this.tableName)
        .where({ grid_id: gridId })
        .del();

      // 清除缓存
      await CacheService.clearPixelCache(gridId);

      return deletedCount > 0;
    } catch (error) {
      console.error('删除像素失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有像素
   */
  static async getByUserId(userId, limit = 100, offset = 0) {
    try {
      return await db(this.tableName)
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('获取用户像素失败:', error);
      throw error;
    }
  }

  /**
   * 统计用户像素数量
   */
  static async countByUserId(userId) {
    try {
      const result = await db(this.tableName)
        .where({ user_id: userId })
        .count('* as count')
        .first();

      return parseInt(result.count);
    } catch (error) {
      console.error('统计用户像素失败:', error);
      throw error;
    }
  }

  /**
   * 获取区域内的像素
   */
  static async getByRegion(minLat, maxLat, minLng, maxLng) {
    try {
      return await db(this.tableName)
        .whereBetween('lat', [minLat, maxLat])
        .whereBetween('lng', [minLng, maxLng])
        .select('*');
    } catch (error) {
      console.error('获取区域像素失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除像素
   */
  static async deleteByGridIds(gridIds) {
    try {
      const deletedCount = await db(this.tableName)
        .whereIn('grid_id', gridIds)
        .del();

      // 清除缓存
      for (const gridId of gridIds) {
        await CacheService.clearPixelCache(gridId);
      }

      return deletedCount;
    } catch (error) {
      console.error('批量删除像素失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找像素
   */
  static async findById(id) {
    try {
      const pixel = await db(this.tableName)
        .where('id', id)
        .first();

      if (pixel) {
        // 缓存结果
        await CacheService.setPixel(pixel.grid_id, pixel);
      }

      return pixel;
    } catch (error) {
      console.error('根据ID查找像素失败:', error);
      throw error;
    }
  }

  /**
   * 查找所有像素
   */
  static async findAll(limit = 100, offset = 0) {
    try {
      const pixels = await db(this.tableName)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return pixels;
    } catch (error) {
      console.error('查找所有像素失败:', error);
      throw error;
    }
  }
  /**
   * 获取热门区域 (Hot Zones)
   * 🔧 性能优化：查询 pixels_history（分区表）而非 pixels（当前快照表），
   * 利用分区裁剪避免全表扫描。30 天窗口可平滑突发事件影响。
   */
  static async getHotZones(limit = 20) {
    try {
      const query = `
        SELECT
          ROUND(CAST(latitude AS NUMERIC), 2) as lat_bin,
          ROUND(CAST(longitude AS NUMERIC), 2) as lng_bin,
          COUNT(*) as pixel_count
        FROM pixels_history
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          AND history_date >= (CURRENT_DATE - INTERVAL '30 days')
        GROUP BY lat_bin, lng_bin
        ORDER BY pixel_count DESC
        LIMIT ?
      `;

      const result = await db.raw(query, [limit]);
      const rows = result.rows || result;

      return rows.map(row => {
        const lat = parseFloat(row.lat_bin);
        const lng = parseFloat(row.lng_bin);
        return {
          center: {
            latitude: lat,
            longitude: lng
          },
          count: parseInt(row.pixel_count),
          bbox: {
            minLat: lat - 0.005,
            maxLat: lat + 0.005,
            minLng: lng - 0.005,
            maxLng: lng + 0.005
          }
        };
      });
    } catch (error) {
      console.error('获取热门区域失败:', error);
      throw error;
    }
  }
}

module.exports = Pixel;
