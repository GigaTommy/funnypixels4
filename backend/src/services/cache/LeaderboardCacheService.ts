/**
 * Leaderboard Cache Service - 排行榜缓存业务语义层
 *
 * 【职责】
 * - 封装排行榜数据的缓存逻辑
 * - 负责 Key 命名（leaderboard:）
 * - 负责 ZSet 操作的封装
 * - 组合 CacheRedisClient，不继承
 */

import RedisManager from '../RedisManager';
import type { CacheRedisClient } from './CacheRedisClient';

/**
 * 排行榜条目接口
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

/**
 * 排行榜类型
 */
export type LeaderboardType = 'global' | 'regional' | 'daily' | 'weekly';

/**
 * 排行榜缓存服务
 */
export class LeaderboardCacheService {
  private cache: CacheRedisClient;

  constructor() {
    this.cache = RedisManager.getCache();
  }

  /**
   * Key 命名: leaderboard:{type}:{period}
   * 例如: leaderboard:global:daily
   */
  private makeKey(type: LeaderboardType, period: string): string {
    return `leaderboard:${type}:${period}`;
  }

  /**
   * 添加或更新分数
   */
  async addScore(
    type: LeaderboardType,
    period: string,
    userId: string,
    score: number
  ): Promise<void> {
    const key = this.makeKey(type, period);
    await this.cache.zadd(key, score, userId);
  }

  /**
   * 批量添加分数
   */
  async addScores(
    type: LeaderboardType,
    period: string,
    entries: Array<{ userId: string; score: number }>
  ): Promise<void> {
    const key = this.makeKey(type, period);

    for (const entry of entries) {
      await this.cache.zadd(key, entry.score, entry.userId);
    }
  }

  /**
   * 获取排行榜（降序，带分数）
   */
  async getRange(
    type: LeaderboardType,
    period: string,
    start = 0,
    stop = 9
  ): Promise<LeaderboardEntry[]> {
    const key = this.makeKey(type, period);

    try {
      const results = await this.cache.zrevrange(key, start, stop, true);

      if (!Array.isArray(results)) {
        return [];
      }

      return results.map((item: any, index) => ({
        rank: start + index + 1,
        userId: item.value,
        username: '', // 需要从其他地方获取
        score: item.score,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 获取用户排名和分数
   */
  async getUserRank(
    type: LeaderboardType,
    period: string,
    userId: string
  ): Promise<{ rank: number; score: number } | null> {
    const key = this.makeKey(type, period);

    try {
      const scoreResult = await this.cache.zrange(key, 0, -1);
      if (!Array.isArray(scoreResult)) {
        return null;
      }

      // 查找用户分数
      let score = 0;
      for (const item of scoreResult) {
        if (item === userId) {
          // 需要单独查询分数
          break;
        }
      }

      // 获取排名（降序）
      const rankResults = await this.cache.zrevrange(key, 0, -1);
      let rank = 0;
      for (const item of rankResults) {
        rank++;
        if (item === userId) {
          return { rank, score };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * 移除用户
   */
  async removeUser(type: LeaderboardType, period: string, userId: string): Promise<void> {
    const key = this.makeKey(type, period);
    await this.cache.zrem(key, userId);
  }

  /**
   * 获取总数
   */
  async getCount(type: LeaderboardType, period: string): Promise<number> {
    const key = this.makeKey(type, period);
    return await this.cache.zcard(key);
  }

  /**
   * 清空排行榜
   */
  async clear(type: LeaderboardType, period: string): Promise<void> {
    const key = this.makeKey(type, period);
    await this.cache.del(key);
  }

  /**
   * 设置过期时间
   */
  async expire(type: LeaderboardType, period: string, ttl: number): Promise<void> {
    const key = this.makeKey(type, period);
    await this.cache.expire(key, ttl);
  }
}

export default LeaderboardCacheService;
