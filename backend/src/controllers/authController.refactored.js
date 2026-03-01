/**
 * 认证控制器（重构版本）
 *
 * 职责：
 * 1. 接收HTTP请求
 * 2. 验证请求格式（已由中间件处理）
 * 3. 调用Service层处理业务逻辑
 * 4. 格式化响应并返回给客户端
 * 5. 处理错误并返回适当的HTTP状态码
 *
 * ❌ 不应该做的事情：
 * - 直接操作数据库（应通过Repository或Model）
 * - 包含复杂的业务逻辑（应在Service层）
 * - 进行数据验证（应在Validator或Service层）
 *
 * @module controllers/authController
 */

const AuthService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * 认证控制器类
 */
class AuthController {
  /**
   * 用户注册
   * POST /api/auth/register
   *
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  static async register(req, res) {
    try {
      const { email, password, verificationCode } = req.body;

      // 检查是否为邮箱验证码注册
      if (!email || !verificationCode) {
        return res.status(400).json({
          success: false,
          error: '请提供邮箱和验证码'
        });
      }

      // 调用Service层处理业务逻辑
      const result = await AuthService.registerWithEmailCode(
        email,
        verificationCode,
        password
      );

      // 返回成功响应
      return res.status(201).json({
        success: true,
        message: '注册成功',
        user: result.user,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });

    } catch (error) {
      // 记录错误
      logger.error('注册失败', {
        error: error.message,
        email: req.body.email
      });

      // 根据错误类型返回适当的状态码
      if (error.message.includes('已被注册') ||
          error.message.includes('格式不正确') ||
          error.message.includes('验证码')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      // 默认返回500错误
      return res.status(500).json({
        success: false,
        error: '注册失败，请稍后重试'
      });
    }
  }

  /**
   * 用户登录
   * POST /api/auth/login
   *
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: '请提供邮箱和密码'
        });
      }

      // 调用Service层处理业务逻辑
      const result = await AuthService.login(email, password);

      // 返回成功响应
      return res.status(200).json({
        success: true,
        message: '登录成功',
        user: result.user,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });

    } catch (error) {
      logger.error('登录失败', {
        error: error.message,
        email: req.body.email
      });

      // 认证错误返回401
      if (error.message.includes('密码错误') ||
          error.message.includes('格式不正确')) {
        return res.status(401).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: '登录失败，请稍后重试'
      });
    }
  }

  /**
   * 刷新令牌
   * POST /api/auth/refresh
   *
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: '请提供刷新令牌'
        });
      }

      // 调用Service层处理业务逻辑
      const result = await AuthService.refreshAccessToken(refreshToken);

      return res.status(200).json({
        success: true,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });

    } catch (error) {
      logger.error('刷新令牌失败', { error: error.message });

      if (error.message.includes('无效') || error.message.includes('过期')) {
        return res.status(401).json({
          success: false,
          error: '刷新令牌无效或已过期，请重新登录'
        });
      }

      return res.status(500).json({
        success: false,
        error: '刷新令牌失败，请稍后重试'
      });
    }
  }

  /**
   * 获取当前用户信息
   * GET /api/auth/me
   *
   * @param {Object} req - Express请求对象（包含user对象，由authenticateToken中间件注入）
   * @param {Object} res - Express响应对象
   */
  static async getCurrentUser(req, res) {
    try {
      const userId = req.user.id;

      // 调用Service层获取用户信息
      const user = await AuthService.getUserInfo(userId);

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatar_url: user.avatar_url,
          bio: user.bio,
          location: user.location
        }
      });

    } catch (error) {
      logger.error('获取用户信息失败', {
        error: error.message,
        userId: req.user?.id
      });

      if (error.message.includes('不存在')) {
        return res.status(404).json({
          success: false,
          error: '用户不存在'
        });
      }

      return res.status(500).json({
        success: false,
        error: '获取用户信息失败'
      });
    }
  }

  /**
   * 更新用户资料
   * PUT /api/auth/profile
   *
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const updates = req.body;

      // 调用Service层处理更新
      const updatedUser = await AuthService.updateUserProfile(userId, updates);

      return res.status(200).json({
        success: true,
        message: '资料更新成功',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          avatar_url: updatedUser.avatar_url,
          bio: updatedUser.bio,
          location: updatedUser.location
        }
      });

    } catch (error) {
      logger.error('更新用户资料失败', {
        error: error.message,
        userId: req.user?.id
      });

      if (error.message.includes('没有可更新的字段')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: '更新资料失败'
      });
    }
  }

  /**
   * 修改密码
   * PUT /api/auth/change-password
   *
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  static async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: '请提供旧密码和新密码'
        });
      }

      // 调用Service层处理密码修改
      await AuthService.changePassword(userId, oldPassword, newPassword);

      return res.status(200).json({
        success: true,
        message: '密码修改成功'
      });

    } catch (error) {
      logger.error('修改密码失败', {
        error: error.message,
        userId: req.user?.id
      });

      if (error.message.includes('旧密码错误') ||
          error.message.includes('密码长度') ||
          error.message.includes('不能与旧密码相同')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: '修改密码失败'
      });
    }
  }

  /**
   * 用户登出
   * POST /api/auth/logout
   *
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  static async logout(req, res) {
    try {
      const userId = req.user.id;

      // 调用Service层处理登出
      await AuthService.logout(userId);

      return res.status(200).json({
        success: true,
        message: '登出成功'
      });

    } catch (error) {
      logger.error('登出失败', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: '登出失败'
      });
    }
  }

  // 验证码相关方法保持不变，因为这些是简单的业务逻辑
  // 或者也可以移到AuthService中...

  /**
   * 发送验证码
   * POST /api/auth/send-code
   */
  static async sendVerificationCode(req, res) {
    // 实现发送验证码逻辑
    // 这部分可以保留在Controller中，因为它主要是调用外部服务（邮件/短信）
    // 或者也可以创建一个单独的 VerificationService
    res.status(501).json({
      success: false,
      error: '功能开发中'
    });
  }

  /**
   * 验证验证码
   * POST /api/auth/verify-code
   */
  static async verifyCode(req, res) {
    try {
      const { identifier, code, type } = req.body;

      const result = AuthService.verifyVerificationCode(identifier, code, type);

      if (result.valid) {
        return res.status(200).json({
          success: true,
          message: '验证码验证成功'
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('验证码验证失败', { error: error.message });
      return res.status(500).json({
        success: false,
        error: '验证失败'
      });
    }
  }
}

module.exports = AuthController;
