const express = require('express');
const PatternReviewController = require('../controllers/patternReviewController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 所有路由都需要管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 获取待审核的图案列表
router.get('/pending', PatternReviewController.getPendingReviews);

// 审核单个图案
router.post('/review/:uploadId', PatternReviewController.reviewPattern);

// 批量审核
router.post('/batch-review', PatternReviewController.batchReview);

// 获取审核统计信息
router.get('/stats', PatternReviewController.getReviewStats);

// 获取审核历史
router.get('/history', PatternReviewController.getReviewHistory);

module.exports = router;
