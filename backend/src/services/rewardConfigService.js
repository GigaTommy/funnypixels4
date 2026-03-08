/**
 * Reward Config Service
 *
 * Singleton cache for reward/rate-limit/reconciliation configs stored in system_configs.
 * - Loads all reward_config.*, rate_limit.*, reconciliation.* keys at startup
 * - In-memory Map cache, auto-refreshes every 5 minutes
 * - get(key, defaultValue) has zero DB overhead after init
 * - Manual refresh via refresh() for admin panel save-and-apply flow
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');

const CACHE_PREFIX_LIST = ['reward_config.', 'rate_limit.', 'reconciliation.'];
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class RewardConfigService {
  constructor() {
    this._cache = new Map();
    this._initialized = false;
    this._timer = null;
  }

  /**
   * Initialize: load configs from DB and start auto-refresh timer.
   * Safe to call multiple times (idempotent).
   */
  async init() {
    try {
      await this._loadFromDB();
      this._initialized = true;

      // Start periodic refresh
      if (!this._timer) {
        this._timer = setInterval(() => {
          this._loadFromDB().catch(err => {
            logger.error('RewardConfigService auto-refresh failed:', err.message);
          });
        }, REFRESH_INTERVAL_MS);
        // Allow process to exit even if timer is running
        if (this._timer.unref) this._timer.unref();
      }

      logger.info(`RewardConfigService initialized with ${this._cache.size} config(s)`);
    } catch (err) {
      logger.error('RewardConfigService init failed (will use defaults):', err.message);
      // Service remains usable — get() returns defaultValue
    }
  }

  /**
   * Get a config value. Returns defaultValue if key is missing or service is uninitialized.
   * @param {string} key - e.g. 'reward_config.share_points'
   * @param {*} defaultValue - fallback value
   * @returns {*} parsed numeric value or raw string
   */
  get(key, defaultValue) {
    if (!this._cache.has(key)) {
      return defaultValue;
    }
    return this._cache.get(key);
  }

  /**
   * Force reload from DB. Called by admin after saving config changes.
   */
  async refresh() {
    await this._loadFromDB();
    logger.info(`RewardConfigService refreshed (${this._cache.size} config(s))`);
  }

  /**
   * Stop the auto-refresh timer (for graceful shutdown).
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // ---- internal ----

  async _loadFromDB() {
    const orClauses = CACHE_PREFIX_LIST.map(prefix =>
      db.raw('config_key LIKE ?', [`${prefix}%`])
    );

    const rows = await db('system_configs')
      .where(function () {
        orClauses.forEach((clause, i) => {
          if (i === 0) this.whereRaw(clause);
          else this.orWhereRaw(clause);
        });
      })
      .select('config_key', 'config_value');

    const newCache = new Map();
    for (const row of rows) {
      newCache.set(row.config_key, this._parseValue(row.config_value));
    }
    this._cache = newCache;
  }

  /**
   * Try to parse as number, otherwise return raw string.
   */
  _parseValue(raw) {
    if (raw === null || raw === undefined) return raw;
    const num = Number(raw);
    if (!isNaN(num) && raw.toString().trim() !== '') return num;
    return raw;
  }
}

// Export singleton
module.exports = new RewardConfigService();
