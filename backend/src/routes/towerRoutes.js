/**
 * Tower Routes
 * Task: #36 - Week 1 Backend 路由配置
 *
 * 3D 像素塔 API 路由
 */

const express = require('express');
const router = express.Router();
const TowerController = require('../controllers/towerController');
const { authenticateToken } = require('../middleware/auth');

// 公开接口（无需登录）
router.get('/viewport', TowerController.getViewportTowers);
router.get('/:tileId/floors', TowerController.getTowerFloors);

// 需要登录的接口
router.get('/my-towers', authenticateToken, TowerController.getMyTowers);

module.exports = router;
