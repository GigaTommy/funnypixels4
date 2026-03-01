const sharp = require('sharp');

class AIDetectionService {
  constructor() {
    // 初始化检测模型（这里使用简化的检测逻辑）
    this.detectionModels = {
      faceDetection: this.detectFaces.bind(this),
      trademarkDetection: this.detectTrademarks.bind(this),
      copyrightDetection: this.detectCopyrightContent.bind(this),
      inappropriateDetection: this.detectInappropriateContent.bind(this)
    };
  }

  // 主要检测方法
  async detectContent(imageBuffer) {
    try {
      // 转换图像格式
      const processedImage = await this.preprocessImage(imageBuffer);
      
      // 并行执行所有检测
      const detectionResults = await Promise.all([
        this.detectionModels.faceDetection(processedImage),
        this.detectionModels.trademarkDetection(processedImage),
        this.detectionModels.copyrightDetection(processedImage),
        this.detectionModels.inappropriateDetection(processedImage)
      ]);

      // 合并检测结果
      const combinedResults = this.combineDetectionResults(detectionResults);
      
      // 计算风险等级
      const riskLevel = this.calculateRiskLevel(combinedResults);
      
      // 计算置信度
      const confidence = this.calculateConfidence(combinedResults);

      return {
        risk_level: riskLevel,
        confidence: confidence,
        detections: combinedResults,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('AI检测失败:', error);
      // 返回默认的低风险结果
      return {
        risk_level: 'low',
        confidence: 0.5,
        detections: {},
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 图像预处理
  async preprocessImage(imageBuffer) {
    try {
      // 使用sharp处理图像
      const processed = await sharp(imageBuffer)
        .resize(224, 224) // 标准化尺寸
        .png()
        .toBuffer();

      return processed;
    } catch (error) {
      console.error('图像预处理失败:', error);
      // 返回原始图像，让后续处理继续
      return imageBuffer;
    }
  }

  // 人脸检测（简化版本）
  async detectFaces(imageBuffer) {
    try {
      // 简化的检测逻辑，基于图像元数据
      const metadata = await sharp(imageBuffer).metadata();
      
      // 基于图像尺寸和格式的简单判断
      const aspectRatio = metadata.width / metadata.height;
      const isPortrait = aspectRatio < 0.8; // 竖屏可能是人像
      
      // 简化的检测结果
      const hasFaces = isPortrait && metadata.width > 100; // 简单的判断逻辑
      const confidence = hasFaces ? 0.6 : 0.3;

      return {
        has_faces: hasFaces,
        face_count: hasFaces ? 1 : 0,
        confidence: confidence,
        aspect_ratio: aspectRatio
      };
    } catch (error) {
      console.error('人脸检测失败:', error);
      return {
        has_faces: false,
        face_count: 0,
        confidence: 0.0,
        error: error.message
      };
    }
  }

  // 商标检测（简化版本）
  async detectTrademarks(imageBuffer) {
    try {
      // 简化的商标检测逻辑，基于图像元数据
      const metadata = await sharp(imageBuffer).metadata();
      
      // 基于图像特征的简单判断
      const hasTrademarks = metadata.width > 200 && metadata.height > 200; // 大尺寸可能是商标
      const confidence = hasTrademarks ? 0.5 : 0.2;

      return {
        has_trademarks: hasTrademarks,
        trademark_count: hasTrademarks ? 1 : 0,
        confidence: confidence,
        image_size: `${metadata.width}x${metadata.height}`
      };
    } catch (error) {
      console.error('商标检测失败:', error);
      return {
        has_trademarks: false,
        trademark_count: 0,
        confidence: 0.0,
        error: error.message
      };
    }
  }

  // 版权内容检测（简化版本）
  async detectCopyrightContent(imageBuffer) {
    try {
      // 简化的版权内容检测，基于图像元数据
      const metadata = await sharp(imageBuffer).metadata();
      
      // 基于图像格式和尺寸的简单判断
      const isComplex = metadata.width > 300 || metadata.height > 300; // 大尺寸可能是复杂内容
      const complexity = isComplex ? 0.6 : 0.3;

      return {
        is_copyright_content: isComplex,
        complexity_score: complexity,
        image_format: metadata.format,
        confidence: complexity
      };
    } catch (error) {
      console.error('版权内容检测失败:', error);
      return {
        is_copyright_content: false,
        complexity_score: 0,
        image_format: 'unknown',
        confidence: 0.0,
        error: error.message
      };
    }
  }

  // 不当内容检测（简化版本）
  async detectInappropriateContent(imageBuffer) {
    try {
      // 简化的不当内容检测，基于图像元数据
      const metadata = await sharp(imageBuffer).metadata();
      
      // 基于图像特征的简单判断
      const isInappropriate = metadata.width < 50 && metadata.height < 50; // 极小尺寸可能是不当内容
      const inappropriateScore = isInappropriate ? 0.7 : 0.1;

      return {
        is_inappropriate: isInappropriate,
        inappropriate_score: inappropriateScore,
        image_size: `${metadata.width}x${metadata.height}`,
        confidence: inappropriateScore
      };
    } catch (error) {
      console.error('不当内容检测失败:', error);
      return {
        is_inappropriate: false,
        inappropriate_score: 0,
        image_size: 'unknown',
        confidence: 0.0,
        error: error.message
      };
    }
  }

  // 合并检测结果
  combineDetectionResults(results) {
    const [faceResult, trademarkResult, copyrightResult, inappropriateResult] = results;
    
    return {
      faces: faceResult,
      trademarks: trademarkResult,
      copyright_content: copyrightResult,
      inappropriate_content: inappropriateResult
    };
  }

  // 计算风险等级
  calculateRiskLevel(detections) {
    let riskScore = 0;

    // 人脸检测权重
    if (detections.faces.has_faces && detections.faces.confidence > 0.7) {
      riskScore += 3;
    }

    // 商标检测权重
    if (detections.trademarks.has_trademarks && detections.trademarks.confidence > 0.6) {
      riskScore += 2;
    }

    // 版权内容检测权重
    if (detections.copyright_content.is_copyright_content && detections.copyright_content.confidence > 0.5) {
      riskScore += 2;
    }

    // 不当内容检测权重
    if (detections.inappropriate_content.is_inappropriate && detections.inappropriate_content.confidence > 0.5) {
      riskScore += 4;
    }

    // 根据风险分数确定风险等级
    if (riskScore >= 5) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  // 计算置信度
  calculateConfidence(detections) {
    const confidences = [
      detections.faces.confidence,
      detections.trademarks.confidence,
      detections.copyright_content.confidence,
      detections.inappropriate_content.confidence
    ];

    // 返回平均置信度
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }
}

// 创建单例实例
const aiDetectionService = new AIDetectionService();

module.exports = aiDetectionService;
