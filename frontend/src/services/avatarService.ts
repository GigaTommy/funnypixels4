/**
 * 前端头像服务
 * 获取用户头像的CDN URL，支持缓存和批量处理
 */

import { logger } from '../utils/logger';

interface AvatarCacheItem {
  url: string;
  timestamp: number;
  userId: string;
  size: string;
}

class AvatarService {
  private cache = new Map<string, AvatarCacheItem>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
  private readonly API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  constructor() {
    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredCache(), 60000); // 每分钟清理一次
  }

  /**
   * 获取用户头像URL
   * @param userId 用户ID
   * @param pixelData 像素数据
   * @param size 头像尺寸 ('small' | 'medium' | 'large')
   * @returns Promise<string> 头像URL
   */
  async getAvatarUrl(userId: string, pixelData: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<string | null> {
    if (!pixelData) {
      return null;
    }

    // 检查缓存
    const cacheKey = this.getCacheKey(userId, pixelData, size);
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.url;
    }

    try {
      // 调用后端API生成头像
      const response = await fetch(`${this.API_BASE_URL}/avatars/user/${userId}/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pixel_data: pixelData,
          size
        })
      });

      if (!response.ok) {
        throw new Error(`Avatar API failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.avatar_url) {
        // 缓存结果
        this.cache.set(cacheKey, {
          url: data.avatar_url,
          timestamp: Date.now(),
          userId,
          size
        });

        logger.info(`✅ 头像URL已获取:`, { userId, size, url: data.avatar_url });
        return data.avatar_url;
      }

      return null;
    } catch (error) {
      logger.error('获取头像URL失败:', error);
      return null;
    }
  }

  /**
   * 批量获取用户头像URL
   * @param users 用户列表
   * @param avatarField 头像字段名
   * @param size 头像尺寸
   * @returns Promise<Array<{...user, avatar_url: string}>> 更新后的用户列表
   */
  async batchGetAvatarUrls<T extends Record<string, any>>(
    users: T[],
    avatarField = 'avatar',
    size: 'small' | 'medium' | 'large' = 'medium'
  ): Promise<(T & { avatar_url?: string })[]> {
    const results = await Promise.allSettled(
      users.map(async (user) => {
        const pixelData = user[avatarField];
        const avatarUrl = pixelData
          ? await this.getAvatarUrl(user.id, pixelData, size)
          : null;

        return {
          ...user,
          avatar_url: avatarUrl || undefined
        };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`用户${users[index]?.id}头像获取失败:`, result.reason);
        return {
          ...users[index],
          avatar_url: undefined
        };
      }
    });
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(userId: string, pixelData: string, size: string): string {
    // 使用简单哈希来减少键的长度
    const hash = this.simpleHash(pixelData);
    return `${userId}_${size}_${hash}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.CACHE_DURATION) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      logger.info(`🧹 清理了 ${expiredKeys.length} 个过期头像缓存`);
    }
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('🗑️ 头像缓存已清空');
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * 预热头像缓存
   * @param users 用户列表
   */
  async warmupCache<T extends Record<string, any>>(
    users: T[],
    avatarField = 'avatar'
  ): Promise<void> {
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

    logger.info(`🔥 开始预热 ${users.length} 个用户的头像缓存...`);

    for (const size of sizes) {
      await this.batchGetAvatarUrls(users, avatarField, size);
    }

    logger.info(`✅ 头像缓存预热完成`);
  }

  /**
   * 检查头像URL是否有效
   * @param url 头像URL
   * @returns Promise<boolean> 是否有效
   */
  async isAvatarUrlValid(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      logger.warn('头像URL验证失败:', { url, error });
      return false;
    }
  }
}

// 导出单例实例
export const avatarService = new AvatarService();

export default avatarService;