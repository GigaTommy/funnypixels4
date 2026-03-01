/**
 * 认证服务
 * 处理所有认证相关的业务逻辑
 *
 * @module services/authService
 */

const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const RankTierService = require('./rankTierService');

/**
 * 认证服务类
 * 职责：处理用户认证、注册、验证码验证等核心业务逻辑
 */
class AuthService {
  /**
   * 简单的用户信息内存缓存
   * @private
   */
  static userCache = new Map();
  static USER_CACHE_TTL = 30 * 1000; // 30秒缓存时间

  /**
   * 清除用户缓存
   * @param {number} userId - 用户ID
   */
  static clearUserCache(userId) {
    if (userId) {
      this.userCache.delete(userId);
      // Also clear User model Redis cache
      const User = require('../models/User');
      User.clearCache(userId);
      logger.debug('清除用户缓存', { userId });
    }
  }

  /**
   * 验证邮箱格式
   * @param {string} email - 邮箱地址
   * @returns {boolean} 是否有效
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证密码强度
   * @param {string} password - 密码
   * @returns {{valid: boolean, error?: string}} 验证结果
   */
  static validatePassword(password) {
    if (!password || password.length < 6) {
      return { valid: false, error: '密码长度至少6个字符' };
    }
    if (password.length > 128) {
      return { valid: false, error: '密码长度不能超过128个字符' };
    }
    return { valid: true };
  }

  /**
   * 验证验证码
   * @param {string} identifier - 标识符（邮箱或手机号）
   * @param {string} code - 验证码
   * @param {string} type - 验证码类型
   * @returns {{valid: boolean, error?: string}} 验证结果
   */
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

  /**
   * 通过邮箱验证码注册用户
   * @param {string} email - 邮箱地址
   * @param {string} verificationCode - 验证码
   * @param {string} password - 密码
   * @returns {Promise<{user: Object, accessToken: string, refreshToken: string}>} 注册结果
   * @throws {Error} 注册失败时抛出错误
   */
  static async registerWithEmailCode(email, verificationCode, password) {
    // 验证邮箱格式
    if (!this.validateEmail(email)) {
      throw new Error('邮箱格式不正确');
    }

    // 验证验证码
    if (!verificationCode || verificationCode.length !== 6) {
      throw new Error('验证码格式不正确');
    }

    const verification = this.verifyVerificationCode(email, verificationCode, 'register');
    if (!verification.valid) {
      throw new Error(verification.error);
    }

    // 验证密码
    if (password) {
      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.error);
      }
    }

    // 检查邮箱是否已注册
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('该邮箱已被注册');
    }

    // 创建用户
    const hashedPassword = password ? await User.hashPassword(password) : null;
    const user = await User.create({
      email,
      password: hashedPassword,
      username: email.split('@')[0],
      is_email_verified: true
    });

    // 生成令牌
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // 保存刷新令牌
    await User.saveRefreshToken(user.id, refreshToken);

    logger.info('用户注册成功（邮箱验证码）', {
      userId: user.id,
      email: user.email,
      method: 'email_code'
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      },
      accessToken,
      refreshToken
    };
  }

  /**
   * 用户登录
   * @param {string} email - 邮箱地址
   * @param {string} password - 密码
   * @returns {Promise<{user: Object, accessToken: string, refreshToken: string}>} 登录结果
   * @throws {Error} 登录失败时抛出错误
   */
  static async login(email, password) {
    // 验证邮箱格式
    if (!this.validateEmail(email)) {
      throw new Error('邮箱格式不正确');
    }

    // 查找用户
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await User.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('邮箱或密码错误');
    }

    // 生成令牌
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // 保存刷新令牌
    await User.saveRefreshToken(user.id, refreshToken);

    // 更新最后登录时间
    await db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info('用户登录成功', { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url
      },
      accessToken,
      refreshToken
    };
  }

  /**
   * 刷新访问令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<{accessToken: string, refreshToken: string}>} 新令牌
   * @throws {Error} 刷新失败时抛出错误
   */
  static async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('刷新令牌不能为空');
    }

    // 验证刷新令牌
    const isValid = await User.verifyRefreshToken(refreshToken);
    if (!isValid) {
      throw new Error('刷新令牌无效或已过期');
    }

    // 从刷新令牌中获取用户信息
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const userId = decoded.id;

    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 生成新的访问令牌和刷新令牌
    const newAccessToken = generateAccessToken({ id: user.id, email: user.email });
    const newRefreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // 保存新的刷新令牌
    await User.saveRefreshToken(user.id, newRefreshToken);

    logger.info('刷新令牌成功', { userId: user.id });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  /**
   * 获取用户信息（带缓存）
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 用户信息
   */
  static async getUserInfo(userId) {
    // 检查缓存
    const cached = this.userCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.USER_CACHE_TTL) {
      logger.debug('用户信息缓存命中', { userId });
      return cached.user;
    }

    // 从数据库查询
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 更新缓存
    this.userCache.set(userId, {
      user,
      timestamp: Date.now()
    });

    return user;
  }

  /**
   * 更新用户资料
   * @param {number} userId - 用户ID
   * @param {Object} updates - 更新的字段
   * @returns {Promise<Object>} 更新后的用户信息
   */
  static async updateUserProfile(userId, updates) {
    const allowedFields = ['username', 'avatar_url', 'bio', 'location'];
    const filteredUpdates = {};

    // 只允许更新特定字段
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('没有可更新的字段');
    }

    // 执行更新
    const updatedUser = await User.update(userId, filteredUpdates);

    // 清除缓存
    this.clearUserCache(userId);

    logger.info('用户资料更新成功', { userId, updates: Object.keys(filteredUpdates) });

    return updatedUser;
  }

  /**
   * 修改密码
   * @param {number} userId - 用户ID
   * @param {string} oldPassword - 旧密码
   * @param {string} newPassword - 新密码
   * @returns {Promise<void>}
   * @throws {Error} 修改失败时抛出错误
   */
  static async changePassword(userId, oldPassword, newPassword) {
    // 验证新密码
    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.error);
    }

    // 获取用户
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 验证旧密码
    const isOldPasswordValid = await User.verifyPassword(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new Error('旧密码错误');
    }

    // 检查新旧密码是否相同
    if (oldPassword === newPassword) {
      throw new Error('新密码不能与旧密码相同');
    }

    // 更新密码
    const hashedPassword = await User.hashPassword(newPassword);
    await User.update(userId, { password: hashedPassword });

    logger.info('用户密码修改成功', { userId });
  }

  /**
   * 用户登出
   * @param {number} userId - 用户ID
   * @returns {Promise<void>}
   */
  static async logout(userId) {
    // 清除刷新令牌
    await User.clearRefreshTokens(userId);

    // 清除缓存
    this.clearUserCache(userId);

    logger.info('用户登出成功', { userId });
  }
}

module.exports = AuthService;
