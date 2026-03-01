const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  registerSchema,
  loginSchema,
  accountLoginSchema,
  sendCodeSchema,
  refreshTokenSchema,
  changePasswordSchema
} = require('../validators/authValidator');

const router = express.Router();

// 🔒 安全：用户注册（应用Joi验证）
router.post('/register', validate(registerSchema), AuthController.register);

// 🔒 安全：用户登录（应用Joi验证）
router.post('/login', validate(loginSchema), AuthController.login);

// 🔒 安全：账户登录（支持用户名或邮箱）
router.post('/account-login', validate(accountLoginSchema), AuthController.accountLogin);

// 🔒 安全：刷新令牌（应用Joi验证）
router.post('/refresh', validate(refreshTokenSchema), AuthController.refreshToken);

// 🔒 安全：发送验证码（应用Joi验证）
router.post('/send-code', validate(sendCodeSchema), AuthController.sendVerificationCode);

// 验证验证码
router.post('/verify-code', AuthController.verifyCode);

// 获取当前用户信息（需要认证）
router.get('/me', authenticateToken, AuthController.getCurrentUser);

// 更新用户信息（需要认证）
router.put('/profile', authenticateToken, AuthController.updateProfile);

// 🔒 安全：修改密码（应用Joi验证）
router.put('/change-password', authenticateToken, validate(changePasswordSchema), AuthController.changePassword);

// 用户登出（需要认证）
router.post('/logout', authenticateToken, AuthController.logout);

// Apple 登录
router.post('/apple', AuthController.appleLogin);

// Google 登录
router.post('/google', AuthController.googleLogin);

// 抖音登录
router.post('/douyin/login', AuthController.douyinLogin);

// 微信登录
router.post('/wechat/login', AuthController.wechatLogin);

// 检查微信登录状态
router.get('/wechat/status', AuthController.checkWeChatLoginStatus);

// 获取微信用户信息（需要认证）
router.get('/wechat/userinfo', authenticateToken, AuthController.getWeChatUserInfo);

module.exports = router;
