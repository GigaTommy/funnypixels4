const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 所有路由都需要管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @route GET /api/v1/admin/products
 * @desc 获取所有商品列表（shop_skus）
 * @access Private (Admin only)
 */
router.get('/', ProductController.getAllProducts);

/**
 * @route GET /api/v1/admin/products/categories
 * @desc 获取商品分类列表
 * @access Private (Admin only)
 */
router.get('/categories', ProductController.getCategories);

/**
 * @route GET /api/v1/admin/products/:id
 * @desc 获取单个商品详情
 * @access Private (Admin only)
 */
router.get('/:id', ProductController.getProductById);

/**
 * @route POST /api/v1/admin/products
 * @desc 创建新商品
 * @access Private (Admin only)
 */
router.post('/', ProductController.createProduct);

/**
 * @route PUT /api/v1/admin/products/:id
 * @desc 更新商品信息
 * @access Private (Admin only)
 */
router.put('/:id', ProductController.updateProduct);

/**
 * @route DELETE /api/v1/admin/products/:id
 * @desc 删除商品
 * @access Private (Admin only)
 */
router.delete('/:id', ProductController.deleteProduct);

/**
 * @route POST /api/v1/admin/products/batch/status
 * @desc 批量更新商品状态
 * @access Private (Admin only)
 */
router.post('/batch/status', ProductController.batchUpdateStatus);

/**
 * @route GET /api/v1/admin/products/ad/list
 * @desc 获取广告商品列表
 * @access Private (Admin only)
 */
router.get('/ad/list', ProductController.getAdProducts);

/**
 * @route POST /api/v1/admin/products/ad
 * @desc 创建广告商品
 * @access Private (Admin only)
 */
router.post('/ad', ProductController.createAdProduct);

/**
 * @route PUT /api/v1/admin/products/ad/:id
 * @desc 更新广告商品
 * @access Private (Admin only)
 */
router.put('/ad/:id', ProductController.updateAdProduct);

/**
 * @route DELETE /api/v1/admin/products/ad/:id
 * @desc 删除广告商品
 * @access Private (Admin only)
 */
router.delete('/ad/:id', ProductController.deleteAdProduct);

// ==================== store_items 商品管理路由 ====================

/**
 * @route GET /api/v1/admin/products/store/list
 * @desc 获取 store_items 商品列表
 * @access Private (Admin only)
 */
router.get('/store/list', ProductController.getStoreItems);

/**
 * @route GET /api/v1/admin/products/store/types
 * @desc 获取 store_items 商品类型列表
 * @access Private (Admin only)
 */
router.get('/store/types', ProductController.getStoreItemTypes);

/**
 * @route GET /api/v1/admin/products/store/:id
 * @desc 获取单个 store_items 商品详情
 * @access Private (Admin only)
 */
router.get('/store/:id', ProductController.getStoreItemById);

/**
 * @route POST /api/v1/admin/products/store
 * @desc 创建 store_items 商品
 * @access Private (Admin only)
 */
router.post('/store', ProductController.createStoreItem);

/**
 * @route PUT /api/v1/admin/products/store/:id
 * @desc 更新 store_items 商品
 * @access Private (Admin only)
 */
router.put('/store/:id', ProductController.updateStoreItem);

/**
 * @route DELETE /api/v1/admin/products/store/:id
 * @desc 删除 store_items 商品
 * @access Private (Admin only)
 */
router.delete('/store/:id', ProductController.deleteStoreItem);

/**
 * @route POST /api/v1/admin/products/store/batch/status
 * @desc 批量更新 store_items 商品状态
 * @access Private (Admin only)
 */
router.post('/store/batch/status', ProductController.batchUpdateStoreItemStatus);

module.exports = router;
