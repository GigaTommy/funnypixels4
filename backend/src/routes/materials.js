/**
 * Material系统路由
 * 提供Material数据的REST API接口
 */

const express = require('express');
const materialController = require('../controllers/materialController');
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Material访问限流 - 每个IP每分钟最多60次请求
const materialRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 60, // 最多60次请求
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 批量获取限流 - 每个IP每分钟最多10次请求
const batchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 最多10次批量请求
  message: {
    success: false,
    error: '批量请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Material系统API路由
 */

// 健康检查
router.get('/health', materialController.healthCheck.bind(materialController));

// 获取Material变体信息
// GET /api/materials/:materialId/variants?variant_type=sprite_sheet
router.get('/:materialId/variants',
  materialRateLimit,
  materialController.getMaterialVariants.bind(materialController)
);

// 下载Material变体文件
// GET /api/materials/:materialId/variants/:variantId/download
router.get('/:materialId/variants/:variantId/download',
  materialRateLimit,
  materialController.downloadMaterialVariant.bind(materialController)
);

// 批量获取Material信息
// POST /api/materials/batch
// Body: { material_ids: ["1", "2", "3"], variant_type: "sprite_sheet" }
router.post('/batch',
  authenticateToken, // 批量接口需要认证
  batchRateLimit,
  materialController.getBatchMaterials.bind(materialController)
);

module.exports = router;