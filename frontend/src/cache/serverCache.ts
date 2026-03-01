/**
 * 服务器缓存服务
 * 与后端图案API交互，提供高效的服务器端缓存
 */

import { logger } from '../utils/logger';

export interface PatternData {
  id: string;
  key: string;
  name: string;
  data: string;
  encoding: string;
  render_type: string;
  unicode_char?: string;
  category: string;
  color?: string;
  metadata: any;
  cached: boolean;
  source: string;
}

export interface GetPatternOptions {
  resolution?: string;
  format?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface ServerCacheStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  cacheHitRate: number;
}

class ServerCache {
  private baseUrl: string;
  private cache: Map<string, { data: PatternData; timestamp: number; ttl: number }>;
  private stats: ServerCacheStats;
  private requestQueue: Map<string, Promise<PatternData>>;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://funnypixels-backend.onrender.com/api/patterns'
      : 'http://localhost:3001/api/patterns';
    
    this.cache = new Map();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      cacheHitRate: 0
    };
    
    this.requestQueue = new Map();
  }

  /**
   * 获取单个图案
   */
  async getPattern(patternId: string, options: GetPatternOptions = {}): Promise<PatternData> {
    const { resolution = 'original', format = 'webp' } = options;
    const cacheKey = `${patternId}:${resolution}:${format}`;
    
    // 检查内存缓存
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.stats.cacheHitRate = (this.stats.cacheHitRate * this.stats.totalRequests + 1) / (this.stats.totalRequests + 1);
      this.stats.totalRequests++;
      return cached.data;
    }
    
    // 检查请求队列，避免重复请求
    if (this.requestQueue.has(cacheKey)) {
      return await this.requestQueue.get(cacheKey)!;
    }
    
    // 创建新请求
    const requestPromise = this.fetchPattern(patternId, options);
    this.requestQueue.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      
      // 缓存结果
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000 // 5分钟TTL
      });
      
      this.stats.successfulRequests++;
      return result;
      
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    } finally {
      this.requestQueue.delete(cacheKey);
      this.stats.totalRequests++;
    }
  }

  /**
   * 批量获取图案
   */
  async batchGetPatterns(patternIds: string[], options: GetPatternOptions = {}): Promise<Map<string, PatternData>> {
    const results = new Map();
    const uncachedIds: string[] = [];
    
    // 1. 检查内存缓存
    for (const patternId of patternIds) {
      const cacheKey = `${patternId}:${options.resolution || 'original'}:${options.format || 'webp'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        results.set(patternId, cached.data);
        this.stats.cacheHitRate = (this.stats.cacheHitRate * this.stats.totalRequests + 1) / (this.stats.totalRequests + 1);
      } else {
        uncachedIds.push(patternId);
      }
    }
    
    // 2. 批量获取未缓存的图案
    if (uncachedIds.length > 0) {
      try {
        const batchResults = await this.fetchBatchPatterns(uncachedIds, options);
        
        // 缓存新获取的图案
        for (const [patternId, pattern] of batchResults) {
          results.set(patternId, pattern);
          
          const cacheKey = `${patternId}:${options.resolution || 'original'}:${options.format || 'webp'}`;
          this.cache.set(cacheKey, {
            data: pattern,
            timestamp: Date.now(),
            ttl: 5 * 60 * 1000 // 5分钟TTL
          });
        }
        
        this.stats.successfulRequests++;
        
      } catch (error) {
        this.stats.failedRequests++;
        logger.error('批量获取图案失败:', error);
      }
    }
    
    this.stats.totalRequests += patternIds.length;
    return results;
  }

  /**
   * 从服务器获取单个图案
   */
  private async fetchPattern(patternId: string, options: GetPatternOptions): Promise<PatternData> {
    const startTime = Date.now();
    
    try {
      const params = new URLSearchParams({
        resolution: options.resolution || 'original',
        format: options.format || 'webp'
      });
      
      const response = await fetch(`${this.baseUrl}/${patternId}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '获取图案失败');
      }
      
      // 更新延迟统计
      const latency = Date.now() - startTime;
      this.updateLatencyStats(latency);
      
      return result.data;
      
    } catch (error) {
      logger.error(`获取图案失败: ${patternId}`, error);
      throw error;
    }
  }

  /**
   * 从服务器批量获取图案
   */
  private async fetchBatchPatterns(patternIds: string[], options: GetPatternOptions): Promise<Map<string, PatternData>> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          patternIds,
          resolution: options.resolution || 'original',
          format: options.format || 'webp'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '批量获取图案失败');
      }
      
      // 更新延迟统计
      const latency = Date.now() - startTime;
      this.updateLatencyStats(latency);
      
      // 转换结果格式
      const results = new Map();
      for (const [patternId, pattern] of Object.entries(result.data)) {
        results.set(patternId, pattern as PatternData);
      }
      
      return results;
      
    } catch (error) {
      logger.error('批量获取图案失败:', error);
      throw error;
    }
  }

  /**
   * 获取认证令牌
   */
  private getAuthToken(): string {
    return localStorage.getItem('funnypixels_token') || '';
  }

  /**
   * 更新延迟统计
   */
  private updateLatencyStats(latency: number): void {
    if (this.stats.totalRequests === 0) {
      this.stats.averageLatency = latency;
    } else {
      this.stats.averageLatency = (this.stats.averageLatency * (this.stats.totalRequests - 1) + latency) / this.stats.totalRequests;
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): ServerCacheStats {
    return { ...this.stats };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('🧹 服务器缓存已清空');
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, cached] of this.cache) {
      if (now - cached.timestamp >= cached.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`🧹 清理过期服务器缓存: ${cleanedCount}个`);
    }
  }

  /**
   * 预热缓存
   */
  async warmupCache(patternIds: string[], options: GetPatternOptions = {}): Promise<void> {
    try {
      logger.info(`🔥 开始预热服务器缓存: ${patternIds.length}个图案`);

      await this.batchGetPatterns(patternIds, options);

      logger.info(`✅ 服务器缓存预热完成: ${patternIds.length}个图案`);
      
    } catch (error) {
      logger.error('❌ 服务器缓存预热失败:', error);
    }
  }

  /**
   * 检查网络连接
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.ok;
      
    } catch (error) {
      logger.error('服务器连接检查失败:', error);
      return false;
    }
  }

  /**
   * 获取服务器状态
   */
  async getServerStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data;
      
    } catch (error) {
      logger.error('获取服务器状态失败:', error);
      return null;
    }
  }
}

export default ServerCache;
