/**
 * Material系统控制器
 * 提供Material数据的API接口，支持CDN集成
 */

const logger = require('../utils/logger');
const materialAssetService = require('../services/materialAssetService');

class MaterialController {
  /**
   * 获取Material变体信息
   * GET /api/materials/:materialId/variants
   */
  async getMaterialVariants(req, res) {
    try {
      const { materialId } = req.params;
      const { variant_type = 'sprite_sheet' } = req.query;

      logger.info(`🎨 获取Material变体: materialId=${materialId}, variant=${variant_type}`);

      const variants = await materialAssetService.getMaterialVariants(materialId, variant_type);

      if (!variants || variants.length === 0) {
        logger.warn(`⚠️ Material变体不存在: materialId=${materialId}, variant=${variant_type}`);
        return res.status(404).json({
          success: false,
          error: 'Material变体不存在',
          materialId,
          variant_type
        });
      }

      // 返回最优变体（通常是第一个）
      const variant = variants[0];

      res.json({
        success: true,
        data: {
          id: variant.id,
          material_id: variant.material_id,
          variant_type: variant.variant_type,
          format: variant.format,
          width: variant.width,
          height: variant.height,
          size_bytes: variant.size_bytes,
          checksum: variant.checksum,
          payload: variant.payload, // base64图像数据
          metadata: variant.metadata || {},
          version: variant.version,
          is_active: variant.is_active,
          // 生成CDN URL
          cdn_url: this.generateCDNUrl(variant),
          // 生成下载URL
          download_url: `/api/materials/${materialId}/variants/${variant.id}/download`
        }
      });

    } catch (error) {
      logger.error('❌ 获取Material变体失败:', error);
      res.status(500).json({
        success: false,
        error: '获取Material变体失败',
        message: error.message
      });
    }
  }

  /**
   * 下载Material变体文件
   * GET /api/materials/:materialId/variants/:variantId/download
   */
  async downloadMaterialVariant(req, res) {
    try {
      const { materialId, variantId } = req.params;

      logger.info(`📥 下载Material变体: materialId=${materialId}, variantId=${variantId}`);

      const variant = await materialAssetService.getMaterialVariantById(variantId);

      if (!variant) {
        return res.status(404).json({
          success: false,
          error: 'Material变体不存在'
        });
      }

      // 解析base64数据
      const base64Data = variant.payload.split(',')[1] || variant.payload;
      const buffer = Buffer.from(base64Data, 'base64');

      // 设置响应头
      res.setHeader('Content-Type', variant.format);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年缓存
      res.setHeader('ETag', variant.checksum);

      // 发送文件数据
      res.send(buffer);

    } catch (error) {
      logger.error('❌ 下载Material变体失败:', error);
      res.status(500).json({
        success: false,
        error: '下载失败',
        message: error.message
      });
    }
  }

  /**
   * 批量获取Material信息
   * POST /api/materials/batch
   */
  async getBatchMaterials(req, res) {
    try {
      const { material_ids, variant_type = 'sprite_sheet' } = req.body;

      if (!Array.isArray(material_ids) || material_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'material_ids参数无效'
        });
      }

      if (material_ids.length > 50) {
        return res.status(400).json({
          success: false,
          error: '一次最多获取50个Material'
        });
      }

      logger.info(`📦 批量获取Material: ${material_ids.length}个`);

      const results = await Promise.allSettled(
        material_ids.map(async (materialId) => {
          const variants = await materialAssetService.getMaterialVariants(materialId, variant_type);
          return {
            material_id: materialId,
            variants: variants || [],
            found: variants && variants.length > 0
          };
        })
      );

      const materials = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          const material = result.value;
          if (material.found && material.variants.length > 0) {
            const variant = material.variants[0];
            return {
              material_id: material.material_id,
              found: true,
              variant: {
                id: variant.id,
                variant_type: variant.variant_type,
                format: variant.format,
                width: variant.width,
                height: variant.height,
                checksum: variant.checksum,
                payload: variant.payload,
                cdn_url: this.generateCDNUrl(variant),
                version: variant.version
              }
            };
          }
        }
        return {
          material_id: material_ids[index],
          found: false
        };
      });

      res.json({
        success: true,
        data: {
          materials,
          total: material_ids.length,
          found: materials.filter(m => m.found).length,
          missing: materials.filter(m => !m.found).length
        }
      });

    } catch (error) {
      logger.error('❌ 批量获取Material失败:', error);
      res.status(500).json({
        success: false,
        error: '批量获取失败',
        message: error.message
      });
    }
  }

  /**
   * 生成CDN URL
   * @param {Object} variant - Material变体
   * @returns {string} CDN URL
   */
  generateCDNUrl(variant) {
    // 如果有CDN配置，生成CDN URL
    if (process.env.CDN_BASE_URL) {
      const materialId = variant.material_id;
      const variantId = variant.id;
      const checksum = variant.checksum;
      return `${process.env.CDN_BASE_URL}/materials/${materialId}/${variantId}/${checksum}.${variant.format.split('/')[1]}`;
    }

    // 否则使用本地API URL
    return `/api/materials/${variant.material_id}/variants/${variant.id}/download`;
  }

  /**
   * 健康检查接口
   * GET /api/materials/health
   */
  async healthCheck(req, res) {
    try {
      // 检查Material服务状态
      const stats = await materialAssetService.getMaterialStats();

      res.json({
        success: true,
        status: 'healthy',
        data: {
          timestamp: new Date().toISOString(),
          material_stats: stats,
          cdn_enabled: !!process.env.CDN_BASE_URL,
          cdn_base_url: process.env.CDN_BASE_URL || null
        }
      });

    } catch (error) {
      logger.error('❌ Material健康检查失败:', error);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  }
}

module.exports = new MaterialController();