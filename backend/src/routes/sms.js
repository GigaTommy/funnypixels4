const express = require('express');
const SmsController = require('../controllers/smsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// 短信发送频率限制
const smsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 5, // 最多5次
  message: {
    success: false,
    error: '短信发送过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 图形验证频率限制
const graphicRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 10, // 最多10次
  message: {
    success: false,
    error: '图形验证尝试过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 发送短信验证码
router.post('/send-code', smsRateLimit, SmsController.sendVerificationCode);

// 验证短信验证码并请求图形验证
router.post('/verify-sms', SmsController.verifySmsAndRequestChallenge);

// 验证图形验证挑战
router.post('/verify-graphic', graphicRateLimit, SmsController.verifyGraphicChallenge);

// 获取短信发送状态
router.get('/status/:messageId', authenticateToken, SmsController.getSmsStatus);

// 获取短信统计信息
router.get('/stats', authenticateToken, SmsController.getSmsStats);

// 清理过期验证码（仅管理员）
router.post('/cleanup', requireAdmin, SmsController.cleanExpiredCodes);

module.exports = router;