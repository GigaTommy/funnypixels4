/**
 * 图案存储服务
 * 实现多级存储架构：PostgreSQL + Redis + CDN
 * 支持图案压缩、多分辨率生成、瓦片预渲染
 */

const { db } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');
const PatternCompressionService = require('./patternCompressionService');
const CDNService = require('./cdnService');

class PatternStorageService {
  constructor() {
    this.db = db;
    this.redis = redis;
    this.compressionService = new PatternCompressionService();
    this.cdnService = new CDNService();
    
    // 存储配置
    this.config = {
      redis: {
        ttl: 24 * 60 * 60, // 24小时
        keyPrefix: 'pattern:'
      },
      cdn: {
        baseUrl: process.env.CDN_BASE_URL || 'https://cdn.funnypixels.com',
        bucket: 'pattern-assets'
      },
      compression: {
        webp: { quality: 85, lossless: false },
        avif: { quality: 80, lossless: false }
      },
      resolutions: [16, 32, 64, 128] // 支持的分辨率
    };
  }

  /**
   * 存储图案到多级存储
   * @param {Object} patternData - 图案数据
   * @returns {Object} 存储结果
   */
  async storePattern(patternData) {
    const startTime = Date.now();
    
    try {
      logger.info(`🎨 开始存储图案: ${patternData.key || patternData.id}`);
      
      // 1. 数据验证和优化
      const optimizedData = await this.optimizePatternData(patternData);
      
      // 2. 并行存储到多个层级
      const storagePromises = [
        // 主存储：PostgreSQL
        this.storeToDatabase(optimizedData),
        // 热缓存：Redis
        this.storeToRedis(optimizedData),
        // CDN：静态资源
        this.storeToCDN(optimizedData)
      ];
      
      await Promise.all(storagePromises);
      
      // 3. 生成多分辨率版本
      const multiResData = await this.generateMultiResolution(optimizedData);
      
      // 4. 瓦片预渲染（如果支持）
      if (optimizedData.render_type === 'color' || optimizedData.render_type === 'emoji') {
        await this.preRenderTilesForPattern(optimizedData.id);
      }
      
      const processingTime = Date.now() - startTime;
      logger.info(`✅ 图案存储完成: ${optimizedData.key}, 耗时: ${processingTime}ms`);
      
      return {
        success: true,
        patternId: optimizedData.id,
        key: optimizedData.key,
        processingTime,
        storage: {
          database: true,
          redis: true,
          cdn: true
        },
        multiResolution: multiResData
      };
      
    } catch (error) {
      logger.error(`❌ 图案存储失败: ${patternData.key}`, { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * 图案数据优化
   * @param {Object} patternData - 原始图案数据
   * @returns {Object} 优化后的图案数据
   */
  async optimizePatternData(patternData) {
    const { encoding, payload, render_type } = patternData;
    
    try {
      let optimizedPayload = payload;
      let compressionRatio = 1;
      
      // 根据编码类型进行优化
      switch (encoding) {
        case 'png_base64':
          const pngResult = await this.optimizePNGPattern(payload);
          optimizedPayload = pngResult.webp;
          compressionRatio = pngResult.compressionRatio;
          break;
          
        case 'rle':
          const rleResult = await this.optimizeRLEPattern(payload);
          optimizedPayload = rleResult.optimized;
          compressionRatio = rleResult.compressionRatio;
          break;
          
        default:
          logger.warn(`未知编码类型: ${encoding}`);
      }
      
      return {
        ...patternData,
        payload: optimizedPayload,
        encoding: 'webp', // 统一转换为WebP
        compression_ratio: compressionRatio,
        optimized_at: new Date(),
        metadata: {
          original_size: payload.length,
          optimized_size: optimizedPayload.length,
          compression_ratio: compressionRatio,
          render_type: render_type || 'color'
        }
      };
      
    } catch (error) {
      logger.error('图案数据优化失败:', error);
      return patternData; // 返回原始数据
    }
  }

  /**
   * PNG图案优化
   * @param {string} base64Data - Base64编码的PNG数据
   * @returns {Object} 优化结果
   */
  async optimizePNGPattern(base64Data) {
    try {
      // WebP转换
      const webpData = await this.compressionService.convertToWebP(base64Data, this.config.compression.webp);
      
      // AVIF转换（现代浏览器支持）
      let avifData = null;
      if (this.supportsAVIF()) {
        avifData = await this.compressionService.convertToAVIF(base64Data, this.config.compression.avif);
      }
      
      // 多分辨率生成
      const resolutions = await this.generateResolutions(base64Data, this.config.resolutions);
      
      return {
        webp: webpData,
        avif: avifData,
        resolutions: resolutions,
        compressionRatio: webpData.length / base64Data.length
      };
      
    } catch (error) {
      logger.error('PNG图案优化失败:', error);
      throw error;
    }
  }

  /**
   * RLE图案优化
   * @param {string} rleData - RLE编码数据
   * @returns {Object} 优化结果
   */
  async optimizeRLEPattern(rleData) {
    try {
      // RLE数据压缩
      const compressed = await this.compressionService.compressRLE(rleData);
      
      return {
        optimized: compressed,
        compressionRatio: compressed.length / rleData.length
      };
      
    } catch (error) {
      logger.error('RLE图案优化失败:', error);
      throw error;
    }
  }

  /**
   * 存储到数据库
   * @param {Object} patternData - 图案数据
   */
  async storeToDatabase(patternData) {
    const {
      id,
      key,
      name,
      encoding,
      payload,
      metadata,
      render_type,
      unicode_char,
      category,
      color
    } = patternData;

    try {
      // 检查是否已存在
      const existing = await this.db('pattern_assets')
        .where('key', key)
        .first();

      if (existing) {
        // 更新现有记录
        await this.db('pattern_assets')
          .where('key', key)
          .update({
            name,
            encoding,
            payload,
            metadata: JSON.stringify(metadata),
            render_type,
            unicode_char,
            category,
            color,
            updated_at: new Date()
          });
        
        logger.info(`📝 更新数据库图案: ${key}`);
      } else {
        // 插入新记录
        await this.db('pattern_assets').insert({
          id,
          key,
          name,
          encoding,
          payload,
          metadata: JSON.stringify(metadata),
          render_type,
          unicode_char,
          category,
          color,
          created_at: new Date(),
          updated_at: new Date()
        });
        
        logger.info(`📝 插入数据库图案: ${key}`);
      }
      
    } catch (error) {
      logger.error('数据库存储失败:', error);
      throw error;
    }
  }

  /**
   * 存储到Redis
   * @param {Object} patternData - 图案数据
   */
  async storeToRedis(patternData) {
    const { id, payload, metadata } = patternData;
    
    try {
      // 存储压缩版本
      await this.redis.setex(
        `${this.config.redis.keyPrefix}${id}:webp`,
        this.config.redis.ttl,
        payload
      );
      
      // 存储元数据
      await this.redis.setex(
        `${this.config.redis.keyPrefix}${id}:meta`,
        this.config.redis.ttl,
        JSON.stringify(metadata)
      );
      
      logger.info(`📦 Redis缓存图案: ${id}`);
      
    } catch (error) {
      logger.error('Redis存储失败:', error);
      throw error;
    }
  }

  /**
   * 存储到CDN
   * @param {Object} patternData - 图案数据
   */
  async storeToCDN(patternData) {
    const { id, payload, metadata } = patternData;
    
    try {
      // 上传主版本到CDN
      const mainPath = `patterns/${id}/original.webp`;
      await this.cdnService.upload(mainPath, payload);
      
      // 上传多分辨率版本
      if (metadata.resolutions) {
        for (const [resolution, data] of Object.entries(metadata.resolutions)) {
          const resPath = `patterns/${id}/${resolution}.webp`;
          await this.cdnService.upload(resPath, data);
        }
      }
      
      logger.info(`☁️ CDN上传图案: ${id}`);
      
    } catch (error) {
      logger.error('CDN存储失败:', error);
      // CDN失败不影响主流程
    }
  }

  /**
   * 生成多分辨率版本
   * @param {Object} patternData - 图案数据
   * @returns {Object} 多分辨率数据
   */
  async generateMultiResolution(patternData) {
    const { id, payload, metadata } = patternData;
    
    try {
      const resolutions = {};
      
      for (const size of this.config.resolutions) {
        const resizedData = await this.compressionService.resizeImage(payload, size, size);
        resolutions[size] = resizedData;
      }
      
      // 更新元数据
      metadata.resolutions = resolutions;
      
      return {
        patternId: id,
        resolutions: Object.keys(resolutions),
        totalSize: Object.values(resolutions).reduce((sum, data) => sum + data.length, 0)
      };
      
    } catch (error) {
      logger.error('多分辨率生成失败:', error);
      return { patternId: id, resolutions: [], totalSize: 0 };
    }
  }

  /**
   * 瓦片预渲染
   * @param {string} patternId - 图案ID
   */
  async preRenderTilesForPattern(patternId) {
    try {
      // 获取图案数据
      const pattern = await this.getPattern(patternId);
      if (!pattern) {
        logger.warn(`图案不存在，跳过瓦片预渲染: ${patternId}`);
        return;
      }
      
      // 预渲染常用缩放级别的瓦片
      const zoomLevels = [10, 12, 14, 16, 18];
      const tilePromises = [];
      
      for (const zoom of zoomLevels) {
        // 计算需要预渲染的瓦片范围
        const tiles = this.calculateTileRange(zoom);
        
        for (const tile of tiles) {
          tilePromises.push(
            this.renderTileWithPattern(tile.x, tile.y, zoom, pattern)
          );
        }
      }
      
      await Promise.allSettled(tilePromises);
      logger.info(`🗺️ 瓦片预渲染完成: ${patternId}`);
      
    } catch (error) {
      logger.error('瓦片预渲染失败:', error);
    }
  }

  /**
   * 获取图案
   * @param {string} patternId - 图案ID
   * @param {Object} options - 获取选项
   * @returns {Object} 图案数据
   */
  async getPattern(patternId, options = {}) {
    const { resolution = 'original', format = 'webp' } = options;
    
    try {
      // 1. 检查Redis缓存
      const cachedPattern = await this.getFromRedis(patternId, resolution, format);
      if (cachedPattern) {
        return cachedPattern;
      }
      
      // 2. 从数据库获取
      const pattern = await this.getFromDatabase(patternId);
      if (!pattern) {
        return null;
      }
      
      // 3. 缓存到Redis
      await this.cacheToRedis(patternId, pattern, resolution, format);
      
      return pattern;
      
    } catch (error) {
      logger.error(`获取图案失败: ${patternId}`, error);
      throw error;
    }
  }

  /**
   * 批量获取图案
   * @param {Array} patternIds - 图案ID数组
   * @param {Object} options - 获取选项
   * @returns {Map} 图案数据映射
   */
  async batchGetPatterns(patternIds, options = {}) {
    const results = new Map();
    const uncachedIds = [];
    
    try {
      // 1. 批量检查Redis缓存
      const redisResults = await this.batchGetFromRedis(patternIds, options);
      
      for (const [patternId, pattern] of redisResults) {
        results.set(patternId, pattern);
      }
      
      // 2. 获取未缓存的图案
      uncachedIds.push(...patternIds.filter(id => !results.has(id)));
      
      if (uncachedIds.length > 0) {
        const dbResults = await this.batchGetFromDatabase(uncachedIds);
        
        for (const [patternId, pattern] of dbResults) {
          results.set(patternId, pattern);
          // 异步缓存到Redis
          this.cacheToRedis(patternId, pattern, options.resolution, options.format);
        }
      }
      
      return results;
      
    } catch (error) {
      logger.error('批量获取图案失败:', error);
      throw error;
    }
  }

  /**
   * 从Redis获取图案
   * @param {string} patternId - 图案ID
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   * @returns {Object} 图案数据
   */
  async getFromRedis(patternId, resolution, format) {
    try {
      const key = `${this.config.redis.keyPrefix}${patternId}:${resolution}:${format}`;
      const data = await this.redis.get(key);
      
      if (data) {
        const metaKey = `${this.config.redis.keyPrefix}${patternId}:meta`;
        const metadata = await this.redis.get(metaKey);
        
        // 尝试获取完整的图案信息
        const fullPatternKey = `${this.config.redis.keyPrefix}${patternId}:full`;
        const fullPattern = await this.redis.get(fullPatternKey);
        
        if (fullPattern) {
          // 如果有完整图案信息，使用它
          const patternData = JSON.parse(fullPattern);
          return {
            ...patternData,
            payload: data, // 使用当前分辨率的payload
            metadata: metadata ? JSON.parse(metadata) : {},
            cached: true
          };
        } else {
          // 如果没有完整信息，从数据库获取并缓存
          const dbPattern = await this.getFromDatabase(patternId);
          if (dbPattern) {
            // 缓存完整图案信息
            await this.redis.setex(fullPatternKey, this.config.redis.ttl, JSON.stringify(dbPattern));
            return {
              ...dbPattern,
              payload: data, // 使用当前分辨率的payload
              metadata: metadata ? JSON.parse(metadata) : {},
              cached: true
            };
          } else {
            // 如果数据库也没有，返回null
            return null;
          }
        }
        
        // 降级：返回基本结构
        return {
          id: patternId,
          payload: data,
          metadata: metadata ? JSON.parse(metadata) : {},
          cached: true
        };
      }
      
      return null;
      
    } catch (error) {
      logger.error('Redis获取失败:', error);
      return null;
    }
  }

  /**
   * 从数据库获取图案
   * @param {string} patternId - 图案ID
   * @returns {Object} 图案数据
   */
  async getFromDatabase(patternId) {
    try {
      // 首先尝试按key查找（字符串）
      let pattern = await this.db('pattern_assets')
        .where('key', patternId)
        .first();
      
      // 如果没找到且patternId是数字，尝试按id查找
      if (!pattern && !isNaN(patternId)) {
        pattern = await this.db('pattern_assets')
          .where('id', parseInt(patternId))
          .first();
      }
      
      if (pattern) {
        // ✅ 性能优化：对于有Material CDN的complex图案，返回降级payload而不是null
        const hasMaterialCDN = pattern.render_type === 'complex' && pattern.material_id;

        return {
          id: pattern.id,
          key: pattern.key,
          name: pattern.name,
          payload: hasMaterialCDN ? this.generateFallbackPayload(pattern) : pattern.payload,
          encoding: hasMaterialCDN ? 'rle' : pattern.encoding, // CDN时使用RLE降级
          metadata: pattern.metadata ? JSON.parse(pattern.metadata) : {},
          render_type: pattern.render_type,
          unicode_char: pattern.unicode_char,
          category: pattern.category,
          color: pattern.color,
          // ✅ 添加Material系统字段
          material_id: pattern.material_id || null,
          material_version: pattern.material_version || null,
          material_metadata: pattern.material_metadata || null,
          cached: false
        };
      }
      
      return null;
      
    } catch (error) {
      logger.error('数据库获取失败:', error);
      throw error;
    }
  }

  /**
   * 为CDN图案生成降级payload
   * @param {Object} pattern - 图案数据
   * @returns {string} RLE编码的降级payload
   */
  generateFallbackPayload(pattern) {
    try {
      // 生成一个简单的RLE编码降级图案
      // 使用颜色块的简化表示，确保前端可以渲染
      const color = pattern.color || '#FF0000';
      const rleData = `${color}:64x64`; // 简化的RLE格式：颜色:尺寸

      logger.debug(`🎨 为CDN图案生成降级payload: patternId=${pattern.id}, color=${color}`);
      return rleData;

    } catch (error) {
      logger.error('❌ 生成降级payload失败:', error);
      // 最后的兜底：返回红色
      return '#FF0000:64x64';
    }
  }

  /**
   * 缓存到Redis
   * @param {string} patternId - 图案ID
   * @param {Object} pattern - 图案数据
   * @param {string} resolution - 分辨率
   * @param {string} format - 格式
   */
  async cacheToRedis(patternId, pattern, resolution, format) {
    try {
      const key = `${this.config.redis.keyPrefix}${patternId}:${resolution}:${format}`;
      await this.redis.setex(key, this.config.redis.ttl, pattern.payload);
      
      const metaKey = `${this.config.redis.keyPrefix}${patternId}:meta`;
      await this.redis.setex(metaKey, this.config.redis.ttl, JSON.stringify(pattern.metadata));
      
      // 缓存完整的图案信息
      const fullPatternKey = `${this.config.redis.keyPrefix}${patternId}:full`;
      await this.redis.setex(fullPatternKey, this.config.redis.ttl, JSON.stringify(pattern));
      
    } catch (error) {
      logger.error('Redis缓存失败:', error);
    }
  }

  /**
   * 批量从Redis获取
   * @param {Array} patternIds - 图案ID数组
   * @param {Object} options - 选项
   * @returns {Map} 结果映射
   */
  async batchGetFromRedis(patternIds, options) {
    const results = new Map();
    
    try {
      const { resolution = 'original', format = 'webp' } = options;
      
      // 构建Redis键
      const keys = patternIds.map(id => 
        `${this.config.redis.keyPrefix}${id}:${resolution}:${format}`
      );
      
      // 批量获取
      const values = await this.redis.mget(keys);
      
      for (let i = 0; i < patternIds.length; i++) {
        if (values[i]) {
          results.set(patternIds[i], {
            id: patternIds[i],
            payload: values[i],
            cached: true
          });
        }
      }
      
      return results;
      
    } catch (error) {
      logger.error('批量Redis获取失败:', error);
      return results;
    }
  }

  /**
   * 批量从数据库获取
   * @param {Array} patternIds - 图案ID数组
   * @returns {Map} 结果映射
   */
  async batchGetFromDatabase(patternIds) {
    const results = new Map();

    try {
      const patterns = await this.db('pattern_assets')
        .whereIn('id', patternIds)
        .orWhereIn('key', patternIds);

      for (const pattern of patterns) {
        // ✅ 性能优化：对于有Material CDN的complex图案，不返回payload以减少数据传输
        const hasMaterialCDN = pattern.render_type === 'complex' && pattern.material_id;

        results.set(pattern.id, {
          id: pattern.id,
          key: pattern.key,
          name: pattern.name,
          payload: hasMaterialCDN ? this.generateFallbackPayload(pattern) : pattern.payload,
          encoding: hasMaterialCDN ? 'rle' : pattern.encoding, // CDN时使用RLE降级
          metadata: pattern.metadata ? JSON.parse(pattern.metadata) : {},
          render_type: pattern.render_type,
          unicode_char: pattern.unicode_char,
          category: pattern.category,
          color: pattern.color,
          // ✅ 添加Material系统字段
          material_id: pattern.material_id || null,
          material_version: pattern.material_version || null,
          material_metadata: pattern.material_metadata || null,
          cached: false
        });

        if (hasMaterialCDN) {
          logger.info(`♻️ 优化：跳过返回Material图案payload (${pattern.id})`);
        }
      }

      return results;

    } catch (error) {
      logger.error('批量数据库获取失败:', error);
      throw error;
    }
  }

  /**
   * 检查AVIF支持
   * @returns {boolean} 是否支持AVIF
   */
  supportsAVIF() {
    // 这里可以添加更复杂的检测逻辑
    return process.env.SUPPORT_AVIF === 'true';
  }

  /**
   * 计算瓦片范围
   * @param {number} zoom - 缩放级别
   * @returns {Array} 瓦片数组
   */
  calculateTileRange(zoom) {
    // 简化实现，实际应该根据图案的地理位置计算
    const tiles = [];
    const maxTiles = Math.pow(2, zoom);
    
    // 预渲染中心区域的瓦片
    const center = maxTiles / 2;
    const range = Math.min(10, maxTiles / 4);
    
    for (let x = center - range; x < center + range; x++) {
      for (let y = center - range; y < center + range; y++) {
        if (x >= 0 && x < maxTiles && y >= 0 && y < maxTiles) {
          tiles.push({ x, y });
        }
      }
    }
    
    return tiles;
  }

  /**
   * 渲染带图案的瓦片
   * @param {number} x - 瓦片X坐标
   * @param {number} y - 瓦片Y坐标
   * @param {number} z - 缩放级别
   * @param {Object} pattern - 图案数据
   */
  async renderTileWithPattern(x, y, z, pattern) {
    try {
      // 这里应该实现瓦片渲染逻辑
      // 暂时跳过具体实现
      logger.debug(`渲染瓦片: ${z}/${x}/${y} with pattern: ${pattern.id}`);
      
    } catch (error) {
      logger.error(`瓦片渲染失败: ${z}/${x}/${y}`, error);
    }
  }

  /**
   * 生成分辨率版本
   * @param {string} base64Data - 基础数据
   * @param {Array} sizes - 尺寸数组
   * @returns {Object} 分辨率数据
   */
  async generateResolutions(base64Data, sizes) {
    const resolutions = {};
    
    for (const size of sizes) {
      try {
        const resizedData = await this.compressionService.resizeImage(base64Data, size, size);
        resolutions[size] = resizedData;
      } catch (error) {
        logger.error(`分辨率生成失败: ${size}`, error);
      }
    }
    
    return resolutions;
  }
}

module.exports = PatternStorageService;
