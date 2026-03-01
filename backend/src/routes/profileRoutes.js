const express = require('express');
const ProfileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// 获取用户详细信息
router.get('/:userId', ProfileController.getUserProfile);

// 更新用户资料
router.put('/update', ProfileController.updateProfile);

// 关注用户
router.post('/follow/:followingId', ProfileController.followUser);

// 取消关注用户
router.delete('/unfollow/:followingId', ProfileController.unfollowUser);

// 点赞用户
router.post('/like/:targetUserId', ProfileController.likeUser);

// 取消点赞用户
router.delete('/unlike/:targetUserId', ProfileController.unlikeUser);

// 删除账号
router.delete('/account', ProfileController.deleteAccount);

// 获取用户统计信息
router.get('/stats/me', ProfileController.getUserStats);

// 隐私设置别名 (出于后向兼容性)
const PrivacyController = require('../controllers/privacyController');
router.get('/privacy', PrivacyController.getPrivacySettings);
router.put('/privacy', PrivacyController.updatePrivacySettings);

// 昵称管理相关路由
router.get('/nickname/history', ProfileController.getNicknameHistory);
router.get('/nickname/limit', ProfileController.checkNicknameChangeLimit);

module.exports = router;
