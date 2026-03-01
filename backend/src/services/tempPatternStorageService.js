const { db } = require('../config/database');

/**
 * 临时图案存储服务
 * 负责管理用户上传的自定义像素图案的临时存储
 */
class TempPatternStorageService {
  
  /**
   * 保存临时图案数据
   * @param {Object} orderData - 订单数据
   * @param {Object} processedData - 处理后的图案数据
   * @param {Object} trx - 可选的事务对象
   * @returns {Object} 保存结果
   */
  static async saveTempPattern(orderData, processedData, trx = null) {
    try {
      console.log('💾 保存临时图案数据到数据库...');
      
      const tempPatternData = {
        order_id: orderData.id,
        pattern_name: orderData.pattern_name,
        rle_payload: processedData.payload, // RLE格式的像素数据
        width: processedData.width,
        height: processedData.height,
        color_features: processedData.colorFeatures,
        original_image_data: orderData.original_image_url, // 原始base64图像数据
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
      };
      
      const dbInstance = trx || db;
      const [tempPattern] = await dbInstance('temp_pattern_storage')
        .insert(tempPatternData)
        .returning('*');
      
      console.log(`✅ 临时图案数据已保存: ${tempPattern.id}`);
      console.log(`   订单ID: ${tempPattern.order_id}`);
      console.log(`   图案名称: ${tempPattern.pattern_name}`);
      console.log(`   尺寸: ${tempPattern.width}x${tempPattern.height}`);
      console.log(`   过期时间: ${tempPattern.expires_at}`);
      
      return {
        success: true,
        tempPatternId: tempPattern.id,
        data: tempPattern
      };
      
    } catch (error) {
      console.error('❌ 保存临时图案数据失败:', error);
      throw new Error(`临时图案存储失败: ${error.message}`);
    }
  }
  
  /**
   * 获取临时图案数据
   * @param {string} orderId - 订单ID
   * @returns {Object|null} 临时图案数据
   */
  static async getTempPattern(orderId) {
    try {
      console.log(`🔍 获取订单 ${orderId} 的临时图案数据...`);
      
      const tempPattern = await db('temp_pattern_storage')
        .where('order_id', orderId)
        .where('expires_at', '>', new Date())
        .first();
      
      if (tempPattern) {
        console.log(`✅ 找到临时图案数据: ${tempPattern.id}`);
        console.log(`   图案名称: ${tempPattern.pattern_name}`);
        console.log(`   尺寸: ${tempPattern.width}x${tempPattern.height}`);
        console.log(`   RLE数据长度: ${tempPattern.rle_payload ? tempPattern.rle_payload.length : 0}`);
      } else {
        console.log('❌ 未找到有效的临时图案数据');
      }
      
      return tempPattern;
      
    } catch (error) {
      console.error('❌ 获取临时图案数据失败:', error);
      throw new Error(`获取临时图案失败: ${error.message}`);
    }
  }
  
  /**
   * 将临时图案转换为正式图案并保存到pattern_assets和材质系统
   * @param {string} orderId - 订单ID
   * @param {Object} options - 转换选项
   * @returns {Object} 转换结果
   */
  static async convertTempPatternToAsset(orderId, options = {}) {
    try {
      console.log(`🔄 将订单 ${orderId} 的临时图案转换为正式图案...`);

      // 1. 获取临时图案数据
      const tempPattern = await this.getTempPattern(orderId);
      if (!tempPattern) {
        throw new Error('临时图案数据不存在或已过期');
      }

      // ✅ 改进第一步：RLE → PNG Buffer（方案B优化）
      console.log('🔄 将RLE数据转换为PNG Buffer格式...');
      const PatternConversionService = require('./patternConversionService');
      const bufferResult = await PatternConversionService.convertRLEToBuffer(
        tempPattern.rle_payload,
        tempPattern.width,
        tempPattern.height
      );

      console.log(`✅ RLE转换完成，Buffer大小: ${bufferResult.buffer.length} bytes`);

      // ✅ 改进第二步：直接创建Material资源（不经过base64）
      console.log('🔄 创建Material System资源...');
      const materialService = require('./materialAssetService');

      // 生成短key格式：custom_xxxxxx
      const shortKey = `custom_${Math.random().toString(36).substr(2, 6)}`;

      // 📌 关键改变：直接传递Buffer，Material System会生成variants
      const materialResult = await materialService.createCustomStickerMaterial({
        buffer: bufferResult.buffer,  // ✅ 传Buffer而不是base64
        key: shortKey,
        fileName: tempPattern.pattern_name,
        mimeType: 'image/png',
        uploadedBy: options.userId
      });

      console.log(`✅ Material资源创建成功: ${materialResult.material.id}`);
      console.log(`   - Sprite Sheet: ${materialResult.variants.spriteSheet.width}x${materialResult.variants.spriteSheet.height}`);
      console.log(`   - Distance Field: ${materialResult.variants.distanceField.width}x${materialResult.variants.distanceField.height}`);
      console.log(`   - Source: ${materialResult.variants.source.width}x${materialResult.variants.source.height}`);

      // ✅ 改进第三步：创建pattern_assets - 只存Material引用，不存base64
      const PatternAsset = require('../models/PatternAsset');

      // ✅ 优化：直接使用原始RLE数据作为preview，保证高保真
      // Material System的sprite_sheet虽然性能好，但压缩会导致失真
      // 而tempPattern.rle_payload包含完整像素格子数据，可以按任意尺寸无损渲染
      const previewPayload = tempPattern.rle_payload;
      const previewEncoding = 'rle';

      const patternAsset = await PatternAsset.create({
        key: shortKey,
        name: tempPattern.pattern_name,
        category: 'alliance_flag',
        width: tempPattern.width,
        height: tempPattern.height,
        // ✅ 改进：保存preview数据用于前端缩略图，同时记录material编码
        encoding: 'material',  // 数据引擎使用Material System
        payload: previewPayload,  // 前端缩略图显示用的preview数据
        render_type: 'complex',
        verified: true,
        created_by: options.userId,
        // ⭐️ 核心：完全依赖Material System，但保存preview用于UI显示
        material_id: materialResult.material.id,
        material_version: materialResult.material.version,
        material_metadata: JSON.stringify({
          originalFormat: 'rle',
          uploadedAt: new Date().toISOString(),
          dimensions: `${tempPattern.width}x${tempPattern.height}`,
          orderId: orderId,
          previewEncoding: previewEncoding,  // 前端需要知道preview数据的编码格式
          // 保存Material variants信息供前端参考
          variantsInfo: {
            spriteSheet: {
              width: materialResult.variants.spriteSheet.width,
              height: materialResult.variants.spriteSheet.height,
              sizeBytes: materialResult.variants.spriteSheet.size_bytes
            },
            distanceField: {
              width: materialResult.variants.distanceField.width,
              height: materialResult.variants.distanceField.height
            }
          }
        })
      });

      console.log(`✅ Pattern资源创建成功: ${patternAsset.id}`);
      console.log(`   - Encoding: material (不存base64）`);
      console.log(`   - Material ID: ${materialResult.material.id}`);

      // 创建用户权限记录
      await db('user_custom_patterns').insert({
        user_id: options.userId,
        pattern_id: patternAsset.id,
        order_id: orderId
      });

      console.log('✅ 用户权限记录创建成功');

      // 触发瓦片缓存失效 - 确保渲染更新
      console.log('🔄 触发瓦片缓存失效...');
      try {
        const TileCacheService = require('./tileCacheService');
        await TileCacheService.invalidatePatternTiles(patternAsset.id, {
          reason: 'custom_pattern_created',
          materialId: materialResult.material.id
        });
        console.log('✅ 瓦片缓存失效完成');
      } catch (cacheError) {
        console.warn('⚠️ 瓦片缓存失效失败:', cacheError.message);
      }

      // 删除临时图案数据
      await this.deleteTempPattern(orderId);
      console.log('✅ 临时图案数据已清理');

      return {
        success: true,
        patternAsset: patternAsset,
        materialId: materialResult.material.id,
        materialVersion: materialResult.material.version,
        // ✅ 改进：不再返回base64Data
        variantsInfo: {
          spriteSheet: materialResult.variants.spriteSheet,
          distanceField: materialResult.variants.distanceField,
          source: materialResult.variants.source
        }
      };

    } catch (error) {
      console.error('❌ 转换临时图案失败:', error);
      throw new Error(`临时图案转换失败: ${error.message}`);
    }
  }
  
  /**
   * 删除临时图案数据
   * @param {string} orderId - 订单ID
   * @returns {boolean} 删除结果
   */
  static async deleteTempPattern(orderId) {
    try {
      console.log(`🗑️ 删除订单 ${orderId} 的临时图案数据...`);
      
      const deletedCount = await db('temp_pattern_storage')
        .where('order_id', orderId)
        .del();
      
      console.log(`✅ 已删除 ${deletedCount} 条临时图案记录`);
      return deletedCount > 0;
      
    } catch (error) {
      console.error('❌ 删除临时图案数据失败:', error);
      throw new Error(`删除临时图案失败: ${error.message}`);
    }
  }
  
  /**
   * 清理过期的临时图案数据
   * @returns {number} 清理的记录数
   */
  static async cleanupExpiredPatterns() {
    try {
      console.log('🧹 清理过期的临时图案数据...');
      
      const deletedCount = await db('temp_pattern_storage')
        .where('expires_at', '<', new Date())
        .del();
      
      console.log(`✅ 已清理 ${deletedCount} 条过期的临时图案记录`);
      return deletedCount;
      
    } catch (error) {
      console.error('❌ 清理过期临时图案数据失败:', error);
      throw new Error(`清理过期临时图案失败: ${error.message}`);
    }
  }
  
  /**
   * 获取临时图案统计信息
   * @returns {Object} 统计信息
   */
  static async getTempPatternStats() {
    try {
      const stats = await db('temp_pattern_storage')
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active'),
          db.raw('COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired')
        )
        .first();
      
      return {
        total: parseInt(stats.total),
        active: parseInt(stats.active),
        expired: parseInt(stats.expired)
      };
      
    } catch (error) {
      console.error('❌ 获取临时图案统计信息失败:', error);
      throw new Error(`获取统计信息失败: ${error.message}`);
    }
  }
}

module.exports = TempPatternStorageService;
