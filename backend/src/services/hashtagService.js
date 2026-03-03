const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * 话题标签服务
 * 支持多语言话题标签映射和搜索
 */
class HashtagService {
  /**
   * 规范化话题标签：将本地化标签转换为规范标签
   * @param {string} tag - 原始标签
   * @param {string} userLanguage - 用户语言（如 'zh-Hans', 'en'）
   * @returns {Promise<string>} - 规范化后的标签（英文小写）
   */
  static async normalizeHashtag(tag, userLanguage = 'en') {
    try {
      // 去除#符号，转小写
      const cleanTag = tag.replace('#', '').trim().toLowerCase();

      if (!cleanTag) {
        return '';
      }

      // 查找映射（优先匹配本地化标签）
      const mapping = await db('hashtag_mappings')
        .where('localized_tag', cleanTag)
        .orWhere('canonical_tag', cleanTag)
        .first();

      if (mapping) {
        // 更新使用次数和最后使用时间
        await db('hashtag_mappings')
          .where('id', mapping.id)
          .update({
            usage_count: db.raw('usage_count + 1'),
            last_used_at: db.fn.now()
          });

        return mapping.canonical_tag;
      }

      // 如果未找到映射，返回清理后的标签作为规范标签
      return cleanTag;
    } catch (error) {
      logger.error('normalizeHashtag error:', error);
      return tag.replace('#', '').trim().toLowerCase();
    }
  }

  /**
   * 本地化话题标签：将规范标签转换为用户语言
   * @param {string} canonicalTag - 规范标签
   * @param {string} userLanguage - 用户语言
   * @returns {Promise<string>} - 本地化后的标签
   */
  static async localizeHashtag(canonicalTag, userLanguage = 'en') {
    try {
      const mapping = await db('hashtag_mappings')
        .where({ canonical_tag: canonicalTag, language: userLanguage })
        .first();

      return mapping ? mapping.localized_tag : canonicalTag;
    } catch (error) {
      logger.error('localizeHashtag error:', error);
      return canonicalTag;
    }
  }

  /**
   * 批量规范化话题标签
   * @param {string[]} tags - 标签数组
   * @param {string} userLanguage - 用户语言
   * @returns {Promise<string[]>} - 规范化后的标签数组
   */
  static async normalizeBatch(tags, userLanguage = 'en') {
    if (!tags || tags.length === 0) {
      return [];
    }

    const normalized = await Promise.all(
      tags.map(tag => this.normalizeHashtag(tag, userLanguage))
    );

    // 去重
    return [...new Set(normalized.filter(tag => tag))];
  }

  /**
   * 搜索话题标签（多语言统一搜索）
   * @param {string} query - 搜索关键词
   * @param {string} userLanguage - 用户语言
   * @param {number} limit - 返回数量限制
   * @returns {Promise<Array>} - 搜索结果
   */
  static async searchHashtags(query, userLanguage = 'en', limit = 20) {
    try {
      const cleanQuery = query.replace('#', '').trim().toLowerCase();

      if (!cleanQuery) {
        return [];
      }

      // 首先规范化查询词
      const normalizedQuery = await this.normalizeHashtag(cleanQuery, userLanguage);

      // 搜索使用规范标签的所有动态
      const results = await db('feed_items')
        .select('hashtags')
        .whereRaw('? = ANY(hashtags)', [normalizedQuery])
        .limit(100);

      // 统计使用次数
      const tagCounts = {};
      results.forEach(item => {
        if (item.hashtags) {
          item.hashtags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });

      // 转换为数组并排序
      const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([tag, count]) => ({ tag, count }));

      // 本地化标签
      const localized = await Promise.all(
        sortedTags.map(async item => ({
          canonical: item.tag,
          localized: await this.localizeHashtag(item.tag, userLanguage),
          count: item.count
        }))
      );

      return localized;
    } catch (error) {
      logger.error('searchHashtags error:', error);
      return [];
    }
  }

  /**
   * 获取话题标签建议（自动补全）
   * @param {string} query - 输入的部分标签
   * @param {string} userLanguage - 用户语言
   * @param {number} limit - 返回数量
   * @returns {Promise<Array>} - 建议列表
   */
  static async getSuggestions(query, userLanguage = 'en', limit = 10) {
    try {
      const cleanQuery = query.replace('#', '').trim().toLowerCase();

      if (!cleanQuery) {
        // 返回热门话题
        return this.getTrendingHashtags(userLanguage, limit);
      }

      // 从映射表中搜索匹配的标签
      const mappings = await db('hashtag_mappings')
        .where('language', userLanguage)
        .where('localized_tag', 'like', `${cleanQuery}%`)
        .orderBy('usage_count', 'desc')
        .limit(limit);

      return mappings.map(m => ({
        canonical: m.canonical_tag,
        localized: m.localized_tag,
        count: m.usage_count
      }));
    } catch (error) {
      logger.error('getSuggestions error:', error);
      return [];
    }
  }

  /**
   * 获取热门话题
   * @param {string} userLanguage - 用户语言
   * @param {number} limit - 返回数量
   * @returns {Promise<Array>} - 热门话题列表
   */
  static async getTrendingHashtags(userLanguage = 'en', limit = 20) {
    try {
      // 获取最近使用的话题
      const mappings = await db('hashtag_mappings')
        .where('language', userLanguage)
        .orderBy('usage_count', 'desc')
        .orderBy('last_used_at', 'desc')
        .limit(limit);

      return mappings.map(m => ({
        canonical: m.canonical_tag,
        localized: m.localized_tag,
        count: m.usage_count
      }));
    } catch (error) {
      logger.error('getTrendingHashtags error:', error);
      return [];
    }
  }

  /**
   * 创建或更新话题标签映射
   * @param {string} canonicalTag - 规范标签
   * @param {string} language - 语言代码
   * @param {string} localizedTag - 本地化标签
   */
  static async createOrUpdateMapping(canonicalTag, language, localizedTag) {
    try {
      const existing = await db('hashtag_mappings')
        .where({ canonical_tag: canonicalTag, language })
        .first();

      if (existing) {
        await db('hashtag_mappings')
          .where('id', existing.id)
          .update({
            localized_tag: localizedTag,
            usage_count: db.raw('usage_count + 1'),
            last_used_at: db.fn.now()
          });
      } else {
        await db('hashtag_mappings').insert({
          canonical_tag: canonicalTag,
          language,
          localized_tag: localizedTag,
          usage_count: 1
        });
      }
    } catch (error) {
      logger.error('createOrUpdateMapping error:', error);
    }
  }

  /**
   * 初始化常用话题映射（仅在首次设置时调用）
   */
  static async initializeCommonHashtags() {
    const commonMappings = [
      // 像素艺术
      { canonical: 'pixelart', lang: 'en', localized: 'PixelArt' },
      { canonical: 'pixelart', lang: 'zh-Hans', localized: '像素艺术' },
      { canonical: 'pixelart', lang: 'ja', localized: 'ピクセルアート' },

      // 打卡
      { canonical: 'checkin', lang: 'en', localized: 'CheckIn' },
      { canonical: 'checkin', lang: 'zh-Hans', localized: '打卡' },
      { canonical: 'checkin', lang: 'ja', localized: 'チェックイン' },

      // 挑战
      { canonical: 'challenge', lang: 'en', localized: 'Challenge' },
      { canonical: 'challenge', lang: 'zh-Hans', localized: '挑战' },
      { canonical: 'challenge', lang: 'ja', localized: 'チャレンジ' },

      // 创作
      { canonical: 'creation', lang: 'en', localized: 'Creation' },
      { canonical: 'creation', lang: 'zh-Hans', localized: '创作' },
      { canonical: 'creation', lang: 'ja', localized: '創作' },

      // 日常
      { canonical: 'daily', lang: 'en', localized: 'Daily' },
      { canonical: 'daily', lang: 'zh-Hans', localized: '日常' },
      { canonical: 'daily', lang: 'ja', localized: '日常' },
    ];

    for (const mapping of commonMappings) {
      await this.createOrUpdateMapping(
        mapping.canonical,
        mapping.lang,
        mapping.localized
      );
    }

    logger.info('Common hashtag mappings initialized');
  }
}

module.exports = HashtagService;
