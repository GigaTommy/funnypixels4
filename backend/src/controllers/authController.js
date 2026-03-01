const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const RankTierService = require('../services/rankTierService');

// 简单的用户信息内存缓存，减少频繁的数据库查询
const userCache = new Map();
const USER_CACHE_TTL = 30 * 1000; // 30秒缓存时间

class AuthController {
  // 清除用户缓存
  static clearUserCache(userId) {
    if (userId) {
      userCache.delete(userId);
      logger.debug('清除用户缓存', { userId });
    }
  }

  // 验证验证码的辅助方法
  static verifyVerificationCode(identifier, code, type) {
    if (!global.verificationCodes) {
      return { valid: false, error: '验证码不存在' };
    }

    const stored = global.verificationCodes.get(identifier);
    if (!stored) {
      return { valid: false, error: '验证码不存在' };
    }

    // 检查验证码是否过期（5分钟）
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    if (now - stored.timestamp > fiveMinutes) {
      global.verificationCodes.delete(identifier);
      return { valid: false, error: '验证码已过期' };
    }

    // 检查验证码类型
    if (stored.type !== type) {
      return { valid: false, error: '验证码类型不匹配' };
    }

    // 检查验证码是否正确
    if (stored.code !== code) {
      return { valid: false, error: '验证码错误' };
    }

    // 验证成功后删除验证码
    global.verificationCodes.delete(identifier);
    return { valid: true };
  }

  // 验证邮箱格式
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // 验证密码强度
  static validatePassword(password) {
    if (!password || password.length < 6) {
      return { valid: false, error: '密码长度至少6个字符' };
    }
    if (password.length > 128) {
      return { valid: false, error: '密码长度不能超过128个字符' };
    }
    // 可以添加更多密码强度检查
    return { valid: true };
  }
  // 用户注册
  static async register(req, res) {
    try {
      const { email, password, verificationCode } = req.body;

      // 检查是否为邮箱验证码注册
      if (email && verificationCode) {
        return await AuthController.registerWithEmailCode(req, res, email, verificationCode, password);
      }

      // 传统邮箱+密码注册（已废弃，现在只支持邮箱验证码注册）
      return res.status(400).json({ error: '请使用邮箱验证码注册' });

    } catch (error) {
      logger.error('注册失败', { error: error.message, email: req.body.email });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 邮箱验证码注册
  static async registerWithEmailCode(req, res, email, verificationCode, password) {
    try {
      // 验证邮箱格式
      if (!AuthController.validateEmail(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
      }

      // 验证验证码
      if (!verificationCode || verificationCode.length !== 6) {
        return res.status(400).json({ error: '验证码格式不正确' });
      }

      const codeVerification = AuthController.verifyVerificationCode(email, verificationCode, 'register');
      if (!codeVerification.valid) {
        return res.status(400).json({ error: codeVerification.error });
      }

      // 验证密码强度
      const passwordValidation = AuthController.validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }

      // 检查邮箱是否已注册
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: '该邮箱已被注册' });
      }

      // 生成默认用户名（邮箱前缀）
      const emailPrefix = email.split('@')[0];
      const defaultUsername = emailPrefix.length >= 3 ? emailPrefix : `user_${emailPrefix}`;
      
      // 确保用户名唯一
      let finalUsername = defaultUsername;
      let counter = 1;
      while (await User.findByUsername(finalUsername)) {
        finalUsername = `${defaultUsername}_${counter}`;
        counter++;
      }
      
      // 创建用户
      const userData = { 
        username: finalUsername, 
        email: email,
        password
      };

      const user = await User.create(userData);

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.status(201).json({
        success: true,
        message: '注册成功',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_admin: user.role === 'admin' || user.role === 'super_admin',
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          avatar: user.avatar,
          motto: user.motto,
          privacy_mode: user.privacy_mode,
          points: userPoints,
          total_pixels: user.total_pixels,
          current_pixels: user.current_pixels,
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          gems: user.gems,
          created_at: user.created_at
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      logger.error('邮箱验证码注册失败', { error: error.message, email: req.body.email });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 手机号验证码注册（保留兼容性）
  static async registerWithPhoneCode(req, res, phone, verificationCode, password) {
    try {
      // 验证手机号格式
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' });
      }

      // 验证验证码
      if (!verificationCode || verificationCode.length !== 6) {
        return res.status(400).json({ error: '验证码格式不正确' });
      }

      const codeVerification = AuthController.verifyVerificationCode(phone, verificationCode, 'register');
      if (!codeVerification.valid) {
        return res.status(400).json({ error: codeVerification.error });
      }

      // 验证密码强度
      if (!password || password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6个字符' });
      }

      // 检查手机号是否已注册
      const existingPhone = await User.findByPhone(phone);
      if (existingPhone) {
        return res.status(400).json({ error: '该手机号已被注册' });
      }

      // 生成默认用户名（手机号后6位）
      const defaultUsername = `user_${phone.slice(-6)}`;
      
      // 创建用户
      const userData = { 
        username: defaultUsername, 
        email: `${phone}@funnypixels.com`, // 生成默认邮箱
        password,
        phone 
      };

      const user = await User.create(userData);

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.status(201).json({
        success: true,
        message: '注册成功',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_admin: user.role === 'admin' || user.role === 'super_admin',
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          avatar: user.avatar,
          motto: user.motto,
          privacy_mode: user.privacy_mode,
          points: userPoints,
          total_pixels: user.total_pixels,
          current_pixels: user.current_pixels,
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          gems: user.gems,
          created_at: user.created_at
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      logger.error('手机号验证码注册失败', { error: error.message, phone: req.body.phone });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 用户登录
  static async login(req, res) {
    try {
      const { email, phone, username, password, verificationCode } = req.body;

      // DEBUG: Log request details
      console.log('🔍 Login request received:', {
        hasEmail: !!email,
        hasPhone: !!phone,
        hasUsername: !!username,
        hasPassword: !!password,
        hasCode: !!verificationCode,
        emailPreview: email ? `${email.substring(0, 5)}...` : 'none',
        bodyKeys: Object.keys(req.body)
      });

      // 检查是否为手机号验证码登录
      if (phone && verificationCode) {
        return await AuthController.loginWithPhoneCode(req, res, phone, verificationCode);
      }

      // 检查是否为手机号+密码登录
      if (phone && password) {
        return await AuthController.loginWithPhonePassword(req, res, phone, password);
      }

      // 检查是否为用户名+密码登录
      if (username && password) {
        return await AuthController.loginWithUsernamePassword(req, res, username, password);
      }

      // 检查是否为邮箱验证码登录
      if (email && verificationCode) {
        return await AuthController.loginWithEmailCode(req, res, email, verificationCode);
      }

      // 检查是否为邮箱+密码登录
      if (email && password) {
        return await AuthController.loginWithEmailPassword(req, res, email, password);
      }

      // 如果同时提供了多种标识符，优先级：手机号 > 用户名 > 邮箱
      if (phone && !password && !verificationCode) {
        return res.status(400).json({ error: '手机号登录需要密码或验证码' });
      }

      if (username && !password && !verificationCode) {
        return res.status(400).json({ error: '用户名登录需要密码' });
      }

      // 如果没有提供登录标识符，返回错误
      if (!email && !phone && !username) {
        return res.status(400).json({ error: '用户名、邮箱或手机号为必填项' });
      }

      // 如果提供了邮箱但没有密码或验证码，返回错误
      if (email && !password && !verificationCode) {
        return res.status(400).json({ error: '邮箱登录需要密码或验证码' });
      }

    } catch (error) {
      logger.error('登录失败', {
        error: error.message,
        email: req.body.email,
        phone: req.body.phone,
        username: req.body.username
      });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 账户登录（自动识别用户名或邮箱）
  static async accountLogin(req, res) {
    try {
      const { account, password } = req.body;

      // 检测账户是否为邮箱（包含 @ 符号）
      const isEmail = account.includes('@');

      if (isEmail) {
        // 使用邮箱登录
        return await AuthController.loginWithEmailPassword(req, res, account, password);
      } else {
        // 使用用户名登录
        return await AuthController.loginWithUsernamePassword(req, res, account, password);
      }
    } catch (error) {
      logger.error('账户登录失败', { error: error.message, account: req.body.account });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 用户名+密码登录
  static async loginWithUsernamePassword(req, res, username, password) {
    try {
      // 验证用户名格式
      if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度必须在3-20个字符之间' });
      }

      // 验证密码
      if (!password) {
        return res.status(400).json({ error: '密码为必填项' });
      }

      // 查找用户（包含密码哈希用于验证）
      const rawUser = await User.findByUsernameForAuth(username);
      if (!rawUser) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 验证密码
      const isValidPassword = await User.verifyPassword(rawUser, password);
      if (!isValidPassword) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 获取清理后的用户数据
      const user = User.sanitizeUser(rawUser);

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      // 更新用户活动时间
      await User.updateActivity(user.id);

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.json({
        success: true,
        message: '登录成功',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_admin: user.role === 'admin' || user.role === 'super_admin',
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          avatar: user.avatar,
          motto: user.motto,
          privacy_mode: user.privacy_mode,
          points: userPoints,
          total_pixels: user.total_pixels,
          current_pixels: user.current_pixels,
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          gems: user.gems,
          created_at: user.created_at
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken
        }
      });

    } catch (error) {
      logger.error('用户名密码登录失败', { error: error.message, username: req.body.username });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 邮箱+密码登录
  static async loginWithEmailPassword(req, res, email, password) {
    try {
      // 验证邮箱格式
      if (!AuthController.validateEmail(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
      }

      // 验证密码
      if (!password) {
        return res.status(400).json({ error: '密码为必填项' });
      }

      // 查找用户（包含密码哈希用于验证）
      const rawUser = await User.findByEmailForAuth(email);
      if (!rawUser) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      // 验证密码
      const isValidPassword = await User.verifyPassword(rawUser, password);
      if (!isValidPassword) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      // 获取清理后的用户数据
      const user = User.sanitizeUser(rawUser);

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      // 更新用户活动时间
      await User.updateActivity(user.id);

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.json({
        success: true,
        message: '登录成功',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_admin: user.role === 'admin' || user.role === 'super_admin',
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          avatar: user.avatar,
          motto: user.motto,
          privacy_mode: user.privacy_mode,
          points: userPoints,
          total_pixels: user.total_pixels,
          current_pixels: user.current_pixels,
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          gems: user.gems,
          created_at: user.created_at
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken
        }
      });

    } catch (error) {
      logger.error('邮箱密码登录失败', { error: error.message, email: req.body.email });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 邮箱验证码登录
  static async loginWithEmailCode(req, res, email, verificationCode) {
    try {
      // 验证邮箱格式
      if (!AuthController.validateEmail(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
      }

      // 验证验证码
      if (!verificationCode || verificationCode.length !== 6) {
        return res.status(400).json({ error: '验证码格式不正确' });
      }

      const codeVerification = AuthController.verifyVerificationCode(email, verificationCode, 'login');
      if (!codeVerification.valid) {
        return res.status(400).json({ error: codeVerification.error });
      }

      // 查找用户
      const rawUser = await User.findByEmail(email);
      if (!rawUser) {
        return res.status(401).json({ error: '该邮箱未注册' });
      }

      // 获取清理后的用户数据
      const user = User.sanitizeUser(rawUser);

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      // 更新用户活动时间
      await User.updateActivity(user.id);

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.json({
        success: true,
        message: '登录成功',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_admin: user.role === 'admin' || user.role === 'super_admin',
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          avatar: user.avatar,
          motto: user.motto,
          privacy_mode: user.privacy_mode,
          points: userPoints,
          total_pixels: user.total_pixels,
          current_pixels: user.current_pixels,
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          gems: user.gems,
          created_at: user.created_at
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken
        }
      });

    } catch (error) {
      logger.error('邮箱验证码登录失败', { error: error.message, email: req.body.email });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 手机号+密码登录（保留兼容性）
  static async loginWithPhonePassword(req, res, phone, password) {
    try {
      // 验证手机号格式
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' });
      }

      // 验证密码
      if (!password) {
        return res.status(400).json({ error: '密码为必填项' });
      }

      // 查找用户（包含密码哈希用于验证）
      const rawUser = await User.findByPhoneForAuth(phone);
      if (!rawUser) {
        return res.status(401).json({ error: '该手机号未注册' });
      }

      // 验证密码
      const isValidPassword = await User.verifyPassword(rawUser, password);
      if (!isValidPassword) {
        return res.status(401).json({ error: '手机号或密码错误' });
      }

      // 获取清理后的用户数据
      const user = User.sanitizeUser(rawUser);

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      // 更新用户活动时间
      await User.updateActivity(user.id);

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.json({
        success: true,
        message: '登录成功',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_admin: user.role === 'admin' || user.role === 'super_admin',
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          avatar: user.avatar,
          motto: user.motto,
          privacy_mode: user.privacy_mode,
          points: userPoints,
          total_pixels: user.total_pixels,
          current_pixels: user.current_pixels,
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          gems: user.gems,
          created_at: user.created_at
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken
        }
      });

    } catch (error) {
      logger.error('手机号密码登录失败', { error: error.message, phone: req.body.phone });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 自动注册手机号用户（仅开发环境）
  static async autoRegisterUserWithPhone(phone) {
    try {
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
      logger.error('自动注册手机号用户失败', {
        phone,
        error: error.message
      });
      throw new Error('用户注册失败');
    }
  }

  // 手机号验证码登录
  static async loginWithPhoneCode(req, res, phone, verificationCode) {
    try {
      // 验证手机号格式
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' });
      }

      // 验证验证码
      if (!verificationCode || verificationCode.length !== 6) {
        return res.status(400).json({ error: '验证码格式不正确' });
      }

      // 根据环境决定验证方式
      const isProduction = process.env.NODE_ENV === 'production';
      let codeVerification;

      if (isProduction || process.env.LOCAL_VALIDATION !== 'true') {
        // 生产环境或明确要求使用短信服务时，使用短信服务验证
        const smsService = require('../services/smsService');
        codeVerification = await smsService.verifyCode(phone, verificationCode, 'login');
      } else {
        // 开发环境使用内存验证码
        codeVerification = AuthController.verifyVerificationCode(phone, verificationCode, 'login');
      }

      if (!codeVerification.valid) {
        return res.status(400).json({ error: codeVerification.error });
      }

      // 查找用户
      let rawUser = await User.findByPhone(phone);

      // 如果用户不存在，自动注册（仅开发环境）
      if (!rawUser && !isProduction) {
        logger.info('用户不存在，自动注册', { phone });
        rawUser = await AuthController.autoRegisterUserWithPhone(phone);
      }

      if (!rawUser) {
        return res.status(401).json({ error: '该手机号未注册' });
      }

      // 获取清理后的用户数据
      const user = User.sanitizeUser(rawUser);

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      // 更新用户活动时间和手机验证状态
      await User.updateActivity(user.id);
      await db('users')
        .where('id', user.id)
        .update({
          phone_verified: true,
          phone_verified_at: new Date(),
          last_phone_login_at: new Date(),
          login_method: 'phone',
          updated_at: new Date()
        });

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      logger.info('手机号验证码登录成功', {
        userId: user.id,
        phone: phone,
        loginMethod: 'phone'
      });

      res.json({
        success: true,
        message: '登录成功',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          phone_verified: true,
          role: user.role,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          avatar: user.avatar,
          motto: user.motto,
          privacy_mode: user.privacy_mode,
          points: userPoints,
          total_pixels: user.total_pixels,
          current_pixels: user.current_pixels,
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          gems: user.gems,
          created_at: user.created_at,
          login_method: 'phone'
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken
        }
      });

    } catch (error) {
      logger.error('手机号验证码登录失败', { error: error.message, phone: req.body.phone });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 刷新令牌
  static async refreshToken(req, res) {
    try {
      logger.debug('刷新令牌请求', {
        body: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString()
      });

      const { refreshToken } = req.body;

      if (!refreshToken) {
        logger.warn('刷新令牌缺失');
        return res.status(400).json({ error: '刷新令牌为必填项' });
      }

      logger.debug('开始验证刷新令牌', { 
        tokenLength: refreshToken.length,
        hasRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
        secretLength: process.env.JWT_REFRESH_SECRET?.length || 0
      });

      // 验证刷新令牌
      const { verifyRefreshToken } = require('../middleware/auth');
      
      // 直接在这里进行详细的JWT验证调试
      const jwt = require('jsonwebtoken');
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        logger.debug('JWT验证成功', { decoded });
      } catch (jwtError) {
        logger.warn('JWT验证失败', { error: jwtError.message, errorType: jwtError.name });
        return res.status(403).json({ 
          error: '刷新令牌无效或已过期',
          details: jwtError.message,
          type: jwtError.name
        });
      }

      if (!decoded) {
        logger.warn('刷新令牌验证失败 - decoded为null');
        return res.status(403).json({ error: '刷新令牌无效或已过期' });
      }

      logger.info('刷新令牌验证成功', { userId: decoded.id });

      // 获取用户信息
      const user = await User.findById(decoded.id);
      if (!user) {
        logger.warn('用户不存在', { userId: decoded.id });
        return res.status(403).json({ error: '用户不存在' });
      }

      logger.info('用户信息获取成功', { username: user.username, userId: user.id });

      // 生成新的令牌
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      logger.info('新令牌生成成功', { userId: user.id });

      res.json({
        success: true,
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      });

    } catch (error) {
      logger.error('刷新令牌失败', { error: error.message, stack: error.stack });
      res.status(500).json({ error: '服务器内部错误', details: error.message });
    }
  }

  // 获取当前用户信息
  static async getCurrentUser(req, res) {
    try {
      const user = req.user;
      const userId = user.id;
      const now = Date.now();

      // 🔧 检查是否有强制刷新参数（用于战果统计等需要最新数据的场景）
      const forceRefresh = req.query.force_refresh === 'true' || req.headers['x-force-refresh'] === 'true';

      // 检查缓存（除非强制刷新）
      if (!forceRefresh) {
        const cachedData = userCache.get(userId);
        if (cachedData && (now - cachedData.timestamp) < USER_CACHE_TTL) {
          logger.debug('使用用户信息缓存', { userId });
          return res.json({
            success: true,
            user: cachedData.data
          });
        }
      } else {
        logger.debug('强制刷新用户信息，跳过缓存', { userId });
      }

      // 🚀 优化：用户 + 联盟信息合并为单条 LEFT JOIN 查询，积分并行获取
      const [userWithAlliance, points] = await Promise.all([
        db('users as u')
          .leftJoin('alliance_members as am', function() {
            this.on('am.user_id', 'u.id');
          })
          .leftJoin('alliances as a', 'am.alliance_id', 'a.id')
          .where('u.id', userId)
          .select(
            'u.*',
            'a.id as alliance_id', 'a.name as alliance_name', 'a.description as alliance_description',
            'a.flag_unicode_char as alliance_flag', 'a.color as alliance_color',
            'a.flag_pattern_id as alliance_flag_pattern_id',
            'am.role as alliance_role', 'am.joined_at as alliance_joined_at'
          )
          .first(),
        User.getUserPoints(userId)
      ]);

      const freshUser = userWithAlliance || user;
      let alliance = null;
      if (freshUser.alliance_id) {
        alliance = {
          id: freshUser.alliance_id,
          name: freshUser.alliance_name,
          description: freshUser.alliance_description,
          flag: freshUser.alliance_flag,
          flag_pattern_id: freshUser.alliance_flag_pattern_id,
          color: freshUser.alliance_color,
          role: freshUser.alliance_role,
          joined_at: freshUser.alliance_joined_at
        };
      }

      const totalPixels = freshUser.total_pixels || 0;
      const userData = {
        id: freshUser.id,
        username: freshUser.username,
        email: freshUser.email,
        phone: freshUser.phone,
        role: freshUser.role,
        is_admin: freshUser.role === 'admin' || freshUser.role === 'super_admin',
        display_name: freshUser.display_name,
        avatar_url: AuthController.sanitizeAvatarUrl(freshUser.avatar_url),
        avatar: freshUser.avatar,
        points: points,
        total_pixels: totalPixels,
        created_at: freshUser.created_at,
        last_activity: freshUser.last_activity,
        alliance: alliance,
        rankTier: RankTierService.getTierForPixels(totalPixels)
      };

      // 缓存结果（除非强制刷新）
      if (!forceRefresh) {
        userCache.set(userId, {
          data: userData,
          timestamp: now
        });
      }

      res.json({
        success: true,
        user: userData
      });

    } catch (error) {
      logger.error('获取用户信息失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 更新用户信息
  static async updateProfile(req, res) {
    try {
      const { username, email, phone, display_name, motto, avatar_url, avatar, privacy_settings } = req.body;
      const userId = req.user.id;

      logger.info('收到更新请求:', { userId, username, display_name, motto, hasAvatar: !!avatar });

      // 验证用户名长度
      if (username && (username.length < 3 || username.length > 20)) {
        return res.status(400).json({ error: '用户名长度必须在3-20个字符之间' });
      }

      // 验证邮箱格式
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: '邮箱格式不正确' });
        }
      }

      // 检查用户名是否已被其他用户使用
      if (username) {
        const existingUser = await User.findByUsername(username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: '用户名已存在' });
        }
      }

      // 检查邮箱是否已被其他用户使用
      if (email) {
        const existingUser = await User.findByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: '邮箱已被注册' });
        }
      }

      // 更新用户信息
      const updateData = {};
      if (username) updateData.username = username;
      if (email) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (display_name !== undefined) updateData.display_name = display_name;
      if (motto !== undefined) updateData.motto = motto;
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

      // 处理头像数据
      if (avatar !== undefined) {
        updateData.avatar = avatar;
        logger.info('更新头像数据，长度:', avatar?.length || 0);

        // 如果有新的头像数据，自动生成CDN头像
        if (avatar && avatar.length > 0) {
          try {
            logger.info('🎨 自动为新头像生成CDN文件...');
            const AvatarService = require('../services/avatarService');
            const avatarService = new AvatarService();

            // 生成medium尺寸的头像URL
            const newAvatarUrl = await avatarService.getAvatarUrl(avatar, 'medium', userId);

            if (newAvatarUrl) {
              updateData.avatar_url = newAvatarUrl;
              logger.info('✅ CDN头像URL已生成:', newAvatarUrl);
            }
          } catch (error) {
            logger.error('⚠️ CDN头像生成失败，仍保存原始数据:', error);
            // 即使CDN生成失败，也继续保存原始avatar数据
          }
        } else if (avatar === null || avatar === '') {
          // 如果清空头像，也清空avatar_url
          updateData.avatar_url = null;
        }
      }

      if (privacy_settings) {
        updateData.profile_settings = privacy_settings;
      }

      logger.info('准备更新的数据:', updateData);

      await db('users')
        .where({ id: userId })
        .update({
          ...updateData,
          updated_at: db.fn.now()
        });
      logger.info('数据库更新完成');

      // 获取更新后的用户信息
      const updatedUser = await User.findById(userId);
      logger.info('获取更新后的用户信息完成');

      // 清除用户缓存，下次请求时重新获取
      this.clearUserCache(userId);

      // 处理profile_settings (jsonb字段会自动处理)
      const profileSettings = updatedUser.profile_settings || {};

      res.json({
        success: true,
        message: '用户信息更新成功',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          phone: updatedUser.phone,
          display_name: updatedUser.display_name,
          motto: updatedUser.motto,
          avatar_url: updatedUser.avatar_url,
          avatar: updatedUser.avatar,
          points: updatedUser.points,
          created_at: updatedUser.created_at,
          updated_at: updatedUser.updated_at,
          last_activity: updatedUser.last_activity,
          profile_settings: profileSettings
        }
      });

    } catch (error) {
      logger.error('更新用户信息失败:', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 发送验证码（支持邮箱和手机号）
  static async sendVerificationCode(req, res) {
    try {
      const { email, phone, type } = req.body;

      // 检查必填参数
      if (!email && !phone) {
        return res.status(400).json({ error: '邮箱或手机号为必填项' });
      }

      if (!type) {
        return res.status(400).json({ error: '类型为必填项' });
      }

      if (!['register', 'login'].includes(type)) {
        return res.status(400).json({ error: '类型必须是 register 或 login' });
      }

      // 根据环境决定使用哪种验证方式
      const isProduction = process.env.NODE_ENV === 'production';
      const useSmsService = isProduction || phone; // 生产环境或提供了手机号时使用短信服务

      let identifier, code, result;

      if (phone && useSmsService) {
        // 使用手机号发送短信验证码
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
          return res.status(400).json({ error: '手机号格式不正确' });
        }

        // 调用短信服务发送验证码
        const smsService = require('../services/smsService');
        const options = {
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        };

        result = await smsService.sendVerificationCode(phone, type, options);
        identifier = phone;
        code = result.code; // 开发环境会返回验证码

      } else {
        // 使用邮箱发送验证码（兼容开发环境）
        if (!email) {
          return res.status(400).json({ error: '邮箱为必填项' });
        }

        // 验证邮箱格式
        if (!AuthController.validateEmail(email)) {
          return res.status(400).json({ error: '邮箱格式不正确' });
        }

        // 生成6位验证码
        code = Math.floor(100000 + Math.random() * 900000).toString();

        // 存储验证码到内存（开发环境简化处理）
        if (!global.verificationCodes) {
          global.verificationCodes = new Map();
        }

        // 存储验证码，5分钟过期
        global.verificationCodes.set(email, {
          code,
          timestamp: Date.now(),
          type
        });

        identifier = email;
        result = { success: true, code: code };

        // 在实际项目中，这里应该调用邮件服务发送验证码
        logger.info('验证码已发送', { email, code, type });
      }

      // 构建响应
      const response = {
        success: true,
        message: phone ? '短信验证码已发送' : '邮箱验证码已发送',
        identifier: identifier
      };

      // 开发环境返回验证码
      if (!isProduction || process.env.LOCAL_VALIDATION === 'true') {
        response.code = code;
      }

      // 如果是短信服务且返回了额外信息，添加到响应中
      if (result.messageId) {
        response.messageId = result.messageId;
      }
      if (result.expiresAt) {
        response.expiresAt = result.expiresAt;
      }

      res.json(response);

    } catch (error) {
      logger.error('发送验证码失败', {
        error: error.message,
        email: req.body.email,
        phone: req.body.phone
      });
      res.status(500).json({ error: error.message || '服务器内部错误' });
    }
  }

  // 验证验证码
  static async verifyCode(req, res) {
    try {
      const { phone, code } = req.body;

      if (!phone || !code) {
        return res.status(400).json({ error: '手机号和验证码为必填项' });
      }

      // 这里应该从Redis中获取验证码进行验证
      // 简化处理，直接返回成功
      res.json({
        success: true,
        message: '验证码验证成功'
      });

    } catch (error) {
      logger.error('验证验证码失败', { error: error.message, phone: req.body.phone });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 修改密码
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      logger.info('修改密码请求', { 
        userId, 
        hasEmail: !!req.user.email,
        email: req.user.email,
        userObject: req.user 
      });

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: '当前密码和新密码为必填项' });
      }

      // 验证新密码强度
      const passwordValidation = AuthController.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }

      // 获取用户信息（包含密码哈希）
      // 直接从数据库获取用户信息，包含密码哈希
      const rawUser = await db('users')
        .where({ id: userId })
        .first();
      
      if (!rawUser) {
        logger.error('修改密码失败：用户不存在', { 
          userId: req.user.id, 
          email: req.user.email,
          userObject: req.user 
        });
        return res.status(404).json({ error: '用户不存在' });
      }

      // 验证当前密码
      const isValidCurrentPassword = await User.verifyPassword(rawUser, currentPassword);
      if (!isValidCurrentPassword) {
        return res.status(400).json({ error: '当前密码错误' });
      }

      // 更新密码
      const bcrypt = require('bcryptjs');
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      await db('users')
        .where({ id: userId })
        .update({
          password_hash: newPasswordHash,
          updated_at: db.fn.now()
        });

      logger.info('密码修改成功', { userId });

      res.json({
        success: true,
        message: '密码修改成功'
      });

    } catch (error) {
      logger.error('修改密码失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 用户登出
  static async logout(req, res) {
    try {
      // 在实际项目中，这里应该将token加入黑名单
      // 简化处理，直接返回成功
      res.json({
        success: true,
        message: '登出成功'
      });

    } catch (error) {
      logger.error('登出失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 抖音登录
  static async douyinLogin(req, res) {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: '登录凭证code为必填项' });
      }

      logger.info('抖音登录请求', { code });

      // TODO: 实际应该调用抖音开放平台API验证code并获取用户信息
      // 这里简化处理，直接使用code作为标识
      // 实际实现应该：
      // 1. 调用抖音API: code2Session(code) 获取 openid 和 session_key
      // 2. 调用抖音API: getUserInfo() 获取用户信息（昵称、头像等）
      // 3. 根据openid查询或创建用户

      // 使用code的hash作为唯一标识（code可能很长，超过数据库字段限制）
      const crypto = require('crypto');
      const codeHash = crypto.createHash('sha256').update(code).digest('hex').substring(0, 32);
      const douyinOpenId = `dy_${codeHash}`;

      // 查找或创建用户
      let user = await db('users')
        .where({ douyin_openid: douyinOpenId })
        .orWhere({ username: douyinOpenId })
        .first();

      if (!user) {
        // 创建新用户
        const userId = require('uuid').v4();
        const bcrypt = require('bcryptjs');
        // 生成一个随机密码hash（抖音用户不需要密码登录，但数据库要求非空）
        const randomPassword = require('crypto').randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        await db('users').insert({
          id: userId,
          username: douyinOpenId,
          email: `${douyinOpenId}@douyin.temp`,
          password_hash: passwordHash,
          douyin_openid: douyinOpenId,
          display_name: `抖音用户${codeHash.slice(-6)}`,
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

        // 查询刚创建的用户
        user = await db('users')
          .where({ douyin_openid: douyinOpenId })
          .first();

        logger.info('创建新抖音用户', { userId: user.id, douyinOpenId });
      } else {
        logger.info('抖音用户已存在', { userId: user.id, douyinOpenId });
      }

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // 获取用户完整信息
      const completeUser = await User.findById(user.id);

      // 获取用户点数
      let userPoints = 0;
      try {
        const pointsResult = await db('user_points')
          .where({ user_id: user.id })
          .first();
        userPoints = pointsResult ? pointsResult.points : 0;
      } catch (error) {
        logger.warn('获取用户点数失败', { error: error.message, userId: user.id });
      }

      res.json({
        success: true,
        message: '登录成功',
        data: {
          token: accessToken,
          refreshToken: refreshToken,
          user: {
            id: completeUser.id,
            username: completeUser.username,
            display_name: completeUser.display_name,
            avatar_url: completeUser.avatar_url,
            avatar: completeUser.avatar,
            role: completeUser.role,
            points: userPoints,
            total_pixels: completeUser.total_pixels,
            current_pixels: completeUser.current_pixels,
            level: completeUser.level,
            experience: completeUser.experience,
            coins: completeUser.coins,
            gems: completeUser.gems,
            created_at: completeUser.created_at,
            // 添加抖音前端期望的用户信息格式
            userInfo: {
              nickName: completeUser.display_name || completeUser.username,
              avatarUrl: completeUser.avatar_url || completeUser.avatar
            }
          }
        }
      });

    } catch (error) {
      logger.error('抖音登录失败', {
        error: error.message,
        stack: error.stack,
        code: req.body.code
      });
      res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // 微信扫码登录
  static async wechatLogin(req, res) {
    try {
      const { code, state } = req.body;

      if (!code) {
        return res.status(400).json({ error: '登录凭证code为必填项' });
      }

      if (!state) {
        return res.status(400).json({ error: 'state参数为必填项' });
      }

      logger.info('微信登录请求', { code, state });

      // TODO: 实际应该调用微信开放平台API验证code并获取用户信息
      // 这里简化处理，模拟微信登录流程
      // 实际实现应该：
      // 1. 调用微信API: https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code
      // 2. 获取 access_token 和 openid
      // 3. 调用微信API: https://api.weixin.qq.com/sns/userinfo?access_token=ACCESS_TOKEN&openid=OPENID
      // 4. 获取用户信息（昵称、头像、性别、省份、城市等）
      // 5. 根据openid查询或创建用户

      // 使用code的hash作为唯一标识（模拟微信openid）
      const crypto = require('crypto');
      const codeHash = crypto.createHash('sha256').update(code).digest('hex').substring(0, 28);
      const wechatOpenId = `wx_${codeHash}`;

      // 查找用户
      let user = await db('users')
        .where({ wechat_openid: wechatOpenId })
        .first();

      if (!user) {
        // 创建新用户
        const userId = require('uuid').v4();
        const bcrypt = require('bcryptjs');
        // 生成一个随机密码hash（微信用户不需要密码登录，但数据库要求非空）
        const randomPassword = require('crypto').randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        // 模拟微信用户信息
        const mockWechatUserInfo = {
          nickname: `微信用户${codeHash.slice(-6)}`,
          headimgurl: null,
          sex: 0,
          province: null,
          city: null,
          country: null
        };

        await db('users').insert({
          id: userId,
          username: wechatOpenId,
          email: `${wechatOpenId}@wechat.temp`,
          password_hash: passwordHash,
          wechat_openid: wechatOpenId,
          wechat_nickname: mockWechatUserInfo.nickname,
          wechat_avatar_url: mockWechatUserInfo.headimgurl,
          wechat_sex: mockWechatUserInfo.sex,
          wechat_province: mockWechatUserInfo.province,
          wechat_city: mockWechatUserInfo.city,
          wechat_country: mockWechatUserInfo.country,
          display_name: mockWechatUserInfo.nickname,
          avatar: mockWechatUserInfo.headimgurl || 'default_avatar.png',
          login_method: 'wechat',
          role: 'user',
          level: 1,
          experience: 0,
          coins: 100,
          gems: 10,
          total_pixels: 0,
          current_pixels: 0,
          created_at: new Date(),
          updated_at: new Date(),
          wechat_last_login_at: new Date()
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

        // 查询刚创建的用户
        user = await db('users')
          .where({ wechat_openid: wechatOpenId })
          .first();

        logger.info('创建新微信用户', { userId: user.id, wechatOpenId, nickname: mockWechatUserInfo.nickname });
      } else {
        // 更新最后登录时间
        await db('users')
          .where({ id: user.id })
          .update({
            wechat_last_login_at: new Date(),
            updated_at: new Date()
          });

        logger.info('微信用户已存在', { userId: user.id, wechatOpenId });
      }

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // 获取用户完整信息
      const completeUser = await User.findById(user.id);

      // 获取用户点数
      let userPoints = 0;
      try {
        const pointsResult = await db('user_points')
          .where({ user_id: user.id })
          .first();
        userPoints = pointsResult ? pointsResult.points : 0;
      } catch (error) {
        logger.warn('获取用户点数失败', { error: error.message, userId: user.id });
      }

      res.json({
        success: true,
        message: '登录成功',
        user: {
          id: completeUser.id,
          username: completeUser.username,
          email: completeUser.email,
          phone: completeUser.phone,
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
          login_method: 'wechat',
          wechat_info: {
            nickname: completeUser.wechat_nickname,
            avatar_url: completeUser.wechat_avatar_url,
            sex: completeUser.wechat_sex,
            province: completeUser.wechat_province,
            city: completeUser.wechat_city,
            country: completeUser.wechat_country
          }
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken
        }
      });

    } catch (error) {
      logger.error('微信登录失败', {
        error: error.message,
        stack: error.stack,
        code: req.body.code,
        state: req.body.state
      });
      res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // 检查微信登录状态
  static async checkWeChatLoginStatus(req, res) {
    try {
      const { state } = req.query;

      if (!state) {
        return res.status(400).json({ error: 'state参数为必填项' });
      }

      logger.info('检查微信登录状态', { state });

      // TODO: 实际应该从Redis或数据库中查询state对应的登录状态
      // 这里简化处理，模拟登录状态检查
      // 实际实现应该：
      // 1. 从Redis中查询state对应的登录状态和用户信息
      // 2. 如果用户已扫码确认，返回用户信息
      // 3. 如果用户已扫码但未确认，返回scanned状态
      // 4. 如果二维码已过期，返回expired状态
      // 5. 如果状态无效，返回error状态

      // 模拟状态检查 - 这里可以返回不同的状态用于测试
      const mockStatuses = ['waiting', 'scanned', 'confirmed', 'expired', 'error'];
      const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];

      let responseData = {
        status: randomStatus,
        state: state
      };

      switch (randomStatus) {
        case 'scanned':
          responseData.message = '扫码成功，请在手机上确认登录';
          break;
        case 'confirmed':
          // 模拟确认登录后的用户信息
          const crypto = require('crypto');
          const mockUserId = crypto.createHash('md5').update(state).digest('hex').substring(0, 32);
          responseData.userInfo = {
            id: mockUserId,
            username: `wx_user_${mockUserId.slice(-8)}`,
            display_name: `微信用户${mockUserId.slice(-6)}`,
            avatar_url: null,
            role: 'user'
          };
          responseData.message = '登录成功';
          break;
        case 'expired':
          responseData.message = '二维码已过期，请刷新重试';
          break;
        case 'error':
          responseData.message = '登录失败，请重试';
          break;
        default:
          responseData.message = '等待扫码';
      }

      res.json(responseData);

    } catch (error) {
      logger.error('检查微信登录状态失败', {
        error: error.message,
        stack: error.stack,
        state: req.query.state
      });
      res.status(500).json({
        status: 'error',
        error: '服务器内部错误',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // 获取微信用户信息
  static async getWeChatUserInfo(req, res) {
    try {
      // 这个端点用于获取当前微信登录用户的详细信息
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: '用户未登录' });
      }

      if (user.login_method !== 'wechat') {
        return res.status(400).json({ error: '非微信登录用户' });
      }

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_admin: user.role === 'admin' || user.role === 'super_admin',
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          avatar: user.avatar,
          motto: user.motto,
          privacy_mode: user.privacy_mode,
          points: userPoints,
          total_pixels: user.total_pixels,
          current_pixels: user.current_pixels,
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          gems: user.gems,
          created_at: user.created_at,
          login_method: user.login_method,
          wechat_info: {
            nickname: user.wechat_nickname,
            avatar_url: user.wechat_avatar_url,
            sex: user.wechat_sex,
            province: user.wechat_province,
            city: user.wechat_city,
            country: user.wechat_country,
            last_login_at: user.wechat_last_login_at
          }
        }
      });

    } catch (error) {
      logger.error('获取微信用户信息失败', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  /**
   * Strip hardcoded localhost URLs from avatar paths so clients
   * can resolve them relative to their configured API base.
   */
  static sanitizeAvatarUrl(url) {
    if (!url) return url;
    // Remove http://localhost:PORT or http://IP:PORT prefix, keep the path
    return url.replace(/^https?:\/\/(localhost|[\d.]+)(:\d+)?/, '');
  }

  // Apple Sign In 登录
  static async appleLogin(req, res) {
    try {
      const { identity_token, authorization_code, full_name, email } = req.body;

      if (!identity_token) {
        return res.status(400).json({ error: 'identity_token 为必填项' });
      }

      // 解析 Apple identity token (JWT)
      // Apple identity token 是一个 JWT，包含用户的 Apple ID
      let appleUserId;
      let tokenEmail;

      try {
        // 解码 JWT payload (不验证签名，生产环境应验证)
        const parts = identity_token.split('.');
        if (parts.length !== 3) {
          return res.status(400).json({ error: 'identity_token 格式无效' });
        }

        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        appleUserId = payload.sub; // Apple User ID
        tokenEmail = payload.email;

        if (!appleUserId) {
          return res.status(400).json({ error: 'identity_token 缺少用户标识' });
        }

        logger.info('Apple Sign In token parsed', {
          appleUserId: appleUserId.substring(0, 10) + '...',
          hasEmail: !!tokenEmail
        });

      } catch (parseError) {
        logger.error('Apple identity_token 解析失败', { error: parseError.message });
        return res.status(400).json({ error: 'identity_token 解析失败' });
      }

      // 使用 email 优先级: 请求体中的 email > token 中的 email
      const userEmail = email || tokenEmail;

      // 查找是否已有关联的 Apple 用户
      let user = await db('users')
        .where('apple_user_id', appleUserId)
        .first();

      if (user) {
        // 已有用户，更新登录信息
        await db('users')
          .where('id', user.id)
          .update({
            apple_last_login_at: new Date(),
            login_method: 'apple',
            updated_at: new Date()
          });

        logger.info('Apple Sign In 登录成功 (existing user)', { userId: user.id });

      } else {
        // 新用户注册
        // 检查 email 是否已被其他账户使用
        if (userEmail) {
          const existingEmailUser = await User.findByEmail(userEmail);
          if (existingEmailUser) {
            // 将 Apple ID 关联到现有账户
            await db('users')
              .where('id', existingEmailUser.id)
              .update({
                apple_user_id: appleUserId,
                apple_last_login_at: new Date(),
                login_method: 'apple',
                updated_at: new Date()
              });

            user = await User.findById(existingEmailUser.id);
            logger.info('Apple Sign In 关联到现有账户', { userId: user.id, email: userEmail });

          }
        }

        if (!user) {
          // 创建新用户
          const username = full_name || `apple_${appleUserId.substring(0, 8)}`;
          const generatedEmail = userEmail || `${appleUserId}@apple.funnypixels.com`;

          // 确保用户名唯一
          let uniqueUsername = username;
          let counter = 1;
          while (await User.findByUsername(uniqueUsername)) {
            uniqueUsername = `${username}_${counter}`;
            counter++;
          }

          const [newUser] = await db('users')
            .insert({
              id: require('uuid').v4(),
              username: uniqueUsername,
              email: generatedEmail,
              password_hash: await require('bcryptjs').hash(require('uuid').v4(), 10), // 随机密码
              display_name: full_name || uniqueUsername,
              apple_user_id: appleUserId,
              apple_last_login_at: new Date(),
              login_method: 'apple',
              level: 1,
              experience: 0,
              coins: 100,
              gems: 10,
              total_pixels: 0,
              current_pixels: 0,
              created_at: new Date(),
              updated_at: new Date()
            })
            .returning('*');

          // 创建用户像素状态
          await db('user_pixel_states').insert({
            user_id: newUser.id,
            last_accum_time: Math.floor(Date.now() / 1000)
          });

          // 创建用户积分记录
          await db('user_points').insert({
            user_id: newUser.id,
            total_points: 0,
            created_at: new Date(),
            updated_at: new Date()
          });

          user = newUser;
          logger.info('Apple Sign In 新用户注册成功', { userId: user.id, username: uniqueUsername });
        }
      }

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      // 更新用户活动时间
      await User.updateActivity(user.id);

      // 生成令牌
      const cleanUser = User.sanitizeUser(user);
      const accessToken = generateAccessToken(cleanUser);
      const refreshToken = generateRefreshToken(cleanUser);

      res.json({
        success: true,
        message: 'Apple 登录成功',
        user: {
          id: cleanUser.id,
          username: cleanUser.username,
          email: cleanUser.email,
          phone: cleanUser.phone,
          role: cleanUser.role,
          is_admin: cleanUser.role === 'admin' || cleanUser.role === 'super_admin',
          display_name: cleanUser.display_name,
          avatar_url: cleanUser.avatar_url,
          avatar: cleanUser.avatar,
          motto: cleanUser.motto,
          privacy_mode: cleanUser.privacy_mode,
          points: userPoints,
          total_pixels: cleanUser.total_pixels,
          current_pixels: cleanUser.current_pixels,
          level: cleanUser.level,
          experience: cleanUser.experience,
          coins: cleanUser.coins,
          gems: cleanUser.gems,
          created_at: cleanUser.created_at
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      logger.error('Apple Sign In 失败', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
  // Google Sign In 登录
  static async googleLogin(req, res) {
    try {
      const { id_token, full_name, email: requestEmail } = req.body;

      if (!id_token) {
        return res.status(400).json({ error: 'id_token 为必填项' });
      }

      // 解析 Google ID Token (JWT)
      let googleUserId;
      let tokenEmail;

      try {
        const parts = id_token.split('.');
        if (parts.length !== 3) {
          return res.status(400).json({ error: 'id_token 格式无效' });
        }

        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        googleUserId = payload.sub; // Google User ID
        tokenEmail = payload.email;

        if (!googleUserId) {
          return res.status(400).json({ error: 'id_token 缺少用户标识' });
        }

        logger.info('Google Sign In token parsed', {
          googleUserId: googleUserId.substring(0, 10) + '...',
          hasEmail: !!tokenEmail
        });

      } catch (parseError) {
        logger.error('Google id_token 解析失败', { error: parseError.message });
        return res.status(400).json({ error: 'id_token 解析失败' });
      }

      // 使用 email 优先级: 请求体中的 email > token 中的 email
      const userEmail = requestEmail || tokenEmail;

      // 查找是否已有关联的 Google 用户
      let user = await db('users')
        .where('google_user_id', googleUserId)
        .first();

      if (user) {
        // 已有用户，更新登录信息
        await db('users')
          .where('id', user.id)
          .update({
            google_last_login_at: new Date(),
            login_method: 'google',
            updated_at: new Date()
          });

        logger.info('Google Sign In 登录成功 (existing user)', { userId: user.id });

      } else {
        // 新用户注册
        // 检查 email 是否已被其他账户使用
        if (userEmail) {
          const existingEmailUser = await User.findByEmail(userEmail);
          if (existingEmailUser) {
            // 将 Google ID 关联到现有账户
            await db('users')
              .where('id', existingEmailUser.id)
              .update({
                google_user_id: googleUserId,
                google_last_login_at: new Date(),
                login_method: 'google',
                updated_at: new Date()
              });

            user = await User.findById(existingEmailUser.id);
            logger.info('Google Sign In 关联到现有账户', { userId: user.id, email: userEmail });
          }
        }

        if (!user) {
          // 创建新用户
          const username = full_name || `google_${googleUserId.substring(0, 8)}`;
          const generatedEmail = userEmail || `${googleUserId}@google.funnypixels.com`;

          // 确保用户名唯一
          let uniqueUsername = username;
          let counter = 1;
          while (await User.findByUsername(uniqueUsername)) {
            uniqueUsername = `${username}_${counter}`;
            counter++;
          }

          const [newUser] = await db('users')
            .insert({
              id: require('uuid').v4(),
              username: uniqueUsername,
              email: generatedEmail,
              password_hash: await require('bcryptjs').hash(require('uuid').v4(), 10),
              display_name: full_name || uniqueUsername,
              google_user_id: googleUserId,
              google_last_login_at: new Date(),
              login_method: 'google',
              level: 1,
              experience: 0,
              coins: 100,
              gems: 10,
              total_pixels: 0,
              current_pixels: 0,
              created_at: new Date(),
              updated_at: new Date()
            })
            .returning('*');

          // 创建用户像素状态
          await db('user_pixel_states').insert({
            user_id: newUser.id,
            last_accum_time: Math.floor(Date.now() / 1000)
          });

          // 创建用户积分记录
          await db('user_points').insert({
            user_id: newUser.id,
            total_points: 0,
            created_at: new Date(),
            updated_at: new Date()
          });

          user = newUser;
          logger.info('Google Sign In 新用户注册成功', { userId: user.id, username: uniqueUsername });
        }
      }

      // 获取用户积分
      const userPoints = await User.getUserPoints(user.id);

      // 更新用户活动时间
      await User.updateActivity(user.id);

      // 生成令牌
      const cleanUser = User.sanitizeUser(user);
      const accessToken = generateAccessToken(cleanUser);
      const refreshToken = generateRefreshToken(cleanUser);

      res.json({
        success: true,
        message: 'Google 登录成功',
        user: {
          id: cleanUser.id,
          username: cleanUser.username,
          email: cleanUser.email,
          phone: cleanUser.phone,
          role: cleanUser.role,
          is_admin: cleanUser.role === 'admin' || cleanUser.role === 'super_admin',
          display_name: cleanUser.display_name,
          avatar_url: cleanUser.avatar_url,
          avatar: cleanUser.avatar,
          motto: cleanUser.motto,
          privacy_mode: cleanUser.privacy_mode,
          points: userPoints,
          total_pixels: cleanUser.total_pixels,
          current_pixels: cleanUser.current_pixels,
          level: cleanUser.level,
          experience: cleanUser.experience,
          coins: cleanUser.coins,
          gems: cleanUser.gems,
          created_at: cleanUser.created_at
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      logger.error('Google Sign In 失败', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
}

module.exports = AuthController;
