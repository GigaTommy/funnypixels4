const express = require('express');
const multer = require('multer');
const PatternUploadController = require('../controllers/patternUploadController');
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

// 所有路由都需要认证
router.use(authenticateToken);

// 上传图案
router.post('/upload', upload.single('image'), PatternUploadController.uploadPattern);

// 获取用户的图案列表
router.get('/user-patterns', PatternUploadController.getUserPatterns);

// 获取图案详情
router.get('/pattern/:id', PatternUploadController.getPatternDetail);

// 升级服务类型
router.put('/pattern/:id/upgrade', PatternUploadController.upgradeService);

// 删除图案
router.delete('/pattern/:id', PatternUploadController.deletePattern);

// 获取统计信息
router.get('/stats', PatternUploadController.getStats);

// 错误处理中间件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小不能超过5MB' });
    }
    return res.status(400).json({ error: '文件上传错误' });
  }
  
  if (error.message === '不支持的文件格式') {
    return res.status(400).json({ error: '不支持的文件格式' });
  }
  
  console.error('图案上传路由错误:', error);
  res.status(500).json({ error: '服务器内部错误' });
});

module.exports = router;
