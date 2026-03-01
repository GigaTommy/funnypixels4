const smsService = require('../services/smsService');
const graphicVerificationService = require('../services/graphicVerificationService');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class SmsController {
  /**
   * 发送短信验证码
   */
  static async sendVerificationCode(req, res) {
    try {
      const { phone, type = 'login' } = req.body;

      // 验证必填参数
      if (!phone) {
        return res.status(400).json({
          success: false,
          error: '手机号为必填项'
        });
      }

      // 验证类型
      if (!['login', 'register', 'reset_password'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: '验证码类型不正确'
        });
      }

      // 获取客户端信息
      const options = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      // 发送短信验证码
      const result = await smsService.sendVerificationCode(phone, type, options);

      res.json({
        success: true,
        message: '验证码发送成功',
        data: {
          messageId: result.messageId,
          expiresAt: result.expiresAt,
          // 开发环境返回验证码
          ...(process.env.NODE_ENV === 'development' && process.env.LOCAL_VALIDATION === 'true' && {
            code: result.code
          })
        }
      });

    } catch (error) {
      logger.error('发送短信验证码失败', {
        phone: req.body.phone,
        type: req.body.type,
        error: error.message,
        ipAddress: req.ip
      });

      res.status(400).json({
        success: false,
        error: error.message || '短信发送失败'
      });
    }
  }

  /**
   * 验证短信验证码并生成图形验证挑战
   */
  static async verifySmsAndRequestChallenge(req, res) {
    try {
      const { phone, smsCode, type = 'login' } = req.body;

      // 验证必填参数
      if (!phone || !smsCode) {
        return res.status(400).json({
          success: false,
          error: '手机号和短信验证码为必填项'
        });
      }

      // 验证短信验证码
      const smsResult = await smsService.verifyCode(phone, smsCode, type);
      if (!smsResult.valid) {
        return res.status(400).json({
          success: false,
          error: smsResult.error
        });
      }

      // 生成图形验证挑战
      const options = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        difficulty: req.body.difficulty || 'medium'
      };

      const challenge = await graphicVerificationService.createChallenge(phone, options);

      res.json({
        success: true,
        message: '短信验证成功，请完成图形验证',
        data: {
          challenge: challenge,
          nextStep: 'graphic_verification'
        }
      });

    } catch (error) {
      logger.error('验证短信并生成挑战失败', {
        phone: req.body.phone,
        error: error.message,
        ipAddress: req.ip
      });

      res.status(400).json({
        success: false,
        error: error.message || '验证失败'
      });
    }
  }

  /**
   * 验证图形验证挑战
   */
  static async verifyGraphicChallenge(req, res) {
    try {
      const { challengeId, answer, phone } = req.body;

      // 验证必填参数
      if (!challengeId || !answer) {
        return res.status(400).json({
          success: false,
          error: '挑战ID和答案为必填项'
        });
      }

      // 验证图形答案
      const options = {
        ipAddress: req.ip || req.connection.remoteAddress
      };

      const graphicResult = await graphicVerificationService.verifyAnswer(
        challengeId,
        answer,
        options
      );

      if (!graphicResult.valid) {
        return res.status(400).json({
          success: false,
          error: graphicResult.error,
          ...(graphicResult.remainingAttempts !== undefined && {
            remainingAttempts: graphicResult.remainingAttempts
          })
        });
      }

      // 图形验证成功，检查用户是否存在
      const User = require('../models/User');
      let user = await User.findByPhone(phone);

      if (!user) {
        // 用户不存在，自动注册
        user = await this.autoRegisterUser(phone, req);
      }

      // 生成登录令牌
      const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // 更新用户最后登录时间和手机号登录方式
      await db('users')
        .where('id', user.id)
        .update({
          last_phone_login_at: new Date(),
          phone_verified: true,
          phone_verified_at: new Date(),
          login_method: 'phone',
          updated_at: new Date()
        });

      // 获取用户完整信息
      const completeUser = await User.findById(user.id);
      const userPoints = await User.getUserPoints(user.id);

      logger.info('手机号登录成功', {
        userId: user.id,
        phone: phone,
        loginMethod: 'phone'
      });

      res.json({
        success: true,
        message: '登录成功',
        data: {
          user: {
            id: completeUser.id,
            username: completeUser.username,
            email: completeUser.email,
            phone: completeUser.phone,
            phone_verified: true,
            role: completeUser.role,
            display_name: completeUser.display_name,
            avatar_url: completeUser.avatar_url,
            avatar: completeUser.avatar,
            motto: completeUser.motto,
            privacy_mode: completeUser.privacy_mode,
            points: userPoints,
            total_pixels: completeUser.total_pixels,
            current_pixels: completeUser.current_pixels,
            level: completeUser.level,
            experience: completeUser.experience,
            coins: completeUser.coins,
            gems: completeUser.gems,
            created_at: completeUser.created_at,
            login_method: 'phone'
          },
          tokens: {
            accessToken: accessToken,
            refreshToken: refreshToken
          }
        }
      });

    } catch (error) {
      logger.error('验证图形挑战失败', {
        challengeId: req.body.challengeId,
        error: error.message,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: error.message || '图形验证失败'
      });
    }
  }

  /**
   * 自动注册用户
   */
  static async autoRegisterUser(phone, req) {
    try {
      const User = require('../models/User');
      const bcrypt = require('bcryptjs');

      // 生成默认用户名
      const defaultUsername = `user_${phone.slice(-6)}`;

      // 确保用户名唯一
      let finalUsername = defaultUsername;
      let counter = 1;
      while (await User.findByUsername(finalUsername)) {
        finalUsername = `${defaultUsername}_${counter}`;
        counter++;
      }

      // 获取手机号归属地信息
      const phoneLocation = await smsService.getPhoneLocation(phone);

      // 生成随机密码（手机号用户不需要密码登录，但数据库要求非空）
      const randomPassword = require('crypto').randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      // 创建用户
      const userId = require('uuid').v4();
      await db('users').insert({
        id: userId,
        username: finalUsername,
        email: `${phone}@funnypixels.phone`,
        password_hash: passwordHash,
        phone: phone,
        phone_verified: true,
        phone_verified_at: new Date(),
        login_method: 'phone',
        phone_location: phoneLocation.province,
        phone_carrier: phoneLocation.carrier,
        display_name: finalUsername,
        avatar: 'default_avatar.png',
        role: 'user',
        level: 1,
        experience: 0,
        coins: 100,
        gems: 10,
        total_pixels: 0,
        current_pixels: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      // 创建用户像素状态
      await db('user_pixel_states').insert({
        user_id: userId,
        last_accum_time: Math.floor(Date.now() / 1000)
      });

      // 创建用户积分记录
      await db('user_points').insert({
        user_id: userId,
        total_points: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      logger.info('自动注册手机号用户', {
        userId,
        phone,
        username: finalUsername
      });

      return await User.findById(userId);

    } catch (error) {
      logger.error('自动注册用户失败', {
        phone,
        error: error.message
      });
      throw new Error('用户注册失败');
    }
  }

  /**
   * 获取短信发送状态
   */
  static async getSmsStatus(req, res) {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: '消息ID为必填项'
        });
      }

      // 从数据库查询短信记录
      const smsRecord = await db('sms_verification_codes')
        .where('message_id', messageId)
        .first();

      if (!smsRecord) {
        return res.status(404).json({
          success: false,
          error: '短信记录不存在'
        });
      }

      res.json({
        success: true,
        data: {
          messageId: smsRecord.message_id,
          phone: smsRecord.phone,
          type: smsRecord.type,
          status: smsRecord.status,
          createdAt: smsRecord.created_at,
          expiresAt: smsRecord.expires_at,
          used: smsRecord.used,
          usedAt: smsRecord.used_at
        }
      });

    } catch (error) {
      logger.error('获取短信状态失败', {
        messageId: req.params.messageId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: '获取短信状态失败'
      });
    }
  }

  /**
   * 获取用户短信统计
   */
  static async getSmsStats(req, res) {
    try {
      const { phone } = req.query;

      let query = db('sms_verification_codes');
      if (phone) {
        query = query.where('phone', phone);
      }

      const stats = await query
        .select(
          db.raw('COUNT(*) as total_sent'),
          db.raw('SUM(CASE WHEN used = true THEN 1 ELSE 0 END) as verified'),
          db.raw('SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed'),
          db.raw('SUM(CASE WHEN used = false AND expires_at > NOW() THEN 1 ELSE 0 END) as pending'),
          db.raw('SUM(CASE WHEN used = false AND expires_at <= NOW() THEN 1 ELSE 0 END) as expired')
        )
        .first();

      res.json({
        success: true,
        data: {
          totalSent: parseInt(stats.total_sent) || 0,
          verified: parseInt(stats.verified) || 0,
          failed: parseInt(stats.failed) || 0,
          pending: parseInt(stats.pending) || 0,
          expired: parseInt(stats.expired) || 0,
          verificationRate: stats.total_sent > 0 ?
            ((stats.verified / stats.total_sent) * 100).toFixed(2) + '%' : '0%'
        }
      });

    } catch (error) {
      logger.error('获取短信统计失败', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: '获取短信统计失败'
      });
    }
  }

  /**
   * 清理过期验证码（管理员接口）
   */
  static async cleanExpiredCodes(req, res) {
    try {
      const smsDeleted = await smsService.cleanExpiredCodes();
      const graphicDeleted = await graphicVerificationService.cleanExpiredChallenges();

      res.json({
        success: true,
        message: '清理完成',
        data: {
          smsCodesDeleted: smsDeleted,
          graphicChallengesDeleted: graphicDeleted
        }
      });

    } catch (error) {
      logger.error('清理过期验证码失败', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: '清理失败'
      });
    }
  }
}

module.exports = SmsController;