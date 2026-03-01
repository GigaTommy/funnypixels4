const express = require('express');
const multer = require('multer');
const ImageUploadController = require('../controllers/imageUploadController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 配置multer用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB限制
  },
  fileFilter: (req, file, cb) => {
    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'), false);
    }
  }
});

// 上传图片（需要认证）
router.post('/upload', authenticateToken, upload.single('image'), ImageUploadController.uploadImage);

// 获取预签名上传URL（客户端直传）
router.post('/upload-url', authenticateToken, express.json(), ImageUploadController.getUploadUrl);

// 直传 PUT 上传（本地开发模式，替代预签名URL，通过一次性令牌验证）
router.put('/direct/*', express.raw({ type: ['image/*'], limit: '5mb' }), ImageUploadController.directPutUpload);

// 删除图片（需要认证）
router.delete('/delete', authenticateToken, ImageUploadController.deleteImage);

// 错误处理中间件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '文件大小不能超过5MB'
      });
    }
    return res.status(400).json({
      success: false,
      error: '文件上传错误'
    });
  }

  if (error.message === '不支持的文件格式') {
    return res.status(400).json({
      success: false,
      error: '不支持的文件格式'
    });
  }

  console.error('图片上传路由错误:', error);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

module.exports = router;