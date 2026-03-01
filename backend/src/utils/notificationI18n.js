/**
 * 推送通知国际化工具
 * 使用 i18next 从文件系统读取本地化字符串
 * 与项目现有的 i18n 系统保持一致
 */

const { i18next } = require('../config/i18n');
const { db } = require('../config/database');
const logger = require('./logger');

// 默认语言（与项目其他部分保持一致）
const DEFAULT_LANGUAGE = 'zh-Hans';

/**
 * 获取用户的语言偏好
 * @param {string} userId - 用户ID
 * @returns {Promise<string>} 语言代码 (zh-Hans, en, ja, ko, es, pt-BR)
 */
async function getUserLanguage(userId) {
  try {
    // 从用户资料中获取语言偏好
    const user = await db('users')
      .where('id', userId)
      .select('preferred_language')
      .first();

    // 如果用户设置了语言偏好，使用用户设置
    if (user && user.preferred_language) {
      return user.preferred_language;
    }

    // 否则返回默认语言
    return DEFAULT_LANGUAGE;
  } catch (error) {
    logger.error('获取用户语言偏好失败:', { userId, error: error.message });
    return DEFAULT_LANGUAGE;
  }
}

/**
 * 使用 i18next 获取本地化字符串
 * @param {string} langCode - 语言代码
 * @param {string} key - 本地化键（notifications命名空间）
 * @param {Object} params - 插值参数
 * @returns {string} 本地化后的字符串
 */
function getLocalizedString(langCode, key, params = {}) {
  try {
    // 使用 i18next 翻译，指定 notifications 命名空间
    return i18next.t(`notifications:${key}`, {
      lng: langCode,
      ...params
    });
  } catch (error) {
    logger.error('获取本地化字符串失败:', { langCode, key, error: error.message });

    // 降级到默认语言
    if (langCode !== DEFAULT_LANGUAGE) {
      try {
        return i18next.t(`notifications:${key}`, {
          lng: DEFAULT_LANGUAGE,
          ...params
        });
      } catch (fallbackError) {
        logger.error('降级到默认语言也失败:', { key, error: fallbackError.message });
      }
    }

    // 最后的降级：返回键本身
    return key;
  }
}

/**
 * 生成任务完成通知内容
 * @param {string} userId - 用户ID
 * @param {Object} taskData - 任务数据 {title, reward}
 * @returns {Promise<{title: string, body: string}>}
 */
async function getTaskCompletedNotification(userId, taskData) {
  const langCode = await getUserLanguage(userId);

  const title = getLocalizedString(langCode, 'task_completed.title');
  const body = getLocalizedString(langCode, 'task_completed.body', {
    title: taskData.title,
    reward: taskData.reward
  });

  return { title, body };
}

/**
 * 生成全勤奖励通知内容
 * @param {string} userId - 用户ID
 * @param {number} completedCount - 完成的任务数
 * @returns {Promise<{title: string, body: string}>}
 */
async function getAllTasksCompletedNotification(userId, completedCount) {
  const langCode = await getUserLanguage(userId);

  const title = getLocalizedString(langCode, 'all_tasks_completed.title');
  const body = getLocalizedString(langCode, 'all_tasks_completed.body');

  return { title, body };
}

/**
 * 生成连续完成奖励通知内容
 * @param {string} userId - 用户ID
 * @param {number} streakDays - 连续天数
 * @returns {Promise<{title: string, body: string}>}
 */
async function getStreakRewardNotification(userId, streakDays) {
  const langCode = await getUserLanguage(userId);

  const title = getLocalizedString(langCode, 'streak_reward.title', {
    days: streakDays
  });
  const body = getLocalizedString(langCode, 'streak_reward.body', {
    days: streakDays
  });

  return { title, body };
}

/**
 * 生成任务提醒通知内容
 * @param {string} userId - 用户ID
 * @returns {Promise<{title: string, body: string}>}
 */
async function getTaskReminderNotification(userId) {
  const langCode = await getUserLanguage(userId);

  const title = getLocalizedString(langCode, 'task_reminder.title');
  const body = getLocalizedString(langCode, 'task_reminder.body');

  return { title, body };
}

module.exports = {
  getUserLanguage,
  getLocalizedString,
  getTaskCompletedNotification,
  getAllTasksCompletedNotification,
  getStreakRewardNotification,
  getTaskReminderNotification
};
