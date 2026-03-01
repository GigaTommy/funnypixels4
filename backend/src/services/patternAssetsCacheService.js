/**
 * pattern_assets 内存缓存服务
 *
 * pattern_assets 表很小（~315 行），全量缓存到 Node.js 内存中，
 * 消除 BBOX 等高频端点的 LEFT JOIN，将 DB 查询从 JOIN 变为纯表扫描。
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');

class PatternAssetsCacheService {
  constructor() {
    // key -> { render_type, material_id, unicode_char, color }
    this.cache = new Map();
    this.lastRefresh = 0;
    this.refreshInterval = parseInt(process.env.PATTERN_CACHE_REFRESH_INTERVAL) || 60000; // 60s
    this.timer = null;
    this.ready = false;
  }

  async init() {
    await this.refresh();
    this.timer = setInterval(() => {
      this.refresh().catch(err => {
        logger.warn('[PatternAssetsCache] 定期刷新失败:', err.message);
      });
    }, this.refreshInterval);
    if (this.timer.unref) this.timer.unref();
  }

  async refresh() {
    try {
      const rows = await db('pattern_assets')
        .whereNull('deleted_at')
        .select('key', 'render_type', 'material_id', 'unicode_char', 'color');

      const newCache = new Map();
      for (const row of rows) {
        if (row.key) {
          newCache.set(row.key, {
            render_type: row.render_type || 'color',
            material_id: row.material_id || null,
            unicode_char: row.unicode_char || null,
            color: row.color || null
          });
        }
      }

      this.cache = newCache;
      this.lastRefresh = Date.now();
      this.ready = true;
      logger.debug(`[PatternAssetsCache] 已加载 ${newCache.size} 个 pattern`);
    } catch (err) {
      logger.error('[PatternAssetsCache] 刷新失败:', err.message);
      if (!this.ready) throw err;
    }
  }

  /**
   * 根据 pattern_id (key) 获取 pattern 信息
   * @returns {{ render_type, material_id, unicode_char, color } | null}
   */
  getByKey(key) {
    if (!key) return null;
    return this.cache.get(key) || null;
  }

  get size() {
    return this.cache.size;
  }
}

const instance = new PatternAssetsCacheService();

module.exports = instance;
