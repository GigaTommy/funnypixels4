/**
 * 用户显示标准化工具
 *
 * 确保所有API返回的用户信息都经过标准化处理，
 * 优雅降级处理已删除用户，避免前端出现null/undefined错误
 */

const logger = require('./logger');

/**
 * 标准化用户信息用于显示
 *
 * @param {Object} user - 原始用户对象
 * @param {Object} options - 选项
 * @param {boolean} options.includeEmail - 是否包含邮箱（默认false）
 * @param {boolean} options.includeStats - 是否包含统计数据（默认true）
 * @returns {Object} 标准化的用户对象
 */
function normalizeUserForDisplay(user, options = {}) {
  const {
    includeEmail = false,
    includeStats = true
  } = options;

  // 场景1：用户不存在（null/undefined）
  if (!user || !user.id) {
    return {
      id: null,
      username: '未知用户',
      display_name: '未知用户',
      avatar_url: null,
      is_deleted: true,
      is_system: false,
      clickable: false,
      account_status: 'unknown'
    };
  }

  // 场景2：用户已删除
  const deletedStatuses = ['pending_deletion', 'anonymized', 'purged'];
  if (deletedStatuses.includes(user.account_status)) {
    const result = {
      id: user.id,
      username: '已删除用户',
      display_name: '已删除用户',
      avatar_url: null,
      is_deleted: true,
      is_system: false,
      clickable: false,
      account_status: 'deleted'  // 统一返回 'deleted'
    };

    // 如果需要统计数据，保留匿名化的统计（不含个人信息）
    if (includeStats && user.account_status === 'anonymized') {
      result.level = user.level || 1;
      result.total_pixels = user.total_pixels || 0;
    }

    return result;
  }

  // 场景3：正常用户
  const result = {
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    avatar_url: user.avatar_url,
    avatar: user.avatar,  // 像素头像数据
    is_deleted: false,
    is_system: false,
    clickable: true,
    account_status: user.account_status || 'active'
  };

  // 可选字段
  if (includeEmail && user.email) {
    result.email = user.email;
  }

  if (includeStats) {
    result.level = user.level || 1;
    result.experience = user.experience || 0;
    result.total_pixels = user.total_pixels || 0;
    result.current_pixels = user.current_pixels || 0;
    result.coins = user.coins || 0;
    result.gems = user.gems || 0;
  }

  // 联盟信息（如果有）
  if (user.alliance_id) {
    result.alliance = {
      id: user.alliance_id,
      name: user.alliance_name,
      flag_pattern_id: user.alliance_flag_pattern_id
    };
  }

  return result;
}

/**
 * 批量标准化用户列表
 *
 * @param {Array} users - 用户对象数组
 * @param {Object} options - 选项（同 normalizeUserForDisplay）
 * @returns {Array} 标准化的用户对象数组
 */
function normalizeUsersForDisplay(users, options = {}) {
  if (!Array.isArray(users)) {
    logger.warn('normalizeUsersForDisplay: input is not an array', { input: users });
    return [];
  }

  return users.map(user => normalizeUserForDisplay(user, options));
}

/**
 * 检查用户是否已删除
 *
 * @param {Object} user - 用户对象
 * @returns {boolean}
 */
function isUserDeleted(user) {
  if (!user) return true;

  const deletedStatuses = ['pending_deletion', 'anonymized', 'purged'];
  return deletedStatuses.includes(user.account_status);
}

/**
 * 获取用户显示名称（安全访问）
 *
 * @param {Object} user - 用户对象
 * @returns {string}
 */
function getUserDisplayName(user) {
  if (!user || isUserDeleted(user)) {
    return '已删除用户';
  }
  return user.display_name || user.username || '未知用户';
}

/**
 * 标准化像素作者信息
 * 用于像素信息卡片、地图标记等场景
 *
 * @param {Object} pixel - 像素对象（包含用户信息）
 * @returns {Object} 包含标准化作者信息的像素对象
 */
function normalizePixelWithAuthor(pixel) {
  if (!pixel) return null;

  return {
    ...pixel,
    author: normalizeUserForDisplay({
      id: pixel.user_id,
      username: pixel.username,
      display_name: pixel.display_name,
      avatar_url: pixel.avatar_url,
      account_status: pixel.account_status,
      level: pixel.user_level,
      total_pixels: pixel.user_total_pixels
    })
  };
}

/**
 * 标准化评论作者信息
 *
 * @param {Object} comment - 评论对象
 * @returns {Object} 包含标准化作者信息的评论对象
 */
function normalizeCommentWithAuthor(comment) {
  if (!comment) return null;

  // 如果评论已匿名化，使用缓存的 author_name
  if (comment.is_anonymous) {
    return {
      ...comment,
      author: {
        id: null,
        username: comment.author_name || '已删除用户',
        display_name: comment.author_name || '已删除用户',
        avatar_url: null,
        is_deleted: true,
        clickable: false
      }
    };
  }

  return {
    ...comment,
    author: normalizeUserForDisplay({
      id: comment.user_id,
      username: comment.username,
      display_name: comment.display_name,
      avatar_url: comment.avatar_url,
      account_status: comment.account_status
    })
  };
}

module.exports = {
  normalizeUserForDisplay,
  normalizeUsersForDisplay,
  isUserDeleted,
  getUserDisplayName,
  normalizePixelWithAuthor,
  normalizeCommentWithAuthor
};
