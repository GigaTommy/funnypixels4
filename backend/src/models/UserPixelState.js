const { db, redisUtils } = require('../config/database');

// ==================== Redis HASH Configuration ====================
const HASH_PREFIX = 'ups:';        // Redis HASH key prefix
const DIRTY_SET = 'ups:dirty';     // SET of userIds with unsaved changes
const HASH_TTL = 14400;            // 4 hours TTL on HASH keys (reduce DB fallback under load)
const SYNC_INTERVAL_MS = 5000;     // Write-behind sync every 5s
const SYNC_BATCH_SIZE = 50;        // Max dirty states to sync per cycle
const OLD_CACHE_PREFIX = 'user_state:'; // Old JSON cache key (for cleanup)

// Fields that must be numeric when read back from Redis
const NUMERIC_FIELDS = new Set([
  'id', 'pixel_points', 'item_pixel_points', 'natural_pixel_points',
  'max_natural_pixel_points', 'last_accum_time', 'last_activity_time',
  'freeze_until'
]);

// Fields that are boolean
const BOOLEAN_FIELDS = new Set(['is_in_natural_accumulation', 'pattern_mirror']);

// Fields to sync back to DB (mutable state fields)
const SYNC_FIELDS = [
  'pixel_points', 'item_pixel_points', 'natural_pixel_points',
  'max_natural_pixel_points', 'last_accum_time', 'last_activity_time',
  'is_in_natural_accumulation', 'freeze_until',
  'last_latitude', 'last_longitude'
];

let syncTimer = null;
let isSyncing = false;

class UserPixelState {
  static tableName = 'user_pixel_states';

  // ==================== Redis HASH Helpers ====================

  static _hashKey(userId) {
    return `${HASH_PREFIX}${userId}`;
  }

  /**
   * Convert a JS/DB state object to Redis HASH-safe flat string entries
   */
  static _toHashEntries(state) {
    const entries = {};
    for (const [k, v] of Object.entries(state)) {
      if (v === undefined) continue;
      if (v === null) {
        entries[k] = '';
      } else if (typeof v === 'boolean') {
        entries[k] = v ? '1' : '0';
      } else if (v instanceof Date) {
        entries[k] = v.toISOString();
      } else {
        entries[k] = String(v);
      }
    }
    return entries;
  }

  /**
   * Convert Redis HASH strings back to proper JS types
   */
  static _fromHash(hash) {
    if (!hash || Object.keys(hash).length === 0) return null;
    const state = {};
    for (const [k, v] of Object.entries(hash)) {
      if (NUMERIC_FIELDS.has(k)) {
        state[k] = v === '' ? 0 : Number(v);
      } else if (BOOLEAN_FIELDS.has(k)) {
        state[k] = v === '1' || v === 'true';
      } else {
        state[k] = v === '' ? null : v;
      }
    }
    return state;
  }

  /**
   * Check if Redis is available (non-throwing)
   */
  static _redisAvailable() {
    try {
      return !!redisUtils && typeof redisUtils.hgetall === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Read state from Redis HASH, returns null if not found or Redis unavailable
   */
  static async _getFromHash(userId) {
    if (!this._redisAvailable()) return null;
    try {
      const hash = await redisUtils.hgetall(this._hashKey(userId));
      return this._fromHash(hash);
    } catch (error) {
      // Redis unavailable, graceful fallback
      return null;
    }
  }

  /**
   * Populate Redis HASH from a state object + refresh TTL
   */
  static async _writeToHash(userId, state) {
    if (!this._redisAvailable()) return;
    try {
      const entries = this._toHashEntries(state);
      await redisUtils.hset(this._hashKey(userId), entries);
      await redisUtils.expire(this._hashKey(userId), HASH_TTL);
    } catch (error) {
      console.error('⚠️ Redis HASH write failed:', error.message);
    }
  }

  /**
   * Mark userId as dirty (needs DB sync)
   */
  static async _markDirty(userId) {
    if (!this._redisAvailable()) return;
    try {
      await redisUtils.sadd(DIRTY_SET, userId);
    } catch (error) {
      // Non-critical: worst case the state syncs late
    }
  }

  /**
   * Delete old JSON cache key (migration cleanup)
   */
  static async _deleteOldCache(userId) {
    try {
      await redisUtils.del(`${OLD_CACHE_PREFIX}${userId}`);
    } catch {
      // ignore
    }
  }

  // ==================== Core Methods (Redis-First) ====================

  // 获取或创建用户状态
  static async getOrCreate(userId) {
    try {
      let state = await this.findByUserId(userId);

      if (!state) {
        // User state doesn't exist — must create in DB (cold path, acceptable)
        if (userId.startsWith('guest_')) {
          const [newState] = await db(this.tableName)
            .insert({
              user_id: userId,
              pixel_points: 64,
              item_pixel_points: 0,
              natural_pixel_points: 64,
              max_natural_pixel_points: 64,
              last_accum_time: Math.floor(Date.now() / 1000),
              last_activity_time: Math.floor(Date.now() / 1000),
              is_in_natural_accumulation: false,
              freeze_until: 0
            })
            .returning('*');

          state = newState;
          await this._writeToHash(userId, state);
          await this._deleteOldCache(userId);
        } else {
          // Check user exists in DB
          const user = await db('users').where({ id: userId }).first();
          if (!user) {
            throw new Error('用户不存在');
          }

          const [newState] = await db(this.tableName)
            .insert({
              user_id: userId,
              pixel_points: 64,
              item_pixel_points: 0,
              natural_pixel_points: 64,
              max_natural_pixel_points: 64,
              last_accum_time: Math.floor(Date.now() / 1000),
              last_activity_time: Math.floor(Date.now() / 1000),
              is_in_natural_accumulation: false,
              freeze_until: 0
            })
            .returning('*');

          state = newState;
          await this._writeToHash(userId, state);
          await this._deleteOldCache(userId);
        }
      }

      return state;
    } catch (error) {
      console.error('获取或创建用户状态时发生错误:', error);
      throw error;
    }
  }

  // 根据用户ID查找状态 — Redis HASH first, DB fallback
  static async findByUserId(userId) {
    try {
      // 1. Try Redis HASH
      const cached = await this._getFromHash(userId);
      if (cached) return cached;

      // 2. DB fallback
      const state = await db(this.tableName)
        .where({ user_id: userId })
        .first();

      if (state) {
        // Populate Redis HASH for future reads
        await this._writeToHash(userId, state);
        await this._deleteOldCache(userId);
      }

      return state;
    } catch (error) {
      console.error('❌ 查找用户状态失败:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // 更新用户状态 — Redis HASH + dirty mark, NO direct DB write
  static async update(userId, updates) {
    try {
      // 1. Read current full state from Redis
      let currentState = await this._getFromHash(userId);

      if (currentState) {
        // 2. Merge updates into current state (in-memory)
        const updatedAt = new Date().toISOString();
        const mergedState = { ...currentState, ...updates, updated_at: updatedAt };

        // 3. Write merged state back to Redis HASH
        await this._writeToHash(userId, mergedState);

        // 4. Mark dirty for background DB sync
        await this._markDirty(userId);

        return mergedState;
      }

      // Redis miss — fall back to direct DB update (cold path)
      const [updatedState] = await db(this.tableName)
        .where({ user_id: userId })
        .update({
          ...updates,
          updated_at: db.fn.now()
        })
        .returning('*');

      if (updatedState) {
        await this._writeToHash(userId, updatedState);
        await this._deleteOldCache(userId);
      } else {
        console.warn('⚠️ 用户状态更新失败，未找到用户:', userId);
      }

      return updatedState;
    } catch (error) {
      console.error('❌ 更新用户状态失败:', {
        userId,
        updates,
        error: error.message
      });
      throw error;
    }
  }

  // 消耗点数 (socket.io handler path)
  static async consumePoint(userId) {
    try {
      const state = await this.getOrCreate(userId);

      const now = Math.floor(Date.now() / 1000);

      // 检查冻结状态
      if (state.freeze_until > 0) {
        if (now >= state.freeze_until) {
          // 冻结状态已过期
          const timeSinceLastActivity = now - (state.last_activity_time || now);

          if (timeSinceLastActivity >= 10) {
            // 用户空闲，进入自然累计阶段
            const newNaturalPoints = Math.min(1, state.max_natural_pixel_points || 64);
            const totalPoints = (state.item_pixel_points || 0) + newNaturalPoints;

            return await this.update(userId, {
              natural_pixel_points: newNaturalPoints,
              pixel_points: totalPoints,
              last_accum_time: now,
              last_activity_time: now,
              is_in_natural_accumulation: true,
              freeze_until: 0
            });
          } else {
            // 用户最近有活动，不进入自然累计
            return await this.update(userId, {
              freeze_until: 0,
              is_in_natural_accumulation: false
            });
          }
        }
        return null; // 仍在冻结中
      }

      // 检查是否有足够的点数
      if (state.pixel_points > 0) {
        // 优先消耗道具像素点数
        let newItemPoints = state.item_pixel_points || 0;
        let newNaturalPoints = state.natural_pixel_points || 0;

        if (newItemPoints > 0) {
          newItemPoints -= 1;
        } else {
          newNaturalPoints -= 1;
        }

        const newTotalPoints = newItemPoints + newNaturalPoints;
        const freezeUntil = newTotalPoints === 0 ? now + 10 : 0;

        return await this.update(userId, {
          item_pixel_points: newItemPoints,
          natural_pixel_points: newNaturalPoints,
          pixel_points: newTotalPoints,
          last_activity_time: now,
          is_in_natural_accumulation: false,
          freeze_until: freezeUntil
        });
      }

      return null; // 点数不足
    } catch (error) {
      console.error('消耗点数时发生错误:', error);
      throw error;
    }
  }

  // 自然累计相关方法
  static async startNaturalAccumulation(userId) {
    try {
      const state = await this.findByUserId(userId);
      if (!state) return null;

      const now = Math.floor(Date.now() / 1000);

      return await this.update(userId, {
        is_in_natural_accumulation: true,
        last_accum_time: now,
        last_activity_time: now
      });
    } catch (error) {
      console.error('启动自然累计失败:', error);
      throw error;
    }
  }

  static async stopNaturalAccumulation(userId) {
    try {
      const state = await this.findByUserId(userId);
      if (!state) return null;

      const now = Math.floor(Date.now() / 1000);

      return await this.update(userId, {
        is_in_natural_accumulation: false,
        last_activity_time: now
      });
    } catch (error) {
      console.error('停止自然累计失败:', error);
      throw error;
    }
  }

  static async updateActivityTime(userId) {
    try {
      const state = await this.findByUserId(userId);
      if (!state) return null;

      const now = Math.floor(Date.now() / 1000);

      return await this.update(userId, {
        last_activity_time: now
      });
    } catch (error) {
      console.error('更新活动时间失败:', error);
      throw error;
    }
  }

  static async processNaturalAccumulation(userId) {
    try {
      const state = await this.findByUserId(userId);
      if (!state) return null;

      const now = Math.floor(Date.now() / 1000);

      // 检查是否在自然累计阶段
      if (!(state.is_in_natural_accumulation || false)) {
        return state;
      }

      // 检查是否超过10秒没有活动
      if (now - (state.last_activity_time || now) < 10) {
        return state;
      }

      // 检查是否已达到最大值
      if (state.natural_pixel_points >= state.max_natural_pixel_points) {
        return state;
      }

      // 增加1点自然累计
      const newNaturalPoints = Math.min(
        state.natural_pixel_points + 1,
        state.max_natural_pixel_points
      );
      const totalPoints = (state.item_pixel_points || 0) + newNaturalPoints;

      return await this.update(userId, {
        natural_pixel_points: newNaturalPoints,
        pixel_points: totalPoints,
        last_accum_time: now
      });
    } catch (error) {
      console.error('处理自然累计失败:', error);
      throw error;
    }
  }

  /**
   * 刷新用户状态（计算冻结过期和自然增长）
   * @param {string} userId
   * @param {Object|null} existingState - 可选，避免重复查询
   * @returns {Promise<Object>} 最新用户状态
   */
  static async refreshState(userId, existingState = null) {
    try {
      const state = existingState || await this.getOrCreate(userId);

      const now = Math.floor(Date.now() / 1000);
      let needsUpdate = false;
      const updates = {};

      // 1. 检查冻结状态
      if (state.freeze_until > 0) {
        if (now >= state.freeze_until) {
          updates.freeze_until = 0;
          needsUpdate = true;

          // 检查是否应该进入自然累计
          const timeSinceLastActivity = now - (state.last_activity_time || 0);
          if (timeSinceLastActivity >= 10) {
            updates.is_in_natural_accumulation = true;
            updates.last_accum_time = now;

            // 如果当前自然点数为0，立即给1点启动资金
            if ((state.natural_pixel_points || 0) === 0) {
              updates.natural_pixel_points = 1;
              updates.pixel_points = (state.item_pixel_points || 0) + 1;
            }
          } else {
            updates.is_in_natural_accumulation = false;
          }
        } else {
          // 仍在冻结中，直接返回
          return state;
        }
      }

      // 应用冻结相关的更新，以便后续逻辑基于最新状态
      let currentState = { ...state, ...updates };

      // 2. 处理自然累计
      let isInNaturalAccumulation = currentState.is_in_natural_accumulation || false;

      const lastActivityTime = Number(currentState.last_activity_time || now);
      const timeSinceLastActivity = now - lastActivityTime;
      const currentNaturalPoints = Number(currentState.natural_pixel_points || 0);
      const maxNaturalPoints = Number(currentState.max_natural_pixel_points || 64);

      if (isInNaturalAccumulation) {
        if (timeSinceLastActivity < 10) {
          updates.is_in_natural_accumulation = false;
          needsUpdate = true;
        } else {
          const lastAccumTime = Number(currentState.last_accum_time || lastActivityTime || now);
          const timeSinceLastAccum = now - lastAccumTime;

          if (timeSinceLastAccum >= 10 && currentNaturalPoints < maxNaturalPoints) {
            const pointsToAdd = Math.floor(timeSinceLastAccum / 10);
            if (pointsToAdd > 0) {
              const newNaturalPoints = Math.min(maxNaturalPoints, currentNaturalPoints + pointsToAdd);

              if (newNaturalPoints > currentNaturalPoints) {
                updates.natural_pixel_points = newNaturalPoints;
                updates.pixel_points = Number(currentState.item_pixel_points || 0) + newNaturalPoints;
                updates.last_accum_time = lastAccumTime + (pointsToAdd * 10);
                needsUpdate = true;
              }
            }
          }
        }
      } else {
        const currentFreezeUntil = Number(updates.freeze_until ?? currentState.freeze_until ?? 0);
        if (currentFreezeUntil === 0 &&
          timeSinceLastActivity >= 10 &&
          currentNaturalPoints < maxNaturalPoints) {

          const pointsEarned = Math.floor(timeSinceLastActivity / 10);
          const newNaturalPoints = Math.min(maxNaturalPoints, currentNaturalPoints + pointsEarned);

          updates.is_in_natural_accumulation = true;
          updates.natural_pixel_points = newNaturalPoints;
          updates.pixel_points = Number(currentState.item_pixel_points || 0) + newNaturalPoints;
          updates.last_accum_time = lastActivityTime + (pointsEarned * 10);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        return await this.update(userId, updates);
      }

      return state;
    } catch (error) {
      console.error('刷新用户状态失败:', error);
      throw error;
    }
  }

  // ==================== Legacy Cache API (kept for backward compatibility) ====================

  static async setCache(userId, state) {
    await this._writeToHash(userId, state);
    await this._deleteOldCache(userId);
  }

  static async getCache(userId) {
    return await this._getFromHash(userId);
  }

  // ==================== Write-Behind DB Sync ====================

  /**
   * Sync dirty Redis states back to DB in batch
   * Called periodically by the sync timer
   */
  static async syncDirtyToDb() {
    if (isSyncing || !this._redisAvailable()) return;
    isSyncing = true;

    try {
      // Pop a batch of dirty userIds atomically
      const dirtyUserIds = [];
      for (let i = 0; i < SYNC_BATCH_SIZE; i++) {
        const userId = await redisUtils.spop(DIRTY_SET);
        if (!userId) break;
        dirtyUserIds.push(userId);
      }

      if (dirtyUserIds.length === 0) return;

      let synced = 0;
      for (const userId of dirtyUserIds) {
        try {
          const state = await this._getFromHash(userId);
          if (!state || !state.user_id) continue;

          // Build DB update from sync-able fields only
          const dbUpdate = { updated_at: new Date() };
          for (const field of SYNC_FIELDS) {
            if (state[field] !== undefined && state[field] !== null) {
              dbUpdate[field] = state[field];
            }
          }

          await db(this.tableName)
            .where({ user_id: userId })
            .update(dbUpdate);

          synced++;
        } catch (error) {
          // Re-add to dirty set so it retries next cycle
          try { await redisUtils.sadd(DIRTY_SET, userId); } catch {}
          console.error(`⚠️ DB sync failed for user ${userId}:`, error.message);
        }
      }

      if (synced > 0) {
        console.log(`[UPS Sync] ${synced}/${dirtyUserIds.length} states synced to DB`);
      }
    } catch (error) {
      console.error('⚠️ Write-behind sync error:', error.message);
    } finally {
      isSyncing = false;
    }
  }

  /**
   * Start the write-behind sync timer
   */
  static startSyncTimer() {
    if (syncTimer) return;
    syncTimer = setInterval(() => {
      this.syncDirtyToDb().catch(() => {});
    }, SYNC_INTERVAL_MS);
    if (syncTimer.unref) syncTimer.unref(); // Don't block process exit
    console.log(`[UPS] Write-behind sync started (interval=${SYNC_INTERVAL_MS}ms)`);
  }

  /**
   * Stop sync timer and flush remaining dirty states
   */
  static async stopSyncTimer() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
    // Final flush
    await this.syncDirtyToDb();
    console.log('[UPS] Write-behind sync stopped, final flush done');
  }
}

// Auto-start sync timer on module load
UserPixelState.startSyncTimer();

module.exports = UserPixelState;
