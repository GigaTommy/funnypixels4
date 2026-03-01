const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

/**
 * 图案转换服务
 * 负责将不同格式的图案转换为统一的 png_base64 格式
 */
class PatternConversionService {
  
  /**
   * 将 png_url 格式的图案转换为 png_base64 格式
   * @param {string} pngUrl - 图片URL路径
   * @param {Object} options - 转换选项
   * @returns {Object} 转换结果
   */
  static async convertPngUrlToBase64(pngUrl, options = {}) {
    try {
      console.log(`🔄 开始转换 png_url 到 png_base64: ${pngUrl}`);
      
      // 1. 构建完整的文件路径
      const fullPath = path.join(__dirname, '../../public', pngUrl);
      console.log(`📁 完整文件路径: ${fullPath}`);
      
      // 2. 检查文件是否存在
      try {
        await fs.access(fullPath);
        console.log('✅ 文件存在，开始读取');
      } catch (error) {
        console.warn(`⚠️ 文件不存在: ${fullPath}，将生成默认图案`);
        return await this.generateDefaultPattern(options);
      }
      
      // 3. 读取文件
      const imageBuffer = await fs.readFile(fullPath);
      console.log(`📊 文件大小: ${imageBuffer.length} bytes`);
      
      // 4. 使用 sharp 处理图片 - 修复：使用contain避免裁剪
      const targetWidth = options.width || 64;
      const targetHeight = options.height || 64;
      const processedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, targetHeight, {
          fit: 'contain', // 修复：保持完整图像，避免裁剪
          position: 'center',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // 透明背景填充
        })
        .png({ quality: 95, compressionLevel: 6 })
        .toBuffer();
      
      console.log(`✅ 图片处理完成，新大小: ${processedBuffer.length} bytes`);
      
      // 5. 转换为 base64
      const base64Data = `data:image/png;base64,${processedBuffer.toString('base64')}`;
      
      console.log(`🎉 png_url 转换完成: ${pngUrl} -> base64 (${base64Data.length} 字符)`);
      
      return {
        success: true,
        encoding: 'png_base64',
        payload: base64Data,
        width: options.width || 64,
        height: options.height || 64,
        originalUrl: pngUrl,
        convertedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ png_url 转换失败: ${pngUrl}`, error);
      throw new Error(`图案转换失败: ${error.message}`);
    }
  }
  
  /**
   * ✅ 新增：将 RLE 格式的图案转换为 PNG Buffer（方案B优化）
   * 与convertRLEToBase64类似，但返回Buffer而不是base64字符串
   * @param {string} rlePayload - RLE 编码的 payload
   * @param {number} width - 图案宽度
   * @param {number} height - 图案高度
   * @param {Object} options - 转换选项
   * @returns {Object} 转换结果 { buffer: Buffer, width, height }
   */
  static async convertRLEToBuffer(rlePayload, width, height, options = {}) {
    try {
      console.log(`🔄 开始转换 RLE 到 PNG Buffer: ${width}x${height}`);

      // 1. 解析 RLE 数据
      const rleData = JSON.parse(rlePayload);
      if (!Array.isArray(rleData)) {
        throw new Error('RLE 数据格式无效');
      }

      // 2. 验证尺寸
      if (width <= 0 || height <= 0 || width > 1024 || height > 1024) {
        throw new Error(`无效的图案尺寸: ${width}x${height}`);
      }

      const expectedPixels = width * height;
      const pixels = new Uint8Array(expectedPixels * 4);
      let pixelIndex = 0;
      let totalProcessedPixels = 0;

      console.log(`🔍 开始RLE解码: 期望${expectedPixels}个像素, ${rleData.length}个RLE段`);

      for (let segmentIndex = 0; segmentIndex < rleData.length; segmentIndex++) {
        const segment = rleData[segmentIndex];

        // 验证RLE段结构
        if (!segment || typeof segment !== 'object') {
          throw new Error(`RLE段${segmentIndex}格式无效: 不是对象`);
        }

        const { color, count } = segment;

        // 验证必需字段
        if (color === undefined || count === undefined) {
          throw new Error(`RLE段${segmentIndex}缺少必需字段: color或count`);
        }

        // 验证count值
        if (!Number.isInteger(count) || count <= 0) {
          throw new Error(`RLE段${segmentIndex}的count值无效: ${count}`);
        }

        // 验证颜色值
        if (typeof color !== 'string') {
          throw new Error(`RLE段${segmentIndex}的color值无效: 不是字符串`);
        }

        // 解析颜色
        let r, g, b, a = 255;
        if (color === 'transparent') {
          r = g = b = 0;
          a = 0;
        } else if (color.startsWith('#')) {
          const hex = color.slice(1);
          if (hex.length === 6 && /^[0-9A-Fa-f]{6}$/.test(hex)) {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
            a = 255;
          } else if (hex.length === 8 && /^[0-9A-Fa-f]{8}$/.test(hex)) {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
            a = parseInt(hex.slice(6, 8), 16);
          } else {
            throw new Error(`RLE段${segmentIndex}的十六进制颜色格式无效: ${color}`);
          }
        } else {
          console.warn(`⚠️ RLE段${segmentIndex}使用未知颜色格式: "${color}", 使用默认灰色`);
          r = g = b = 128;
        }

        // 安全填充像素，防止越界
        const remainingPixels = expectedPixels - Math.floor(pixelIndex / 4);
        if (remainingPixels <= 0) {
          console.warn(`⚠️ RLE段${segmentIndex}超出图像边界，跳过剩余段`);
          break;
        }

        const actualCount = Math.min(count, remainingPixels);
        for (let i = 0; i < actualCount; i++) {
          pixels[pixelIndex] = r;
          pixels[pixelIndex + 1] = g;
          pixels[pixelIndex + 2] = b;
          pixels[pixelIndex + 3] = a;
          pixelIndex += 4;
        }

        totalProcessedPixels += count;
      }

      // 正确的像素边界验证
      const actualProcessedPixels = pixelIndex / 4;
      if (actualProcessedPixels > expectedPixels) {
        console.warn(`⚠️ RLE解码像素溢出: 期望${expectedPixels}, 实际处理${actualProcessedPixels}`);
        pixelIndex = expectedPixels * 4;
      } else if (actualProcessedPixels < expectedPixels) {
        const remainingPixels = expectedPixels - actualProcessedPixels;
        console.log(`🔧 用透明像素填充剩余${remainingPixels}个位置`);

        for (let i = 0; i < remainingPixels; i++) {
          pixels[pixelIndex] = 255;
          pixels[pixelIndex + 1] = 255;
          pixels[pixelIndex + 2] = 255;
          pixels[pixelIndex + 3] = 0;
          pixelIndex += 4;
        }
      }

      console.log(`✅ RLE解码完成: 处理了${totalProcessedPixels}个像素`);

      // 3. 使用sharp将像素转换为PNG Buffer（不转base64）
      const imageBuffer = await sharp(pixels, {
        raw: {
          width: width,
          height: height,
          channels: 4
        }
      })
        .png({
          quality: 95,
          compressionLevel: 6,
          adaptiveFiltering: false,
          palette: false
        })
        .toBuffer();

      console.log(`🎉 RLE到Buffer转换完成: ${width}x${height} -> ${imageBuffer.length} bytes`);

      return {
        success: true,
        buffer: imageBuffer,
        width: width,
        height: height,
        originalEncoding: 'rle',
        convertedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ RLE到Buffer转换失败:', error);
      throw new Error(`RLE图案转换失败: ${error.message}`);
    }
  }

  /**
   * 将 RLE 格式的图案转换为 png_base64 格式
   * @param {string} rlePayload - RLE 编码的 payload
   * @param {number} width - 图案宽度
   * @param {number} height - 图案高度
   * @param {Object} options - 转换选项
   * @returns {Object} 转换结果
   */
  static async convertRLEToBase64(rlePayload, width, height, options = {}) {
    try {
      console.log(`🔄 开始转换 RLE 到 png_base64: ${width}x${height}`);
      
      // 1. 解析 RLE 数据
      const rleData = JSON.parse(rlePayload);
      if (!Array.isArray(rleData)) {
        throw new Error('RLE 数据格式无效');
      }
      
      // 2. ✅ 增强RLE解码安全验证
      if (width <= 0 || height <= 0 || width > 1024 || height > 1024) {
        throw new Error(`无效的图案尺寸: ${width}x${height}`);
      }

      const expectedPixels = width * height;
      const pixels = new Uint8Array(expectedPixels * 4);
      let pixelIndex = 0;
      let totalProcessedPixels = 0;

      console.log(`🔍 开始RLE解码验证: 期望${expectedPixels}个像素, ${rleData.length}个RLE段`);

      for (let segmentIndex = 0; segmentIndex < rleData.length; segmentIndex++) {
        const segment = rleData[segmentIndex];

        // 验证RLE段结构
        if (!segment || typeof segment !== 'object') {
          throw new Error(`RLE段${segmentIndex}格式无效: 不是对象`);
        }

        const { color, count } = segment;

        // 验证必需字段
        if (color === undefined || count === undefined) {
          throw new Error(`RLE段${segmentIndex}缺少必需字段: color或count`);
        }

        // 验证count值
        if (!Number.isInteger(count) || count <= 0) {
          throw new Error(`RLE段${segmentIndex}的count值无效: ${count}`);
        }

        // 验证颜色值
        if (typeof color !== 'string') {
          throw new Error(`RLE段${segmentIndex}的color值无效: 不是字符串`);
        }

        // 解析颜色并验证
        let r, g, b, a = 255;
        if (color === 'transparent') {
          r = g = b = 0;
          a = 0;
        } else if (color.startsWith('#')) {
          const hex = color.slice(1);
          if (hex.length === 6 && /^[0-9A-Fa-f]{6}$/.test(hex)) {
            // RGB格式: #RRGGBB
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
            a = 255; // 不透明
          } else if (hex.length === 8 && /^[0-9A-Fa-f]{8}$/.test(hex)) {
            // RGBA格式: #RRGGBBAA
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
            a = parseInt(hex.slice(6, 8), 16); // Alpha通道
          } else {
            throw new Error(`RLE段${segmentIndex}的十六进制颜色格式无效: ${color} (支持6位RGB或8位RGBA格式)`);
          }
        } else {
          // 默认颜色 - 但记录警告
          console.warn(`⚠️ RLE段${segmentIndex}使用未知颜色格式: "${color}", 使用默认灰色`);
          r = g = b = 128;
        }

        // ✅ 修复：更宽松的像素边界验证 - 允许适度溢出并截断
        const remainingPixels = expectedPixels - Math.floor(pixelIndex / 4);
        if (remainingPixels <= 0) {
          console.warn(`⚠️ RLE段${segmentIndex}超出图像边界，跳过剩余段`);
          break; // 跳出循环，不再处理更多RLE段
        }

        // ✅ 修复：安全填充像素，防止越界
        const actualCount = Math.min(count, remainingPixels);
        for (let i = 0; i < actualCount; i++) {
          pixels[pixelIndex] = r;     // Red
          pixels[pixelIndex + 1] = g; // Green
          pixels[pixelIndex + 2] = b; // Blue
          pixels[pixelIndex + 3] = a; // Alpha
          pixelIndex += 4;
        }

        totalProcessedPixels += count;
      }

      // ✅ 修复：正确的像素边界验证 - 允许适度的像素数量不匹配
      const actualProcessedPixels = pixelIndex / 4;
      if (actualProcessedPixels > expectedPixels) {
        console.warn(`⚠️ RLE解码像素溢出: 期望${expectedPixels}, 实际处理${actualProcessedPixels}`);
        // 截断多余的像素
        pixelIndex = expectedPixels * 4;
      } else if (actualProcessedPixels < expectedPixels) {
        const remainingPixels = expectedPixels - actualProcessedPixels;
        console.log(`🔧 用透明像素填充剩余${remainingPixels}个位置`);

        for (let i = 0; i < remainingPixels; i++) {
          pixels[pixelIndex] = 255;     // R
          pixels[pixelIndex + 1] = 255; // G
          pixels[pixelIndex + 2] = 255; // B
          pixels[pixelIndex + 3] = 0;   // A (透明)
          pixelIndex += 4;
        }
      }

      console.log(`✅ RLE解码验证完成: 处理了${totalProcessedPixels}个像素, 最终像素数组${actualProcessedPixels}/${expectedPixels}`);
      
      // 3. 使用 sharp 创建图片，优化压缩设置 - 修复：使用contain避免裁剪
      const targetWidth = options.targetWidth || width;
      const targetHeight = options.targetHeight || height;
      const imageBuffer = await sharp(pixels, {
        raw: {
          width: width,
          height: height,
          channels: 4
        }
      })
        .resize(targetWidth, targetHeight, {
          fit: 'contain', // 修复：保持完整图像，避免裁剪
          position: 'center',
          kernel: sharp.kernel.lanczos3, // 使用高质量重采样
          background: { r: 255, g: 255, b: 255, alpha: 0 } // 透明背景填充
        })
        .png({
          quality: 95, // 提高质量
          compressionLevel: 6, // 平衡压缩率和速度
          adaptiveFiltering: false, // 修复：禁用以提高存取效率
          palette: false // 修复：禁用以提高兼容性
        })
        .toBuffer();
      
      // 4. 转换为 base64
      const base64Data = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      
      console.log(`🎉 RLE 转换完成: ${width}x${height} -> base64 (${base64Data.length} 字符)`);
      
      return {
        success: true,
        encoding: 'png_base64',
        payload: base64Data,
        width: options.targetWidth || width,
        height: options.targetHeight || height,
        originalEncoding: 'rle',
        convertedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ RLE 转换失败:', error);
      throw new Error(`RLE 图案转换失败: ${error.message}`);
    }
  }
  
  /**
   * 将 hybrid 格式的图案转换为 png_base64 格式
   * @param {string} hybridPayload - hybrid 编码的 payload
   * @param {Object} options - 转换选项
   * @returns {Object} 转换结果
   */
  static async convertHybridToBase64(hybridPayload, options = {}) {
    try {
      console.log('🔄 开始转换 hybrid 到 png_base64');
      
      // 1. 解析 hybrid 数据
      const hybridData = JSON.parse(hybridPayload);
      
      // 2. 优先使用 base64 图像
      if (hybridData.base64Image) {
        console.log('✅ 使用 hybrid 中的 base64 图像');
        return {
          success: true,
          encoding: 'png_base64',
          payload: hybridData.base64Image,
          width: options.width || 64,
          height: options.height || 64,
          originalEncoding: 'hybrid',
          convertedAt: new Date().toISOString()
        };
      }
      
      // 3. 回退到 RLE 转换
      if (hybridData.rleData) {
        console.log('🔄 使用 hybrid 中的 RLE 数据');
        return await this.convertRLEToBase64(
          JSON.stringify(hybridData.rleData),
          hybridData.width || 64,
          hybridData.height || 64,
          options
        );
      }
      
      throw new Error('hybrid 数据中没有可用的图像数据');
      
    } catch (error) {
      console.error('❌ hybrid 转换失败:', error);
      throw new Error(`hybrid 图案转换失败: ${error.message}`);
    }
  }
  
  /**
   * 通用图案转换方法
   * @param {Object} pattern - 图案对象
   * @param {Object} options - 转换选项
   * @returns {Object} 转换结果
   */
  static async convertPatternToBase64(pattern, options = {}) {
    try {
      console.log(`🔄 开始转换图案: ${pattern.name} (${pattern.encoding})`);
      
      switch (pattern.encoding) {
      case 'png_url':
        return await this.convertPngUrlToBase64(pattern.payload, options);
        
      case 'rle':
        return await this.convertRLEToBase64(
          pattern.payload,
          pattern.width || 64,
          pattern.height || 64,
          options
        );
        
      case 'hybrid':
        return await this.convertHybridToBase64(pattern.payload, options);
        
      case 'png_base64':
        // 已经是 base64 格式，直接返回
        console.log('✅ 图案已经是 png_base64 格式');
        return {
          success: true,
          encoding: 'png_base64',
          payload: pattern.payload,
          width: pattern.width || 64,
          height: pattern.height || 64,
          originalEncoding: 'png_base64',
          convertedAt: new Date().toISOString()
        };
        
      default:
        throw new Error(`不支持的编码格式: ${pattern.encoding}`);
      }
      
    } catch (error) {
      console.error(`❌ 图案转换失败: ${pattern.name}`, error);
      throw error;
    }
  }
  
  /**
   * 生成默认图案（当文件不存在时使用）
   * @param {Object} options - 生成选项
   * @returns {Object} 默认图案结果
   */
  static async generateDefaultPattern(options = {}) {
    try {
      console.log('🎨 生成默认图案...');
      
      const width = options.width || 64;
      const height = options.height || 64;
      
      // 创建一个简单的渐变图案
      const pixels = new Uint8Array(width * height * 4);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          
          // 创建蓝色到紫色的渐变
          const r = Math.floor((x / width) * 255);
          const g = Math.floor((y / height) * 128);
          const b = Math.floor(128 + (x / width) * 127);
          const a = 255;
          
          pixels[index] = r;     // Red
          pixels[index + 1] = g; // Green
          pixels[index + 2] = b; // Blue
          pixels[index + 3] = a; // Alpha
        }
      }
      
      // 使用 sharp 创建图片
      const imageBuffer = await sharp(pixels, {
        raw: {
          width: width,
          height: height,
          channels: 4
        }
      })
        .png({ quality: 90 })
        .toBuffer();
      
      // 转换为 base64
      const base64Data = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      
      console.log(`✅ 默认图案生成完成: ${width}x${height}`);
      
      return {
        success: true,
        encoding: 'png_base64',
        payload: base64Data,
        width: width,
        height: height,
        isDefault: true,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ 生成默认图案失败:', error);
      throw new Error(`默认图案生成失败: ${error.message}`);
    }
  }
  
  /**
   * 批量转换图案
   * @param {Array} patterns - 图案数组
   * @param {Object} options - 转换选项
   * @returns {Array} 转换结果数组
   */
  static async batchConvertPatterns(patterns, options = {}) {
    try {
      console.log(`🔄 开始批量转换 ${patterns.length} 个图案`);
      
      const results = [];
      const errors = [];
      
      for (const pattern of patterns) {
        try {
          const result = await this.convertPatternToBase64(pattern, options);
          results.push({
            patternId: pattern.id,
            patternName: pattern.name,
            success: true,
            result: result
          });
        } catch (error) {
          console.error(`❌ 图案转换失败: ${pattern.name}`, error);
          errors.push({
            patternId: pattern.id,
            patternName: pattern.name,
            success: false,
            error: error.message
          });
        }
      }
      
      console.log(`🎉 批量转换完成: ${results.length} 成功, ${errors.length} 失败`);
      
      return {
        success: true,
        total: patterns.length,
        successful: results.length,
        failed: errors.length,
        results: results,
        errors: errors
      };
      
    } catch (error) {
      console.error('❌ 批量转换失败:', error);
      throw error;
    }
  }
}

module.exports = PatternConversionService;
