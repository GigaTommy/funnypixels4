const express = require('express');
const BombController = require('../controllers/bombController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// 使用炸弹
router.post('/use', BombController.useBomb);

// 获取冷却状态
router.get('/cooldown', BombController.getCooldownStatus);

// 获取炸弹使用历史
router.get('/history', BombController.getBombHistory);

// 获取炸弹库存
router.get('/inventory', BombController.getBombInventory);

module.exports = router;
