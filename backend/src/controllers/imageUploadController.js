const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const logger = require('../utils/logger');
const CDNService = require('../services/cdnService');

// 单例 CDN 服务
const cdnService = new CDNService();

// 本地开发模式上传令牌（简单验证，防止未授权上传）
const pendingUploadTokens = new Map(); // key -> { expires, userId }

class ImageUploadController {
  /**
   * 通用图片上传服务
   * 支持漂流瓶等功能的图片上传，返回可访问的URL
   */
  static async uploadImage(req, res) {
    try {
      // 检查文件
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请上传图片文件'
        });
      }

      // 验证文件类型
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: '不支持的文件格式，请使用 JPG、PNG、GIF 或 WebP 格式'
        });
      }

      // 验证文件大小（5MB限制）
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          error: '文件大小不能超过5MB'
        });
      }

      // 确保上传目录存在
      const uploadDir = path.join(__dirname, '../../uploads/images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 生成唯一文件名
      const fileExtension = path.extname(req.file.originalname) ||
        (req.file.mimetype === 'image/jpeg' ? '.jpg' :
          req.file.mimetype === 'image/png' ? '.png' : '.gif');
      const uniqueFilename = `drift_${Date.now()}_${uuidv4().replace(/-/g, '')}${fileExtension}`;
      const filePath = path.join(uploadDir, uniqueFilename);

      // 使用 Sharp 优化图片
      let processedBuffer = req.file.buffer;

      // 如果图片过大，进行压缩
      if (req.file.size > 1024 * 1024) { // 超过1MB进行压缩
        processedBuffer = await sharp(req.file.buffer)
          .resize({
            width: 1200,  // 最大宽度1200px
            height: 1200, // 最大高度1200px
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85,
            progressive: true
          })
          .toBuffer();
      }

      // 保存文件到本地
      fs.writeFileSync(filePath, processedBuffer);

      // 生成访问URL（开发环境使用相对路径，生产环境可以使用CDN）
      const imageUrl = `/uploads/images/${uniqueFilename}`;

      logger.info('图片上传成功', {
        userId: req.user?.id || 'anonymous',
        originalName: req.file.originalname,
        size: req.file.size,
        compressedSize: processedBuffer.length,
        imageUrl,
        mimetype: req.file.mimetype
      });

      res.json({
        success: true,
        data: {
          imageUrl,
          originalName: req.file.originalname,
          size: req.file.size,
          compressedSize: processedBuffer.length,
          mimetype: req.file.mimetype
        },
        message: '图片上传成功'
      });

    } catch (error) {
      logger.error('图片上传失败:', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        originalName: req.file?.originalname
      });

      res.status(500).json({
        success: false,
        error: '图片上传失败',
        message: error.message
      });
    }
  }

  /**
   * 删除图片文件
   */
  static async deleteImage(req, res) {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          error: '缺少图片URL参数'
        });
      }

      // 安全检查：确保只删除上传目录下的文件
      const imagePath = imageUrl.startsWith('/uploads/images/')
        ? path.join(__dirname, '../../', imageUrl)
        : null;

      if (!imagePath || !fs.existsSync(imagePath)) {
        return res.status(404).json({
          success: false,
          error: '图片文件不存在'
        });
      }

      // 删除文件
      fs.unlinkSync(imagePath);

      logger.info('图片删除成功', {
        userId: req.user?.id,
        imageUrl
      });

      res.json({
        success: true,
        message: '图片删除成功'
      });

    } catch (error) {
      logger.error('图片删除失败:', error);

      res.status(500).json({
        success: false,
        error: '图片删除失败',
        message: error.message
      });
    }
  }

  /**
   * 获取图片上传的预签名 URL (客户端直传 S3/OSS)
   * 相比代理上传，这能极大减轻服务器带宽压力
   * 本地开发模式下返回直传 PUT 端点
   */
  static async getUploadUrl(req, res) {
    try {
      const { contentType = 'image/jpeg' } = req.body;

      // 验证 content type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(contentType)) {
        return res.status(400).json({ success: false, error: '不支持的文件类型' });
      }

      // 生成唯一文件名
      const fileExtension = contentType.split('/')[1];
      const filename = `direct_${Date.now()}_${uuidv4().replace(/-/g, '')}.${fileExtension}`;
      const key = `images/${filename}`;

      // 本地开发模式：返回直传 PUT 端点
      if (cdnService.provider === 'local') {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        // 生成一次性上传令牌
        const uploadToken = uuidv4();
        pendingUploadTokens.set(uploadToken, {
          key,
          userId: req.user?.id,
          expires: Date.now() + 10 * 60 * 1000 // 10分钟有效
        });
        const uploadUrl = `${baseUrl}/api/images/direct/${key}?token=${uploadToken}`;
        const publicUrl = `${baseUrl}/uploads/${key}`;

        logger.info('本地模式上传URL生成成功', { userId: req.user?.id, key });

        return res.json({
          success: true,
          data: {
            uploadUrl,
            publicUrl,
            key
          }
        });
      }

      // 云存储模式：生成预签名 URL
      const presignedData = await cdnService.generatePresignedUploadUrl(key, {
        contentType,
        metadata: {
          userId: req.user?.id || 'anonymous',
          source: 'direct_upload'
        }
      });

      logger.info('预签名上传URL生成成功', { userId: req.user?.id, key });

      res.json({
        success: true,
        data: {
          uploadUrl: presignedData.url,
          publicUrl: cdnService.generateUrl(key),
          key: presignedData.key
        }
      });

    } catch (error) {
      logger.error('获取上传 URL 失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 直传 PUT 上传（本地开发模式替代预签名URL）
   * iOS 客户端直接 PUT 原始图片数据到此端点
   */
  static async directPutUpload(req, res) {
    try {
      const key = req.params[0]; // captures everything after /direct/
      const { token } = req.query;

      // 验证上传令牌
      if (!token || !pendingUploadTokens.has(token)) {
        return res.status(403).json({ success: false, error: '无效的上传令牌' });
      }
      const tokenData = pendingUploadTokens.get(token);
      pendingUploadTokens.delete(token); // 一次性令牌
      if (Date.now() > tokenData.expires) {
        return res.status(403).json({ success: false, error: '上传令牌已过期' });
      }

      if (!key || !key.startsWith('images/')) {
        return res.status(400).json({ success: false, error: '无效的上传路径' });
      }

      const uploadDir = path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadDir, key);
      const dir = path.dirname(filePath);

      // 确保目录存在
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 写入原始请求体
      fs.writeFileSync(filePath, req.body);

      logger.info('直传上传成功', {
        userId: req.user?.id,
        key,
        size: req.body.length
      });

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('直传上传失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = ImageUploadController;