const PatternUpload = require('../models/PatternUpload');
const aiDetectionService = require('../services/aiDetectionService');
const ImageProcessor = require('../services/imageProcessor');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

class PatternUploadController {
  // 上传图案
  static async uploadPattern(req, res) {
    try {
      const { name, description, service_type = 'free' } = req.body;
      const userId = req.user.id;

      // 检查文件
      if (!req.file) {
        return res.status(400).json({ error: '请上传图片文件' });
      }

      // 验证文件类型
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: '不支持的文件格式' });
      }

      // 验证文件大小（5MB限制）
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: '文件大小不能超过5MB' });
      }

      // 处理图像 - 使用ImageProcessor代替有BUG的processImage
      console.log('🖼️ 开始处理上传的图案图片');
      const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const processedResult = await ImageProcessor.processUserImage(base64Data, 64, 64);

      // 转换为原有的数据格式
      const processedImage = {
        rleData: processedResult.payload,  // RLE编码的JSON字符串
        width: processedResult.width,
        height: processedResult.height,
        colorCount: processedResult.colorFeatures.totalColors
      };

      console.log(`✅ 图案处理完成: ${processedImage.width}x${processedImage.height}, ${processedImage.colorCount}种颜色`);

      // AI检测
      const aiResults = await aiDetectionService.detectContent(req.file.buffer);

      // 确定审核状态
      let reviewStatus = 'pending';
      if (aiResults.risk_level === 'low' && aiResults.confidence > 0.7) {
        reviewStatus = 'ai_approved';
      } else if (aiResults.risk_level === 'high') {
        reviewStatus = 'human_review';
      }

      // 创建图案上传记录
      const uploadData = {
        user_id: userId,
        name,
        description,
        image_data: processedImage.rleData,
        width: processedImage.width,
        height: processedImage.height,
        color_count: processedImage.colorCount,
        service_type,
        review_status: reviewStatus,
        risk_level: aiResults.risk_level,
        ai_detection_results: aiResults,
        ai_confidence: aiResults.confidence
      };

      const upload = await PatternUpload.create(uploadData);

      // 记录审核日志
      await PatternUploadController.logReview({
        upload_id: upload.id,
        review_type: 'ai',
        action: reviewStatus === 'ai_approved' ? 'approve' : 'request_more_info',
        notes: `AI检测结果: 风险等级${aiResults.risk_level}, 置信度${aiResults.confidence}`,
        metadata: aiResults
      });

      res.status(201).json({
        success: true,
        upload: {
          id: upload.id,
          name: upload.name,
          review_status: upload.review_status,
          risk_level: upload.risk_level,
          ai_confidence: upload.ai_confidence,
          created_at: upload.created_at
        },
        ai_results: aiResults
      });

    } catch (error) {
      console.error('上传图案失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 获取用户的图案列表
  static async getUserPatterns(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;

      const uploads = await PatternUpload.getByUserId(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status
      });

      res.json({
        success: true,
        uploads: uploads.map(upload => ({
          id: upload.id,
          name: upload.name,
          description: upload.description,
          service_type: upload.service_type,
          review_status: upload.review_status,
          risk_level: upload.risk_level,
          ai_confidence: upload.ai_confidence,
          created_at: upload.created_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: uploads.length
        }
      });

    } catch (error) {
      console.error('获取用户图案列表失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 获取图案详情
  static async getPatternDetail(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const upload = await PatternUpload.getById(id);
      if (!upload) {
        return res.status(404).json({ error: '图案不存在' });
      }

      // 检查权限（只能查看自己的图案或已审核通过的图案）
      if (upload.user_id !== userId && upload.review_status !== 'approved') {
        return res.status(403).json({ error: '无权限查看此图案' });
      }

      res.json({
        success: true,
        upload: {
          id: upload.id,
          name: upload.name,
          description: upload.description,
          service_type: upload.service_type,
          review_status: upload.review_status,
          risk_level: upload.risk_level,
          ai_confidence: upload.ai_confidence,
          ai_detection_results: upload.ai_detection_results,
          review_notes: upload.review_notes,
          created_at: upload.created_at,
          updated_at: upload.updated_at
        }
      });

    } catch (error) {
      console.error('获取图案详情失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 升级服务类型（免费升级到付费）
  static async upgradeService(req, res) {
    try {
      const { id } = req.params;
      const { service_type } = req.body;
      const userId = req.user.id;

      const upload = await PatternUpload.getById(id);
      if (!upload) {
        return res.status(404).json({ error: '图案不存在' });
      }

      // 检查权限
      if (upload.user_id !== userId) {
        return res.status(403).json({ error: '无权限操作此图案' });
      }

      // 检查服务类型
      if (!['certified', 'commercial'].includes(service_type)) {
        return res.status(400).json({ error: '无效的服务类型' });
      }

      // 检查当前状态
      if (upload.service_type === service_type) {
        return res.status(400).json({ error: '已经是该服务类型' });
      }

      // 升级服务类型
      const updatedUpload = await PatternUpload.updateServiceType(id, service_type);

      // 如果是付费服务，需要重新审核
      if (service_type !== 'free') {
        await PatternUpload.updateReviewStatus(id, {
          review_status: 'human_review',
          risk_level: 'medium',
          review_notes: `用户升级到${service_type}服务，需要人工审核`
        });

        // 记录审核日志
        await PatternUploadController.logReview({
          upload_id: id,
          review_type: 'system',
          action: 'request_more_info',
          notes: `服务升级到${service_type}，需要人工审核`
        });
      }

      res.json({
        success: true,
        upload: {
          id: updatedUpload.id,
          service_type: updatedUpload.service_type,
          review_status: updatedUpload.review_status,
          updated_at: updatedUpload.updated_at
        }
      });

    } catch (error) {
      console.error('升级服务失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 删除图案
  static async deletePattern(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const upload = await PatternUpload.getById(id);
      if (!upload) {
        return res.status(404).json({ error: '图案不存在' });
      }

      // 检查权限
      if (upload.user_id !== userId) {
        return res.status(403).json({ error: '无权限删除此图案' });
      }

      // 删除图案
      const deleted = await PatternUpload.delete(id);
      if (!deleted) {
        return res.status(500).json({ error: '删除失败' });
      }

      res.json({
        success: true,
        message: '图案删除成功'
      });

    } catch (error) {
      console.error('删除图案失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 获取统计信息
  static async getStats(req, res) {
    try {
      const stats = await PatternUpload.getStats();

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('获取统计信息失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 处理图像
  static async processImage(imageBuffer) {
    try {
      // 使用sharp处理图像
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // 调整尺寸（最大64x64）
      const maxSize = 64;
      let width = metadata.width;
      let height = metadata.height;

      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // 调整图像
      const processed = await image
        .resize(width, height)
        .png()
        .toBuffer();

      // 转换为RLE格式（简化版本）
      const rleData = await PatternUploadController.convertToRLE(processed, width, height);

      // 计算颜色数量
      const colorCount = await PatternUploadController.countColors(processed);

      return {
        rleData,
        width,
        height,
        colorCount
      };

    } catch (error) {
      console.error('处理图像失败:', error);
      throw error;
    }
  }

  // 转换为RLE格式 (已修复 - 读取真实像素数据)
  static async convertToRLE(imageBuffer, width, height) {
    try {
      console.log(`🔄 开始RLE转换: ${width}x${height}`);

      // 提取真实像素数据
      const { data, info } = await sharp(imageBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

      console.log(`📊 提取像素数据: ${info.width}x${info.height}, ${info.channels}通道, ${data.length}字节`);

      // 生成RLE数据 - 读取真实像素颜色
      const rle = [];
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = info.channels === 4 ? data[i + 3] : 255;

        rle.push(`${r},${g},${b},${a}`);
      }

      console.log(`✅ RLE转换完成: ${rle.length}个像素`);
      return rle.join(';');

    } catch (error) {
      console.error('❌ RLE转换失败:', error);
      throw error;
    }
  }

  // 计算颜色数量
  static async countColors(imageBuffer) {
    try {
      // 简化的颜色计算，基于图像元数据
      const metadata = await sharp(imageBuffer).metadata();

      // 基于图像尺寸估算颜色数量
      const estimatedColors = Math.min(metadata.width * metadata.height / 100, 256);
      return Math.floor(estimatedColors);

    } catch (error) {
      console.error('计算颜色数量失败:', error);
      return 64; // 默认颜色数量
    }
  }

  // 记录审核日志
  static async logReview(logData) {
    try {
      const { db } = require('../config/database');
      await db('review_logs').insert({
        id: uuidv4(),
        upload_id: logData.upload_id,
        reviewer_id: logData.reviewer_id || null,
        review_type: logData.review_type,
        action: logData.action,
        notes: logData.notes,
        metadata: logData.metadata || null
      });
    } catch (error) {
      console.error('记录审核日志失败:', error);
    }
  }
}

module.exports = PatternUploadController;
