const express = require('express');
const router = express.Router();
const BattleController = require('../controllers/battleController');
const { authenticateToken } = require('../middleware/auth');

// 所有路由需要认证
router.use(authenticateToken);

router.get('/unread', BattleController.getUnreadCount);
router.get('/', BattleController.getBattleFeed);

module.exports = router;
