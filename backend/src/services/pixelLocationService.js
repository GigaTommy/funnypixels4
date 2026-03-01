const { db } = require('../config/database');
const CacheService = require('./cacheService');
const h3 = require('h3-js');

/**
 * 像素地理归属匹配服务
 * 使用PostGIS和H3索引进行高效的地理空间计算
 */
class PixelLocationService {
  constructor() {
    this.cachePrefix = 'pixel_location:';
    this.batchSize = 1000; // 批处理大小
  }

  /**
   * 获取像素点的地理归属信息
   * @param {number} pixelId 像素ID
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   */
  async getPixelLocation(pixelId, latitude, longitude) {
    try {
      // 1. 先检查缓存
      const cacheKey = `${this.cachePrefix}${pixelId}`;
      let locationInfo = await CacheService.get(cacheKey);
      
      if (locationInfo) {
        return locationInfo;
      }
      
      // 2. 检查数据库缓存
      const cachedLocation = await db('pixel_location_cache')
        .where('pixel_id', pixelId)
        .first();
      
      if (cachedLocation) {
        locationInfo = {
          province_code: cachedLocation.province_code,
          city_code: cachedLocation.city_code,
          province_name: cachedLocation.province_name,
          city_name: cachedLocation.city_name
        };
        
        // 更新Redis缓存
        await CacheService.set(cacheKey, locationInfo, 3600); // 1小时缓存
        return locationInfo;
      }
      
      // 3. 实时计算地理归属
      locationInfo = await this.calculatePixelLocation(latitude, longitude);
      
      // 4. 保存到数据库缓存
      await this.savePixelLocationCache(pixelId, locationInfo);
      
      // 5. 保存到Redis缓存
      await CacheService.set(cacheKey, locationInfo, 3600);
      
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
   * 计算像素点的地理归属
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   */
  async calculatePixelLocation(latitude, longitude) {
    try {
      // 优先使用天地图数据进行精确匹配
      let result;
      try {
        result = await db.raw(`
          WITH matched_regions AS (
            SELECT 
              name,
              gb_code,
              level,
              ST_Contains(geometry, ST_SetSRID(ST_Point(?, ?), 4326)) as contains
            FROM tianditu_regions
            WHERE ST_Contains(geometry, ST_SetSRID(ST_Point(?, ?), 4326))
            ORDER BY 
              CASE level 
                WHEN 'district' THEN 1
                WHEN 'city' THEN 2
                WHEN 'province' THEN 3
                ELSE 4
              END
          )
          SELECT * FROM matched_regions LIMIT 1
        `, [longitude, latitude, longitude, latitude]);

        if (result.rows.length > 0) {
          const region = result.rows[0];
          console.log(`  ✅ 天地图精确匹配: ${region.name} (${region.level})`);
          
          if (region.level === 'province') {
            return {
              province_code: region.gb_code,
              city_code: null,
              province_name: region.name,
              city_name: null
            };
          } else if (region.level === 'city') {
            // 查找对应的省级信息
            const provinceResult = await db.raw(`
              SELECT 
                p.name as province_name,
                p.gb_code as province_code
              FROM tianditu_regions p
              WHERE p.level = 'province'
              AND ST_Contains(p.geometry, ST_SetSRID(ST_Point(?, ?), 4326))
              LIMIT 1
            `, [longitude, latitude]);
            
            const province = provinceResult.rows.length > 0 ? provinceResult.rows[0] : null;
            
            return {
              province_code: province ? province.province_code : null,
              city_code: region.gb_code,
              province_name: province ? province.province_name : '未知',
              city_name: region.name
            };
          } else if (region.level === 'district') {
            // 查找对应的市级和省级信息
            const cityResult = await db.raw(`
              SELECT 
                c.name as city_name,
                c.gb_code as city_code,
                p.name as province_name,
                p.gb_code as province_code
              FROM tianditu_regions c
              JOIN tianditu_regions p ON c.level = 'city' AND p.level = 'province'
              WHERE c.level = 'city'
              AND p.level = 'province'
              AND ST_Contains(c.geometry, ST_SetSRID(ST_Point(?, ?), 4326))
              AND ST_Contains(p.geometry, ST_SetSRID(ST_Point(?, ?), 4326))
              LIMIT 1
            `, [longitude, latitude, longitude, latitude]);
            
            const city = cityResult.rows.length > 0 ? cityResult.rows[0] : null;
            
            return {
              province_code: city ? city.province_code : null,
              city_code: city ? city.city_code : null,
              province_name: city ? city.province_name : '未知',
              city_name: city ? city.city_name : '未知'
            };
          }
        }
      } catch (error) {
        console.log('  ⚠️ 天地图数据匹配失败，尝试原有regions表:', error.message);
        // 如果天地图匹配失败，继续尝试regions表
      }

      // 如果天地图匹配失败，尝试原有regions表
      try {
        result = await db.raw(`
          SELECT 
            r.code,
            r.name,
            r.level,
            r.parent_code,
            p.name as parent_name
          FROM regions r
          LEFT JOIN regions p ON r.parent_code = p.code
          WHERE r.is_active = true
          AND ST_Contains(r.geometry, ST_Point(?, ?))
          ORDER BY 
            CASE r.level 
              WHEN 'country' THEN 1
              WHEN 'province' THEN 2
              WHEN 'city' THEN 3
              ELSE 4
            END
          LIMIT 1
        `, [longitude, latitude]);
        
        if (result.rows.length > 0) {
          const region = result.rows[0];
          console.log(`  ✅ regions表匹配: ${region.name} (${region.level})`);
          
          if (region.level === 'province') {
            return {
              province_code: region.code,
              city_code: null,
              province_name: region.name,
              city_name: null
            };
          } else if (region.level === 'city') {
            return {
              province_code: region.parent_code,
              city_code: region.code,
              province_name: region.parent_name,
              city_name: region.name
            };
          }
        }
      } catch (error) {
        console.log('  ⚠️ regions表匹配失败，使用H3索引:', error.message);
      }
      
      // 如果所有精确匹配都失败，使用H3索引进行近似匹配
      return await this.calculatePixelLocationWithH3(latitude, longitude);
      
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
   * 使用H3索引计算像素地理归属
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   */
  async calculatePixelLocationWithH3(latitude, longitude) {
    try {
      // 生成H3索引
      const h3Index = h3.latLngToCell(latitude, longitude, 6); // 使用6级精度
      
      // 检查H3缓存
      const h3CacheKey = `h3_location:${h3Index}`;
      let locationInfo = await CacheService.get(h3CacheKey);
      
      if (locationInfo) {
        return locationInfo;
      }
      
      // 使用H3索引查找最近的区域
      let result;
      try {
        result = await db.raw(`
          SELECT 
            r.code,
            r.name,
            r.level,
            r.parent_code,
            p.name as parent_name,
            ST_Distance(r.geometry, ST_Point(?, ?)) as distance
          FROM regions r
          LEFT JOIN regions p ON r.parent_code = p.code
          WHERE r.is_active = true
          AND r.geometry IS NOT NULL
          ORDER BY distance
          LIMIT 1
        `, [longitude, latitude]);
      } catch (error) {
        // PostGIS不可用，使用改进的距离计算
        console.log('  ⚠️ PostGIS不可用，使用改进距离计算');
        result = await db.raw(`
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
        `, [latitude, longitude, latitude, longitude, latitude, longitude, latitude, longitude, latitude, longitude, latitude, longitude]);
      }
      
      if (result.rows.length > 0) {
        const region = result.rows[0];
        
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
        
        // 缓存H3结果
        await CacheService.set(h3CacheKey, locationInfo, 7200); // 2小时缓存
        
        return locationInfo;
      }
      
      return {
        province_code: null,
        city_code: null,
        province_name: '未知',
        city_name: '未知'
      };
      
    } catch (error) {
      console.error('H3索引计算失败:', error);
      return {
        province_code: null,
        city_code: null,
        province_name: '未知',
        city_name: '未知'
      };
    }
  }

  /**
   * 保存像素地理归属缓存
   * @param {number} pixelId 像素ID
   * @param {Object} locationInfo 地理归属信息
   */
  async savePixelLocationCache(pixelId, locationInfo) {
    try {
      await db('pixel_location_cache')
        .insert({
          pixel_id: pixelId,
          province_code: locationInfo.province_code,
          city_code: locationInfo.city_code,
          province_name: locationInfo.province_name,
          city_name: locationInfo.city_name,
          updated_at: new Date()
        })
        .onConflict('pixel_id')
        .merge(['province_code', 'city_code', 'province_name', 'city_name', 'updated_at']);
        
    } catch (error) {
      console.error('保存像素地理归属缓存失败:', error);
    }
  }

  /**
   * 批量处理像素地理归属
   * @param {Array} pixels 像素数据数组
   */
  async batchProcessPixelLocations(pixels) {
    console.log(`🗺️ 开始批量处理 ${pixels.length} 个像素的地理归属...`);
    
    const results = [];
    const batchCount = Math.ceil(pixels.length / this.batchSize);
    
    for (let i = 0; i < batchCount; i++) {
      const start = i * this.batchSize;
      const end = Math.min(start + this.batchSize, pixels.length);
      const batch = pixels.slice(start, end);
      
      console.log(`  📦 处理批次 ${i + 1}/${batchCount} (${start + 1}-${end})`);
      
      try {
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
        
        // 添加延迟避免数据库压力过大
        if (i < batchCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`  ❌ 批次 ${i + 1} 处理失败:`, error.message);
        // 继续处理下一批
      }
    }
    
    console.log(`✅ 批量处理完成，成功处理 ${results.length} 个像素`);
    return results;
  }

  /**
   * 处理单个批次的像素
   * @param {Array} batch 像素批次
   */
  async processBatch(batch) {
    const results = [];
    
    for (const pixel of batch) {
      try {
        const locationInfo = await this.calculatePixelLocation(
          pixel.latitude, 
          pixel.longitude
        );
        
        // 保存到缓存
        await this.savePixelLocationCache(pixel.id, locationInfo);
        
        results.push({
          pixel_id: pixel.id,
          ...locationInfo
        });
        
      } catch (error) {
        console.error(`处理像素 ${pixel.id} 失败:`, error.message);
        results.push({
          pixel_id: pixel.id,
          province_code: null,
          city_code: null,
          province_name: '未知',
          city_name: '未知'
        });
      }
    }
    
    return results;
  }

  /**
   * 获取未处理地理归属的像素
   * @param {number} limit 限制数量
   */
  async getUnprocessedPixels(limit = 1000) {
    try {
      const pixels = await db('pixels')
        .leftJoin('pixel_location_cache', 'pixels.id', 'pixel_location_cache.pixel_id')
        .whereNull('pixel_location_cache.pixel_id')
        .select('pixels.id', 'pixels.latitude', 'pixels.longitude')
        .limit(limit);
      
      return pixels;
      
    } catch (error) {
      console.error('获取未处理像素失败:', error);
      return [];
    }
  }

  /**
   * 清理过期的地理归属缓存
   * @param {number} days 保留天数
   */
  async cleanExpiredCache(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const deletedCount = await db('pixel_location_cache')
        .where('updated_at', '<', cutoffDate)
        .del();
      
      console.log(`🧹 清理了 ${deletedCount} 条过期地理归属缓存`);
      return deletedCount;
      
    } catch (error) {
      console.error('清理过期缓存失败:', error);
      return 0;
    }
  }

  /**
   * 获取地理归属统计信息
   */
  async getLocationStats() {
    try {
      const stats = await db('pixel_location_cache')
        .select('province_name', 'city_name')
        .count('* as count')
        .groupBy('province_name', 'city_name')
        .orderBy('count', 'desc')
        .limit(20);
      
      return stats;
      
    } catch (error) {
      console.error('获取地理归属统计失败:', error);
      return [];
    }
  }
}

module.exports = PixelLocationService;
