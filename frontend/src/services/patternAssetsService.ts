/**
 * Pattern Assets Service
 * 管理pattern_assets数据的加载和缓存
 */

import { api } from './api';
import { logger } from '../utils/logger';

export interface PatternAsset {
  key: string;
  name: string;
  render_type: 'color' | 'emoji' | 'complex' | 'default';
  color?: string;           // render_type=color时使用
  unicode_char?: string;    // render_type=emoji时使用
  file_url?: string;        // render_type=complex时使用（生产环境）
  file_path?: string;       // render_type=complex时使用（开发环境）
  image_url?: string;       // 备用图片URL
  category?: string;
}

class PatternAssetsService {
  // 内存缓存
  private cache: Map<string, PatternAsset> = new Map();

  // 批量加载中的promise，避免重复请求
  private loadingPromises: Map<string, Promise<PatternAsset | null>> = new Map();

  // 记录已警告的缺失patterns，避免重复警告
  private warnedPatterns: Set<string> = new Set();

  /**
   * 批量获取pattern assets
   */
  async batchGet(keys: string[], forceRefresh: boolean = false): Promise<Map<string, PatternAsset>> {
    if (!keys || keys.length === 0) {
      return new Map();
    }

    // 过滤掉已缓存的（除非强制刷新）
    const uncachedKeys = forceRefresh
      ? keys
      : keys.filter(key => !this.cache.has(key));

    // 🔍 调试：记录请求详情（仅当有未缓存的keys时）
    if (uncachedKeys.length > 0) {
      logger.debug(`🔍 [DEBUG] PatternAssetsService请求详情:`, {
        totalRequestedKeys: keys.length,
        uncachedKeysCount: uncachedKeys.length,
        uncachedKeys: uncachedKeys,
        cacheSize: this.cache.size
      });
    }

    if (uncachedKeys.length === 0) {
      // 全部已缓存，直接返回
      const result = new Map<string, PatternAsset>();
      keys.forEach(key => {
        const cached = this.cache.get(key);
        if (cached) {
          result.set(key, cached);
        }
      });
      return result;
    }

    try {
      logger.debug(`🎨 批量加载pattern_assets: ${uncachedKeys.length}个`);

      const response = await api.post('/pattern-assets/batch', { keys: uncachedKeys });
      const patterns = response.data as Record<string, PatternAsset>;

      // 🔍 调试：记录加载结果
      if (uncachedKeys.length > 0) {
        logger.debug(`🔍 [DEBUG] Patterns加载结果:`, {
          requestedKeys: uncachedKeys,
          returnedKeys: Object.keys(patterns),
          successCount: Object.keys(patterns).length,
          failedKeys: uncachedKeys.filter(key => !patterns[key])
        });
      }

      // 缓存结果 - 只缓存有效的patterns
      Object.entries(patterns).forEach(([key, pattern]) => {
        if (pattern) {  // 🔧 关键修复：只缓存有效的pattern
          this.cache.set(key, pattern);
        }
      });

      logger.debug(`✅ 成功加载 ${Object.keys(patterns).length} 个pattern_assets`);

      // 合并缓存和新加载的数据
      const result = new Map<string, PatternAsset>();
      keys.forEach(key => {
        // 🔧 修复：优先使用新加载的pattern，如果没有则使用缓存
        let pattern = patterns[key];
        if (!pattern) {
          pattern = this.cache.get(key);
        }
        if (pattern) {
          result.set(key, pattern);
        } else {
          // 只在首次缺失时警告，避免重复警告
          if (!this.warnedPatterns.has(key)) {
            logger.warn(`⚠️ Pattern缺失: ${key}`, {
              inResponse: !!patterns[key],
              inCache: this.cache.has(key),
              wasRequested: uncachedKeys.includes(key)
            });
            this.warnedPatterns.add(key);
          }
        }
      });

      return result;

    } catch (error) {
      logger.error('❌ 批量加载pattern_assets失败:', error);

      // 返回已缓存的数据
      const result = new Map<string, PatternAsset>();
      keys.forEach(key => {
        const cached = this.cache.get(key);
        if (cached) {
          result.set(key, cached);
        }
      });
      return result;
    }
  }

  /**
   * 获取单个pattern asset
   */
  async get(key: string): Promise<PatternAsset | null> {
    // 检查缓存
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // 检查是否正在加载
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key)!;
    }

    // 创建加载promise
    const loadPromise = this.batchGet([key]).then(result => {
      return result.get(key) || null;
    });

    this.loadingPromises.set(key, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.loadingPromises.delete(key);
    }
  }

  /**
   * 获取图片URL（处理开发环境和生产环境）
   */
  getImageUrl(pattern: PatternAsset): string | null {
    if (pattern.render_type !== 'complex') {
      return null;
    }

    // 优先使用file_url
    if (pattern.file_url) {
      return pattern.file_url;
    }

    // 开发环境使用file_path
    if (pattern.file_path && import.meta.env.DEV) {
      // 开发环境从本地服务器获取
      return `/uploads/${pattern.file_path}`;
    }

    // 生产环境使用CDN
    if (pattern.file_path && import.meta.env.PROD) {
      const cdnBaseUrl = import.meta.env.VITE_CDN_BASE_URL || 'https://cdn.funnypixels.com';
      return `${cdnBaseUrl}/${pattern.file_path}`;
    }

    // 备用：使用image_url
    if (pattern.image_url) {
      return pattern.image_url;
    }

    return null;
  }

  /**
   * 强制刷新指定patterns的缓存
   */
  async forceRefresh(patternIds: string[]): Promise<Map<string, PatternAsset>> {
    logger.info(`🔄 强制刷新 ${patternIds.length} 个patterns的缓存`);

    // 清除指定patterns的缓存
    patternIds.forEach(id => {
      this.cache.delete(id);
      this.loadingPromises.delete(id);
      this.warnedPatterns.delete(id);  // 清除警告记录，允许再次警告
    });

    // 重新加载
    return this.batchGet(patternIds, true);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    this.warnedPatterns.clear();  // 清除警告记录
    logger.info('🗑️ PatternAssetsService缓存已清除');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      cachedCount: this.cache.size,
      loadingCount: this.loadingPromises.size,
      warnedCount: this.warnedPatterns.size
    };
  }
}

// 导出单例
export const patternAssetsService = new PatternAssetsService();
