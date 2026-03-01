/**
 * 图案压缩服务
 * 支持WebP、AVIF转换，图像缩放，RLE压缩
 */

const sharp = require('sharp');
const logger = require('../utils/logger');

class PatternCompressionService {
  constructor() {
    this.supportedFormats = ['webp', 'avif', 'png', 'jpeg'];
    this.compressionConfigs = {
      webp: {
        quality: 85,
        lossless: false,
        effort: 4
      },
      avif: {
        quality: 80,
        lossless: false,
        effort: 4
      },
      png: {
        compressionLevel: 9,
        adaptiveFiltering: true
      }
    };
  }

  /**
   * 转换为WebP格式
   * @param {string} base64Data - Base64编码的图像数据
   * @param {Object} options - 压缩选项
   * @returns {string} WebP格式的Base64数据
   */
  async convertToWebP(base64Data, options = {}) {
    try {
      const config = { ...this.compressionConfigs.webp, ...options };
      
      // 移除Base64前缀
      const imageBuffer = Buffer.from(base64Data.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
      
      // 转换为WebP
      const webpBuffer = await sharp(imageBuffer)
        .webp({
          quality: config.quality,
          lossless: config.lossless,
          effort: config.effort
        })
        .toBuffer();
      
      // 转换回Base64
      const webpBase64 = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
      
      logger.debug(`WebP转换完成: ${imageBuffer.length} -> ${webpBuffer.length} bytes`);
      
      return webpBase64;
      
    } catch (error) {
      logger.error('WebP转换失败:', error);
      throw error;
    }
  }

  /**
   * 转换为AVIF格式
   * @param {string} base64Data - Base64编码的图像数据
   * @param {Object} options - 压缩选项
   * @returns {string} AVIF格式的Base64数据
   */
  async convertToAVIF(base64Data, options = {}) {
    try {
      const config = { ...this.compressionConfigs.avif, ...options };
      
      // 移除Base64前缀
      const imageBuffer = Buffer.from(base64Data.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
      
      // 转换为AVIF
      const avifBuffer = await sharp(imageBuffer)
        .avif({
          quality: config.quality,
          lossless: config.lossless,
          effort: config.effort
        })
        .toBuffer();
      
      // 转换回Base64
      const avifBase64 = `data:image/avif;base64,${avifBuffer.toString('base64')}`;
      
      logger.debug(`AVIF转换完成: ${imageBuffer.length} -> ${avifBuffer.length} bytes`);
      
      return avifBase64;
      
    } catch (error) {
      logger.error('AVIF转换失败:', error);
      throw error;
    }
  }

  /**
   * 调整图像尺寸
   * @param {string} base64Data - Base64编码的图像数据
   * @param {number} width - 目标宽度
   * @param {number} height - 目标高度
   * @param {Object} options - 调整选项
   * @returns {string} 调整后的Base64数据
   */
  async resizeImage(base64Data, width, height, options = {}) {
    try {
      const {
        fit = 'cover',
        position = 'center',
        format = 'webp',
        quality = 85
      } = options;
      
      // 移除Base64前缀
      const imageBuffer = Buffer.from(base64Data.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
      
      // 调整尺寸
      let sharpInstance = sharp(imageBuffer)
        .resize(width, height, {
          fit,
          position
        });
      
      // 应用格式转换
      switch (format) {
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality });
          break;
        case 'avif':
          sharpInstance = sharpInstance.avif({ quality });
          break;
        case 'png':
          sharpInstance = sharpInstance.png();
          break;
        default:
          sharpInstance = sharpInstance.webp({ quality });
      }
      
      const resizedBuffer = await sharpInstance.toBuffer();
      
      // 转换回Base64
      const resizedBase64 = `data:image/${format};base64,${resizedBuffer.toString('base64')}`;
      
      logger.debug(`图像缩放完成: ${width}x${height}, ${imageBuffer.length} -> ${resizedBuffer.length} bytes`);
      
      return resizedBase64;
      
    } catch (error) {
      logger.error('图像缩放失败:', error);
      throw error;
    }
  }

  /**
   * 压缩RLE数据
   * @param {string} rleData - RLE编码数据
   * @returns {string} 压缩后的RLE数据
   */
  async compressRLE(rleData) {
    try {
      // 解析RLE数据
      const rleArray = JSON.parse(rleData);
      
      // 优化RLE编码
      const optimizedRLE = this.optimizeRLEEncoding(rleArray);
      
      // 压缩JSON字符串
      const compressed = JSON.stringify(optimizedRLE);
      
      logger.debug(`RLE压缩完成: ${rleData.length} -> ${compressed.length} bytes`);
      
      return compressed;
      
    } catch (error) {
      logger.error('RLE压缩失败:', error);
      throw error;
    }
  }

  /**
   * 优化RLE编码
   * @param {Array} rleArray - RLE数组
   * @returns {Array} 优化后的RLE数组
   */
  optimizeRLEEncoding(rleArray) {
    const optimized = [];
    let current = null;
    
    for (const item of rleArray) {
      if (current && current.color === item.color) {
        // 合并相同颜色的连续块
        current.count += item.count;
      } else {
        // 开始新的颜色块
        if (current) {
          optimized.push(current);
        }
        current = { ...item };
      }
    }
    
    // 添加最后一个块
    if (current) {
      optimized.push(current);
    }
    
    return optimized;
  }

  /**
   * 生成图像缩略图
   * @param {string} base64Data - Base64编码的图像数据
   * @param {number} size - 缩略图尺寸
   * @returns {string} 缩略图Base64数据
   */
  async generateThumbnail(base64Data, size = 64) {
    try {
      return await this.resizeImage(base64Data, size, size, {
        fit: 'cover',
        format: 'webp',
        quality: 75
      });
      
    } catch (error) {
      logger.error('缩略图生成失败:', error);
      throw error;
    }
  }

  /**
   * 获取图像信息
   * @param {string} base64Data - Base64编码的图像数据
   * @returns {Object} 图像信息
   */
  async getImageInfo(base64Data) {
    try {
      // 移除Base64前缀
      const imageBuffer = Buffer.from(base64Data.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
      
      const metadata = await sharp(imageBuffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: imageBuffer.length,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha
      };
      
    } catch (error) {
      logger.error('获取图像信息失败:', error);
      throw error;
    }
  }

  /**
   * 验证图像格式
   * @param {string} base64Data - Base64编码的图像数据
   * @returns {boolean} 是否为有效图像
   */
  async validateImage(base64Data) {
    try {
      await this.getImageInfo(base64Data);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 批量处理图像
   * @param {Array} images - 图像数组
   * @param {Object} options - 处理选项
   * @returns {Array} 处理结果
   */
  async batchProcessImages(images, options = {}) {
    const results = [];
    
    try {
      const { concurrency = 5 } = options;
      
      // 分批处理
      for (let i = 0; i < images.length; i += concurrency) {
        const batch = images.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (image) => {
          try {
            const result = await this.processImage(image, options);
            return { success: true, result };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
      
      return results;
      
    } catch (error) {
      logger.error('批量图像处理失败:', error);
      throw error;
    }
  }

  /**
   * 处理单个图像
   * @param {Object} image - 图像数据
   * @param {Object} options - 处理选项
   * @returns {Object} 处理结果
   */
  async processImage(image, options = {}) {
    const {
      convertToWebP = true,
      generateThumbnail = true,
      thumbnailSize = 64,
      quality = 85
    } = options;
    
    const result = {
      id: image.id,
      original: image.data,
      processed: {}
    };
    
    try {
      // 转换为WebP
      if (convertToWebP) {
        result.processed.webp = await this.convertToWebP(image.data, { quality });
      }
      
      // 生成缩略图
      if (generateThumbnail) {
        result.processed.thumbnail = await this.generateThumbnail(image.data, thumbnailSize);
      }
      
      // 获取图像信息
      result.info = await this.getImageInfo(image.data);
      
      return result;
      
    } catch (error) {
      logger.error(`图像处理失败: ${image.id}`, error);
      throw error;
    }
  }

  /**
   * 计算压缩比
   * @param {number} originalSize - 原始大小
   * @param {number} compressedSize - 压缩后大小
   * @returns {number} 压缩比
   */
  calculateCompressionRatio(originalSize, compressedSize) {
    return compressedSize / originalSize;
  }

  /**
   * 估算存储空间
   * @param {Array} images - 图像数组
   * @param {Object} options - 选项
   * @returns {Object} 存储空间估算
   */
  async estimateStorageSpace(images, options = {}) {
    const {
      webpQuality = 85,
      thumbnailSize = 64,
      includeThumbnails = true
    } = options;
    
    let totalOriginalSize = 0;
    let totalWebPSize = 0;
    let totalThumbnailSize = 0;
    
    for (const image of images) {
      try {
        const info = await this.getImageInfo(image.data);
        totalOriginalSize += info.size;
        
        // 估算WebP大小（通常比原图小30-50%）
        const estimatedWebPSize = info.size * (webpQuality / 100) * 0.7;
        totalWebPSize += estimatedWebPSize;
        
        // 估算缩略图大小
        if (includeThumbnails) {
          const thumbnailRatio = (thumbnailSize * thumbnailSize) / (info.width * info.height);
          totalThumbnailSize += estimatedWebPSize * thumbnailRatio;
        }
        
      } catch (error) {
        logger.warn(`图像信息获取失败: ${image.id}`, error);
      }
    }
    
    return {
      original: totalOriginalSize,
      webp: totalWebPSize,
      thumbnails: totalThumbnailSize,
      total: totalWebPSize + totalThumbnailSize,
      compressionRatio: this.calculateCompressionRatio(totalOriginalSize, totalWebPSize),
      savings: totalOriginalSize - totalWebPSize
    };
  }
}

module.exports = PatternCompressionService;
