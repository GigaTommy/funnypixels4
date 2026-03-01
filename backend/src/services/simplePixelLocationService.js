/**
 * 简化的像素地理归属服务
 * 直接使用坐标范围匹配，避免H3缓存问题
 */

const { db } = require('../config/database');
const CacheService = require('./cacheService');

class SimplePixelLocationService {
  constructor() {
    this.cachePrefix = 'pixel_location:';
  }

  /**
   * 获取像素地理归属
   * @param {number} pixelId 像素ID
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   */
  async getPixelLocation(pixelId, latitude, longitude) {
    try {
      // 先检查像素位置缓存
      const cacheKey = `${this.cachePrefix}${pixelId}`;
      let locationInfo = await CacheService.get(cacheKey);
      
      if (locationInfo) {
        return locationInfo;
      }
      
      // 计算地理归属
      locationInfo = await this.calculatePixelLocation(pixelId, latitude, longitude);
      
      // 缓存结果
      await CacheService.set(cacheKey, locationInfo, 3600); // 1小时缓存
      
      return locationInfo;
      
    } catch (error) {
      console.error('获取像素地理归属失败:', error);
      return {
        province_code: null,
        city_code: null,
        province_name: '未知',
        city_name: '未知'
      };
    }
  }

  /**
   * 计算像素地理归属
   * @param {number} pixelId 像素ID
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   */
  async calculatePixelLocation(pixelId, latitude, longitude) {
    try {
      console.log(`  🔍 计算像素 ${pixelId} 地理归属 (${latitude}, ${longitude})`);
      
      // 使用坐标范围匹配
      const result = await db.raw(`
        SELECT 
          r.code,
          r.name,
          r.level,
          r.parent_code,
          p.name as parent_name,
          CASE 
            WHEN r.name LIKE '%北京%' AND ? BETWEEN 39.0 AND 40.5 AND ? BETWEEN 115.5 AND 117.5 THEN 0
            WHEN r.name LIKE '%上海%' AND ? BETWEEN 30.5 AND 32.0 AND ? BETWEEN 120.5 AND 122.0 THEN 0
            WHEN r.name LIKE '%深圳%' AND ? BETWEEN 22.0 AND 23.0 AND ? BETWEEN 113.5 AND 114.5 THEN 0
            WHEN r.name LIKE '%广州%' AND ? BETWEEN 22.5 AND 24.0 AND ? BETWEEN 112.5 AND 114.0 THEN 0
            WHEN r.name LIKE '%杭州%' AND ? BETWEEN 29.5 AND 31.0 AND ? BETWEEN 119.5 AND 121.0 THEN 0
            WHEN r.name LIKE '%成都%' AND ? BETWEEN 30.0 AND 31.0 AND ? BETWEEN 103.5 AND 104.5 THEN 0
            WHEN r.name LIKE '%武汉%' AND ? BETWEEN 30.0 AND 31.0 AND ? BETWEEN 113.5 AND 115.0 THEN 0
            WHEN r.name LIKE '%西安%' AND ? BETWEEN 34.0 AND 35.0 AND ? BETWEEN 108.5 AND 109.5 THEN 0
            WHEN r.name LIKE '%南京%' AND ? BETWEEN 31.5 AND 32.5 AND ? BETWEEN 118.0 AND 119.0 THEN 0
            WHEN r.name LIKE '%天津%' AND ? BETWEEN 39.0 AND 40.0 AND ? BETWEEN 117.0 AND 118.0 THEN 0
            WHEN r.center_lat IS NOT NULL AND r.center_lng IS NOT NULL THEN
              SQRT(POW(r.center_lat - ?, 2) + POW(r.center_lng - ?, 2))
            ELSE 999999
          END as distance
        FROM regions r
        LEFT JOIN regions p ON r.parent_code = p.code
        WHERE r.is_active = true
        AND r.level IN ('province', 'city')
        ORDER BY distance
        LIMIT 1
      `, [
        latitude, longitude, latitude, longitude, latitude, longitude, 
        latitude, longitude, latitude, longitude, latitude, longitude,
        latitude, longitude, latitude, longitude, latitude, longitude,
        latitude, longitude, latitude, longitude
      ]);
      
      if (result.rows.length > 0) {
        const region = result.rows[0];
        console.log(`  ✅ 匹配到: ${region.name} (${region.level}) - 距离: ${region.distance}`);
        
        let locationInfo;
        if (region.level === 'province') {
          locationInfo = {
            province_code: region.code,
            city_code: null,
            province_name: region.name,
            city_name: null
          };
        } else if (region.level === 'city') {
          locationInfo = {
            province_code: region.parent_code,
            city_code: region.code,
            province_name: region.parent_name,
            city_name: region.name
          };
        } else {
          locationInfo = {
            province_code: null,
            city_code: null,
            province_name: '未知',
            city_name: '未知'
          };
        }
        
        // 保存到数据库缓存
        await this.savePixelLocationCache(pixelId, locationInfo);
        
        return locationInfo;
      }
      
      console.log('  ⚠️ 未找到匹配的区域');
      return {
        province_code: null,
        city_code: null,
        province_name: '未知',
        city_name: '未知'
      };
      
    } catch (error) {
      console.error('计算像素地理归属失败:', error);
      return {
        province_code: null,
        city_code: null,
        province_name: '未知',
        city_name: '未知'
      };
    }
  }

  /**
   * 保存像素位置缓存到数据库
   * @param {number} pixelId 像素ID
   * @param {Object} locationInfo 位置信息
   */
  async savePixelLocationCache(pixelId, locationInfo) {
    try {
      await db('pixel_location_cache').insert({
        pixel_id: pixelId,
        province_code: locationInfo.province_code,
        city_code: locationInfo.city_code,
        province_name: locationInfo.province_name,
        city_name: locationInfo.city_name,
        updated_at: new Date()
      }).onConflict('pixel_id').merge();
      
      console.log(`  💾 已保存像素 ${pixelId} 位置缓存`);
    } catch (error) {
      console.error('保存像素位置缓存失败:', error);
    }
  }
}

module.exports = SimplePixelLocationService;
