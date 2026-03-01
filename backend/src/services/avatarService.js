/**
 * 头像服务 - 适配现有的存储架构
 * 将像素数据转换为PNG格式并上传到存储系统（开发环境本地，生产环境CDN）
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const { getMaterialStorage } = require('./storage');
const { redisUtils } = require('../config/redis');

class AvatarService {
  constructor() {
    this.storage = getMaterialStorage();
    // 移除内存缓存，避免内存泄漏
    // this.avatarCache = new Map(); 
    this.avatarSizes = {
      small: 32,   // 32x32 - 小头像（地图卡片使用）
      medium: 64,  // 64x64 - 中等头像（个人资料使用）
      large: 128   // 128x128 - 大头像（联盟页面使用）
    };

    // 缓存TTL: 24小时
    this.cacheTTL = 24 * 60 * 60;

    // 确保头像存储目录存在
    this.ensureAvatarDirectory();
  }

  /**
   * 确保头像存储目录存在
   */
  async ensureAvatarDirectory() {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      // 获取存储配置中的baseDir
      const storageBaseDir = this.storage.baseDir;
      const avatarDir = path.join(storageBaseDir, 'avatars');
      await fs.mkdir(avatarDir, { recursive: true });

      logger.info(`✅ 头像存储目录已准备: ${avatarDir}`);
    } catch (error) {
      logger.warn('⚠️ 头像存储目录创建失败:', error.message);
    }
  }

  /**
   * 将像素数据转换为PNG Buffer
   * @param {string} pixelData - 压缩的像素数据（逗号分隔的颜色代码）
   * @param {number} size - 输出图片尺寸
   * @returns {Promise<Buffer>} PNG图片Buffer
   */
  async pixelDataToPNG(pixelData, size = 64) {
    if (!pixelData || !pixelData.includes(',')) {
      throw new Error('无效的像素数据格式');
    }

    try {
      // 检查是否有canvas模块
      let canvas;
      try {
        canvas = require('canvas');
      } catch (canvasError) {
        logger.error('Canvas模块未安装，无法转换像素数据:', canvasError);
        throw new Error('需要安装canvas模块: npm install canvas');
      }

      const canvasInstance = canvas.createCanvas(size, size);
      const ctx = canvasInstance.getContext('2d');

      // 解析像素数据
      const colorArray = pixelData.split(',');
      const originalSize = Math.sqrt(colorArray.length);

      // 填充背景（白色）
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      // 绘制像素
      const pixelSize = size / originalSize;

      for (let y = 0; y < originalSize; y++) {
        for (let x = 0; x < originalSize; x++) {
          const index = y * originalSize + x;
          const rawColor = colorArray[index] || 'FFFFFF';
          const color = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;

          ctx.fillStyle = color;
          ctx.fillRect(
            Math.floor(x * pixelSize),
            Math.floor(y * pixelSize),
            Math.ceil(pixelSize) + 1,
            Math.ceil(pixelSize) + 1
          );
        }
      }

      // 转换为PNG
      return canvasInstance.toBuffer('image/png');
    } catch (error) {
      logger.error('像素数据转PNG失败:', error);
      throw error;
    }
  }

  /**
   * 生成头像文件的哈希值
   * @param {string} pixelData - 像素数据
   * @param {number} size - 图片尺寸
   * @returns {string} 文件哈希
   */
  generateAvatarHash(pixelData, size = 64) {
    const hashInput = `${pixelData}_${size}`;
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }

  /**
   * 将相对路径转换为完整URL
   * @param {string} relativePath - 相对路径 (e.g., /uploads/materials/avatars/...)
   * @returns {string|null} 完整URL 或 null
   */
  buildAvatarUrl(relativePath) {
    if (!relativePath) {
      return null;
    }

    // 如果已经是完整URL，直接返回（兼容旧数据）
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }

    // 构建完整URL
    const { getBaseURL } = require('../config/urlConfig');
    const baseURL = getBaseURL();

    // 确保路径正确拼接
    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    return `${baseURL}${path}`;
  }

  /**
   * 批量构建头像URL
   * @param {Array} users - 用户列表
   * @returns {Array} 转换后的用户列表
   */
  buildAvatarUrls(users) {
    if (!Array.isArray(users)) {
      return users;
    }

    return users.map(user => {
      if (user && user.avatar_url) {
        return {
          ...user,
          avatar_url: this.buildAvatarUrl(user.avatar_url)
        };
      }
      return user;
    });
  }

  /**
   * 获取头像URL（适配现有存储系统）
   * @param {string} pixelData - 像素数据
   * @param {string} size - 头像尺寸 (small/medium/large)
   * @param {string} userId - 用户ID
   * @returns {Promise<string>} 头像URL
   */
  async getAvatarUrl(pixelData, size = 'medium', userId = 'default') {
    try {
      if (!pixelData) {
        return null;
      }

      const avatarSize = this.avatarSizes[size] || 64;
      const hash = this.generateAvatarHash(pixelData, avatarSize);

      // 检查Redis缓存
      const cacheKey = `avatar:${userId}:${hash}:${size}`;
      try {
        const cachedUrl = await redisUtils.get(cacheKey);
        if (cachedUrl) {
          return cachedUrl;
        }
      } catch (redisError) {
        logger.warn(`Redis读取失败，跳过缓存: ${redisError.message}`);
      }

      // 构建文件名：avatar_{hash}_{size}.png
      const fileName = `avatar_${hash}_${size}.png`;

      // 上传到存储系统
      const pngBuffer = await this.pixelDataToPNG(pixelData, avatarSize);
      const uploadResult = await this.storage.upload(pngBuffer, {
        fileName,
        variantType: 'avatars', // 使用avatars作为变体类型
        materialId: userId,     // 使用userId作为materialId
        format: 'png'
      });

      const avatarUrl = uploadResult.cdnUrl;

      // 缓存结果到Redis
      try {
        await redisUtils.setex(cacheKey, this.cacheTTL, avatarUrl);
      } catch (redisError) {
        logger.warn(`Redis写入失败: ${redisError.message}`);
      }

      logger.info(`✅ 头像已生成:`, {
        userId,
        size,
        hash: hash.substring(0, 8),
        url: avatarUrl
      });

      return avatarUrl;
    } catch (error) {
      logger.error('获取头像URL失败:', error);
      return null;
    }
  }

  /**
   * 批量处理用户头像
   * @param {Array} users - 用户列表
   * @param {string} avatarField - 头像字段名
   * @param {string} size - 头像尺寸
   * @returns {Promise<Array>} 包含头像URL的用户列表
   */
  async batchProcessAvatars(users, avatarField = 'avatar', size = 'medium') {
    const results = [];

    for (const user of users) {
      try {
        const pixelData = user[avatarField];
        const avatarUrl = pixelData ? await this.getAvatarUrl(pixelData, size, user.id) : null;

        results.push({
          ...user,
          avatar_url: avatarUrl,
          avatar_processed: !!avatarUrl
        });
      } catch (error) {
        logger.error(`用户${user.id}头像处理失败:`, error);
        results.push({
          ...user,
          avatar_url: null,
          avatar_processed: false,
          avatar_error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 更新用户头像URL到数据库
   * @param {string} userId - 用户ID
   * @param {string} avatarUrl - 头像URL
   */
  async updateUserAvatarUrl(userId, avatarUrl) {
    const { db } = require('../config/database');

    try {
      await db.raw('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?', [avatarUrl, new Date().toISOString(), userId]);

      logger.info(`✅ 用户头像URL已更新:`, { userId, avatarUrl });
    } catch (error) {
      logger.error('更新用户头像URL失败:', error);
      throw error;
    }
  }

  /**
   * 为用户生成所有尺寸的头像并更新数据库
   * @param {string} userId - 用户ID
   * @param {string} pixelData - 像素数据
   */
  async generateUserAvatars(userId, pixelData) {
    const sizes = ['small', 'medium', 'large'];
    const avatarUrls = {};

    for (const size of sizes) {
      try {
        const avatarUrl = await this.getAvatarUrl(pixelData, size, userId);
        avatarUrls[size] = avatarUrl;
      } catch (error) {
        logger.error(`生成${size}尺寸头像失败:`, error);
      }
    }

    // 更新数据库，优先使用medium尺寸的URL
    if (avatarUrls.medium) {
      await this.updateUserAvatarUrl(userId, avatarUrls.medium);
    }

    return avatarUrls;
  }

  /**
   * 清理过期的头像缓存
   */
  async clearAvatarCache() {
    // 对于Redis，不需要手动清除所有Key，它们会自动过期
    logger.info('✅ Redis头像缓存将会自动过期');
  }

  /**
   * 预热头像缓存
   * @param {string} userId - 用户ID
   * @param {string} pixelData - 像素数据
   */
  async warmupAvatarCache(userId, pixelData) {
    const sizes = ['small', 'medium', 'large'];

    for (const size of sizes) {
      try {
        await this.getAvatarUrl(pixelData, size, userId);
      } catch (error) {
        logger.warn(`预热${size}尺寸头像失败:`, error);
      }
    }
  }

  /**
   * 生成默认头像
   * @param {string} username - 用户名
   * @param {string} size - 头像尺寸
   * @returns {Promise<Buffer>} 默认头像PNG
   */
  async generateDefaultAvatar(username, size = 'medium') {
    const avatarSize = this.avatarSizes[size] || 64;

    let canvas;
    try {
      canvas = require('canvas');
    } catch (error) {
      logger.error('Canvas模块未安装');
      throw new Error('需要安装canvas模块: npm install canvas');
    }

    const canvasInstance = canvas.createCanvas(avatarSize, avatarSize);
    const ctx = canvasInstance.getContext('2d');

    // 背景
    const gradient = ctx.createLinearGradient(0, 0, avatarSize, avatarSize);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, avatarSize, avatarSize);

    // 文字
    ctx.fillStyle = 'white';
    ctx.font = `bold ${avatarSize * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const firstChar = username ? username.charAt(0).toUpperCase() : 'U';
    ctx.fillText(firstChar, avatarSize / 2, avatarSize / 2);

    return canvasInstance.toBuffer('image/png');
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    const provider = process.env.NODE_ENV === 'development' ? 'LocalFileStorage' : 'CDNStorage';

    // 尝试获取Redis中头像相关的key数量
    let cacheCount = 0;
    try {
      const keys = await redisUtils.keys('avatar:*');
      cacheCount = keys.length;
    } catch (e) {
      // ignore error
    }

    return {
      provider,
      baseUrl: this.storage.baseUrl || 'N/A',
      cacheSize: cacheCount,
      cacheType: 'Redis'
    };
  }
}

module.exports = AvatarService;