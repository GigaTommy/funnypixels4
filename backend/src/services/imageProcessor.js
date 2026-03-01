const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * 图片处理服务
 */
class ImageProcessor {

  /**
   * 处理用户上传的图片，压缩到指定尺寸并提取特征
   * @param {string} imageData - base64图片数据
   * @param {number} targetWidth - 目标宽度，默认为16
   * @param {number} targetHeight - 目标高度，默认为16
   * @returns {Object} 处理结果
   */
  static async processUserImage(imageData, targetWidth = 64, targetHeight = 64) {
    try {
      logger.info(`🖼️ 开始处理用户上传的图片: ${targetWidth}x${targetHeight}`);

      let imageBuffer;

      // 1. 解析输入数据 (支持 Base64 字符串或 Buffer)
      if (Buffer.isBuffer(imageData)) {
        imageBuffer = imageData;
      } else if (typeof imageData === 'string') {
        const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        throw new Error('不支持的图像数据格式');
      }

      // 2. 获取原始图片信息
      const originalImage = sharp(imageBuffer);
      const metadata = await originalImage.metadata();

      logger.info(`📏 原始图片尺寸: ${metadata.width}x${metadata.height}`);
      logger.info(`📊 原始图片格式: ${metadata.format}`);

      // 3. 高质量处理：使用块平均算法（基于测试页面的最佳实践）

      // 3.1 先获取原始图像数据
      const { data: originalData, info: originalInfo } = await originalImage
        .raw()
        .toBuffer({ resolveWithObject: true });

      logger.info(`🎨 使用主颜色采样算法（保留像素艺术特征）: ${originalInfo.width}x${originalInfo.height} -> ${targetWidth}x${targetHeight}`);

      // 3.2 应用主颜色采样算法（用于像素艺术，保留原始色块）
      const blockAveragedPixels = this.pixelateImageWithDominantColor(
        originalData,
        originalInfo.width,
        originalInfo.height,
        targetWidth,
        targetHeight
      );

      const data = Buffer.alloc(targetWidth * targetHeight * 4);
      const info = {
        width: targetWidth,
        height: targetHeight,
        channels: 4
      };

      // 3.3 将块平均结果转换为Buffer格式
      for (let i = 0; i < blockAveragedPixels.length; i++) {
        const pixel = blockAveragedPixels[i];
        const bufferIndex = i * 4;
        data[bufferIndex] = pixel.r;
        data[bufferIndex + 1] = pixel.g;
        data[bufferIndex + 2] = pixel.b;
        data[bufferIndex + 3] = pixel.a;
      }

      logger.info(`✅ 图片已压缩到${targetWidth}x${targetHeight}像素`);

      // 4. 创建完整的像素网格数组，包含原始的 RGB 值 和 color 字段
      const pixels = [];
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = info.channels === 4 ? data[i + 3] : 255;

        // ✅ 必须生成 color 字段，RLE编码需要这个字段
        const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

        pixels.push({ r, g, b, a, color });
      }

      // ✅ 修复：对于用户自定义旗帜，保留原始颜色，不进行激进的颜色量化
      // 原来的 applyAdaptiveColorQuantization 会将颜色压缩到64种，导致彩色图片变成灰色
      // 现在直接使用块平均后的像素数据，保留完整的RGB色彩
      logger.info('🎨 保留原始颜色（不进行激进的颜色量化）');
      const finalPixels = pixels; // 直接使用块平均结果，保留所有颜色信息

      // 5. 转换为 RLE 编码格式
      const rlePattern = this.generateRLEPattern(finalPixels, targetWidth, targetHeight);
      const rlePayload = JSON.stringify(rlePattern);

      // 6. 分析颜色特征
      const colorFeatures = await this.analyzeColors(finalPixels);

      logger.info('✅ 图片处理完成');
      logger.info(`📊 RLE数据大小: ${rlePayload.length} 字符`);
      logger.info(`🎨 主要颜色数量: ${colorFeatures.dominantColors.length}`);
      logger.info(`📊 总颜色数: ${colorFeatures.totalColors}`);

      return {
        width: targetWidth,
        height: targetHeight,
        encoding: 'rle', // 使用RLE编码存储像素数据
        payload: rlePayload, // 存储RLE编码的像素数据
        render_type: 'complex', // 设置为complex类型
        originalSize: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format
        },
        colorFeatures: colorFeatures,
        pixelCount: finalPixels.length,
        rleSegments: rlePattern.length
      };

    } catch (error) {
      logger.error('❌ 图片处理失败:', error);
      throw new Error(`图片处理失败: ${error.message}`);
    }
  }

  /**
   * 从图片缓冲区提取像素数据
   * @param {Buffer} imageBuffer - 图片缓冲区
   * @returns {Array} 像素数据数组
   */
  static async extractPixelData(imageBuffer) {
    try {
      const { data, info } = await sharp(imageBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

      logger.info(`🔍 提取像素数据: 宽度=${info.width}, 高度=${info.height}, 通道数=${info.channels}, 数据长度=${data.length}`);

      const pixels = [];
      const expectedPixels = info.width * info.height;

      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = info.channels === 4 ? data[i + 3] : 255; // 如果没有alpha通道，设为255

        // 转换为十六进制颜色
        const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

        pixels.push({
          r, g, b, a,
          color: color,
          position: Math.floor(i / info.channels)
        });
      }

      logger.info(`✅ 像素数据提取完成: 期望${expectedPixels}个像素, 实际${pixels.length}个像素`);

      // 验证像素数量
      if (pixels.length !== expectedPixels) {
        logger.warn(`⚠️ 像素数量不匹配: 期望${expectedPixels}, 实际${pixels.length}`);
      }

      return pixels;
    } catch (error) {
      logger.error('❌ 提取像素数据失败:', error);
      throw new Error('提取像素数据失败');
    }
  }

  /**
   * 分析图片颜色特征
   * @param {Array} pixelData - 像素数据
   * @returns {Object} 颜色特征
   */
  static async analyzeColors(pixelData) {
    try {
      // 统计颜色频率
      const colorCount = {};
      let totalPixels = 0;

      pixelData.forEach(pixel => {
        if (pixel.a > 128) { // 只统计不透明的像素
          colorCount[pixel.color] = (colorCount[pixel.color] || 0) + 1;
          totalPixels++;
        }
      });

      // 获取主要颜色
      const sortedColors = Object.entries(colorCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8) // 取前8种主要颜色
        .map(([color, count]) => ({
          color,
          count,
          percentage: (count / totalPixels * 100).toFixed(2)
        }));

      // 计算平均颜色
      let totalR = 0, totalG = 0, totalB = 0;
      let validPixels = 0;

      pixelData.forEach(pixel => {
        if (pixel.a > 128) {
          totalR += pixel.r;
          totalG += pixel.g;
          totalB += pixel.b;
          validPixels++;
        }
      });

      const averageColor = validPixels > 0 ? {
        r: Math.round(totalR / validPixels),
        g: Math.round(totalG / validPixels),
        b: Math.round(totalB / validPixels)
      } : { r: 128, g: 128, b: 128 };

      return {
        dominantColors: sortedColors,
        averageColor: `#${averageColor.r.toString(16).padStart(2, '0')}${averageColor.g.toString(16).padStart(2, '0')}${averageColor.b.toString(16).padStart(2, '0')}`,
        totalColors: Object.keys(colorCount).length,
        totalPixels: validPixels
      };
    } catch (error) {
      logger.error('❌ 分析颜色特征失败:', error);
      return {
        dominantColors: [],
        averageColor: '#808080',
        totalColors: 0,
        totalPixels: 0
      };
    }
  }

  /**
   * 生成RLE编码图案 - 真正的RLE编码格式
   * @param {Array} pixelData - 像素数据
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Array} RLE编码数据
   */
  static generateRLEPattern(pixelData, width = 16, height = 16) {
    try {
      const rleData = [];

      // 按行处理像素数据，生成真正的RLE编码
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          const pixel = pixelData[index];

          if (!pixel) {
            logger.warn(`⚠️ 像素数据缺失: (${x}, ${y})`);
            continue;
          }

          // 关键修改：直接使用已经量化和抖动过的 `pixel.color`
          const color = pixel.a > 128 ? pixel.color : 'transparent';

          // 检查是否与前一个像素颜色相同
          if (rleData.length > 0 && rleData[rleData.length - 1].color === color) {
            // 相同颜色，增加计数
            rleData[rleData.length - 1].count++;
          } else {
            // 不同颜色，创建新的RLE段
            rleData.push({
              color: color,
              count: 1
            });
          }
        }
      }

      logger.info(`📊 生成RLE编码: ${rleData.length}个RLE段 (${width}x${height})`);
      logger.info('🎨 颜色统计:', this.getColorStats(rleData));

      return rleData;
    } catch (error) {
      logger.error('❌ 生成RLE编码失败:', error);
      // 返回简单的默认图案
      return [
        { color: '#808080', count: width * height } // 动态计算像素数量
      ];
    }
  }

  /**
   * 获取颜色统计信息
   * @param {Array} rleData - RLE数据
   * @returns {Object} 颜色统计
   */
  static getColorStats(rleData) {
    const colorCount = {};
    rleData.forEach(rleSegment => {
      const color = rleSegment.color;
      colorCount[color] = (colorCount[color] || 0) + rleSegment.count;
    });

    return Object.entries(colorCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([color, count]) => ({ color, count }));
  }

  /**
   * 保存处理后的图片
   * @param {Buffer} imageBuffer - 图片缓冲区
   * @returns {string} 图片URL
   */
  static async saveProcessedImage(imageBuffer) {
    try {
      const fs = require('fs');
      const path = require('path');

      // 创建上传目录
      const uploadDir = path.join(__dirname, '../../public/uploads/custom_flags');
      logger.info('📁 上传目录路径:', uploadDir);

      if (!fs.existsSync(uploadDir)) {
        logger.info('📁 创建上传目录...');
        fs.mkdirSync(uploadDir, { recursive: true });
        logger.info('✅ 上传目录创建成功');
      }

      // 生成唯一文件名
      const imageId = crypto.randomUUID();
      const filename = `${imageId}.png`;
      const filepath = path.join(uploadDir, filename);

      logger.info('📄 文件保存路径:', filepath);

      // 保存文件
      fs.writeFileSync(filepath, imageBuffer);

      // 验证文件是否保存成功
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        logger.info(`💾 处理后的图片已保存: ${filename} (${stats.size} bytes)`);
        return `/uploads/custom_flags/${filename}`;
      } else {
        throw new Error('文件保存后验证失败');
      }

    } catch (error) {
      logger.error('❌ 保存图片失败:', error);
      logger.error('错误详情:', error.message);
      logger.error('错误堆栈:', error.stack);
      return '/uploads/custom_flags/default.png';
    }
  }

  /**
   * 处理广告图片，转换为像素点集合（智能自适应版本）
   * @param {string} imageData - base64图片数据
   * @param {number} targetWidth - 目标宽度
   * @param {number} targetHeight - 目标高度
   * @param {Object} options - 可选配置
   * @returns {Object} 处理结果
   * @returns {Object} 处理结果
   */
  static async processAdImage(imageData, targetWidth, targetHeight, options = {}) {
    try {
      logger.info(`🖼️ 开始智能自适应处理广告图片: ${targetWidth}x${targetHeight}`);

      // 1. 解析图片数据（支持 base64 和 URL）
      let imageBuffer;
      if (imageData.startsWith('data:')) {
        // base64 格式: "data:image/jpeg;base64,..."
        const base64Data = imageData.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        // URL 格式: 从远程或本地服务器获取
        // 尝试从本地文件系统读取（适用于本地开发模式）
        const urlObj = new URL(imageData);
        const localPath = path.join(__dirname, '../../', urlObj.pathname);
        if (fs.existsSync(localPath)) {
          imageBuffer = fs.readFileSync(localPath);
          logger.info(`📂 从本地文件读取图片: ${localPath}`);
        } else {
          // 远程 URL: 使用 HTTP 获取
          const fetchModule = imageData.startsWith('https://') ? require('https') : require('http');
          imageBuffer = await new Promise((resolve, reject) => {
            fetchModule.get(imageData, (resp) => {
              const chunks = [];
              resp.on('data', (chunk) => chunks.push(chunk));
              resp.on('end', () => resolve(Buffer.concat(chunks)));
              resp.on('error', reject);
            }).on('error', reject);
          });
          logger.info(`🌐 从远程URL获取图片: ${imageData}`);
        }
      } else if (imageData.startsWith('/uploads/')) {
        // 相对路径格式: "/uploads/images/..."
        const localPath = path.join(__dirname, '../../', imageData);
        imageBuffer = fs.readFileSync(localPath);
        logger.info(`📂 从本地相对路径读取图片: ${localPath}`);
      } else {
        // 兜底: 尝试当作 base64 处理
        imageBuffer = Buffer.from(imageData, 'base64');
      }

      // 2. 获取原始图片信息
      const originalImage = sharp(imageBuffer);
      const metadata = await originalImage.metadata();
      logger.info(`📏 原始图片尺寸: ${metadata.width}x${metadata.height}`);

      // 3. ✅ 优化预处理 - 保留最佳色彩还原度
      // - 使用 lanczos3 插值获得最佳质量
      // - 保持 sRGB 颜色空间
      // - 禁用量化，保留完整 RGB
      // - 根据长宽比差异自动选择 contain/cover（默认更偏向完整保真）
      const resizeStrategy = this.selectAdResizeStrategy(
        metadata.width,
        metadata.height,
        targetWidth,
        targetHeight,
        options
      );
      logger.info(`🧩 Resize策略: fit=${resizeStrategy.fit}, position=${resizeStrategy.position}, pad=${resizeStrategy.pad}`);

      const preprocessedBuffer = await sharp(imageBuffer)
        .rotate()  // 自动根据EXIF方向旋转
        .flatten({ background: { r: 255, g: 255, b: 255 } })  // 用白色填充透明区域
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: resizeStrategy.fit,
          position: resizeStrategy.position,
          background: resizeStrategy.background,
          kernel: sharp.kernel.lanczos3  // ✅ 使用 lanczos3 获得最佳质量
        })
        .toColorspace('srgb')  // ✅ 保证标准颜色空间
        .ensureAlpha()  // 确保有alpha通道
        .png({ quality: 100, compressionLevel: 0 })  // ✅ 禁用压缩，保留原始色彩
        .toBuffer();

      // 4. 🆕 在预处理后的图像上检测图像类型（此时已经是目标尺寸）
      const { data: preprocessData, info: preprocessInfo } = await sharp(preprocessedBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const imageType = this.detectImageType(preprocessData, preprocessInfo.width, preprocessInfo.height);
      logger.info(`🔍 图像类型检测: ${imageType.type} (置信度: ${imageType.confidence.toFixed(2)})`);

      // 5. ✅ 修复：由于已经在步骤3使用高质量插值调整到目标尺寸，
      // 这里直接提取像素数据，不再需要块平均
      logger.info(`🎨 提取像素数据: ${preprocessInfo.width}x${preprocessInfo.height}`);

      // 验证尺寸是否正确
      if (preprocessInfo.width !== targetWidth || preprocessInfo.height !== targetHeight) {
        throw new Error(`尺寸不匹配: 期望${targetWidth}x${targetHeight}, 实际${preprocessInfo.width}x${preprocessInfo.height}`);
      }

      // 5.1 ✅ 提取像素并保留原始RGB值（不进行颜色映射）
      const pixelatedData = [];
      for (let y = 0; y < preprocessInfo.height; y++) {
        for (let x = 0; x < preprocessInfo.width; x++) {
          const idx = (y * preprocessInfo.width + x) * preprocessInfo.channels;
          const r = preprocessData[idx];
          const g = preprocessData[idx + 1];
          const b = preprocessData[idx + 2];
          const a = preprocessData[idx + 3];

          // ✅ 保留原始RGB值，不进行量化
          const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();

          pixelatedData.push({ r, g, b, a, color, x, y });
        }
      }

      // 5.2 ✅ 基于图像类型自适应量化策略
      const processedPixels = this.adaptiveQuantizeAdPixels(
        pixelatedData,
        targetWidth,
        targetHeight,
        imageType
      );

      // 9. 转换为像素点集合格式
      const pixelPoints = this.convertToPixelPointsAdvanced(processedPixels, targetWidth, targetHeight, {
        forceOpaque: true,
        transparentColor: '#FFFFFF'
      });

      // 10. 保存处理后的像素图到临时文件夹（用于调试）
      await this.saveDebugPixelImage(processedPixels, targetWidth, targetHeight);

      // 11. ✅ 额外保存：对比原始缩放图和处理后的图
      await this.saveComparisonImages(preprocessedBuffer, processedPixels, targetWidth, targetHeight);

      logger.info(`✅ 智能自适应处理完成，共${pixelPoints.length}个像素点`);

      return {
        width: targetWidth,
        height: targetHeight,
        pixelData: pixelPoints,
        pixelCount: pixelPoints.length,
        encoding: 'pixel_points',
        render_type: 'advertisement',
        processing_method: 'adaptive_intelligent_v2',
        image_type: imageType.type
      };

    } catch (error) {
      logger.error('❌ 智能自适应处理失败:', error);
      throw new Error(`广告图片智能自适应处理失败: ${error.message}`);
    }
  }

  /**
   * ✅ 广告专用 Resize 策略：优先保证完整内容，必要时才裁剪
   * @param {number} srcW - 原图宽度
   * @param {number} srcH - 原图高度
   * @param {number} dstW - 目标宽度
   * @param {number} dstH - 目标高度
   * @param {Object} options - 可选配置 { fit, aspectThreshold }
   * @returns {Object} resize策略
   */
  static selectAdResizeStrategy(srcW, srcH, dstW, dstH, options = {}) {
    const safeSrcW = Math.max(1, parseInt(srcW || 1, 10));
    const safeSrcH = Math.max(1, parseInt(srcH || 1, 10));
    const safeDstW = Math.max(1, parseInt(dstW || 1, 10));
    const safeDstH = Math.max(1, parseInt(dstH || 1, 10));

    if (options.fit) {
      return {
        fit: options.fit,
        position: options.position || 'centre',
        background: options.background || { r: 255, g: 255, b: 255, alpha: 1 },
        pad: options.fit === 'contain'
      };
    }

    const srcRatio = safeSrcW / safeSrcH;
    const dstRatio = safeDstW / safeDstH;
    const ratioDiff = Math.abs(Math.log(srcRatio / dstRatio));
    const threshold = typeof options.aspectThreshold === 'number' ? options.aspectThreshold : 0.12;

    // 长宽比差异明显时使用 contain 以保证内容完整
    if (ratioDiff > threshold) {
      return {
        fit: 'contain',
        position: 'centre',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        pad: true
      };
    }

    // 相近比例下可使用 cover 以最大化有效像素
    return {
      fit: 'cover',
      position: 'centre',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      pad: false
    };
  }

  /**
   * ✅ 广告像素自适应量化策略
   * - photo: Lab + Floyd-Steinberg 抖动（保留渐变细节）
   * - graphic/cartoon: 无抖动量化（保持文字/边缘锐利）
   */
  static adaptiveQuantizeAdPixels(pixels, width, height, imageType) {
    const type = imageType?.type || 'photo';
    const confidence = imageType?.confidence ?? 0.5;
    const sharpEdgeRatio = imageType?.sharpEdgeRatio ?? 0;

    // 图形/卡通类优先关闭抖动，减少文字与边缘失真
    if (type === 'graphic' || type === 'cartoon' || sharpEdgeRatio > 0.45) {
      logger.info(`🎯 量化策略: 无抖动 (type=${type}, confidence=${confidence.toFixed(2)}, sharpEdge=${sharpEdgeRatio.toFixed(2)})`);
      return this.quantizePixelsTo256Colors(pixels);
    }

    // 照片类保留抖动以提升渐变
    logger.info(`🎯 量化策略: Lab+Floyd-Steinberg (type=${type}, confidence=${confidence.toFixed(2)}, sharpEdge=${sharpEdgeRatio.toFixed(2)})`);
    return this.quantizeWithDithering256(pixels, width, height);
  }

  /**
   * 将像素数据转换为像素点集合
   * @param {Array} pixelData - 像素数据数组
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Array} 像素点集合
   */
  static convertToPixelPoints(pixelData, width, height) {
    const pixelPoints = [];
    let totalPixels = 0;
    let transparentPixels = 0;
    let includedPixels = 0;

    logger.info(`🔍 开始转换像素点: ${width}x${height}, 总像素数据: ${pixelData.length}`);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        totalPixels++;

        if (pixelIndex < pixelData.length) {
          const pixel = pixelData[pixelIndex];

          // 🔧 优化：更智能的透明度处理
          // 对于广告图片，我们只过滤完全透明的像素，保留所有有颜色的像素
          if (pixel.a > 0) {
            pixelPoints.push({
              x: x,
              y: y,
              color: pixel.color
            });
            includedPixels++;
          } else {
            transparentPixels++;
            // 只在调试模式下输出详细信息
            if (process.env.NODE_ENV === 'development') {
              logger.info(`🚫 跳过完全透明像素: (${x}, ${y}), a=${pixel.a}, color=${pixel.color}`);
            }
          }
        } else {
          logger.info(`❌ 像素索引超出范围: (${x}, ${y}), index=${pixelIndex}, max=${pixelData.length}`);
        }
      }
    }

    logger.info('📊 像素转换统计:');
    logger.info(`  总像素位置: ${totalPixels}`);
    logger.info(`  包含的像素: ${includedPixels}`);
    logger.info(`  透明像素: ${transparentPixels}`);
    logger.info(`  缺失像素: ${totalPixels - includedPixels - transparentPixels}`);

    return pixelPoints;
  }

  /**
   * ✅ 生成256色调色板
   */
  static generate256ColorPalette() {
    const palette = [];
    const rgbLevels = [0, 51, 102, 153, 204, 255];

    for (const r of rgbLevels) {
      for (const g of rgbLevels) {
        for (const b of rgbLevels) {
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
          palette.push({ r, g, b, hex });
        }
      }
    }

    for (let i = 0; i < 40; i++) {
      const gray = Math.floor((i / 39) * 255);
      const hex = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`.toUpperCase();
      palette.push({ r: gray, g: gray, b: gray, hex });
    }

    return palette;
  }

  /**
   * ✅ 正确的 sRGB → CIE Lab 颜色空间转换
   * 用于感知均匀的颜色距离计算，比 RGB 加权距离准确得多
   * @param {number} r - 红色值 (0-255)
   * @param {number} g - 绿色值 (0-255)
   * @param {number} b - 蓝色值 (0-255)
   * @returns {Object} Lab色彩空间值 {L, a, b}
   */
  static sRgbToLab(r, g, b) {
    // sRGB → linear RGB (gamma decode)
    let rl = r / 255;
    let gl = g / 255;
    let bl = b / 255;

    rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
    gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
    bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

    // linear RGB → XYZ (D65 reference white)
    const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
    const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750);
    const z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

    // XYZ → Lab
    const f = v => v > 0.008856 ? Math.cbrt(v) : (7.787 * v + 16 / 116);
    return {
      L: 116 * f(y) - 16,
      a: 500 * (f(x) - f(y)),
      b: 200 * (f(y) - f(z))
    };
  }

  /**
   * ✅ 生成256色调色板并缓存 Lab 值（惰性初始化，仅计算一次）
   * @returns {Array} 去重后的调色板，每项含 {r, g, b, hex, L, a, bLab}
   */
  static get256PaletteWithLab() {
    if (this._palette256Lab) return this._palette256Lab;

    const raw = this.generate256ColorPalette();
    const seen = new Set();
    const palette = [];

    for (const c of raw) {
      if (!seen.has(c.hex)) {
        seen.add(c.hex);
        const lab = this.sRgbToLab(c.r, c.g, c.b);
        palette.push({ r: c.r, g: c.g, b: c.b, hex: c.hex, L: lab.L, a: lab.a, bLab: lab.b });
      }
    }

    this._palette256Lab = palette;
    logger.info(`📊 256色Lab调色板已缓存: ${palette.length}种唯一颜色`);
    return palette;
  }

  /**
   * ✅ 使用 Lab 感知色距找到256色调色板中最接近的颜色
   * @param {number} r - 红色值 (0-255)
   * @param {number} g - 绿色值 (0-255)
   * @param {number} b - 蓝色值 (0-255)
   * @returns {Object} 最接近的调色板颜色 {r, g, b, hex, L, a, bLab}
   */
  static findNearest256ColorLab(r, g, b) {
    const palette = this.get256PaletteWithLab();
    const lab = this.sRgbToLab(r, g, b);

    let minDist = Infinity;
    let nearest = palette[0];

    for (const entry of palette) {
      const dL = lab.L - entry.L;
      const da = lab.a - entry.a;
      const db = lab.b - entry.bLab;
      const dist = dL * dL + da * da + db * db;
      if (dist < minDist) {
        minDist = dist;
        nearest = entry;
      }
    }

    return nearest;
  }

  /**
   * ✅ Floyd-Steinberg 抖动 + Lab 感知量化到256色
   * 核心算法改进：
   * 1. CIE Lab 色彩空间最近色匹配（感知均匀，比 RGB 加权距离准确得多）
   * 2. Floyd-Steinberg 误差扩散（用相邻像素的交替色彩模拟中间色）
   * 3. Float64 精度缓冲区（避免误差扩散的浮点截断累积）
   * 4. 调色板 Lab 值一次性缓存（避免重复转换）
   * @param {Array} pixels - 像素数据数组 [{r, g, b, a, color, x, y}, ...]
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Array} 量化后的像素数据数组
   */
  static quantizeWithDithering256(pixels, width, height) {
    logger.info(`🎨 开始 Lab + Floyd-Steinberg 量化: ${width}x${height}, ${pixels.length}像素`);

    const total = width * height;

    // Float64 缓冲区保存误差扩散后的 RGB 值（精度远高于整数）
    const rBuf = new Float64Array(total);
    const gBuf = new Float64Array(total);
    const bBuf = new Float64Array(total);

    for (let i = 0; i < total; i++) {
      rBuf[i] = pixels[i].r;
      gBuf[i] = pixels[i].g;
      bBuf[i] = pixels[i].b;
    }

    const result = new Array(total);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        // 钳制到 [0, 255]（误差扩散可导致越界）
        const cr = Math.max(0, Math.min(255, Math.round(rBuf[idx])));
        const cg = Math.max(0, Math.min(255, Math.round(gBuf[idx])));
        const cb = Math.max(0, Math.min(255, Math.round(bBuf[idx])));

        // Lab 感知最近色匹配
        const nearest = this.findNearest256ColorLab(cr, cg, cb);

        // 量化误差（在 RGB 空间中扩散）
        const errR = cr - nearest.r;
        const errG = cg - nearest.g;
        const errB = cb - nearest.b;

        // 写入量化结果
        result[idx] = {
          ...pixels[idx],
          r: nearest.r,
          g: nearest.g,
          b: nearest.b,
          color: nearest.hex
        };

        // Floyd-Steinberg 误差扩散到相邻像素
        //   * 7/16 → 右
        //   * 3/16 → 左下
        //   * 5/16 → 正下
        //   * 1/16 → 右下
        if (x + 1 < width) {
          const ni = idx + 1;
          rBuf[ni] += errR * 0.4375;
          gBuf[ni] += errG * 0.4375;
          bBuf[ni] += errB * 0.4375;
        }
        if (y + 1 < height) {
          if (x - 1 >= 0) {
            const ni = idx + width - 1;
            rBuf[ni] += errR * 0.1875;
            gBuf[ni] += errG * 0.1875;
            bBuf[ni] += errB * 0.1875;
          }
          {
            const ni = idx + width;
            rBuf[ni] += errR * 0.3125;
            gBuf[ni] += errG * 0.3125;
            bBuf[ni] += errB * 0.3125;
          }
          if (x + 1 < width) {
            const ni = idx + width + 1;
            rBuf[ni] += errR * 0.0625;
            gBuf[ni] += errG * 0.0625;
            bBuf[ni] += errB * 0.0625;
          }
        }
      }
    }

    // 统计量化效果
    const originalColors = new Set(pixels.map(p => p.color));
    const quantizedColors = new Set(result.map(p => p.color));
    logger.info(`📊 Lab+FS量化结果: ${originalColors.size}种原色 → ${quantizedColors.size}种调色板色`);

    return result;
  }

  /**
   * ✅ 颜色量化到256色（用于广告图片）
   */
  static quantizeColorTo256(r, g, b) {
    const palette = this.generate256ColorPalette();
    let minDistance = Infinity;
    let closestColor = palette[0];

    for (const color of palette) {
      const distance =
        Math.pow(r - color.r, 2) * 0.30 +
        Math.pow(g - color.g, 2) * 0.59 +
        Math.pow(b - color.b, 2) * 0.11;

      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color;
      }
    }

    return closestColor.hex;
  }

  /**
   * ✅ 批量量化像素数组到256色
   * @param {Array} pixelData - 像素数据数组
   * @returns {Array} 量化后的像素数据数组
   */
  static quantizePixelsTo256Colors(pixelData) {
    logger.info(`🎨 批量量化${pixelData.length}个像素到256色调色板...`);

    const quantizedPixels = pixelData.map(pixel => ({
      ...pixel,
      color: this.quantizeColorTo256(pixel.r, pixel.g, pixel.b)
    }));

    // 统计量化效果
    const originalColors = new Set(pixelData.map(p => p.color));
    const quantizedColors = new Set(quantizedPixels.map(p => p.color));
    logger.info(`📊 量化结果: ${originalColors.size}种颜色 → ${quantizedColors.size}种颜色 (压缩率: ${((1 - quantizedColors.size / originalColors.size) * 100).toFixed(1)}%)`);

    return quantizedPixels;
  }

  /**
   * 🔧 修复：自适应颜色量化 - 为用户自定义旗帜保留更多颜色细节
   * @param {number} r - 红色值 (0-255)
   * @param {number} g - 绿色值 (0-255)
   * @param {number} b - 蓝色值 (0-255)
   * @returns {string} 量化后的十六进制颜色
   */
  static quantizeColor(r, g, b) {
    // 🎨 为用户自定义旗帜使用改进的颜色量化算法
    return this.quantizeColorAdaptive(r, g, b);
  }

  /**
   * 🔧 新增：自适应颜色量化算法 - 保留用户上传图片的更多颜色细节
   * @param {number} r - 红色值 (0-255)
   * @param {number} g - 绿色值 (0-255)
   * @param {number} b - 蓝色值 (0-255)
   * @returns {string} 量化后的十六进制颜色
   */
  static quantizeColorAdaptive(r, g, b) {
    // 使用更精细的调色板：8x8x8 = 512种颜色，而不是6x6x6 = 216种
    const rgbLevels = [0, 36, 72, 108, 144, 180, 216, 255]; // 8个级别而不是6个

    // 找到最接近的颜色级别
    const nearestR = rgbLevels.reduce((prev, curr) => Math.abs(curr - r) < Math.abs(prev - r) ? curr : prev);
    const nearestG = rgbLevels.reduce((prev, curr) => Math.abs(curr - g) < Math.abs(prev - g) ? curr : prev);
    const nearestB = rgbLevels.reduce((prev, curr) => Math.abs(curr - b) < Math.abs(prev - b) ? curr : prev);

    return `#${nearestR.toString(16).padStart(2, '0')}${nearestG.toString(16).padStart(2, '0')}${nearestB.toString(16).padStart(2, '0')}`;
  }

  /**
   * 🔧 新增：自适应抖动算法 - 保留更多颜色细节，减少失真
   * @param {Array} pixels - 像素数据数组
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Array} 抖动后的像素数据
   */
  static applyAdaptiveColorQuantization(pixels, width, height) {
    logger.info(`🎨 开始自适应颜色量化: ${width}x${height}`);

    // 首先分析图像的主要颜色，创建自适应调色板
    const adaptivePalette = this.createAdaptivePalette(pixels);
    logger.info(`📊 生成了${adaptivePalette.length}种颜色的自适应调色板`);

    const processedPixels = [...pixels];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const pixel = processedPixels[index];

        if (!pixel || index >= pixels.length) continue;

        // 使用自适应调色板进行量化
        const quantizedColor = this.findNearestColor(pixel.r, pixel.g, pixel.b, adaptivePalette);
        const quantizedRgb = this.hexToRgb(quantizedColor);

        // 计算误差
        const errorR = pixel.r - quantizedRgb.r;
        const errorG = pixel.g - quantizedRgb.g;
        const errorB = pixel.b - quantizedRgb.b;

        // ✅ 修复：在新方案中，确保颜色格式一致性
        // 如果原始像素有特殊的alpha值（非完全不透明），需要在颜色中保留alpha信息
        let finalColor = quantizedColor;
        if (pixel.a < 255 && pixel.a > 0) {
          // 对于半透明像素，使用RGBA格式以保持alpha信息
          finalColor = `#${quantizedRgb.r.toString(16).padStart(2, '0')}${quantizedRgb.g.toString(16).padStart(2, '0')}${quantizedRgb.b.toString(16).padStart(2, '0')}${pixel.a.toString(16).padStart(2, '0')}`;
        }

        // 更新当前像素
        processedPixels[index] = {
          ...pixel,
          r: quantizedRgb.r,
          g: quantizedRgb.g,
          b: quantizedRgb.b,
          color: finalColor
        };

        // 扩散误差到邻近像素
        this.diffuseError(processedPixels, x, y, width, height, errorR, errorG, errorB);
      }
    }

    logger.info('✅ 自适应颜色量化完成');
    return processedPixels;
  }

  /**
   * 🔧 新增：创建自适应调色板 - 基于图像的主要颜色
   * @param {Array} pixels - 像素数据数组
   * @returns {Array} 调色板颜色数组
   */
  static createAdaptivePalette(pixels) {
    // 统计颜色频率
    const colorMap = new Map();
    for (const pixel of pixels) {
      if (pixel && pixel.a > 128) {
        const key = `${Math.round(pixel.r / 8) * 8},${Math.round(pixel.g / 8) * 8},${Math.round(pixel.b / 8) * 8}`;
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }
    }

    // 提取最常见的颜色作为调色板基础
    const baseColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 64) // 取前64种主要颜色
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number);
        return { r, g, b };
      });

    // 扩展调色板，确保颜色分布均匀
    const palette = [];

    // 添加主要颜色
    for (const color of baseColors) {
      palette.push(color);
    }

    // 添加灰度级别
    for (let i = 0; i < 16; i++) {
      const gray = Math.round((i / 15) * 255);
      palette.push({ r: gray, g: gray, b: gray });
    }

    // 确保调色板大小合理
    return palette.slice(0, 512); // 最多512种颜色
  }

  /**
   * 🔧 新增：在自适应调色板中找到最近的颜色
   * @param {number} r - 红色值
   * @param {number} g - 绿色值
   * @param {number} b - 蓝色值
   * @param {Array} palette - 调色板
   * @returns {string} 十六进制颜色
   */
  static findNearestColor(r, g, b, palette) {
    if (palette.length === 0) {
      return '#808080';
    }

    let minDistance = Infinity;
    let nearestColor = palette[0];

    for (const color of palette) {
      const distance =
        Math.pow(r - color.r, 2) * 0.30 +
        Math.pow(g - color.g, 2) * 0.59 +
        Math.pow(b - color.b, 2) * 0.11;

      if (distance < minDistance) {
        minDistance = distance;
        nearestColor = color;
      }
    }

    return `#${nearestColor.r.toString(16).padStart(2, '0')}${nearestColor.g.toString(16).padStart(2, '0')}${nearestColor.b.toString(16).padStart(2, '0')}`;
  }

  /**
   * 将十六进制颜色转换为RGB
   * @param {string} hex - 十六进制颜色
   * @returns {Object} RGB对象
   */
  static hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Floyd-Steinberg抖动算法
   * 改善颜色过渡，减少颜色条带效应
   * @param {Array} pixels - 像素数据数组
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Array} 抖动后的像素数据
   */
  static applyFloydSteinbergDithering(pixels, width, height) {
    const ditheredPixels = [...pixels];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const pixel = ditheredPixels[index];

        if (!pixel || index >= pixels.length) continue;

        // 量化颜色
        const quantizedColor = this.quantizeColor(pixel.r, pixel.g, pixel.b);
        const quantizedRgb = this.hexToRgb(quantizedColor);

        // 计算误差
        const errorR = pixel.r - quantizedRgb.r;
        const errorG = pixel.g - quantizedRgb.g;
        const errorB = pixel.b - quantizedRgb.b;

        // 更新当前像素
        ditheredPixels[index] = {
          ...pixel,
          r: quantizedRgb.r,
          g: quantizedRgb.g,
          b: quantizedRgb.b,
          color: quantizedColor
        };

        // 扩散误差到邻近像素
        this.diffuseError(ditheredPixels, x, y, width, height, errorR, errorG, errorB);
      }
    }

    return ditheredPixels;
  }

  /**
   * 扩散误差到邻近像素
   * @param {Array} pixels - 像素数据数组
   * @param {number} x - 当前像素x坐标
   * @param {number} y - 当前像素y坐标
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @param {number} errorR - 红色误差
   * @param {number} errorG - 绿色误差
   * @param {number} errorB - 蓝色误差
   */
  static diffuseError(pixels, x, y, width, height, errorR, errorG, errorB) {
    const diffusionMatrix = [
      { dx: 1, dy: 0, factor: 7 / 16 },
      { dx: -1, dy: 1, factor: 3 / 16 },
      { dx: 0, dy: 1, factor: 5 / 16 },
      { dx: 1, dy: 1, factor: 1 / 16 }
    ];

    diffusionMatrix.forEach(({ dx, dy, factor }) => {
      const newX = x + dx;
      const newY = y + dy;

      if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
        const index = newY * width + newX;
        const pixel = pixels[index];

        if (pixel) {
          pixels[index] = {
            ...pixel,
            r: Math.max(0, Math.min(255, pixel.r + errorR * factor)),
            g: Math.max(0, Math.min(255, pixel.g + errorG * factor)),
            b: Math.max(0, Math.min(255, pixel.b + errorB * factor))
          };
        }
      }
    });
  }

  /**
   * 优化后的像素点转换函数
   * @param {Array} pixelData - 像素数据数组
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Array} 像素点集合
   */
  static convertToPixelPointsOptimized(pixelData, width, height) {
    const pixelPoints = [];
    let totalPixels = 0;
    let transparentPixels = 0;
    let includedPixels = 0;

    logger.info(`🔍 开始优化转换像素点: ${width}x${height}, 总像素数据: ${pixelData.length}`);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        totalPixels++;

        if (pixelIndex < pixelData.length) {
          const pixel = pixelData[pixelIndex];

          if (pixel && pixel.a > 30) { // 检查像素存在且不透明
            pixelPoints.push({
              x: x,
              y: y,
              color: pixel.color
            });
            includedPixels++;
          } else {
            transparentPixels++;
          }
        } else {
          logger.info(`❌ 像素索引超出范围: (${x}, ${y}), index=${pixelIndex}, max=${pixelData.length}`);
        }
      }
    }

    logger.info('📊 优化像素转换统计:');
    logger.info(`  总像素位置: ${totalPixels}`);
    logger.info(`  包含的像素: ${includedPixels}`);
    logger.info(`  透明像素: ${transparentPixels}`);
    logger.info(`  缺失像素: ${totalPixels - includedPixels - transparentPixels}`);

    return pixelPoints;
  }

  /**
   * ✅ 主颜色采样算法 - 用于像素艺术的最佳实践
   * 对每个目标像素位置，计算原始图片中对应矩形块的主要颜色（最频繁出现的颜色）
   * 这种方法保留原始颜色块，而不会像平均那样导致颜色混合
   * @param {Buffer} imageData - 原始图片像素数据
   * @param {number} originalWidth - 原始图片宽度
   * @param {number} originalHeight - 原始图片高度
   * @param {number} targetWidth - 目标宽度
   * @param {number} targetHeight - 目标高度
   * @returns {Array} 主颜色采样后的像素数据
   */
  static pixelateImageWithDominantColor(imageData, originalWidth, originalHeight, targetWidth, targetHeight) {
    logger.info(`🎨 开始主颜色采样处理: ${originalWidth}x${originalHeight} -> ${targetWidth}x${targetHeight}`);

    const pixelatedData = [];

    // 计算每个目标像素对应的原始图片块大小
    const blockWidth = originalWidth / targetWidth;
    const blockHeight = originalHeight / targetHeight;

    for (let targetY = 0; targetY < targetHeight; targetY++) {
      for (let targetX = 0; targetX < targetWidth; targetX++) {
        // 计算当前目标像素在原始图片中对应的矩形块范围
        const startX = Math.floor(targetX * blockWidth);
        const endX = Math.floor((targetX + 1) * blockWidth);
        const startY = Math.floor(targetY * blockHeight);
        const endY = Math.floor((targetY + 1) * blockHeight);

        // 统计块内所有颜色的出现频率
        const colorFrequency = {};
        let totalAlpha = 0;
        let pixelCount = 0;

        for (let y = startY; y < endY && y < originalHeight; y++) {
          for (let x = startX; x < endX && x < originalWidth; x++) {
            const pixelIndex = (y * originalWidth + x) * 4;
            if (pixelIndex + 3 < imageData.length) {
              const r = imageData[pixelIndex];
              const g = imageData[pixelIndex + 1];
              const b = imageData[pixelIndex + 2];
              const a = imageData[pixelIndex + 3];

              // 将颜色转换为唯一的键
              const colorKey = `${r},${g},${b},${a}`;

              // 计数该颜色
              colorFrequency[colorKey] = (colorFrequency[colorKey] || 0) + 1;
              totalAlpha += a;
              pixelCount++;
            }
          }
        }

        // 找到最频繁出现的颜色（主颜色）
        let dominantColorKey = null;
        let maxFrequency = 0;

        for (const [colorKey, frequency] of Object.entries(colorFrequency)) {
          if (frequency > maxFrequency) {
            maxFrequency = frequency;
            dominantColorKey = colorKey;
          }
        }

        // 如果没有找到颜色（不太可能），使用默认灰色
        if (!dominantColorKey) {
          pixelatedData.push({
            r: 128,
            g: 128,
            b: 128,
            a: 255,
            color: '#808080',
            x: targetX,
            y: targetY
          });
          continue;
        }

        // 解析主颜色的RGB值
        const [r, g, b, a] = dominantColorKey.split(',').map(Number);

        // 转换为十六进制颜色
        const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

        pixelatedData.push({
          r,
          g,
          b,
          a: pixelCount > 0 ? Math.round(totalAlpha / pixelCount) : 255,
          color: color,
          x: targetX,
          y: targetY
        });
      }
    }

    logger.info(`✅ 主颜色采样处理完成: ${pixelatedData.length}个像素`);
    return pixelatedData;
  }

  /**
   * 块平均算法 - 基于演示demo的核心实现
   * 对每个目标像素位置，计算原始图片中对应矩形块的平均颜色
   * @param {Buffer} imageData - 原始图片像素数据
   * @param {number} originalWidth - 原始图片宽度
   * @param {number} originalHeight - 原始图片高度
   * @param {number} targetWidth - 目标宽度
   * @param {number} targetHeight - 目标高度
   * @returns {Array} 像素化后的数据
   */
  static pixelateImageWithBlockAveraging(imageData, originalWidth, originalHeight, targetWidth, targetHeight) {
    logger.info(`🎨 开始块平均处理: ${originalWidth}x${originalHeight} -> ${targetWidth}x${targetHeight}`);

    const pixelatedData = [];

    // 计算每个目标像素对应的原始图片块大小
    const blockWidth = originalWidth / targetWidth;
    const blockHeight = originalHeight / targetHeight;

    for (let targetY = 0; targetY < targetHeight; targetY++) {
      for (let targetX = 0; targetX < targetWidth; targetX++) {
        // 计算当前目标像素在原始图片中对应的矩形块范围
        const startX = Math.floor(targetX * blockWidth);
        const endX = Math.floor((targetX + 1) * blockWidth);
        const startY = Math.floor(targetY * blockHeight);
        const endY = Math.floor((targetY + 1) * blockHeight);

        // 计算块内所有像素的平均颜色
        let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
        let pixelCount = 0;

        for (let y = startY; y < endY && y < originalHeight; y++) {
          for (let x = startX; x < endX && x < originalWidth; x++) {
            const pixelIndex = (y * originalWidth + x) * 4;
            if (pixelIndex + 3 < imageData.length) {
              totalR += imageData[pixelIndex];
              totalG += imageData[pixelIndex + 1];
              totalB += imageData[pixelIndex + 2];
              totalA += imageData[pixelIndex + 3];
              pixelCount++;
            }
          }
        }

        // 计算平均颜色
        const avgR = pixelCount > 0 ? Math.round(totalR / pixelCount) : 0;
        const avgG = pixelCount > 0 ? Math.round(totalG / pixelCount) : 0;
        const avgB = pixelCount > 0 ? Math.round(totalB / pixelCount) : 0;
        const avgA = pixelCount > 0 ? Math.round(totalA / pixelCount) : 0;

        // 转换为十六进制颜色
        const color = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;

        pixelatedData.push({
          r: avgR,
          g: avgG,
          b: avgB,
          a: avgA,
          color: color,
          x: targetX,
          y: targetY
        });
      }
    }

    logger.info(`✅ 块平均处理完成: ${pixelatedData.length}个像素`);
    return pixelatedData;
  }

  /**
   * 高级Floyd-Steinberg抖动算法 - 基于演示demo的改进版本
   * @param {Array} pixels - 像素数据数组
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Array} 抖动后的像素数据
   */
  static applyFloydSteinbergDitheringAdvanced(pixels, width, height) {
    logger.info(`🌊 开始高级抖动处理: ${width}x${height}`);

    // 创建像素网格用于抖动处理
    const pixelGrid = [];
    for (let y = 0; y < height; y++) {
      pixelGrid[y] = [];
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        pixelGrid[y][x] = pixels[index] ? { ...pixels[index] } : { r: 0, g: 0, b: 0, a: 0, color: '#000000' };
      }
    }

    // 应用Floyd-Steinberg抖动 - 对所有广告图片使用，提升细节还原度
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = pixelGrid[y][x];
        if (!pixel || pixel.a < 30) continue; // 跳过透明像素

        // ✅ 量化颜色到256色调色板（用于广告图片）
        const quantizedColor = this.quantizeColorTo256(pixel.r, pixel.g, pixel.b);
        const quantizedRgb = this.hexToRgb(quantizedColor);

        // 计算量化误差
        const errorR = pixel.r - quantizedRgb.r;
        const errorG = pixel.g - quantizedRgb.g;
        const errorB = pixel.b - quantizedRgb.b;

        // 更新当前像素
        pixelGrid[y][x] = {
          ...pixel,
          r: quantizedRgb.r,
          g: quantizedRgb.g,
          b: quantizedRgb.b,
          color: quantizedColor
        };

        // ✅ 扩散误差到邻近像素（对所有图片使用抖动）
        this.diffuseErrorAdvanced(pixelGrid, x, y, width, height, errorR, errorG, errorB);
      }
    }

    // 转换回一维数组
    const ditheredPixels = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ditheredPixels.push(pixelGrid[y][x]);
      }
    }

    logger.info(`✅ 高级抖动处理完成`);
    return ditheredPixels;
  }

  /**
   * 高级误差扩散算法
   * @param {Array} pixelGrid - 像素网格
   * @param {number} x - 当前像素x坐标
   * @param {number} y - 当前像素y坐标
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @param {number} errorR - 红色误差
   * @param {number} errorG - 绿色误差
   * @param {number} errorB - 蓝色误差
   */
  static diffuseErrorAdvanced(pixelGrid, x, y, width, height, errorR, errorG, errorB) {
    // Floyd-Steinberg扩散矩阵
    const diffusionMatrix = [
      { dx: 1, dy: 0, factor: 7 / 16 },   // 右
      { dx: -1, dy: 1, factor: 3 / 16 },  // 左下
      { dx: 0, dy: 1, factor: 5 / 16 },   // 下
      { dx: 1, dy: 1, factor: 1 / 16 }    // 右下
    ];

    diffusionMatrix.forEach(({ dx, dy, factor }) => {
      const newX = x + dx;
      const newY = y + dy;

      if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
        const pixel = pixelGrid[newY][newX];
        if (pixel && pixel.a > 30) { // 只对不透明像素扩散误差
          pixelGrid[newY][newX] = {
            ...pixel,
            r: Math.max(0, Math.min(255, pixel.r + errorR * factor)),
            g: Math.max(0, Math.min(255, pixel.g + errorG * factor)),
            b: Math.max(0, Math.min(255, pixel.b + errorB * factor))
          };
        }
      }
    });
  }

  /**
   * 高级像素点转换函数 - 确保完整性和准确性
   * 对于广告图片，包含所有像素（包括透明像素）以确保网格完整性
   * @param {Array} pixelData - 像素数据数组
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Array} 像素点集合
   */
  static convertToPixelPointsAdvanced(pixelData, width, height, options = {}) {
    logger.info(`🔍 开始高级像素点转换: ${width}x${height}`);

    const pixelPoints = [];
    let totalPixels = 0;
    let includedPixels = 0;
    let transparentPixels = 0;
    const forceOpaque = options.forceOpaque === true;
    const transparentColor = options.transparentColor || '#FFFFFF';

    // 确保处理所有像素位置
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        totalPixels++;
        const index = y * width + x;

        if (index < pixelData.length) {
          const pixel = pixelData[index];

          if (pixel) {
            // ✅ 修复：包含所有像素，不跳过透明像素
            // 广告图片可强制忽略透明度，避免深色区域被误判为透明
            const finalColor = forceOpaque ? pixel.color : (pixel.a > 30 ? pixel.color : transparentColor);

            pixelPoints.push({
              x: x,
              y: y,
              color: finalColor
            });

            if (forceOpaque || pixel.a > 30) {
              includedPixels++;
            } else {
              transparentPixels++;
            }
          }
        } else {
          logger.warn(`⚠️ 像素索引超出范围: (${x}, ${y}), index=${index}`);
        }
      }
    }

    logger.info('📊 高级像素转换统计:');
    logger.info(`  总像素位置: ${totalPixels}`);
    logger.info(`  生成的像素: ${pixelPoints.length}`);
    logger.info(`  不透明像素: ${includedPixels}`);
    logger.info(`  透明像素(用白色填充): ${transparentPixels}`);
    logger.info(`  缺失像素: ${totalPixels - pixelPoints.length}`);

    return pixelPoints;
  }

  /**
   * 高质量块平均算法 - 基于测试页面的最佳实践
   * 对每个目标像素位置，计算原始图片中对应矩形块的平均颜色
   * @param {Buffer} imageData - 原始图片像素数据
   * @param {number} originalWidth - 原始图片宽度
   * @param {number} originalHeight - 原始图片高度
   * @param {number} targetWidth - 目标宽度
   * @param {number} targetHeight - 目标高度
   * @returns {Array} 块平均后的像素数据
   */
  static pixelateImageWithBlockAveraging(imageData, originalWidth, originalHeight, targetWidth, targetHeight) {
    logger.info(`🎨 开始高质量块平均处理: ${originalWidth}x${originalHeight} -> ${targetWidth}x${targetHeight}`);

    const pixelatedData = [];

    // 计算每个目标像素对应的原始图片块大小
    const blockWidth = originalWidth / targetWidth;
    const blockHeight = originalHeight / targetHeight;

    for (let targetY = 0; targetY < targetHeight; targetY++) {
      for (let targetX = 0; targetX < targetWidth; targetX++) {
        // 计算当前目标像素在原始图片中对应的矩形块范围
        const startX = Math.floor(targetX * blockWidth);
        const endX = Math.floor((targetX + 1) * blockWidth);
        const startY = Math.floor(targetY * blockHeight);
        const endY = Math.floor((targetY + 1) * blockHeight);

        // 计算块内所有像素的平均颜色
        let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
        let pixelCount = 0;

        for (let y = startY; y < endY && y < originalHeight; y++) {
          for (let x = startX; x < endX && x < originalWidth; x++) {
            const pixelIndex = (y * originalWidth + x) * 4;
            if (pixelIndex + 3 < imageData.length) {
              totalR += imageData[pixelIndex];
              totalG += imageData[pixelIndex + 1];
              totalB += imageData[pixelIndex + 2];
              totalA += imageData[pixelIndex + 3];
              pixelCount++;
            }
          }
        }

        // 计算平均颜色
        const avgR = pixelCount > 0 ? Math.round(totalR / pixelCount) : 0;
        const avgG = pixelCount > 0 ? Math.round(totalG / pixelCount) : 0;
        const avgB = pixelCount > 0 ? Math.round(totalB / pixelCount) : 0;
        const avgA = pixelCount > 0 ? Math.round(totalA / pixelCount) : 255;

        // 转换为十六进制颜色
        const color = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;

        pixelatedData.push({
          r: avgR,
          g: avgG,
          b: avgB,
          a: avgA,
          color: color,
          x: targetX,
          y: targetY
        });
      }
    }

    logger.info(`✅ 高质量块平均处理完成: ${pixelatedData.length}个像素`);
    return pixelatedData;
  }

  /**
   * 验证图片格式和大小
   * @param {string} imageData - base64图片数据
   * @returns {boolean} 是否有效
   */
  static validateImage(imageData) {
    try {
      const supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!imageData.startsWith('data:image/')) {
        return false;
      }

      const format = imageData.split(';')[0].split('/')[1];
      if (!supportedFormats.includes(format)) {
        return false;
      }

      const base64Data = imageData.split(',')[1];
      const size = (base64Data.length * 3) / 4; // base64解码后的大小

      return size <= maxSize;
    } catch (error) {
      logger.error('❌ 验证图片格式失败:', error);
      return false;
    }
  }

  /**
   * 🆕 像素画颜色量化 - 将块平均后的颜色量化到有限调色板
   * @param {Array} pixelData - 块平均后的像素数据
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @param {string} imageType - 图像类型
   * @returns {Array} 量化后的像素数据
   */
  static quantizePixelArtColors(pixelData, width, height, imageType) {
    try {
      // 统计颜色频率
      const colorFreq = new Map();
      for (const pixel of pixelData) {
        if (pixel && pixel.a > 128) {
          const key = `${pixel.r},${pixel.g},${pixel.b}`;
          colorFreq.set(key, (colorFreq.get(key) || 0) + 1);
        }
      }

      // 提取最常用的颜色作为调色板（16-64色）
      const paletteSize = imageType === 'cartoon' ? 16 : 32;
      const palette = Array.from(colorFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, paletteSize)
        .map(([key]) => {
          const [r, g, b] = key.split(',').map(Number);
          return { r, g, b };
        });

      logger.info(`✅ 从${colorFreq.size}种颜色提取${palette.length}色调色板`);

      // 将每个像素量化到最近的调色板颜色
      const quantized = [];
      for (const pixel of pixelData) {
        if (!pixel || pixel.a <= 128) {
          quantized.push({ r: 255, g: 255, b: 255, a: 0, color: '#FFFFFF' });
          continue;
        }

        // 找到最近的调色板颜色
        let minDist = Infinity;
        let nearest = palette[0];

        for (const paletteColor of palette) {
          const dist = this.colorDistance(pixel, paletteColor);
          if (dist < minDist) {
            minDist = dist;
            nearest = paletteColor;
          }
        }

        const hex = `#${nearest.r.toString(16).padStart(2, '0')}${nearest.g.toString(16).padStart(2, '0')}${nearest.b.toString(16).padStart(2, '0')}`;
        quantized.push({
          r: nearest.r,
          g: nearest.g,
          b: nearest.b,
          a: pixel.a,
          color: hex
        });
      }

      logger.info(`✅ 颜色量化完成`);
      return quantized;

    } catch (error) {
      logger.error('❌ 颜色量化失败:', error);
      return pixelData; // 失败时返回原数据
    }
  }

  /**
   * 🆕 在大图上简化卡通颜色（核心优化方法）
   * @param {Buffer} imageBuffer - 图片Buffer
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @param {number} colorCount - 保留的颜色数量
   * @returns {Buffer} 简化后的图片Buffer
   */
  static async simplifyCartoonColors(imageBuffer, width, height, colorCount = 32) {
    try {
      logger.info(`🎨 开始在${width}x${height}大图上简化颜色到${colorCount}色...`);

      // 提取像素数据（确保是RGBA 4通道）
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()  // 确保有alpha通道
        .raw()
        .toBuffer({ resolveWithObject: true });

      logger.info(`📊 提取像素数据: ${info.width}x${info.height}, ${info.channels}通道`);

      // 统计所有颜色及其出现频率
      const colorMap = new Map();
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a > 128) {  // 只统计不透明像素
          const key = `${r},${g},${b}`;
          colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }
      }

      // 提取最常用的颜色作为调色板
      const palette = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, colorCount)
        .map(([key, count]) => {
          const [r, g, b] = key.split(',').map(Number);
          return { r, g, b };
        });

      logger.info(`✅ 从${colorMap.size}种颜色中提取了${palette.length}种主要颜色`);

      // 将每个像素映射到最近的调色板颜色
      const newData = Buffer.alloc(info.width * info.height * 4);
      let outputIdx = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = info.channels === 4 ? data[i + 3] : 255;

        if (a > 128) {
          // 找到最近的调色板颜色
          let minDist = Infinity;
          let nearest = palette[0];

          for (const color of palette) {
            const dist = this.colorDistance({ r, g, b }, color);
            if (dist < minDist) {
              minDist = dist;
              nearest = color;
            }
          }

          newData[outputIdx] = nearest.r;
          newData[outputIdx + 1] = nearest.g;
          newData[outputIdx + 2] = nearest.b;
          newData[outputIdx + 3] = 255;
        } else {
          // 透明像素保持不变
          newData[outputIdx] = 255;
          newData[outputIdx + 1] = 255;
          newData[outputIdx + 2] = 255;
          newData[outputIdx + 3] = 0;
        }
        outputIdx += 4;
      }

      // 转换回图片Buffer
      const simplifiedBuffer = await sharp(newData, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4
        }
      })
        .png({ quality: 100 })
        .toBuffer();

      logger.info(`✅ 颜色简化完成`);
      return simplifiedBuffer;

    } catch (error) {
      logger.error('❌ 颜色简化失败:', error);
      return imageBuffer; // 失败时返回原图
    }
  }

  /**
   * 🆕 检测图像类型（卡通 vs 照片）
   * @param {Buffer} imageData - 原始图片像素数据
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Object} 图像类型信息
   */
  static detectImageType(imageData, width, height) {
    try {
      // 特征1: 颜色数量分析
      const colorSet = new Set();
      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const color = `${r},${g},${b}`;
        colorSet.add(color);
      }
      const uniqueColorCount = colorSet.size;
      const totalPixels = width * height;
      const colorDiversity = uniqueColorCount / totalPixels;

      // 特征2: 边缘锐度分析（检测清晰的色块边界）
      let sharpEdgeCount = 0;
      let totalEdges = 0;
      const edgeThreshold = 80; // 边缘阈值

      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          const idxRight = (y * width + (x + 1)) * 4;
          const idxDown = ((y + 1) * width + x) * 4;

          // 计算与右侧像素的色差
          const diffRight = Math.abs(imageData[idx] - imageData[idxRight]) +
            Math.abs(imageData[idx + 1] - imageData[idxRight + 1]) +
            Math.abs(imageData[idx + 2] - imageData[idxRight + 2]);

          // 计算与下方像素的色差
          const diffDown = Math.abs(imageData[idx] - imageData[idxDown]) +
            Math.abs(imageData[idx + 1] - imageData[idxDown + 1]) +
            Math.abs(imageData[idx + 2] - imageData[idxDown + 2]);

          totalEdges += 2;
          if (diffRight > edgeThreshold) sharpEdgeCount++;
          if (diffDown > edgeThreshold) sharpEdgeCount++;
        }
      }

      const sharpEdgeRatio = sharpEdgeCount / totalEdges;

      // 特征3: 颜色分布集中度（卡通图片颜色更集中）
      const colorCounts = {};
      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const color = `${r},${g},${b}`;
        colorCounts[color] = (colorCounts[color] || 0) + 1;
      }

      const sortedCounts = Object.values(colorCounts).sort((a, b) => b - a);
      const top10ColorsCoverage = sortedCounts.slice(0, 10).reduce((sum, count) => sum + count, 0) / totalPixels;

      // 决策逻辑
      let type = 'photo';
      let confidence = 0;

      logger.info(`📊 图像特征分析:`);
      logger.info(`  - 颜色多样性: ${colorDiversity.toFixed(4)} (${uniqueColorCount}/${totalPixels})`);
      logger.info(`  - 锐利边缘比例: ${sharpEdgeRatio.toFixed(4)}`);
      logger.info(`  - Top10颜色覆盖率: ${top10ColorsCoverage.toFixed(4)}`);

      // 卡通图片特征：低颜色多样性、高锐利边缘、高颜色集中度
      // 调整阈值以更好地识别卡通图片
      if (colorDiversity < 0.20 && sharpEdgeRatio > 0.40) {
        type = 'cartoon';
        confidence = 0.9;
      } else if (colorDiversity < 0.35 && (sharpEdgeRatio > 0.30 || top10ColorsCoverage > 0.6)) {
        type = 'graphic';
        confidence = 0.75;
      } else {
        type = 'photo';
        confidence = 0.6;
      }

      return {
        type,
        confidence,
        sharpEdgeRatio,
        colorDiversity,
        top10ColorsCoverage
      };

    } catch (error) {
      logger.error('❌ 图像类型检测失败:', error);
      return {
        type: 'photo',
        confidence: 0.5,
        sharpEdgeRatio: 0,
        colorDiversity: 0,
        top10ColorsCoverage: 0
      }; // 默认作为照片处理
    }
  }

  /**
   * 🆕 卡通图像专用处理（颜色聚合 + 简化）
   * @param {Array} pixelData - 像素数据数组
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   * @returns {Array} 处理后的像素数据
   */
  static processCartoonImage(pixelData, width, height) {
    logger.info(`🎨 卡通图像处理: 颜色聚合简化`);

    // 步骤1: 统计颜色并按频率排序
    const colorCounts = {};
    for (const pixel of pixelData) {
      if (pixel && pixel.a > 30) {
        const key = `${pixel.r},${pixel.g},${pixel.b}`;
        if (!colorCounts[key]) {
          colorCounts[key] = { count: 0, r: pixel.r, g: pixel.g, b: pixel.b };
        }
        colorCounts[key].count++;
      }
    }

    // 步骤2: 提取主要颜色（出现频率高的颜色）
    const sortedColors = Object.values(colorCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 64); // 保留前64种最常用的颜色

    logger.info(`🎨 从${Object.keys(colorCounts).length}种颜色中提取了${sortedColors.length}种主要颜色`);

    // 步骤3: 将每个像素映射到最近的主要颜色
    const processedPixels = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const pixel = pixelData[index];

        if (!pixel || pixel.a <= 30) {
          processedPixels.push({ r: 255, g: 255, b: 255, a: 0, color: '#FFFFFF' });
          continue;
        }

        // 找到最近的主要颜色
        let minDist = Infinity;
        let nearestColor = sortedColors[0];

        for (const mainColor of sortedColors) {
          const dist = this.colorDistance(pixel, mainColor);
          if (dist < minDist) {
            minDist = dist;
            nearestColor = mainColor;
          }
        }

        const hex = `#${nearestColor.r.toString(16).padStart(2, '0')}${nearestColor.g.toString(16).padStart(2, '0')}${nearestColor.b.toString(16).padStart(2, '0')}`;

        processedPixels.push({
          r: nearestColor.r,
          g: nearestColor.g,
          b: nearestColor.b,
          a: pixel.a,
          color: hex
        });
      }
    }

    logger.info(`✅ 卡通图像处理完成: ${processedPixels.length}个像素`);
    return processedPixels;
  }

  /**
   * 🆕 K-means颜色聚类算法
   * @param {Array} pixelData - 像素数据数组
   * @param {number} k - 聚类数量
   * @returns {Array} 调色板颜色数组
   */
  static kMeansColorClustering(pixelData, k) {
    // 过滤有效像素（非透明）
    const validPixels = pixelData.filter(p => p && p.a > 30);
    if (validPixels.length === 0) {
      return [{ r: 255, g: 255, b: 255, hex: '#FFFFFF' }];
    }

    // 初始化聚类中心（随机选择k个像素）
    const centroids = [];
    const step = Math.floor(validPixels.length / k);
    for (let i = 0; i < k && i * step < validPixels.length; i++) {
      const pixel = validPixels[i * step];
      centroids.push({ r: pixel.r, g: pixel.g, b: pixel.b });
    }

    // 迭代优化（最多10次）
    const maxIterations = 10;
    for (let iter = 0; iter < maxIterations; iter++) {
      // 分配像素到最近的聚类中心
      const clusters = Array.from({ length: centroids.length }, () => []);

      for (const pixel of validPixels) {
        let minDist = Infinity;
        let nearestCluster = 0;

        for (let i = 0; i < centroids.length; i++) {
          const dist = this.colorDistance(pixel, centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            nearestCluster = i;
          }
        }

        clusters[nearestCluster].push(pixel);
      }

      // 更新聚类中心
      let changed = false;
      for (let i = 0; i < centroids.length; i++) {
        if (clusters[i].length === 0) continue;

        const avgR = Math.round(clusters[i].reduce((sum, p) => sum + p.r, 0) / clusters[i].length);
        const avgG = Math.round(clusters[i].reduce((sum, p) => sum + p.g, 0) / clusters[i].length);
        const avgB = Math.round(clusters[i].reduce((sum, p) => sum + p.b, 0) / clusters[i].length);

        if (centroids[i].r !== avgR || centroids[i].g !== avgG || centroids[i].b !== avgB) {
          centroids[i] = { r: avgR, g: avgG, b: avgB };
          changed = true;
        }
      }

      // 如果聚类中心不再变化，提前结束
      if (!changed) break;
    }

    // 转换为调色板格式
    return centroids.map(c => ({
      r: c.r,
      g: c.g,
      b: c.b,
      hex: `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`.toUpperCase()
    }));
  }

  /**
   * 🆕 计算两个颜色之间的距离（加权欧氏距离）
   * @param {Object} color1 - 颜色1
   * @param {Object} color2 - 颜色2
   * @returns {number} 距离值
   */
  static colorDistance(color1, color2) {
    // 使用加权欧氏距离（人眼对绿色更敏感）
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;
    return Math.sqrt(dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11);
  }

  /**
   * 🆕 找到调色板中最近的颜色
   * @param {Object} pixel - 像素数据
   * @param {Array} palette - 调色板
   * @returns {Object} 最近的调色板颜色
   */
  static findNearestPaletteColor(pixel, palette) {
    let minDist = Infinity;
    let nearestColor = palette[0];

    for (const color of palette) {
      const dist = this.colorDistance(pixel, color);
      if (dist < minDist) {
        minDist = dist;
        nearestColor = color;
      }
    }

    return nearestColor;
  }

  /**
   * 保存调试用的像素图到临时文件夹
   * @param {Array} pixelData - 像素数据数组
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   */
  static async saveDebugPixelImage(pixelData, width, height) {
    try {
      const fs = require('fs');
      const path = require('path');

      // 创建临时调试目录
      const debugDir = path.join(__dirname, '../../temp_debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      // 生成文件名（带时间戳）
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `processed_${width}x${height}_${timestamp}.png`;
      const filepath = path.join(debugDir, filename);

      // 将像素数据转换为Buffer
      const buffer = Buffer.alloc(width * height * 4);
      for (let i = 0; i < pixelData.length; i++) {
        const pixel = pixelData[i];
        buffer[i * 4] = pixel.r;
        buffer[i * 4 + 1] = pixel.g;
        buffer[i * 4 + 2] = pixel.b;
        buffer[i * 4 + 3] = pixel.a;
      }

      // 使用sharp保存为PNG（无压缩，保留原色）
      await sharp(buffer, {
        raw: {
          width: width,
          height: height,
          channels: 4
        }
      })
        .png({ compressionLevel: 0 })  // ✅ 无压缩
        .toFile(filepath);

      logger.info(`🖼️ 调试图片已保存: ${filepath}`);

    } catch (error) {
      logger.error('❌ 保存调试图片失败:', error.message);
    }
  }

  /**
   * ✅ 新增：保存对比图（原始缩放图 vs 处理后图）
   * @param {Buffer} preprocessedBuffer - 预处理后的图片Buffer
   * @param {Array} pixelData - 处理后的像素数据
   * @param {number} width - 图片宽度
   * @param {number} height - 图片高度
   */
  static async saveComparisonImages(preprocessedBuffer, pixelData, width, height) {
    try {
      const fs = require('fs');
      const path = require('path');

      const debugDir = path.join(__dirname, '../../temp_debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

      // 1. 保存原始缩放图（sharp处理后的结果）
      const originalPath = path.join(debugDir, `original_scaled_${width}x${height}_${timestamp}.png`);
      await sharp(preprocessedBuffer)
        .png({ compressionLevel: 0 })
        .toFile(originalPath);
      logger.info(`🖼️ 原始缩放图已保存: ${originalPath}`);

      // 2. 保存处理后的图（我们的算法处理结果）
      const processedBuffer = Buffer.alloc(width * height * 4);
      for (let i = 0; i < pixelData.length; i++) {
        const pixel = pixelData[i];
        processedBuffer[i * 4] = pixel.r;
        processedBuffer[i * 4 + 1] = pixel.g;
        processedBuffer[i * 4 + 2] = pixel.b;
        processedBuffer[i * 4 + 3] = pixel.a;
      }

      const processedPath = path.join(debugDir, `final_processed_${width}x${height}_${timestamp}.png`);
      await sharp(processedBuffer, {
        raw: { width, height, channels: 4 }
      })
        .png({ compressionLevel: 0 })
        .toFile(processedPath);
      logger.info(`🖼️ 处理后图片已保存: ${processedPath}`);

      // 3. 统计颜色差异
      const { data: originalData } = await sharp(preprocessedBuffer).raw().toBuffer({ resolveWithObject: true });
      let totalColorDiff = 0;
      let maxDiff = 0;

      for (let i = 0; i < pixelData.length; i++) {
        const idx = i * 4;
        const rDiff = Math.abs(pixelData[i].r - originalData[idx]);
        const gDiff = Math.abs(pixelData[i].g - originalData[idx + 1]);
        const bDiff = Math.abs(pixelData[i].b - originalData[idx + 2]);
        const diff = rDiff + gDiff + bDiff;

        totalColorDiff += diff;
        maxDiff = Math.max(maxDiff, diff);
      }

      const avgDiff = totalColorDiff / pixelData.length;
      logger.info(`📊 颜色差异统计:`);
      logger.info(`  平均差异: ${avgDiff.toFixed(2)} (0=完全相同, 765=完全相反)`);
      logger.info(`  最大差异: ${maxDiff}`);
      logger.info(`  色彩保留度: ${((1 - avgDiff / 765) * 100).toFixed(2)}%`);

    } catch (error) {
      logger.error('❌ 保存对比图失败:', error.message);
    }
  }
}

module.exports = ImageProcessor;
