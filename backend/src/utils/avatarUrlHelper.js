/**
 * 头像URL辅助工具
 * 用于将相对路径转换为完整URL
 */

const { getBaseURL } = require('../config/urlConfig');

/**
 * 将相对路径转换为完整URL
 * @param {string} relativePath - 相对路径
 * @returns {string|null} 完整URL
 */
function buildAvatarUrl(relativePath) {
  if (!relativePath) {
    return null;
  }

  // 如果已经是完整URL，直接返回（兼容旧数据）
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  // 构建完整URL
  const baseURL = getBaseURL();
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${baseURL}${path}`;
}

/**
 * 处理单个用户对象的avatar_url
 * @param {Object} user - 用户对象
 * @returns {Object} 处理后的用户对象
 */
function processUserAvatar(user) {
  if (!user) {
    return user;
  }

  if (user.avatar_url) {
    return {
      ...user,
      avatar_url: buildAvatarUrl(user.avatar_url)
    };
  }

  return user;
}

/**
 * 批量处理用户列表的avatar_url
 * @param {Array} users - 用户列表
 * @returns {Array} 处理后的用户列表
 */
function processUsersAvatars(users) {
  if (!Array.isArray(users)) {
    return users;
  }

  return users.map(processUserAvatar);
}

/**
 * 递归处理对象中的URL字段
 * 支持嵌套对象和数组
 *
 * 处理的URL字段包括：
 * - avatar_url: 用户头像
 * - image_url: 图案/旗帜图片
 * - banner_url: 横幅图片
 * - file_url: 文件资源
 *
 * 同时会清理冗余字段：
 * - avatar: 像素数据（避免日志冗余）
 *
 * @param {any} data - 要处理的数据
 * @returns {any} 处理后的数据
 */
function processAvatarUrls(data) {
  if (!data) {
    return data;
  }

  // 处理数组
  if (Array.isArray(data)) {
    return data.map(item => processAvatarUrls(item));
  }

  // 处理对象（排除Date对象）
  if (typeof data === 'object') {
    // ✅ 特殊处理：Date对象直接返回，不递归处理
    if (data instanceof Date) {
      return data;
    }

    const processed = {};

    // 需要处理的URL字段列表
    const urlFields = ['avatar_url', 'image_url', 'banner_url', 'file_url'];

    // 需要排除的字段（避免日志冗余）
    const excludeFields = ['avatar']; // 排除像素数据字段

    for (const [key, value] of Object.entries(data)) {
      // 跳过需要排除的字段
      if (excludeFields.includes(key)) {
        continue;
      }

      // 处理URL字段
      if (urlFields.includes(key) && typeof value === 'string') {
        processed[key] = buildAvatarUrl(value);
      }
      // 递归处理嵌套对象（Date对象会被上面的检查捕获）
      else if (value && typeof value === 'object') {
        processed[key] = processAvatarUrls(value);
      }
      // 其他字段直接复制
      else {
        processed[key] = value;
      }
    }

    return processed;
  }

  return data;
}

module.exports = {
  buildAvatarUrl,
  processUserAvatar,
  processUsersAvatars,
  processAvatarUrls
};
