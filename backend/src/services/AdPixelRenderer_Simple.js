/**
 * 广告像素渲染服务 - 简化版本
 *
 * 🎯 设计理念：借鉴 pixelpic 的简单直接方法
 * - 直接将图片缩放到指定尺寸（如 64×64）
 * - 提取每个像素的颜色
 * - 从中心点向外扩展，计算每个像素对应的网格坐标
 * - 直接写入数据库，一个像素 = 一个网格
 */

const { db } = require('../config/database');
const { PIXEL_TYPES } = require('../constants/pixelTypes');

/**
 * 网格配置（与 pixelBatchService 保持一致）
 * ⚠️ 必须与 pixelBatchService.calculateGridId() 使用相同的网格系统
 */
const GRID_CONFIG = {
  GRID_SIZE_DEGREES: 0.0001,  // 网格大小（度）≈ 11米
  PIXEL_SIZE_METERS: 11       // 每个格子边长（米）
};

/**
 * 简化版广告像素渲染器
 */
class AdPixelRendererSimple {

  /**
   * 处理广告放置 - 主入口
   * @param {string} placementId - 广告放置ID
   */
  static async processAdPlacement(placementId) {
    try {
      console.log(`🎨 [简化版] 开始处理广告像素渲染: ${placementId}`);

      // 1. 获取广告放置数据
      const placement = await this.getAdPlacement(placementId);
      if (!placement) {
        throw new Error(`广告放置记录不存在: ${placementId}`);
      }

      // 2. 解析像素数据
      const pixelData = JSON.parse(placement.pixel_data);
      console.log(`📊 像素数据: ${pixelData.length}个像素点`);

      // 3. 转换为数据库格式（借鉴 pixelpic 的网格计算方法）
      const pixels = this.convertPixelsToGrids(
        placement.center_lat,
        placement.center_lng,
        pixelData,
        placement.width,
        placement.height,
        placement.user_id,
        placementId
      );

      console.log(`🗺️ 坐标转换完成: ${pixels.length}个像素`);

      // 4. 批量写入数据库
      await this.batchWritePixels(pixels);
      console.log(`💾 批量写入完成`);

      console.log(`🎉 广告像素渲染完成: ${placementId}`);

    } catch (error) {
      console.error(`❌ 广告像素渲染失败: ${placementId}`, error);
      throw error;
    }
  }

  /**
   * 获取广告放置数据
   */
  static async getAdPlacement(placementId) {
    return await db('ad_placements')
      .where('id', placementId)
      .first();
  }

  /**
   * 转换像素到网格 - 使用整数网格索引避免浮点精度问题
   *
   * 🎯 核心逻辑（避免浮点数累积误差）：
   * 1. 将中心点经纬度转换为整数网格索引
   * 2. 使用整数运算计算每个像素的网格索引
   * 3. 从网格索引反推经纬度（保证精度）
   * 4. 生成与 pixelBatchService 一致的 gridId
   */
  static convertPixelsToGrids(centerLat, centerLng, pixelData, width, height, userId, placementId) {
    console.log(`\n📍 [简化版] 广告投影信息:`);
    console.log(`  中心坐标: (${centerLat}, ${centerLng})`);
    console.log(`  广告尺寸: ${width}×${height} = ${pixelData.length}个像素`);
    console.log(`  网格大小: ${GRID_CONFIG.GRID_SIZE_DEGREES}° ≈ ${GRID_CONFIG.PIXEL_SIZE_METERS}m`);
    console.log(`  占地面积: 约 ${(width * 11 / 1000).toFixed(3)} km × ${(height * 11 / 1000).toFixed(3)} km\n`);

    const pixels = [];

    // 🎯 步骤1: 计算中心点的网格索引
    const centerGridX = Math.floor(centerLng / GRID_CONFIG.GRID_SIZE_DEGREES);
    const centerGridY = Math.floor(centerLat / GRID_CONFIG.GRID_SIZE_DEGREES);

    console.log(`📍 中心网格索引: (${centerGridX}, ${centerGridY})`);

    // 🎯 步骤2: 计算起始网格索引（从中心向左上偏移）
    const startGridX = centerGridX - Math.floor(width / 2);
    const startGridY = centerGridY + Math.floor(height / 2);

    console.log(`📍 起始网格索引: (${startGridX}, ${startGridY})`);
    console.log(`\n🔄 开始像素映射...\n`);

    // 🎯 步骤3: 遍历每个像素，使用整数网格索引计算
    for (const pixel of pixelData) {
      try {
        // ✅ 关键：直接使用整数网格索引，避免浮点数累积误差
        const gridX = startGridX + pixel.x;
        const gridY = startGridY - pixel.y;
        const gridId = `grid_${gridX}_${gridY}`;

        // 从网格索引反推经纬度（保证精度和一致性）
        const lng = gridX * GRID_CONFIG.GRID_SIZE_DEGREES;
        const lat = gridY * GRID_CONFIG.GRID_SIZE_DEGREES;

        pixels.push({
          grid_id: gridId,
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lng.toFixed(6)),
          color: pixel.color,
          pattern_id: pixel.patternId || `color_${pixel.color}`,
          user_id: userId,
          timestamp: Date.now(),
          render_type: 'color',
          pixel_type: PIXEL_TYPES.AD,
          related_id: placementId
        });

      } catch (error) {
        console.error(`❌ 处理像素失败: (${pixel.x}, ${pixel.y})`, error);
      }
    }

    console.log(`✅ 像素映射完成: ${pixels.length}/${pixelData.length}`);

    // 验证是否有重复的网格ID
    const gridIds = new Set(pixels.map(p => p.grid_id));
    if (gridIds.size !== pixels.length) {
      console.warn(`⚠️ 警告: 发现重复的网格ID！唯一网格数: ${gridIds.size}, 总像素数: ${pixels.length}`);
    } else {
      console.log(`✅ 所有像素都有唯一的网格ID`);
    }

    return pixels;
  }

  /**
   * 批量写入像素到数据库
   */
  static async batchWritePixels(pixels) {
    console.log(`\n📦 开始批量写入: ${pixels.length}个像素`);

    try {
      // 使用现有的 PixelBatchService
      const PixelBatchService = require('./pixelBatchService');

      const pixelDataArray = pixels.map(pixel => ({
        latitude: pixel.latitude,
        longitude: pixel.longitude,
        userId: pixel.user_id,
        color: pixel.color,
        patternId: pixel.pattern_id,
        pixelType: pixel.pixel_type,
        relatedId: pixel.related_id,
        drawType: 'ad_placement'
      }));

      const result = await PixelBatchService.batchDrawPixels(pixelDataArray, {
        drawType: 'ad_placement',
        skipUserValidation: true,
        skipPointConsumption: true
      });

      console.log(`✅ 批量写入完成: 成功${result.successCount}个, 失败${result.failureCount}个`);

      return result;

    } catch (error) {
      console.error('❌ 批量写入失败:', error);
      throw error;
    }
  }

  /**
   * 网格ID转经纬度（验证用）
   * 与 pixelBatchService 的网格系统保持一致
   */
  static gridIdToLatLng(gridX, gridY) {
    return {
      lng: gridX * GRID_CONFIG.GRID_SIZE_DEGREES,
      lat: gridY * GRID_CONFIG.GRID_SIZE_DEGREES
    };
  }

  /**
   * 经纬度转网格ID（验证用）
   * 与 pixelBatchService.calculateGridId() 保持一致
   */
  static latLngToGridId(lat, lng) {
    const gridX = Math.floor(lng / GRID_CONFIG.GRID_SIZE_DEGREES);
    const gridY = Math.floor(lat / GRID_CONFIG.GRID_SIZE_DEGREES);
    return `grid_${gridX}_${gridY}`;
  }
}

module.exports = AdPixelRendererSimple;
