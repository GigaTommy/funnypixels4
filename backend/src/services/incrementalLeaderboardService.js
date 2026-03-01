/**
 * 增量排行榜服务（v2 — 内存聚合架构）
 *
 * 核心设计（支撑万人并发）：
 * ┌───────────────────────────────────────────────────────┐
 * │  handlePixelDraw()  ← 纯内存 O(1)，零 DB 查询        │
 * │    ↓                                                   │
 * │  personalDeltas  Map<userId, +N>                       │
 * │  allianceDeltas  Map<allianceId, +N>                   │
 * │    ↓  每 30 秒                                         │
 * │  flush() → 原子 swap → 批量 SQL（每张表每个周期 1 条） │
 * └───────────────────────────────────────────────────────┘
 *
 * 性能指标：
 * - 画像素路径：0 DB 查询，0 网络 I/O，纯 Map.set
 * - flush 路径：5 periods × 2 tables = 10 SQL / 30 秒（无论多少用户）
 * - 城市排行榜：不做增量，由 LeaderboardMaintenanceService 每小时全量计算
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');
const { PIXEL_TYPES } = require('../constants/pixelTypes');

// 同步间隔（毫秒）
const SYNC_INTERVAL = parseInt(process.env.LEADERBOARD_SYNC_INTERVAL) || 30000; // 30 秒

// 需要增量更新的时间周期
const PERIODS = ['daily', 'weekly', 'monthly', 'yearly', 'allTime'];

class IncrementalLeaderboardService {
  constructor() {
    // ---- 内存聚合计数器 ----
    // Map<userId, pixelDelta>  — 自上次 flush 以来的增量
    this.personalDeltas = new Map();
    // Map<allianceId, pixelDelta>
    this.allianceDeltas = new Map();

    // 状态
    this.isFlushing = false;

    // 🔒 安全：失败重试保护
    this.consecutiveFailures = 0;
    this.MAX_CONSECUTIVE_FAILURES = 5;

    // 统计
    this.stats = {
      totalPixels: 0,
      flushCount: 0,
      lastFlushTime: null,
      lastFlushDuration: 0,
      errors: 0,
      droppedPixels: 0  // 🔒 新增：因失败丢弃的像素数
    };

    // 启动定时同步
    this._syncTimer = setInterval(() => {
      this.flush().catch(err => {
        logger.error('排行榜定时 flush 失败', { error: err.message });
        this.stats.errors++;
      });
    }, SYNC_INTERVAL);

    logger.info('🏆 增量排行榜服务 v2 启动', { syncInterval: SYNC_INTERVAL });
  }

  // =========================================================
  //  画像素入口（纯内存，O(1)，零 DB）
  // =========================================================

  /**
   * @param {Object} pixelData  { userId, allianceId, pixelType }
   */
  async handlePixelDraw(pixelData) {
    const { userId, allianceId = null, pixelType = PIXEL_TYPES.BASIC } = pixelData;

    // 只统计基础像素
    if (pixelType !== PIXEL_TYPES.BASIC) return;

    // 个人计数 +1
    this.personalDeltas.set(userId, (this.personalDeltas.get(userId) || 0) + 1);

    // 联盟计数 +1
    if (allianceId) {
      this.allianceDeltas.set(allianceId, (this.allianceDeltas.get(allianceId) || 0) + 1);
    }

    this.stats.totalPixels++;
  }

  // =========================================================
  //  定时 flush：原子 swap + 批量 SQL
  // =========================================================

  async flush() {
    if (this.isFlushing) return;

    // 原子 swap：取走当前 Map，换上空 Map（保证画像素路径不阻塞）
    const personalSnapshot = this.personalDeltas;
    const allianceSnapshot = this.allianceDeltas;
    this.personalDeltas = new Map();
    this.allianceDeltas = new Map();

    if (personalSnapshot.size === 0 && allianceSnapshot.size === 0) return;

    this.isFlushing = true;
    const startTime = Date.now();

    try {
      const now = new Date();

      // 对每个时间周期，执行 1 条批量 SQL（个人 + 联盟）
      await Promise.all(PERIODS.map(period =>
        this._flushPeriod(period, personalSnapshot, allianceSnapshot, now)
      ));

      // 🔒 成功时重置失败计数器
      this.consecutiveFailures = 0;

      this.stats.flushCount++;
      this.stats.lastFlushTime = now;
      this.stats.lastFlushDuration = Date.now() - startTime;

      logger.info(`✅ 排行榜 flush 完成`, {
        personalUsers: personalSnapshot.size,
        alliances: allianceSnapshot.size,
        duration: `${this.stats.lastFlushDuration}ms`
      });

    } catch (error) {
      // 🔒 失败计数递增
      this.consecutiveFailures++;

      logger.error('排行榜 flush 失败', {
        error: error.message,
        consecutiveFailures: this.consecutiveFailures,
        personalSize: personalSnapshot.size,
        allianceSize: allianceSnapshot.size
      });

      this.stats.errors++;

      // 🔒 安全：检查是否达到最大失败次数
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        logger.error('⚠️ 排行榜 flush 连续失败，丢弃数据防止内存溢出', {
          consecutiveFailures: this.consecutiveFailures,
          droppedPersonal: personalSnapshot.size,
          droppedAlliance: allianceSnapshot.size,
          totalDropped: personalSnapshot.size + allianceSnapshot.size
        });

        // 统计丢弃的像素数
        this.stats.droppedPixels += personalSnapshot.size;

        // ⚠️ 不 merge back，丢弃数据
        // 这防止内存无限增长，但意味着这些像素不会计入排行榜
        // TODO: 添加 Prometheus 告警

      } else {
        // 🔒 正常情况：merge back 以便下次重试
        logger.info('🔄 Merge back 失败数据，下次重试', {
          personalSize: personalSnapshot.size,
          allianceSize: allianceSnapshot.size
        });

        for (const [userId, delta] of personalSnapshot) {
          this.personalDeltas.set(userId, (this.personalDeltas.get(userId) || 0) + delta);
        }
        for (const [allianceId, delta] of allianceSnapshot) {
          this.allianceDeltas.set(allianceId, (this.allianceDeltas.get(allianceId) || 0) + delta);
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 对单个 period 执行批量 upsert（个人 + 联盟各 1 条 SQL）
   */
  async _flushPeriod(period, personalSnapshot, allianceSnapshot, now) {
    const { periodStart, periodEnd } = this._getPeriodDates(period, now);

    await Promise.all([
      personalSnapshot.size > 0
        ? this._batchUpsertPersonal(period, periodStart, periodEnd, personalSnapshot, now)
        : Promise.resolve(),
      allianceSnapshot.size > 0
        ? this._batchUpsertAlliance(period, periodStart, periodEnd, allianceSnapshot, now)
        : Promise.resolve()
    ]);
  }

  /**
   * 个人排行榜：1 条 SQL 批量 upsert 所有用户的增量
   */
  async _batchUpsertPersonal(period, periodStart, periodEnd, snapshot, now) {
    const entries = Array.from(snapshot.entries()); // [[userId, delta], ...]
    const placeholders = entries.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const params = entries.flatMap(([userId, delta]) => [
      userId, period, periodStart, periodEnd, delta, now
    ]);

    await db.raw(`
      INSERT INTO leaderboard_personal (user_id, period, period_start, period_end, pixel_count, last_updated)
      VALUES ${placeholders}
      ON CONFLICT (user_id, period, period_start)
      DO UPDATE SET
        pixel_count = leaderboard_personal.pixel_count + EXCLUDED.pixel_count,
        last_updated = EXCLUDED.last_updated
    `, params);
  }

  /**
   * 联盟排行榜：1 条 SQL 批量 upsert 所有联盟的增量
   */
  async _batchUpsertAlliance(period, periodStart, periodEnd, snapshot, now) {
    const entries = Array.from(snapshot.entries()); // [[allianceId, delta], ...]
    const placeholders = entries.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const params = entries.flatMap(([allianceId, delta]) => [
      allianceId, period, periodStart, periodEnd, delta, now
    ]);

    await db.raw(`
      INSERT INTO leaderboard_alliance (alliance_id, period, period_start, period_end, total_pixels, last_updated)
      VALUES ${placeholders}
      ON CONFLICT (alliance_id, period, period_start)
      DO UPDATE SET
        total_pixels = leaderboard_alliance.total_pixels + EXCLUDED.total_pixels,
        last_updated = EXCLUDED.last_updated
    `, params);
  }

  // =========================================================
  //  时间计算
  // =========================================================

  _getPeriodDates(period, now) {
    let periodStart, periodEnd;

    switch (period) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(periodStart.getTime() + 86400000 - 1);
        break;
      case 'weekly': {
        const day = now.getDay() || 7;
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
        periodEnd = new Date(periodStart.getTime() + 7 * 86400000 - 1);
        break;
      }
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'yearly':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'allTime':
        periodStart = new Date('2024-01-01T00:00:00.000Z');
        periodEnd = new Date('2099-12-31T23:59:59.999Z');
        break;
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(periodStart.getTime() + 86400000 - 1);
    }

    return { periodStart, periodEnd };
  }

  // =========================================================
  //  公开 API
  // =========================================================

  getStats() {
    return {
      ...this.stats,
      pendingPersonal: this.personalDeltas.size,
      pendingAlliance: this.allianceDeltas.size,
      syncInterval: SYNC_INTERVAL,
      isFlushing: this.isFlushing,
      consecutiveFailures: this.consecutiveFailures,  // 🔒 新增
      maxConsecutiveFailures: this.MAX_CONSECUTIVE_FAILURES  // 🔒 新增
    };
  }

  /**
   * 强制立即 flush（用于优雅关闭等场景）
   */
  async forceFlushUpdates() {
    await this.flush();
    return { success: true };
  }

  /**
   * 停止服务
   */
  stop() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
    logger.info('🛑 增量排行榜服务已停止');
  }
}

// 单例
const incrementalLeaderboardService = new IncrementalLeaderboardService();

module.exports = incrementalLeaderboardService;
