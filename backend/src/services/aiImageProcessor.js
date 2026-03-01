/**
 * AI图像处理服务 - 真实的AI API集成实现
 * 支持多种AI服务商的智能图像处理
 */

const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const AIConfig = require('../config/aiImageProcessing');

class AIImageProcessor {

  /**
   * 智能处理自定义旗帜
   * @param {Buffer} imageBuffer - 图像数据
   * @param {Object} options - 处理选项
   * @returns {Object} 处理结果
   */
  static async processCustomFlag(imageBuffer, options = {}) {
    try {
      console.log('🎨 开始AI智能处理自定义旗帜...');

      // 1. 分析图像特征
      const imageAnalysis = await this.analyzeImage(imageBuffer);
      console.log('📊 图像分析完成:', imageAnalysis);

      // 2. 选择最佳处理策略
      const strategy = AIConfig.selectOptimalStrategy(imageAnalysis, options);
      console.log('🎯 选择处理策略:', strategy);

      // 3. 估算成本和时间
      const estimatedCost = AIConfig.estimateCost(strategy, imageAnalysis);
      const estimatedTime = AIConfig.estimateProcessingTime(strategy, imageAnalysis);
      console.log(`💰 预估成本: $${estimatedCost}, ⏱️ 预估时间: ${estimatedTime}秒`);

      // 4. 执行背景去除
      const backgroundRemoved = await this.removeBackground(imageBuffer, strategy);
      console.log('✂️ 背景去除完成');

      // 5. 图像增强
      const enhancedImage = await this.enhanceImage(backgroundRemoved, imageAnalysis, strategy);
      console.log('✨ 图像增强完成');

      // 6. 生成旗帜风格
      const flagStyle = await this.generateFlagStyle(enhancedImage, imageAnalysis, strategy);
      console.log('🚩 旗帜风格生成完成');

      // 7. 优化多分辨率
      const multiResolution = await this.generateMultiResolution(flagStyle, strategy);
      console.log('📱 多分辨率优化完成');

      return {
        success: true,
        result: {
          imageAnalysis,
          strategy,
          estimatedCost,
          processingTime: estimatedTime,
          multiResolution,
          metadata: {
            originalSize: imageBuffer.length,
            processedAt: new Date().toISOString(),
            confidence: this.calculateConfidence(imageAnalysis, flagStyle)
          }
        }
      };

    } catch (error) {
      console.error('❌ AI处理失败:', error);
      return {
        success: false,
        error: error.message,
        fallback: await this.generateFallback(imageBuffer)
      };
    }
  }

  /**
   * 图像分析
   */
  static async analyzeImage(imageBuffer) {
    try {
      // 使用Sharp获取基本图像信息
      const metadata = await sharp(imageBuffer).metadata();

      // 生成缩略图用于分析
      const thumbnail = await sharp(imageBuffer)
        .resize(512, 512, { fit: 'inside' })
        .png()
        .toBuffer();

      const analysis = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: imageBuffer.length,
        hasTransparency: metadata.hasAlpha,
        colorSpace: metadata.space,

        // AI分析（这里调用真实的AI API）
        aiAnalysis: await this.performAIAnalysis(thumbnail)
      };

      return analysis;
    } catch (error) {
      console.error('图像分析失败:', error);
      return this.getDefaultAnalysis(imageBuffer);
    }
  }

  /**
   * 执行AI分析
   */
  static async performAIAnalysis(imageBuffer) {
    try {
      // 优先使用Google Vision API
      if (process.env.GOOGLE_VISION_API_KEY) {
        return await this.googleVisionAnalysis(imageBuffer);
      }

      // 备用：使用本地分析
      return await this.localImageAnalysis(imageBuffer);
    } catch (error) {
      console.error('AI分析失败:', error);
      return {
        labels: [],
        objects: [],
        colors: [],
        confidence: 0.5,
        hasBackground: true,
        subjectType: 'unknown'
      };
    }
  }

  /**
   * Google Vision API分析
   */
  static async googleVisionAnalysis(imageBuffer) {
    try {
      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
        {
          requests: [{
            image: {
              content: imageBuffer.toString('base64')
            },
            features: [
              { type: 'LABEL_DETECTION', maxResults: 10 },
              { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
              { type: 'WEB_DETECTION', maxResults: 5 },
              { type: 'IMAGE_PROPERTIES', maxResults: 5 }
            ]
          }]
        }
      );

      const annotations = response.data.responses[0];

      return {
        labels: annotations.labelAnnotations?.map(label => ({
          description: label.description,
          score: label.score
        })) || [],
        objects: annotations.localizedObjectAnnotations?.map(obj => ({
          name: obj.name,
          score: obj.score,
          boundingBox: obj.boundingPoly
        })) || [],
        colors: annotations.imagePropertiesAnnotation?.dominantColors?.colors || [],
        webEntities: annotations.webDetection?.webEntities || [],
        confidence: this.calculateVisionConfidence(annotations),
        hasBackground: this.detectBackground(annotations),
        subjectType: this.determineSubjectType(annotations)
      };
    } catch (error) {
      console.error('Google Vision API调用失败:', error);
      throw error;
    }
  }

  /**
   * 本地图像分析
   */
  static async localImageAnalysis(imageBuffer) {
    try {
      // 使用Sharp进行基础分析
      const { data, info } = await sharp(imageBuffer)
        .resize(100, 100, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // 简单的颜色分析
      const colorHistogram = this.analyzeColors(data, info);

      // 简单的边缘检测（判断是否为简单图形）
      const edges = this.detectEdges(data, info);

      return {
        labels: this.generateLabels(colorHistogram, edges),
        objects: [],
        colors: colorHistogram,
        confidence: 0.6,
        hasBackground: edges.complexity > 0.3,
        subjectType: this.determineSimpleSubject(colorHistogram, edges)
      };
    } catch (error) {
      console.error('本地分析失败:', error);
      throw error;
    }
  }

  /**
   * 背景去除
   */
  static async removeBackground(imageBuffer, strategy) {
    try {
      const provider = strategy.backgroundRemoval;

      if (provider === 'adobe' && process.env.ADOBE_API_KEY) {
        return await this.adobeBackgroundRemoval(imageBuffer);
      } else if (provider === 'removebg' && process.env.REMOVEBG_API_KEY) {
        return await this.removeBgBackgroundRemoval(imageBuffer);
      } else if (provider === 'clipdrop' && process.env.CLIPDROP_API_KEY) {
        return await this.clipdropBackgroundRemoval(imageBuffer);
      } else if (provider === 'local_ml') {
        return await this.localBackgroundRemoval(imageBuffer);
      } else {
        console.log('使用基础背景处理');
        return await this.basicBackgroundProcessing(imageBuffer);
      }
    } catch (error) {
      console.error('背景去除失败:', error);
      return imageBuffer; // 返回原图
    }
  }

  /**
   * Adobe背景去除
   */
  static async adobeBackgroundRemoval(imageBuffer) {
    try {
      const formData = new FormData();
      formData.append('image', imageBuffer, 'image.png');
      formData.append('output_mask', 'true');

      const response = await axios.post(
        'https://image.adobe.io/sensei/cutout',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${process.env.ADOBE_API_KEY}`,
            'x-api-key': process.env.ADOBE_API_KEY,
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      return Buffer.from(response.data.image, 'base64');
    } catch (error) {
      console.error('Adobe背景去除失败:', error);
      throw error;
    }
  }

  /**
   * remove.bg背景去除
   */
  static async removeBgBackgroundRemoval(imageBuffer) {
    try {
      const formData = new FormData();
      formData.append('image_file', imageBuffer, 'image.png');
      formData.append('size', 'auto');

      const response = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        formData,
        {
          headers: {
            'X-Api-Key': process.env.REMOVEBG_API_KEY,
            ...formData.getHeaders()
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      console.error('remove.bg背景去除失败:', error);
      throw error;
    }
  }

  /**
   * Clipdrop背景去除
   */
  static async clipdropBackgroundRemoval(imageBuffer) {
    try {
      const formData = new FormData();
      formData.append('image_file', imageBuffer, 'image.png');

      const response = await axios.post(
        'https://clipdrop-api.co/remove-background/v1',
        formData,
        {
          headers: formData.getHeaders(),
          responseType: 'arraybuffer',
          timeout: 20000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Clipdrop背景去除失败:', error);
      throw error;
    }
  }

  /**
   * 本地ML背景去除
   */
  static async localBackgroundRemoval(imageBuffer) {
    try {
      // 这里可以集成TensorFlow.js或其他本地ML模型
      // 暂时使用Sharp的基础处理
      console.log('执行本地背景去除...');

      // 简单的背景处理：增强主体对比度
      const processed = await sharp(imageBuffer)
        .modulate({
          brightness: 1.1,
          saturation: 1.2
        })
        .sharpen()
        .png()
        .toBuffer();

      return processed;
    } catch (error) {
      console.error('本地背景去除失败:', error);
      throw error;
    }
  }

  /**
   * 图像增强
   */
  static async enhanceImage(imageBuffer, imageAnalysis, strategy) {
    try {
      let pipeline = sharp(imageBuffer);

      // 根据分析结果进行增强
      if (imageAnalysis.aiAnalysis?.hasBackground) {
        // 如果有背景，增强主体
        pipeline = pipeline
          .modulate({ brightness: 1.1, saturation: 1.2 })
          .sharpen({ sigma: 1, flat: 1, jagged: 2 });
      }

      // 如果是人物照片，进行特殊处理
      if (imageAnalysis.aiAnalysis?.subjectType === 'person') {
        pipeline = pipeline
          .normalize()
          .modulate({ brightness: 1.05 });
      }

      // 优化尺寸和格式
      const enhanced = await pipeline
        .resize(512, 512, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({
          quality: 90,
          compressionLevel: 6
        })
        .toBuffer();

      return enhanced;
    } catch (error) {
      console.error('图像增强失败:', error);
      return imageBuffer;
    }
  }

  /**
   * 生成旗帜风格
   */
  static async generateFlagStyle(imageBuffer, imageAnalysis, strategy) {
    try {
      // 这里可以集成Stable Diffusion、Midjourney等AI生成服务
      // 暂时返回处理后的图像
      console.log('生成旗帜风格...');

      // 根据分析结果调整图像风格
      const styled = await sharp(imageBuffer)
        .resize(256, 256, {
          fit: 'cover',
          position: 'center'
        })
        .modulate({
          saturation: 1.3,
          brightness: 1.1
        })
        .sharpen()
        .png()
        .toBuffer();

      return styled;
    } catch (error) {
      console.error('旗帜风格生成失败:', error);
      return imageBuffer;
    }
  }

  /**
   * 生成多分辨率版本
   */
  static async generateMultiResolution(imageBuffer, strategy) {
    try {
      const sizes = [
        { name: 'ultraLow', width: 8, height: 8 },
        { name: 'low', width: 32, height: 32 },
        { name: 'medium', width: 64, height: 64 },
        { name: 'high', width: 128, height: 128 }
      ];

      const results = {};

      for (const size of sizes) {
        const resized = await sharp(imageBuffer)
          .resize(size.width, size.height, {
            fit: 'cover',
            position: 'center'
          })
          .png()
          .toBuffer();

        results[size.name] = {
          width: size.width,
          height: size.height,
          format: 'png',
          size: resized.length,
          data: resized.toString('base64')
        };
      }

      return results;
    } catch (error) {
      console.error('多分辨率生成失败:', error);
      throw error;
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 分析颜色
   */
  static analyzeColors(data, info) {
    const colorMap = new Map();

    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = `${r},${g},${b}`;

      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }

    // 返回前10个最常见的颜色
    return Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([color, count]) => ({
        rgb: color.split(',').map(Number),
        count,
        percentage: (count / (data.length / info.channels)) * 100
      }));
  }

  /**
   * 边缘检测
   */
  static detectEdges(data, info) {
    let edges = 0;
    const threshold = 30;

    for (let y = 1; y < info.height - 1; y++) {
      for (let x = 1; x < info.width - 1; x++) {
        const idx = (y * info.width + x) * info.channels;

        // 简单的边缘检测：比较周围像素
        const center = data[idx];
        const neighbors = [
          data[idx - info.channels],
          data[idx + info.channels],
          data[idx - info.width * info.channels],
          data[idx + info.width * info.channels]
        ];

        const maxDiff = Math.max(...neighbors.map(n => Math.abs(n - center)));
        if (maxDiff > threshold) {
          edges++;
        }
      }
    }

    const totalPixels = info.width * info.height;
    const complexity = edges / totalPixels;

    return {
      edgeCount: edges,
      complexity,
      isSimple: complexity < 0.1,
      isComplex: complexity > 0.3
    };
  }

  /**
   * 生成标签
   */
  static generateLabels(colorHistogram, edges) {
    const labels = [];

    if (edges.isSimple) {
      labels.push('simple shape');
    } else if (edges.isComplex) {
      labels.push('complex pattern');
    }

    const dominantColor = colorHistogram[0];
    if (dominantColor) {
      const [r, g, b] = dominantColor.rgb;

      if (r > g && r > b) {
        labels.push('red dominant');
      } else if (g > r && g > b) {
        labels.push('green dominant');
      } else if (b > r && b > g) {
        labels.push('blue dominant');
      } else if (r > 200 && g > 200 && b > 200) {
        labels.push('light colored');
      } else if (r < 50 && g < 50 && b < 50) {
        labels.push('dark colored');
      }
    }

    return labels;
  }

  /**
   * 确定简单主体类型
   */
  static determineSimpleSubject(colorHistogram, edges) {
    if (edges.isSimple && colorHistogram.length < 3) {
      return 'simple shape';
    } else if (edges.complexity > 0.3) {
      return 'complex pattern';
    } else {
      return 'mixed content';
    }
  }

  /**
   * 计算Vision API置信度
   */
  static calculateVisionConfidence(annotations) {
    let confidence = 0.5;

    if (annotations.labelAnnotations) {
      const avgLabelScore = annotations.labelAnnotations.reduce((sum, label) => sum + label.score, 0) / annotations.labelAnnotations.length;
      confidence += avgLabelScore * 0.3;
    }

    if (annotations.localizedObjectAnnotations) {
      const avgObjectScore = annotations.localizedObjectAnnotations.reduce((sum, obj) => sum + obj.score, 0) / annotations.localizedObjectAnnotations.length;
      confidence += avgObjectScore * 0.4;
    }

    return Math.min(1, confidence);
  }

  /**
   * 检测背景
   */
  static detectBackground(annotations) {
    // 如果检测到多个对象，可能有背景
    if (annotations.localizedObjectAnnotations && annotations.localizedObjectAnnotations.length > 1) {
      return true;
    }

    // 如果有大量标签，可能有复杂背景
    if (annotations.labelAnnotations && annotations.labelAnnotations.length > 5) {
      return true;
    }

    return false;
  }

  /**
   * 确定主体类型
   */
  static determineSubjectType(annotations) {
    const labels = annotations.labelAnnotations?.map(label => label.description.toLowerCase()) || [];

    if (labels.some(label => label.includes('person') || label.includes('people') || label.includes('human'))) {
      return 'person';
    } else if (labels.some(label => label.includes('animal') || label.includes('pet'))) {
      return 'animal';
    } else if (labels.some(label => label.includes('logo') || label.includes('symbol'))) {
      return 'symbol';
    } else if (labels.some(label => label.includes('text') || label.includes('writing'))) {
      return 'text';
    } else {
      return 'object';
    }
  }

  /**
   * 基础背景处理
   */
  static async basicBackgroundProcessing(imageBuffer) {
    return await sharp(imageBuffer)
      .modulate({ brightness: 1.1, saturation: 1.2 })
      .sharpen()
      .png()
      .toBuffer();
  }

  /**
   * 计算整体置信度
   */
  static calculateConfidence(imageAnalysis, flagStyle) {
    const visionConfidence = imageAnalysis.aiAnalysis?.confidence || 0.5;
    const processingQuality = flagStyle ? 0.8 : 0.6;

    return (visionConfidence * 0.6 + processingQuality * 0.4);
  }

  /**
   * 获取默认分析结果
   */
  static getDefaultAnalysis(imageBuffer) {
    return {
      width: 0,
      height: 0,
      format: 'unknown',
      size: imageBuffer.length,
      hasTransparency: false,
      colorSpace: 'srgb',
      aiAnalysis: {
        labels: ['unknown'],
        objects: [],
        colors: [],
        confidence: 0.3,
        hasBackground: true,
        subjectType: 'unknown'
      }
    };
  }

  /**
   * 生成备用结果
   */
  static async generateFallback(imageBuffer) {
    try {
      // 生成简单的处理结果
      const thumbnail = await sharp(imageBuffer)
        .resize(64, 64, { fit: 'cover' })
        .png()
        .toBuffer();

      return {
        emojiVersion: '🏴',
        dominantColors: ['#FF0000', '#FFFFFF'],
        complexity: 0.5,
        processedImage: thumbnail.toString('base64'),
        style: 'fallback',
        confidence: 0.3,
        fallback: true
      };
    } catch (error) {
      console.error('生成备用结果失败:', error);
      return {
        emojiVersion: '🏴',
        dominantColors: ['#FF0000', '#FFFFFF'],
        complexity: 0.5,
        processedImage: null,
        style: 'error',
        confidence: 0.1,
        fallback: true,
        error: true
      };
    }
  }
}

module.exports = AIImageProcessor;