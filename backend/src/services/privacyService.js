/**
 * 隐私服务 - 统一处理用户隐私屏蔽逻辑
 *
 * 功能：
 * - 根据隐私设置屏蔽用户昵称
 * - 根据隐私设置屏蔽联盟信息
 * - 根据隐私设置屏蔽头像
 * - 统一的隐私规则管理
 */

/**
 * Strip hardcoded localhost or IP URLs from avatar paths
 * Allows clients to resolve URLs relative to their configured API base
 */
function sanitizeAvatarUrl(url) {
  if (!url) return url;
  // Remove http://localhost:PORT or http://IP:PORT prefix, keep the path
  return url.replace(/^https?:\/\/(localhost|[\d.]+)(:\d+)?/, '');
}

class PrivacyService {
  /**
   * 应用用户隐私设置
   * @param {Object} user - 用户数据
   * @param {string} currentUserId - 当前登录用户ID
   * @param {Object} privacySettings - 隐私设置
   * @returns {Object} 应用隐私规则后的用户数据
   */
  static applyUserPrivacy(user, currentUserId = null, privacySettings = null) {
    if (!user) return null;

    // 判断是否是当前用户自己
    const isCurrentUser = currentUserId && user.user_id === currentUserId;

    // 如果是当前用户，不应用隐私屏蔽
    if (isCurrentUser) {
      return {
        ...user,
        display_name: user.display_name || user.username,
        avatar_url: sanitizeAvatarUrl(user.avatar_url),
        avatar: user.avatar,
        alliance_name: user.alliance_name,
        alliance_flag: user.alliance_flag || user.flag_pattern,
        flag_pattern_id: user.flag_pattern_id,
        is_current_user: true
      };
    }

    // 应用隐私屏蔽规则
    const result = { ...user, is_current_user: false };

    // 🔒 隐私规则 1: 隐藏昵称
    if (privacySettings?.hide_nickname) {
      result.display_name = '匿名像素师';
      result.username = '匿名';
      result.avatar_url = null;
      result.avatar = null;
    } else {
      result.display_name = user.display_name || user.username;
      result.avatar_url = sanitizeAvatarUrl(user.avatar_url);
      result.avatar = user.avatar;
    }

    // 🔒 隐私规则 2: 隐藏联盟名称
    if (privacySettings?.hide_alliance) {
      result.alliance_name = null;
    } else {
      result.alliance_name = user.alliance_name;
    }

    // 🔒 隐私规则 3: 隐藏联盟旗帜
    if (privacySettings?.hide_alliance_flag) {
      result.alliance_flag = null;
      result.flag_pattern = null;
      result.flag_pattern_id = null;
    } else {
      result.alliance_flag = user.alliance_flag || user.flag_pattern;
      result.flag_pattern = user.flag_pattern || user.alliance_flag;
      result.flag_pattern_id = user.flag_pattern_id;
    }

    return result;
  }

  /**
   * 批量应用隐私设置
   * @param {Array} users - 用户数组
   * @param {string} currentUserId - 当前登录用户ID
   * @param {Map} privacySettingsMap - 隐私设置映射 (userId -> settings)
   * @returns {Array} 应用隐私规则后的用户数组
   */
  static applyBatchUserPrivacy(users, currentUserId = null, privacySettingsMap = new Map()) {
    if (!users || !Array.isArray(users)) return [];

    return users.map(user => {
      const userId = user.user_id || user.id;
      const privacySettings = privacySettingsMap.get(userId);
      return this.applyUserPrivacy(user, currentUserId, privacySettings);
    });
  }

  /**
   * 从数据库结果中提取隐私设置
   * @param {Array} dbResults - 数据库查询结果（包含 privacy_settings JOIN）
   * @returns {Map} 用户ID -> 隐私设置映射
   */
  static extractPrivacySettingsMap(dbResults) {
    const map = new Map();

    for (const row of dbResults) {
      const userId = row.user_id || row.id;
      if (userId && (row.hide_nickname !== undefined || row.hide_alliance !== undefined)) {
        map.set(userId, {
          hide_nickname: row.hide_nickname || false,
          hide_alliance: row.hide_alliance || false,
          hide_alliance_flag: row.hide_alliance_flag || false
        });
      }
    }

    return map;
  }

  /**
   * 获取默认隐私设置
   * @returns {Object} 默认隐私设置
   */
  static getDefaultPrivacySettings() {
    return {
      hide_nickname: false,
      hide_alliance: false,
      hide_alliance_flag: false
    };
  }
}

module.exports = PrivacyService;
