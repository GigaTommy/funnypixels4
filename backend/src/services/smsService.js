const Dysmsapi20170525 = require('@alicloud/dysmsapi20170525');
const OpenApi = require('@alicloud/openapi-client');
const { db, redis } = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class SmsService {
  constructor() {
    // 初始化阿里云SMS客户端
    this.config = new OpenApi.Config({
      accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET
    });
    this.config.endpoint = 'dysmsapi.aliyuncs.com';
    this.client = new Dysmsapi20170525.default(this.config);

    // 配置参数
    this.signName = process.env.ALIYUN_SMS_SIGN_NAME || 'FunnyPixels';
    this.templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_xxxxxx';
    this.codeExpireTime = 5 * 60; // 5分钟
    this.rateLimitTime = 60; // 1分钟内只能发送一次
  }

  /**
   * 发送短信验证码
   * @param {string} phone - 手机号
   * @param {string} type - 验证码类型：login, register, reset_password
   * @param {object} options - 额外选项
   * @returns {Promise<object>}
   */
  async sendVerificationCode(phone, type = 'login', options = {}) {
    try {
      // 验证手机号格式
      if (!this.isValidPhone(phone)) {
        throw new Error('手机号格式不正确');
      }

      // 验证类型
      if (!['login', 'register', 'reset_password'].includes(type)) {
        throw new Error('验证码类型不正确');
      }

      // 检查发送频率限制
      await this.checkRateLimit(phone, type);

      // 检查今日发送次数限制
      await this.checkDailyLimit(phone, options.ipAddress);

      // 生成6位验证码
      const code = this.generateVerificationCode();

      // 存储验证码到数据库
      const verificationData = await this.storeVerificationCode(phone, code, type, options);

      // 开发环境直接返回验证码，生产环境发送短信
      if (process.env.NODE_ENV === 'development' && process.env.LOCAL_VALIDATION === 'true') {
        logger.info('开发环境 - 跳过短信发送', { phone, code, type });
        return {
          success: true,
          messageId: `dev_${verificationData.id}`,
          code: code, // 开发环境返回验证码
          expiresAt: verificationData.expires_at
        };
      }

      // 调用阿里云短信API
      const smsResult = await this.sendSms(phone, code);

      // 更新数据库记录
      await this.updateVerificationRecord(verificationData.id, {
        status: 'sent',
        message_id: smsResult.messageId,
        sent_at: new Date()
      });

      logger.info('短信发送成功', {
        phone,
        type,
        messageId: smsResult.messageId,
        ipAddress: options.ipAddress
      });

      return {
        success: true,
        messageId: smsResult.messageId,
        expiresAt: verificationData.expires_at
      };

    } catch (error) {
      logger.error('短信发送失败', {
        phone,
        type,
        error: error.message,
        stack: error.stack,
        ipAddress: options.ipAddress
      });
      throw error;
    }
  }

  /**
   * 验证短信验证码
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @param {string} type - 验证码类型
   * @returns {Promise<object>}
   */
  async verifyCode(phone, code, type = 'login') {
    try {
      // 验证手机号和验证码格式
      if (!this.isValidPhone(phone) || !code) {
        return { valid: false, error: '手机号或验证码格式不正确' };
      }

      // 从数据库查询验证码记录
      const verification = await db('sms_verification_codes')
        .where({
          phone: phone,
          code: code,
          type: type,
          used: false
        })
        .where('expires_at', '>', new Date())
        .orderBy('created_at', 'desc')
        .first();

      if (!verification) {
        return { valid: false, error: '验证码不存在或已过期' };
      }

      // 检查是否已过期
      if (new Date(verification.expires_at) < new Date()) {
        return { valid: false, error: '验证码已过期' };
      }

      // 标记为已使用
      await db('sms_verification_codes')
        .where('id', verification.id)
        .update({
          used: true,
          used_at: new Date(),
          updated_at: new Date()
        });

      logger.info('验证码验证成功', {
        phone,
        type,
        verificationId: verification.id
      });

      return { valid: true };

    } catch (error) {
      logger.error('验证码验证失败', {
        phone,
        type,
        error: error.message
      });
      return { valid: false, error: '服务器内部错误' };
    }
  }

  /**
   * 调用阿里云短信API
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @returns {Promise<object>}
   */
  async sendSms(phone, code) {
    try {
      const params = {
        phoneNumbers: phone,
        signName: this.signName,
        templateCode: this.templateCode,
        templateParam: JSON.stringify({ code })
      };

      const result = await this.client.sendSms(params);

      if (result.body.code === 'OK') {
        return {
          success: true,
          messageId: result.body.bizId
        };
      } else {
        throw new Error(`短信发送失败: ${result.body.message}`);
      }

    } catch (error) {
      logger.error('阿里云短信API调用失败', {
        phone,
        error: error.message
      });
      throw new Error(`短信服务暂时不可用: ${error.message}`);
    }
  }

  /**
   * 存储验证码到数据库
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @param {string} type - 验证码类型
   * @param {object} options - 额外选项
   * @returns {Promise<object>}
   */
  async storeVerificationCode(phone, code, type, options = {}) {
    const expiresAt = new Date(Date.now() + this.codeExpireTime * 1000);

    const verificationData = {
      id: uuidv4(),
      phone: phone,
      code: code,
      type: type,
      ip_address: options.ipAddress,
      user_agent: options.userAgent,
      status: 'sent',
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('sms_verification_codes').insert(verificationData);

    return verificationData;
  }

  /**
   * 更新验证码记录
   * @param {string} id - 记录ID
   * @param {object} updateData - 更新数据
   * @returns {Promise<void>}
   */
  async updateVerificationRecord(id, updateData) {
    await db('sms_verification_codes')
      .where('id', id)
      .update({
        ...updateData,
        updated_at: new Date()
      });
  }

  /**
   * 检查发送频率限制
   * @param {string} phone - 手机号
   * @param {string} type - 验证码类型
   * @returns {Promise<void>}
   */
  async checkRateLimit(phone, type) {
    const recentVerification = await db('sms_verification_codes')
      .where({
        phone: phone,
        type: type
      })
      .where('created_at', '>', new Date(Date.now() - this.rateLimitTime * 1000))
      .first();

    if (recentVerification) {
      const remainingTime = Math.ceil(
        (recentVerification.created_at.getTime() + this.rateLimitTime * 1000 - Date.now()) / 1000
      );
      throw new Error(`发送过于频繁，请等待${remainingTime}秒后再试`);
    }
  }

  /**
   * 检查每日发送次数限制
   * @param {string} phone - 手机号
   * @param {string} ipAddress - IP地址
   * @returns {Promise<void>}
   */
  async checkDailyLimit(phone, ipAddress) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 检查手机号每日发送次数（最多10次）
    const phoneCount = await db('sms_verification_codes')
      .where('phone', phone)
      .where('created_at', '>=', today)
      .count('* as count');

    if (parseInt(phoneCount[0].count) >= 10) {
      throw new Error('该手机号今日发送次数已达上限');
    }

    // 检查IP每日发送次数（最多20次）
    if (ipAddress) {
      const ipCount = await db('sms_verification_codes')
        .where('ip_address', ipAddress)
        .where('created_at', '>=', today)
        .count('* as count');

      if (parseInt(ipCount[0].count) >= 20) {
        throw new Error('该IP今日发送次数已达上限');
      }
    }
  }

  /**
   * 生成6位验证码
   * @returns {string}
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 验证手机号格式
   * @param {string} phone - 手机号
   * @returns {boolean}
   */
  isValidPhone(phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 清理过期的验证码记录
   * @returns {Promise<number>} 删除的记录数
   */
  async cleanExpiredCodes() {
    try {
      const result = await db('sms_verification_codes')
        .where('expires_at', '<', new Date())
        .orWhere('used', true)
        .where('created_at', '<', new Date(Date.now() - 24 * 60 * 60 * 1000)) // 24小时前的已使用记录
        .del();

      if (result > 0) {
        logger.info('清理过期验证码记录', { count: result });
      }

      return result;
    } catch (error) {
      logger.error('清理过期验证码记录失败', { error: error.message });
      return 0;
    }
  }

  /**
   * 获取手机号归属地信息
   * @param {string} phone - 手机号
   * @returns {Promise<object>}
   */
  async getPhoneLocation(phone) {
    try {
      // 这里可以集成第三方手机号归属地查询API
      // 暂时返回基本信息
      const prefix = phone.substring(0, 3);
      const carriers = {
        '130': '中国联通', '131': '中国联通', '132': '中国联通', '155': '中国联通', '156': '中国联通', '185': '中国联通', '186': '中国联通',
        '134': '中国移动', '135': '中国移动', '136': '中国移动', '137': '中国移动', '138': '中国移动', '139': '中国移动',
        '147': '中国移动', '150': '中国移动', '151': '中国移动', '152': '中国移动', '157': '中国移动', '158': '中国移动',
        '159': '中国移动', '182': '中国移动', '183': '中国移动', '184': '中国移动', '187': '中国移动', '188': '中国移动',
        '133': '中国电信', '153': '中国电信', '180': '中国电信', '181': '中国电信', '189': '中国电信'
      };

      return {
        carrier: carriers[prefix] || '未知运营商',
        province: '未知',
        city: '未知'
      };
    } catch (error) {
      logger.error('获取手机号归属地失败', { phone, error: error.message });
      return {
        carrier: '未知运营商',
        province: '未知',
        city: '未知'
      };
    }
  }
}

module.exports = new SmsService();