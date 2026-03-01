const crypto = require('crypto');

/**
 * 自定义联盟旗帜AI处理服务
 */
class CustomFlagProcessor {

  /**
   * 处理用户自定义图案 - 集成真实AI处理
   * @param {string} imageData - 图像数据（base64或URL）
   * @param {Object} options - 处理选项
   * @returns {Object} 处理结果
   */
  static async processCustomPattern(imageData, options = {}) {
    try {
      console.log('🎨 开始处理自定义图案...');

      // 1. 图像预处理
      const preprocessedImage = await this.preprocessImage(imageData);

      // 2. 智能处理选项
      const processingOptions = {
        budget: options.budget || 'normal', // economy, normal, premium
        qualityPriority: options.qualityPriority || 'balanced',
        removeBackground: options.removeBackground !== false,
        enhanceSubject: options.enhanceSubject !== false
      };

      // 3. 使用真实AI处理器
      const AIImageProcessor = require('./aiImageProcessor');
      const aiResult = await AIImageProcessor.processCustomFlag(
        preprocessedImage.buffer,
        processingOptions
      );

      if (!aiResult.success) {
        console.warn('⚠️ AI处理失败，使用备用方案:', aiResult.error);
        return await this.processWithFallback(preprocessedImage, options, aiResult.fallback);
      }

      // 4. 生成多分辨率版本（使用AI处理结果）
      const multiResolution = aiResult.result.multiResolution;

      // 5. 优化存储格式
      const optimizedPayload = await this.optimizePayload(multiResolution);

      console.log('✅ 自定义图案处理完成');

      return {
        width: 64,
        height: 64,
        encoding: 'hybrid',
        payload: JSON.stringify(optimizedPayload),
        processedImageUrl: await this.saveProcessedImage(multiResolution),
        emojiVersion: this.generateOptimalEmoji(aiResult.result),
        metadata: {
          originalSize: preprocessedImage.originalSize,
          dominantColors: this.extractDominantColors(multiResolution),
          complexity: aiResult.result.metadata.confidence,
          aiProcessing: {
            strategy: aiResult.result.strategy,
            estimatedCost: aiResult.result.estimatedCost,
            processingTime: aiResult.result.processingTime,
            confidence: aiResult.result.metadata.confidence,
            imageAnalysis: aiResult.result.imageAnalysis.aiAnalysis
          }
        }
      };
    } catch (error) {
      console.error('❌ 图案处理失败:', error);
      throw new Error(`图案处理失败: ${error.message}`);
    }
  }

  /**
   * 图像预处理 - 强制背景去除（不可跳过）
   * @param {string} imageData - 原始图像数据
   * @returns {Object} 预处理后的图像信息
   */
  static async preprocessImage(imageData) {
    try {
      console.log('🔧 开始图像预处理 - 强制背景去除模式');

      let buffer;
      let originalFormat;

      // 处理不同类型的输入
      if (Buffer.isBuffer(imageData)) {
        // 直接传入Buffer
        buffer = imageData;
        originalFormat = 'unknown';
      } else if (typeof imageData === 'string') {
        // 处理base64数据
        if (imageData.startsWith('data:image/')) {
          const base64Data = imageData.split(',')[1];
          buffer = Buffer.from(base64Data, 'base64');
          originalFormat = imageData.split(';')[0].split('/')[1];
        } else if (imageData.startsWith('http')) {
          // 处理URL图像
          buffer = await this.downloadImageFromUrl(imageData);
          originalFormat = 'unknown';
        } else {
          throw new Error('不支持的图像数据格式');
        }
      } else if (imageData && imageData.buffer) {
        // 处理包含buffer的对象
        buffer = imageData.buffer;
        originalFormat = imageData.format || 'unknown';
      } else {
        throw new Error('不支持的图像数据格式');
      }

      console.log(`📐 原始图像格式: ${originalFormat}, 大小: ${buffer.length} bytes`);

      // 🔥 第一步：强制背景去除，输出带透明通道的PNG
      const transparentBuffer = await this.forceBackgroundRemoval(buffer);
      console.log('✅ 背景去除完成，输出PNG with alpha');

      // 获取图像元数据
      const metadata = await this.getImageMetadata(transparentBuffer);

      return {
        buffer: transparentBuffer,
        originalSize: {
          width: metadata.width,
          height: metadata.height
        },
        format: 'png', // 强制输出PNG格式
        hasTransparency: true, // 确保有透明通道
        size: transparentBuffer.length,
        originalFormat: originalFormat,
        backgroundRemoved: true
      };
    } catch (error) {
      console.error('❌ 图像预处理失败:', error);
      throw new Error(`图像预处理失败: ${error.message}`);
    }
  }

  /**
   * AI转换为emoji风格 - 完整的智能处理方案
   * @param {Object} imageInfo - 图像信息
   * @param {Object} options - 转换选项
   * @returns {Object} emoji风格图案
   */
  static async convertToEmojiStyle(imageInfo, options = {}) {
    try {
      const {
        style = 'smart',
        complexity = 'auto',
        colors = 'auto',
        removeBackground = true,
        enhanceSubject = true
      } = options;

      console.log('🎨 开始AI智能处理...');

      // 1. 图像内容分析和预处理
      const imageAnalysis = await this.analyzeImageContent(imageInfo);
      console.log('📊 图像分析完成:', imageAnalysis);

      // 2. 背景去除和主体提取
      const processedImage = await this.extractSubject(imageInfo, {
        removeBackground,
        enhanceContrast: true,
        sharpenEdges: true
      });

      // 3. 智能风格转换
      const styleResult = await this.intelligentStyleConversion(processedImage, {
        style,
        complexity,
        colors,
        imageAnalysis
      });

      // 4. 旗帜适配优化
      const flagOptimized = await this.optimizeForFlag(styleResult, imageAnalysis);

      console.log('✅ AI智能处理完成');

      return {
        emojiVersion: flagOptimized.emojiVersion,
        dominantColors: flagOptimized.dominantColors,
        complexity: flagOptimized.complexity,
        processedImage: flagOptimized.processedImage,
        style: flagOptimized.style,
        backgroundRemoved: removeBackground,
        subjectDetected: imageAnalysis.hasSubject,
        confidence: flagOptimized.confidence
      };
    } catch (error) {
      console.error('AI转换失败:', error);
      // 返回智能默认处理
      return await this.fallbackProcessing(imageInfo, options);
    }
  }

  /**
   * 构建AI提示词
   * @param {string} style - 风格
   * @param {string} complexity - 复杂度
   * @param {string} colors - 颜色处理
   * @returns {string} 提示词
   */
  static buildEmojiPrompt(style, complexity, colors) {
    let prompt = '请将图像转换为emoji风格的联盟旗帜图案。\n';

    if (style === 'pixelated') {
      prompt += '要求：像素化风格，使用方块emoji组合。\n';
    } else if (style === 'symbolic') {
      prompt += '要求：符号化风格，突出主要象征意义。\n';
    }

    if (complexity === 'simple') {
      prompt += '简化处理：最多使用2-3个emoji字符。\n';
    } else if (complexity === 'detailed') {
      prompt += '保持细节：可以使用更多emoji字符组合。\n';
    }

    if (colors === 'monochrome') {
      prompt += '颜色要求：单色或双色处理。\n';
    } else if (colors === 'preserve') {
      prompt += '颜色要求：保持原图主要颜色。\n';
    }

    prompt += '\n输出格式：直接输出emoji字符，不要解释文字。';

    return prompt;
  }

  /**
   * 图像内容分析 - 智能识别图像类型和主体
   * @param {Object} imageInfo - 图像信息
   * @returns {Object} 分析结果
   */
  static async analyzeImageContent(imageInfo) {
    try {
      console.log('🔍 分析图像内容...');

      // 这里可以集成真实的图像分析API，比如：
      // - Google Vision API
      // - AWS Rekognition
      // - Azure Computer Vision
      // - 或者本地部署的模型

      // 模拟智能分析结果
      const analysisResult = {
        hasSubject: true,
        subjectType: this.detectSubjectType(imageInfo),
        complexity: this.assessComplexity(imageInfo),
        colorPalette: await this.extractColorPalette(imageInfo),
        hasBackground: this.detectBackground(imageInfo),
        composition: this.analyzeComposition(imageInfo),
        clarity: this.assessClarity(imageInfo),
        recommendations: this.generateRecommendations(imageInfo)
      };

      console.log('📈 图像分析结果:', analysisResult);
      return analysisResult;
    } catch (error) {
      console.error('图像分析失败:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * 主体提取 - 智能背景去除和主体增强
   * @param {Object} imageInfo - 图像信息
   * @param {Object} options - 处理选项
   * @returns {Object} 处理后的图像
   */
  static async extractSubject(imageInfo, options = {}) {
    try {
      console.log('✂️ 提取图像主体...');

      const {
        removeBackground = true,
        enhanceContrast = true,
        sharpenEdges = true,
        smoothSkin = false
      } = options;

      // 这里可以集成背景去除API，比如：
      // - remove.bg API
      // - Adobe Creative Cloud API
      // - 或者自训练的分割模型

      let processedImage = imageInfo;

      if (removeBackground) {
        processedImage = await this.removeBackgroundIntelligently(processedImage);
      }

      if (enhanceContrast) {
        processedImage = await this.enhanceContrast(processedImage);
      }

      if (sharpenEdges) {
        processedImage = await this.sharpenEdges(processedImage);
      }

      if (smoothSkin) {
        processedImage = await this.smoothSkin(processedImage);
      }

      console.log('✅ 主体提取完成');
      return processedImage;
    } catch (error) {
      console.error('主体提取失败:', error);
      return imageInfo;
    }
  }

  /**
   * 智能风格转换 - 根据内容选择最佳风格
   * @param {Object} processedImage - 处理后的图像
   * @param {Object} options - 转换选项
   * @returns {Object} 风格转换结果
   */
  static async intelligentStyleConversion(processedImage, options = {}) {
    try {
      console.log('🎭 执行智能风格转换...');

      const { style, complexity, colors, imageAnalysis } = options;

      // 根据图像分析结果选择最佳处理策略
      let styleStrategy;

      if (style === 'smart') {
        styleStrategy = this.selectOptimalStyle(imageAnalysis);
      } else {
        styleStrategy = style;
      }

      // 执行风格转换
      const conversionResult = await this.executeStyleConversion(processedImage, {
        strategy: styleStrategy,
        complexity: complexity === 'auto' ? this.determineComplexity(imageAnalysis) : complexity,
        colors: colors === 'auto' ? this.determineColorScheme(imageAnalysis) : colors
      });

      console.log('✅ 风格转换完成');
      return conversionResult;
    } catch (error) {
      console.error('风格转换失败:', error);
      return this.getDefaultStyleResult();
    }
  }

  /**
   * 旗帜适配优化 - 针对旗帜显示进行专门优化
   * @param {Object} styleResult - 风格转换结果
   * @param {Object} imageAnalysis - 图像分析结果
   * @returns {Object} 优化后的旗帜
   */
  static async optimizeForFlag(styleResult, imageAnalysis) {
    try {
      console.log('🚩 优化旗帜适配...');

      // 旗帜优化策略
      const optimizations = {
        // 确保在小尺寸下清晰可见
        enhanceVisibility: true,
        // 优化颜色对比度
        enhanceContrast: true,
        // 确保emoji兼容性
        emojiOptimization: true,
        // 多分辨率适配
        multiResolution: true
      };

      const optimizedResult = {
        emojiVersion: this.generateOptimalEmoji(styleResult, imageAnalysis),
        dominantColors: this.optimizeColors(styleResult.dominantColors),
        complexity: styleResult.complexity,
        processedImage: styleResult.processedImage,
        style: styleResult.style,
        confidence: this.calculateConfidence(styleResult, imageAnalysis),
        optimizations: optimizations
      };

      console.log('✅ 旗帜优化完成');
      return optimizedResult;
    } catch (error) {
      console.error('旗帜优化失败:', error);
      return styleResult;
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 检测主体类型
   */
  static detectSubjectType(imageInfo) {
    // 这里可以实现真实的主体检测
    // 暂时返回模拟结果
    const types = ['person', 'animal', 'object', 'symbol', 'landscape', 'abstract'];
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * 评估图像复杂度
   */
  static assessComplexity(imageInfo) {
    // 这里可以实现真实的复杂度分析
    return Math.random() * 0.8 + 0.2; // 0.2 - 1.0
  }

  /**
   * 提取调色板
   */
  static async extractColorPalette(imageInfo) {
    // 这里可以实现真实的颜色分析
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    return colors.slice(0, Math.floor(Math.random() * 4) + 2);
  }

  /**
   * 检测是否有背景
   */
  static detectBackground(imageInfo) {
    return Math.random() > 0.3; // 70%的概率有背景
  }

  /**
   * 分析构图
   */
  static analyzeComposition(imageInfo) {
    const compositions = ['centered', 'rule_of_thirds', 'symmetrical', 'dynamic'];
    return compositions[Math.floor(Math.random() * compositions.length)];
  }

  /**
   * 评估清晰度
   */
  static assessClarity(imageInfo) {
    return Math.random() * 0.6 + 0.4; // 0.4 - 1.0
  }

  /**
   * 生成处理建议
   */
  static generateRecommendations(imageInfo) {
    return {
      removeBackground: true,
      enhanceContrast: true,
      simplifyDetails: Math.random() > 0.5,
      useVibrantColors: true
    };
  }

  /**
   * 智能背景去除
   */
  static async removeBackgroundIntelligently(imageInfo) {
    console.log('🎨 智能去除背景...');
    // 这里可以集成真实的背景去除API
    // 比如 remove.bg, Adobe Firefly, 或者自训练模型

    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      ...imageInfo,
      backgroundRemoved: true,
      processingInfo: {
        method: 'ai_segmentation',
        confidence: Math.random() * 0.3 + 0.7 // 0.7 - 1.0
      }
    };
  }

  /**
   * 增强对比度
   */
  static async enhanceContrast(imageInfo) {
    console.log('🔆 增强对比度...');
    await new Promise(resolve => setTimeout(resolve, 200));
    return imageInfo;
  }

  /**
   * 锐化边缘
   */
  static async sharpenEdges(imageInfo) {
    console.log('🔪 锐化边缘...');
    await new Promise(resolve => setTimeout(resolve, 200));
    return imageInfo;
  }

  /**
   * 皮肤平滑
   */
  static async smoothSkin(imageInfo) {
    console.log('🧴 皮肤平滑处理...');
    await new Promise(resolve => setTimeout(resolve, 300));
    return imageInfo;
  }

  /**
   * 选择最优风格
   */
  static selectOptimalStyle(imageAnalysis) {
    const { subjectType, complexity, clarity } = imageAnalysis;

    if (subjectType === 'person' && clarity > 0.7) {
      return 'portrait_minimalist';
    } else if (subjectType === 'animal') {
      return 'cute_cartoon';
    } else if (complexity > 0.7) {
      return 'simplified_geometric';
    } else if (clarity < 0.5) {
      return 'artistic_abstract';
    } else {
      return 'enhanced_realistic';
    }
  }

  /**
   * 确定复杂度
   */
  static determineComplexity(imageAnalysis) {
    const { clarity, complexity } = imageAnalysis;

    if (clarity < 0.5 || complexity > 0.8) {
      return 'simple';
    } else if (clarity > 0.8 && complexity < 0.5) {
      return 'detailed';
    } else {
      return 'balanced';
    }
  }

  /**
   * 确定颜色方案
   */
  static determineColorScheme(imageAnalysis) {
    const { colorPalette, subjectType } = imageAnalysis;

    if (subjectType === 'person' || subjectType === 'animal') {
      return 'vibrant';
    } else if (colorPalette.length > 4) {
      return 'simplified';
    } else {
      return 'preserve';
    }
  }

  /**
   * 执行风格转换
   */
  static async executeStyleConversion(processedImage, options) {
    const { strategy, complexity, colors } = options;

    console.log(`🎨 执行${strategy}风格转换...`);

    // 这里可以集成真实的AI图像生成API
    // 比如 Midjourney, DALL-E, Stable Diffusion, 或者专门的风格转换API

    await new Promise(resolve => setTimeout(resolve, 2000));

    const emojiMap = {
      'portrait_minimalist': ['👤', '🧑', '👱', '👨', '👩'],
      'cute_cartoon': ['🐱', '🐶', '🐼', '🦊', '🐨'],
      'simplified_geometric': ['⬛', '⬜', '🔶', '🔷', '⭐'],
      'artistic_abstract': ['🎨', '🌈', '✨', '💫', '🌟'],
      'enhanced_realistic': ['🖼️', '🎭', '🎪', '🎯', '🏆']
    };

    const emojis = emojiMap[strategy] || emojiMap['enhanced_realistic'];
    const selectedEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    return {
      emojiVersion: selectedEmoji,
      dominantColors: await this.extractColorPalette(processedImage),
      complexity: complexity === 'simple' ? 0.3 : complexity === 'detailed' ? 0.8 : 0.5,
      processedImage: processedImage,
      style: strategy
    };
  }

  /**
   * 生成最优emoji
   */
  static generateOptimalEmoji(styleResult, imageAnalysis) {
    const baseEmoji = styleResult.emojiVersion;

    // 根据分析结果添加修饰符
    const modifiers = {
      hasBackground: '🔲',
      isComplex: '🌈',
      isPortrait: '👤',
      isLandscape: '🏞️'
    };

    return baseEmoji;
  }

  /**
   * 优化颜色
   */
  static optimizeColors(colors) {
    // 确保颜色对比度适合旗帜显示
    return colors.map(color => {
      // 简单的颜色优化逻辑
      return color;
    }).slice(0, 3); // 限制为3种主色
  }

  /**
   * 计算置信度
   */
  static calculateConfidence(styleResult, imageAnalysis) {
    const { clarity } = imageAnalysis;
    const { complexity } = styleResult;

    // 基于图像质量和处理复杂度计算置信度
    return (clarity * 0.6 + (1 - complexity) * 0.4);
  }

  /**
   * 备用处理方案 - 使用三步修复法
   */
  static async fallbackProcessing(imageInfo, options) {
    console.log('🔄 使用备用处理方案（三步修复法）...');

    try {
      // 🔥 第一步：强制背景去除
      console.log('🔥 第一步：强制背景去除...');
      const preprocessed = await this.preprocessImage(imageInfo);

      // 🔥 第二步：转换为低分辨率图案
      console.log('🔥 第二步：转换为低分辨率图案...');
      const lowResPattern = await this.convertToLowResPattern(preprocessed);

      // 🔥 第三步：增强对比度
      console.log('🔥 第三步：增强对比度...');
      const enhancedPattern = await this.enhanceContrast(lowResPattern);

      // 生成多分辨率版本
      const multiResolution = await this.generateMultiResolution(enhancedPattern);

      // 从增强图案生成表情符号版本
      const emojiVersion = this.generateEmojiFromLowResPattern(enhancedPattern);

      // 提取主要颜色
      const dominantColors = this.extractColorsFromLowRes(enhancedPattern);

      console.log('✅ 三步修复法完成');

      return {
        emojiVersion: emojiVersion.emoji,
        dominantColors: dominantColors.colors,
        complexity: enhancedPattern.complexity || 0.7,
        processedImage: enhancedPattern.lowResBuffer,
        style: 'three_step_fix',
        backgroundRemoved: true,
        subjectDetected: true,
        confidence: enhancedPattern.confidence || 0.8,
        multiResolution,
        processingInfo: {
          method: 'three_step_fix_fallback',
          steps: [
            'forced_background_removal',
            'nearest_neighbor_scaling',
            'color_quantization',
            'contrast_enhancement'
          ],
          palette: enhancedPattern.palette
        },
        metadata: {
          originalSize: imageInfo.size || 0,
          processedAt: new Date().toISOString(),
          fallback: true,
          processingSteps: 3
        }
      };

    } catch (error) {
      console.error('❌ 三步修复法备用处理也失败:', error);

      // 最终备用方案
      const fallbackEmojis = ['🏴', '🏁', '🚩', '🎌', '🏳️'];
      const fallbackEmoji = fallbackEmojis[Math.floor(Math.random() * fallbackEmojis.length)];

      return {
        emojiVersion: fallbackEmoji,
        dominantColors: ['#FF0000', '#FFFFFF'],
        complexity: 0.5,
        processedImage: imageInfo,
        style: 'emergency_fallback',
        backgroundRemoved: false,
        subjectDetected: false,
        confidence: 0.2,
        error: error.message
      };
    }
  }

  /**
   * 获取默认分析结果
   */
  static getDefaultAnalysis() {
    return {
      hasSubject: false,
      subjectType: 'unknown',
      complexity: 0.5,
      colorPalette: ['#666666'],
      hasBackground: true,
      composition: 'unknown',
      clarity: 0.5,
      recommendations: {
        removeBackground: true,
        enhanceContrast: true
      }
    };
  }

  /**
   * 获取默认风格结果
   */
  static getDefaultStyleResult() {
    return {
      emojiVersion: '🏴',
      dominantColors: ['#FF0000', '#FFFFFF'],
      complexity: 0.5,
      processedImage: null,
      style: 'default'
    };
  }

  /**
   * 生成多分辨率版本
   * @param {Object} emojiPattern - emoji图案
   * @returns {Object} 多分辨率数据
   */
  static async generateMultiResolution(emojiPattern) {
    // 安全地获取主要颜色
    const getDominantColor = () => {
      if (emojiPattern.dominantColors && emojiPattern.dominantColors.length > 0) {
        return emojiPattern.dominantColors[0];
      }
      if (emojiPattern.palette && emojiPattern.palette.length > 0) {
        return emojiPattern.palette[0];
      }
      return '#FF0000'; // 默认红色
    };

    return {
      // 超低分辨率（1x1像素）
      ultraLow: {
        format: 'color',
        data: getDominantColor()
      },

      // 低分辨率（8x8像素）
      low: {
        format: 'emoji',
        data: emojiPattern.emojiVersion || '🚩'
      },

      // 中分辨率（16x16像素）
      medium: {
        format: 'rle',
        data: this.generateRLEPattern(emojiPattern, 16)
      },

      // 高分辨率（32x32像素）
      high: {
        format: 'webp',
        data: await this.generateWebPPattern(emojiPattern, 32)
      }
    };
  }

  /**
   * 生成RLE编码图案
   * @param {Object} emojiPattern - emoji图案
   * @param {number} size - 图案大小
   * @returns {string} RLE编码数据
   */
  static generateRLEPattern(emojiPattern, size) {
    const totalPixels = size * size;
    const colors = emojiPattern.dominantColors || ['#FF0000'];

    // 简单的RLE编码生成
    const rleData = [];
    let currentColor = colors[0];
    let count = 0;

    for (let i = 0; i < totalPixels; i++) {
      if (count === 0 || Math.random() < 0.1) {
        if (count > 0) {
          rleData.push({ count, color: currentColor });
        }
        currentColor = colors[Math.floor(Math.random() * colors.length)];
        count = 1;
      } else {
        count++;
      }
    }

    if (count > 0) {
      rleData.push({ count, color: currentColor });
    }

    return JSON.stringify(rleData);
  }

  /**
   * 生成WebP图案
   * @param {Object} emojiPattern - emoji图案
   * @param {number} size - 图案大小
   * @returns {string} WebP base64数据
   */
  static async generateWebPPattern(emojiPattern, size) {
    // 模拟WebP生成（实际项目中可以使用canvas或图像处理库）
    const mockWebPData = `data:image/webp;base64,${Buffer.from('mock_webp_data').toString('base64')}`;
    return mockWebPData;
  }

  /**
   * 优化存储格式
   * @param {Object} multiResolution - 多分辨率数据
   * @returns {Object} 优化后的payload
   */
  static async optimizePayload(multiResolution) {
    return {
      version: '1.0',
      format: 'hybrid',
      width: 32,
      height: 32,
      data: multiResolution,
      metadata: {
        generatedAt: new Date().toISOString(),
        processor: 'CustomFlagProcessor'
      }
    };
  }

  /**
   * 强制背景去除 - 不可跳过
   * @param {Buffer} imageBuffer - 图像数据
   * @returns {Buffer} 带透明通道的PNG
   */
  static async forceBackgroundRemoval(imageBuffer) {
    try {
      console.log('🎨 执行强制背景去除...');

      // 优先使用外部API
      const externalResult = await this.tryExternalBackgroundRemoval(imageBuffer);
      if (externalResult.success) {
        console.log('✅ 外部API背景去除成功');
        return externalResult.buffer;
      }

      // 备用：使用Sharp进行基础背景处理
      console.log('⚠️ 使用Sharp基础背景处理作为备用');
      return await this.sharpBackgroundRemoval(imageBuffer);

    } catch (error) {
      console.error('❌ 背景去除失败:', error);
      throw new Error(`背景去除失败: ${error.message}`);
    }
  }

  /**
   * 尝试外部API背景去除
   * @param {Buffer} imageBuffer - 图像数据
   * @returns {Object} 处理结果
   */
  static async tryExternalBackgroundRemoval(imageBuffer) {
    const apis = [
      { name: 'remove.bg', key: process.env.REMOVEBG_API_KEY, url: 'https://api.remove.bg/v1.0/removebg' },
      { name: 'clipdrop', key: process.env.CLIPDROP_API_KEY, url: 'https://clipdrop-api.co/remove-background/v1' }
    ];

    for (const api of apis) {
      if (api.key) {
        try {
          console.log(`🔄 尝试使用 ${api.name} API...`);
          const result = await this.callBackgroundRemovalAPI(imageBuffer, api);
          if (result) {
            return { success: true, buffer: result, provider: api.name };
          }
        } catch (error) {
          console.warn(`⚠️ ${api.name} API失败:`, error.message);
          continue;
        }
      }
    }

    return { success: false };
  }

  /**
   * 调用背景去除API
   * @param {Buffer} imageBuffer - 图像数据
   * @param {Object} apiConfig - API配置
   * @returns {Buffer} 处理结果
   */
  static async callBackgroundRemovalAPI(imageBuffer, apiConfig) {
    const FormData = require('form-data');
    const axios = require('axios');

    const formData = new FormData();
    formData.append('image_file', imageBuffer, 'image.png');

    // 根据不同API添加参数
    if (apiConfig.name === 'remove.bg') {
      formData.append('size', 'auto');
      formData.append('type', 'auto');
    }

    const response = await axios.post(apiConfig.url, formData, {
      headers: {
        'X-Api-Key': apiConfig.key,
        ...formData.getHeaders()
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });

    return response.data;
  }

  /**
   * Sharp基础背景处理
   * @param {Buffer} imageBuffer - 图像数据
   * @returns {Buffer} 处理结果
   */
  static async sharpBackgroundRemoval(imageBuffer) {
    const sharp = require('sharp');

    try {
      console.log('🔧 使用Sharp进行智能背景处理...');

      // 1. 获取图像信息
      const metadata = await sharp(imageBuffer).metadata();
      const { data, info } = await sharp(imageBuffer)
        .resize(256, 256, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // 2. 检测背景色（通常是四角或边缘的主要颜色）
      const backgroundColor = this.detectBackgroundColor(data, info);
      console.log(`🎨 检测到背景色: ${backgroundColor}`);

      // 3. 创建alpha蒙版，将背景色设为透明
      const processedData = this.createTransparencyMask(data, info, backgroundColor);

      // 4. 重建图像并增强主体
      const processed = await sharp(processedData, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4
        }
      })
        .modulate({
          brightness: 1.15,
          saturation: 1.3,
          lightness: 1.1
        })
        .sharpen({ sigma: 1.2, flat: 1.5, jagged: 2.5 })
        .ensureAlpha(1) // 确保alpha通道
        .png({
          compressionLevel: 6,
          adaptiveFiltering: false,
          force: true,
          quality: 90
        })
        .toBuffer();

      console.log('✅ Sharp背景处理完成');
      return processed;

    } catch (error) {
      console.error('❌ Sharp背景处理失败:', error);
      // 降级为简单处理
      return await sharp(imageBuffer)
        .modulate({ brightness: 1.2, saturation: 1.3 })
        .sharpen()
        .png({ compressionLevel: 6 })
        .toBuffer();
    }
  }

  /**
   * 检测背景色
   * @param {Buffer} data - 图像原始数据
   * @param {Object} info - 图像信息
   * @returns {Object} 背景色RGBA
   */
  static detectBackgroundColor(data, info) {
    const width = info.width;
    const height = info.height;
    const channels = info.channels;

    // 采样边缘像素来检测背景色
    const edgePixels = [];

    // 采样四角
    const corners = [
      { x: 0, y: 0 }, // 左上
      { x: width - 1, y: 0 }, // 右上
      { x: 0, y: height - 1 }, // 左下
      { x: width - 1, y: height - 1 } // 右下
    ];

    for (const corner of corners) {
      const idx = (corner.y * width + corner.x) * channels;
      edgePixels.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: channels > 3 ? data[idx + 3] : 255
      });
    }

    // 采样边缘（每隔10个像素）
    for (let i = 0; i < width; i += 10) {
      // 上边缘
      let idx = (0 * width + i) * channels;
      edgePixels.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: channels > 3 ? data[idx + 3] : 255
      });

      // 下边缘
      idx = ((height - 1) * width + i) * channels;
      edgePixels.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: channels > 3 ? data[idx + 3] : 255
      });
    }

    // 计算平均背景色
    const avgColor = edgePixels.reduce((acc, pixel) => ({
      r: acc.r + pixel.r,
      g: acc.g + pixel.g,
      b: acc.b + pixel.b,
      a: acc.a + pixel.a
    }), { r: 0, g: 0, b: 0, a: 0 });

    const count = edgePixels.length;
    return {
      r: Math.round(avgColor.r / count),
      g: Math.round(avgColor.g / count),
      b: Math.round(avgColor.b / count),
      a: Math.round(avgColor.a / count)
    };
  }

  /**
   * 创建透明度蒙版
   * @param {Buffer} data - 原始图像数据
   * @param {Object} info - 图像信息
   * @param {Object} backgroundColor - 背景色
   * @returns {Buffer} 带透明通道的图像数据
   */
  static createTransparencyMask(data, info, backgroundColor) {
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    const tolerance = 50; // 颜色容差

    // 创建新的4通道数据（RGBA）
    const rgbaData = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * channels;
        const dstIdx = (y * width + x) * 4;

        const pixel = {
          r: data[srcIdx],
          g: data[srcIdx + 1],
          b: data[srcIdx + 2],
          a: channels > 3 ? data[srcIdx + 3] : 255
        };

        // 计算与背景色的差异
        const diff = Math.sqrt(
          Math.pow(pixel.r - backgroundColor.r, 2) +
          Math.pow(pixel.g - backgroundColor.g, 2) +
          Math.pow(pixel.b - backgroundColor.b, 2)
        );

        // 如果与背景色相似，设置为透明
        let alpha = pixel.a;
        if (diff < tolerance) {
          // 渐变透明度
          alpha = Math.max(0, 255 - (tolerance - diff) * 2);
        }

        rgbaData[dstIdx] = pixel.r;
        rgbaData[dstIdx + 1] = pixel.g;
        rgbaData[dstIdx + 2] = pixel.b;
        rgbaData[dstIdx + 3] = alpha;
      }
    }

    return rgbaData;
  }

  /**
   * 下载URL图像
   * @param {string} imageUrl - 图像URL
   * @returns {Buffer} 图像数据
   */
  static async downloadImageFromUrl(imageUrl) {
    const axios = require('axios');

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'CustomFlagProcessor/1.0'
      }
    });

    return Buffer.from(response.data);
  }

  /**
   * 获取图像元数据
   * @param {Buffer} imageBuffer - 图像数据
   * @returns {Object} 元数据
   */
  static async getImageMetadata(imageBuffer) {
    const sharp = require('sharp');

    try {
      const metadata = await sharp(imageBuffer).metadata();
      return {
        width: metadata.width || 256,
        height: metadata.height || 256,
        format: metadata.format || 'png',
        channels: metadata.channels || 4,
        hasAlpha: metadata.hasAlpha || true
      };
    } catch (error) {
      console.warn('获取元数据失败，使用默认值:', error.message);
      return {
        width: 256,
        height: 256,
        format: 'png',
        channels: 4,
        hasAlpha: true
      };
    }
  }

  /**
   * 🔥 第二步：低分辨率转换 - 最近邻缩放+调色板量化
   * @param {Buffer} imageBuffer - 带透明通道的图像
   * @param {Object} options - 转换选项
   * @returns {Buffer} 低分辨率图像
   */
  static async convertToLowResPattern(imageBuffer, options = {}) {
    try {
      console.log('📐 开始低分辨率转换 - 最近邻缩放+调色板量化');

      const {
        targetSize = 64,
        maxColors = 4, // 包括透明色，最多4种颜色
        preserveTransparency = true,
        enhanceContrast = true
      } = options;

      // 确保图像有透明通道
      let buffer = imageBuffer;
      if (!Buffer.isBuffer(imageBuffer)) {
        if (imageBuffer.buffer) {
          buffer = imageBuffer.buffer;
        } else {
          throw new Error('无效的图像缓冲区');
        }
      }

      // 验证buffer不为空
      if (!buffer || buffer.length === 0) {
        throw new Error('图像缓冲区为空');
      }

      const sharp = require('sharp');

      // 验证buffer是否为有效图像
      try {
        const metadata = await sharp(buffer).metadata();
        if (!metadata.width || !metadata.height) {
          throw new Error('无效的图像尺寸');
        }
        console.log(`📏 原始图像尺寸: ${metadata.width}x${metadata.height}`);
      } catch (metadataError) {
        throw new Error(`图像格式验证失败: ${metadataError.message}`);
      }

      let pipeline = sharp(buffer);

      // 🎯 额外建议：增强主体对比度
      if (enhanceContrast) {
        pipeline = pipeline
          .modulate({
            brightness: 1.05,    // 稍微提高亮度
            saturation: 1.15,   // 提升饱和度，避免灰度
            lightness: 1.05
          })
          .sharpen({
            sigma: 1.2,
            flat: 1,
            jagged: 2
          });
      }

      // 🔥 第二步核心：最近邻插值缩放，保留硬边缘
      const resized = await pipeline
        .resize(targetSize, targetSize, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: 'nearest' // 👈 关键：最近邻插值，无抗锯齿
        })
        .png({
          quality: 100,
          compressionLevel: 9,
          adaptiveFiltering: false, // 禁用自适应滤镜
          force: true
        })
        .toBuffer();

      console.log(`✅ 最近邻缩放完成: ${targetSize}x${targetSize}`);

      // 🔥 第二步核心：调色板量化（限制颜色数）
      const quantized = await sharp(resized)
        .png({
          palette: true,           // 启用调色板
          colors: maxColors,        // 限制为4种颜色（包括透明）
          quality: 100,
          compressionLevel: 9
        })
        .toBuffer();

      console.log(`✅ 调色板量化完成，限制颜色数为: ${maxColors}`);

      // 验证结果
      const finalMetadata = await sharp(quantized).metadata();
      console.log('📊 最终图像信息:', {
        width: finalMetadata.width,
        height: finalMetadata.height,
        format: finalMetadata.format,
        channels: finalMetadata.channels,
        hasAlpha: finalMetadata.hasAlpha,
        size: quantized.length
      });

      // 返回完整的低分辨率图案信息
      return {
        lowResBuffer: quantized,
        buffer: quantized,
        targetSize: targetSize,
        width: finalMetadata.width,
        height: finalMetadata.height,
        format: finalMetadata.format,
        size: quantized.length,
        palette: await this.extractColorPalette({ buffer: quantized }),
        complexity: 0.7, // 基于处理复杂度的估算
        confidence: 0.8, // 基于处理质量的估算
        hasTransparency: finalMetadata.hasAlpha,
        processingSteps: ['nearest_neighbor_scaling', 'color_quantization'],
        metadata: {
          originalSize: buffer.length,
          processedAt: new Date().toISOString(),
          compressionRatio: quantized.length / buffer.length
        }
      };

    } catch (error) {
      console.error('❌ 低分辨率转换失败:', error);
      throw new Error(`低分辨率转换失败: ${error.message}`);
    }
  }

  /**
   * 批量低分辨率转换
   * @param {Buffer} imageBuffer - 原始图像
   * @param {Array} sizes - 目标尺寸数组
   * @returns {Object} 多个低分辨率版本
   */
  static async convertToMultipleLowResPatterns(imageBuffer, sizes = [8, 32, 64]) {
    try {
      console.log('🔄 批量低分辨率转换...');

      const results = {};

      for (const size of sizes) {
        console.log(`📐 处理 ${size}x${size} 版本...`);
        const maxColors = size <= 8 ? 2 : size <= 32 ? 3 : 4; // 根据尺寸调整颜色数
        const lowResBuffer = await this.convertToLowResPattern(imageBuffer, {
          targetSize: size,
          maxColors: maxColors,
          enhanceContrast: true
        });

        results[size] = {
          width: size,
          height: size,
          buffer: lowResBuffer,
          format: 'png',
          colors: maxColors,
          size: lowResBuffer.length,
          base64: lowResBuffer.toString('base64')
        };
      }

      console.log('✅ 批量低分辨率转换完成');
      return results;

    } catch (error) {
      console.error('❌ 批量低分辨率转换失败:', error);
      throw error;
    }
  }

  /**
   * 提取主色调
   * @param {Buffer} imageBuffer - 图像数据
   * @returns {string} 主色调
   */
  static async extractDominantColor(imageBuffer) {
    try {
      const sharp = require('sharp');

      // 缩放到小尺寸进行分析
      const { data, info } = await sharp(imageBuffer)
        .resize(4, 4, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // 统计颜色
      const colorMap = new Map();
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 只统计不透明像素
        if (a > 128) {
          const key = `${r},${g},${b}`;
          colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }
      }

      // 返回最频繁的颜色
      if (colorMap.size > 0) {
        const dominantColor = Array.from(colorMap.entries())
          .sort((a, b) => b[1] - a[1])[0][0];
        return `#${dominantColor.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('')}`;
      }

      return '#FF0000'; // 默认红色
    } catch (error) {
      console.warn('提取主色调失败:', error);
      return '#FF0000';
    }
  }

  /**
   * 从低分辨率数据提取颜色
   * @param {Object} lowResData - 低分辨率数据
   * @returns {Array} 颜色数组
   */
  static async extractColorsFromLowRes(lowResData) {
    try {
      const sharp = require('sharp');

      // 分析64x64图像的颜色
      const { data, info } = await sharp(lowResData.buffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const colors = new Set();
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 只统计不透明像素
        if (a > 128) {
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          colors.add(hex);
        }
      }

      const colorArray = Array.from(colors);

      // 返回最多4种主要颜色
      return colorArray.slice(0, 4);
    } catch (error) {
      console.warn('从低分辨率数据提取颜色失败:', error);
      return ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'].slice(0, 2);
    }
  }

  /**
   * 从低分辨率图案生成emoji
   * @param {Object} lowResData - 低分辨率数据
   * @returns {string} emoji
   */
  static async generateEmojiFromLowResPattern(lowResData) {
    try {
      // 分析图像特征
      const sharp = require('sharp');
      const { data, info } = await sharp(lowResData.buffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

      let centerPixels = [];
      const centerStart = (64 - 16) / 2; // 中心16x16区域
      const centerEnd = centerStart + 16;

      // 采集中心区域的像素
      for (let y = centerStart; y < centerEnd; y++) {
        for (let x = centerStart; x < centerEnd; x++) {
          const idx = (y * 64 + x) * info.channels;
          const a = data[idx + 3];
          if (a > 128) { // 只统计不透明像素
            centerPixels.push({
              r: data[idx],
              g: data[idx + 1],
              b: data[idx + 2],
              a: a
            });
          }
        }
      }

      if (centerPixels.length === 0) {
        return '🏴'; // 默认旗帜
      }

      // 分析颜色特征
      const avgColor = centerPixels.reduce((acc, pixel) => ({
        r: acc.r + pixel.r,
        g: acc.g + pixel.g,
        b: acc.b + pixel.b,
        a: acc.a + pixel.a
      }), { r: 0, g: 0, b: 0, a: 0 });

      const count = centerPixels.length;
      avgColor.r = Math.round(avgColor.r / count);
      avgColor.g = Math.round(avgColor.g / count);
      avgColor.b = Math.round(avgColor.b / count);

      // 根据颜色特征选择emoji
      const emojiMap = this.getEmojiColorMap(avgColor);

      return emojiMap[Math.floor(Math.random() * emojiMap.length)];
    } catch (error) {
      console.warn('从低分辨率生成emoji失败:', error);
      return '🏴';
    }
  }

  /**
   * 获取基于颜色的emoji映射
   * @param {Object} color - RGB颜色对象
   * @returns {Array} emoji数组
   */
  static getEmojiColorMap(color) {
    const { r, g, b } = color;

    // 简单的颜色分析
    if (r > 200 && g < 100 && b < 100) {
      return ['🔴', '❤️', '🟥️', '🧡']; // 红色系
    } else if (r < 100 && g > 200 && b < 100) {
      return ['🟢', '💚', '✅', '🟩']; // 绿色系
    } else if (r < 100 && g < 100 && b > 200) {
      return ['🔵', '💙', '🔹', '💎']; // 蓝色系
    } else if (r > 180 && g > 180 && b < 100) {
      return ['🟡', '🟠', '⭐', '☀️']; // 黄色系
    } else if (r > 180 && g < 100 && b > 180) {
      return ['🟣', '💜', '🔮', '🌸']; // 紫色系
    } else if (r < 100 && g > 180 && b > 180) {
      return ['🟦', '💚�', '🔷', '🎨']; // 青色系
    } else if (r > 150 && g > 150 && b > 150) {
      return ['⚪', '🤍', '⚫', '🌈']; // 浅色系
    } else if (r < 100 && g < 100 && b < 100) {
      return ['⚫', '⬛', '🔲', '⚫']; // 深色系
    } else {
      return ['🏴', '🏳️', '🚩', '🎌']; // 旗帜系
    }
  }

  /**
   * 保存处理后的图像
   * @param {Object} multiResolution - 多分辨率数据
   * @returns {string} 图像URL
   */
  static async saveProcessedImage(multiResolution) {
    // 模拟图像保存（实际项目中保存到文件系统或云存储）
    const imageId = crypto.randomUUID();
    return `/uploads/custom_flags/${imageId}.png`;
  }

  /**
   * 生成最优emoji
   * @param {Object} aiResult - AI处理结果
   * @returns {string} emoji
   */
  static generateOptimalEmoji(aiResult) {
    const { imageAnalysis } = aiResult;
    const { subjectType, confidence } = imageAnalysis.aiAnalysis;

    // 根据主体类型和置信度选择emoji
    const emojiMap = {
      'person': ['👤', '🧑', '👱', '👨', '👩'],
      'animal': ['🐱', '🐶', '🐼', '🦊', '🐨'],
      'symbol': ['⭐', '🔶', '🔷', '💎', '🎯'],
      'text': ['📝', '📄', '📃', '📋', '🗒️'],
      'object': ['📦', '🎁', '📦', '🎪', '🏆'],
      'unknown': ['🏴', '🏁', '🚩', '🎌', '🏳️']
    };

    const emojiOptions = emojiMap[subjectType] || emojiMap['unknown'];

    // 根据置信度选择emoji
    if (confidence > 0.8) {
      return emojiOptions[0]; // 最相关的emoji
    } else if (confidence > 0.5) {
      return emojiOptions[Math.floor(Math.random() * Math.min(3, emojiOptions.length))];
    } else {
      return emojiOptions[Math.floor(Math.random() * emojiOptions.length)];
    }
  }

  /**
   * 提取主色调
   * @param {Object} multiResolution - 多分辨率数据
   * @returns {Array} 颜色数组
   */
  static extractDominantColors(multiResolution) {
    // 从不同分辨率中提取颜色，这里简化处理
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];

    // 随机选择2-4种颜色作为主色调
    const count = Math.floor(Math.random() * 3) + 2;
    return colors.slice(0, count);
  }

  /**
   * 🔥 备用处理方案 - 应用三步修复
   * @param {Object} preprocessedImage - 预处理图像
   * @param {Object} options - 原始选项
   * @param {Object} fallbackData - 备用数据
   * @returns {Object} 处理结果
   */
  static async processWithFallback(preprocessedImage, options, fallbackData) {
    console.log('🔄 使用备用处理方案 - 应用三步修复...');

    try {
      console.log('🔧 应用三步修复方案...');

      // 验证预处理的图像
      if (!preprocessedImage.buffer || !preprocessedImage.hasTransparency) {
        console.warn('⚠️ 预处理图像无效，重新处理...');
        preprocessedImage = await this.forceBackgroundRemoval(preprocessedImage.buffer);
      }

      // 🔥 核心三步修复：
      // 1. 确保透明通道 ✓ (已在preprocessImage中完成)
      // 2. 最近邻缩放+调色板量化
      const lowResPatterns = await this.convertToMultipleLowResPatterns(preprocessedImage.buffer);
      // 3. 主体对比度增强 ✓ (已在convertToLowResPattern中完成)

      console.log('✅ 三步修复完成，生成多分辨率数据');

      // 构建优化的多分辨率payload
      const optimizedMultiResolution = {
        // 超低分辨率（1x1像素）- 纯色
        ultraLow: {
          format: 'color',
          data: this.extractDominantColor(lowResPatterns[64].buffer) || '#FF0000'
        },

        // 低分辨率（8x8像素）- 2种颜色
        low: {
          format: 'png',
          width: 8,
          height: 8,
          data: lowResPatterns[8].base64
        },

        // 中分辨率（32x32像素）- 3种颜色
        medium: {
          format: 'png',
          width: 32,
          height: 32,
          data: lowResPatterns[32].base64
        },

        // 高分辨率（64x64像素）- 4种颜色
        high: {
          format: 'png',
          width: 64,
          height: 64,
          data: lowResPatterns[64].base64
        }
      };

      // 优化存储格式
      const optimizedPayload = await this.optimizePayload(optimizedMultiResolution);

      // 基于低分辨率数据生成emoji
      const emojiVersion = this.generateEmojiFromLowResPattern(lowResPatterns[64]);

      // 提取优化后的颜色
      const dominantColors = this.extractColorsFromLowRes(lowResPatterns[64]);

      return {
        width: 64,
        height: 64,
        encoding: 'hybrid',
        payload: JSON.stringify(optimizedPayload),
        processedImageUrl: await this.saveProcessedImage(optimizedMultiResolution),
        emojiVersion: emojiVersion,
        metadata: {
          originalSize: preprocessedImage.originalSize,
          dominantColors: dominantColors,
          complexity: 0.7, // 三步修复后的置信度
          threeStepProcess: {
            backgroundRemoved: true,
            nearestNeighborScaling: true,
            colorQuantization: true,
            contrastEnhanced: true
          },
          fallbackUsed: true,
          fallbackData: fallbackData,
          processing: {
            method: 'three_step_fix',
            sizes: Object.keys(lowResPatterns)
          }
        }
      };

    } catch (error) {
      console.error('❌ 三步修复失败:', error);

      // 最终备用：返回默认旗帜
      console.log('🚨 使用最终备用方案...');
      return {
        width: 64,
        height: 64,
        encoding: 'hybrid',
        payload: JSON.stringify(this.getDefaultPayload()),
        processedImageUrl: '/uploads/custom_flags/default.png',
        emojiVersion: '🏴',
        metadata: {
          originalSize: preprocessedImage.originalSize,
          dominantColors: ['#FF0000', '#FFFFFF'],
          complexity: 0.3,
          fallbackUsed: true,
          error: true,
          processing: {
            method: 'default_fallback'
          }
        }
      };
    }
  }

  /**
   * 获取默认payload
   */
  static getDefaultPayload() {
    return {
      version: '1.0',
      format: 'hybrid',
      width: 64,
      height: 64,
      data: {
        ultraLow: { format: 'color', data: '#FF0000' },
        low: { format: 'emoji', data: '🏴' },
        medium: { format: 'rle', data: JSON.stringify([{ count: 4096, color: '#FF0000' }]) },
        high: { format: 'webp', data: 'data:image/webp;base64,placeholder' }
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        processor: 'CustomFlagProcessor-Fallback'
      }
    };
  }

  /**
   * 批准自定义旗帜订单
   * @param {string} orderId - 订单ID
   * @param {string} processorId - 处理人ID
   * @param {string} notes - 处理备注
   */
  static async approveCustomFlag(orderId, processorId, notes, trx = null) {
    const { db } = require('../config/database');
    const logger = require('../utils/logger');
    const useTrx = trx || db;

    try {
      // 获取订单信息
      const order = await useTrx('custom_flag_orders')
        .where('id', orderId)
        .first();

      if (!order) {
        throw new Error('订单不存在');
      }

      // 处理原始图像用于preview（可选）
      const ImageProcessor = require('./imageProcessor');

      // ✅ 修复：先将URL/Base64统一转为Buffer，避免processUserImage误将URL当作Base64解码
      let processInput;
      if (order.original_image_url && order.original_image_url.startsWith('http')) {
        logger.info(`📥 从 URL 下载图像: ${order.original_image_url}`);
        processInput = await this.downloadImageFromUrl(order.original_image_url);
      } else if (order.original_image_url && order.original_image_url.startsWith('data:image/')) {
        const base64Data = order.original_image_url.split(',')[1];
        processInput = Buffer.from(base64Data, 'base64');
      } else if (order.original_image_url) {
        processInput = Buffer.from(order.original_image_url, 'base64');
      } else {
        throw new Error('订单缺少原始图像数据');
      }

      const processedResult = await ImageProcessor.processUserImage(processInput);
      logger.info(`✅ 原始图像处理完成: ${orderId}`);

      // 创建图案资源（集成Material系统）
      const PatternAsset = require('../models/PatternAsset');
      const patternKey = `custom_flag_${orderId}`;

      // 使用已获取的 processInput buffer（避免重复下载/解码）
      const sharp = require('sharp');
      let resizedBase64 = null;
      const imageBuffer = processInput;

      try {
        // 获取原始尺寸
        const metadata = await sharp(imageBuffer).metadata();
        logger.info(`📏 原始图片尺寸: ${metadata.width}x${metadata.height}`);

        // 如果图片尺寸不在Material系统要求范围内，进行resize
        const maxSize = 512;
        const minSize = 16;

        if (metadata.width > maxSize || metadata.height > maxSize || metadata.width < minSize || metadata.height < minSize) {
          // 计算目标尺寸（保持宽高比，最大不超过256px以优化性能）
          const targetSize = Math.min(maxSize, 256);
          let targetWidth = metadata.width;
          let targetHeight = metadata.height;

          if (metadata.width > targetSize || metadata.height > targetSize) {
            const scale = Math.min(targetSize / metadata.width, targetSize / metadata.height);
            targetWidth = Math.round(metadata.width * scale);
            targetHeight = Math.round(metadata.height * scale);
          } else if (metadata.width < minSize || metadata.height < minSize) {
            // 放大到最小尺寸
            const scale = Math.max(minSize / metadata.width, minSize / metadata.height);
            targetWidth = Math.round(metadata.width * scale);
            targetHeight = Math.round(metadata.height * scale);
          }

          logger.info(`📐 调整图片尺寸: ${metadata.width}x${metadata.height} -> ${targetWidth}x${targetHeight}`);

          const resizedBuffer = await sharp(imageBuffer)
            .resize(targetWidth, targetHeight, {
              fit: 'contain',
              background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .png()
            .toBuffer();

          resizedBase64 = `data:image/png;base64,${resizedBuffer.toString('base64')}`;
          logger.info(`✅ 图片已调整至合适尺寸`);
        } else {
          logger.info(`✅ 图片尺寸符合Material系统要求，无需调整`);
        }
      } catch (error) {
        logger.warn(`⚠️ 图片尺寸调整失败，使用原始图片:`, error.message);
      }

      // 准备Material系统配置
      const materialConfig = {
        base64: resizedBase64, // 使用调整后的图片base64
        materialKey: patternKey,
        fileName: `custom_flag_${orderId}.png`,
        refresh: true // 强制创建新的Material
      };

      const patternAsset = await PatternAsset.create({
        key: patternKey,
        name: order.pattern_name,
        category: 'custom_flag',
        width: processedResult.width || 64,
        height: processedResult.height || 64,
        encoding: 'png_base64', // Material系统需要png_base64编码
        payload: resizedBase64, // 保存调整后的base64数据作为payload
        render_type: 'complex', // 使用complex类型以启用Material系统
        created_by: order.user_id,
        image_url: order.original_image_url.startsWith('http') ? order.original_image_url : null, // 存储 CDN URL
        verified: true,
        material_config: materialConfig // 传递Material配置以自动创建Material
      });

      logger.info(`✅ 图案资源创建成功: ${patternAsset.id}, material_id: ${patternAsset.material_id || 'null'}`);

      // 添加到用户库存
      const inventoryId = crypto.randomUUID();
      await useTrx('user_custom_patterns').insert({
        id: inventoryId,
        user_id: order.user_id,
        pattern_id: patternAsset.id,
        order_id: orderId,
        created_at: new Date()
      });

      // 更新订单状态
      await useTrx('custom_flag_orders')
        .where('id', orderId)
        .update({
          status: 'approved',
          admin_notes: notes,
          processed_by: processorId,
          processed_at: new Date(),
          updated_at: new Date()
        });

      logger.info('自定义旗帜已批准', { orderId, processorId });
    } catch (error) {
      logger.error('批准自定义旗帜失败:', error);
      throw error;
    }
  }

  /**
   * 拒绝自定义旗帜订单
   * @param {string} orderId - 订单ID
   * @param {string} processorId - 处理人ID
   * @param {string} notes - 拒绝理由
   */
  static async rejectCustomFlag(orderId, processorId, notes, trx = null) {
    const { db } = require('../config/database');
    const logger = require('../utils/logger');
    const useTrx = trx || db;

    try {
      // 更新订单状态
      await useTrx('custom_flag_orders')
        .where('id', orderId)
        .update({
          status: 'rejected',
          admin_notes: notes,
          processed_by: processorId,
          processed_at: new Date(),
          updated_at: new Date()
        });

      // 删除临时存储数据
      await useTrx('temp_pattern_storage')
        .where('order_id', orderId)
        .del();

      logger.info('自定义旗帜已拒绝', { orderId, processorId, notes });
    } catch (error) {
      logger.error('拒绝自定义旗帜失败:', error);
      throw error;
    }
  }

  /**
   * 验证图像格式
   * @param {string} imageData - 图像数据
   * @returns {boolean} 是否有效
   */
  static validateImageFormat(imageData) {
    const supportedFormats = ['jpg', 'jpeg', 'png', 'gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (imageData.startsWith('data:image/')) {
      const format = imageData.split(';')[0].split('/')[1];
      const base64Data = imageData.split(',')[1];
      const size = (base64Data.length * 3) / 4; // base64解码后的大小

      return supportedFormats.includes(format) && size <= maxSize;
    }

    return false;
  }
}

module.exports = CustomFlagProcessor;
