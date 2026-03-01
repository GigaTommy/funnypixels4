const express = require('express');
const RegionController = require('../controllers/regionController');
const router = express.Router();

// 获取所有地区列表
router.get('/', RegionController.getAllRegions);

// 获取地区排行榜（必须在 /:id 路由之前）
router.get('/leaderboard', RegionController.getRegionLeaderboard);

// 获取地区详情（包含统计数据）
router.get('/:id/stats', RegionController.getRegionDetailsWithStats);

// 获取地区详情
router.get('/:id', RegionController.getRegionDetails);

module.exports = router;
