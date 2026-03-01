/**
 * IndexedDB包装器
 * 提供高性能的本地存储解决方案，替代localStorage
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
  lastAccessed: number;
  accessCount: number;
  cachedAt: number;
}

export interface CacheMeta {
  key: string;
  lastAccessed: number;
  accessCount: number;
  size: number;
  priority: number;
}

export class IndexedDBWrapper {
  private dbName: string;
  private version: number;
  private db: IDBDatabase | null = null;
  private isInitialized: boolean = false;

  constructor(dbName: string = 'funnypixels_pattern_cache', version: number = 1) {
    this.dbName = dbName;
    this.version = version;
  }

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        logger.error('IndexedDB初始化失败:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        logger.info('✅ IndexedDB初始化成功');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建图案存储
        if (!db.objectStoreNames.contains('patterns')) {
          const patternStore = db.createObjectStore('patterns', { keyPath: 'id' });
          patternStore.createIndex('key', 'key', { unique: true });
          patternStore.createIndex('category', 'category', { unique: false });
          patternStore.createIndex('render_type', 'render_type', { unique: false });
          patternStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          patternStore.createIndex('accessCount', 'accessCount', { unique: false });
          patternStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
        
        // 创建缓存元数据存储
        if (!db.objectStoreNames.contains('cache_meta')) {
          const metaStore = db.createObjectStore('cache_meta', { keyPath: 'key' });
          metaStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          metaStore.createIndex('accessCount', 'accessCount', { unique: false });
          metaStore.createIndex('size', 'size', { unique: false });
          metaStore.createIndex('priority', 'priority', { unique: false });
        }
        
        // 创建缓存统计存储
        if (!db.objectStoreNames.contains('cache_stats')) {
          const statsStore = db.createObjectStore('cache_stats', { keyPath: 'id' });
          statsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        logger.info('📊 IndexedDB数据库结构创建完成');
      };
    });
  }

  /**
   * 获取图案
   */
  async get(patternId: string): Promise<PatternData | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns', 'cache_meta'], 'readwrite');
      const patternStore = transaction.objectStore('patterns');
      const metaStore = transaction.objectStore('cache_meta');
      
      const request = patternStore.get(patternId);
      
      request.onsuccess = () => {
        const pattern = request.result;
        if (pattern) {
          // 更新访问统计
          this.updateAccessStats(patternId, metaStore);
          resolve(pattern);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 存储图案
   */
  async set(patternId: string, pattern: PatternData): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns', 'cache_meta'], 'readwrite');
      const patternStore = transaction.objectStore('patterns');
      const metaStore = transaction.objectStore('cache_meta');
      
      // 准备图案数据
      const patternData = {
        ...pattern,
        id: patternId,
        lastAccessed: Date.now(),
        cachedAt: Date.now()
      };
      
      // 存储图案数据
      const patternRequest = patternStore.put(patternData);
      
      // 存储缓存元数据
      const metaData: CacheMeta = {
        key: patternId,
        lastAccessed: Date.now(),
        accessCount: 1,
        size: this.calculateSize(pattern),
        priority: this.calculatePriority(pattern)
      };
      
      const metaRequest = metaStore.put(metaData);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 批量获取图案
   */
  async batchGet(patternIds: string[]): Promise<Map<string, PatternData>> {
    if (!this.db) await this.init();
    
    const results = new Map<string, PatternData>();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns', 'cache_meta'], 'readwrite');
      const patternStore = transaction.objectStore('patterns');
      const metaStore = transaction.objectStore('cache_meta');
      
      let completed = 0;
      const total = patternIds.length;
      
      if (total === 0) {
        resolve(results);
        return;
      }
      
      for (const patternId of patternIds) {
        const request = patternStore.get(patternId);
        
        request.onsuccess = () => {
          const pattern = request.result;
          if (pattern) {
            results.set(patternId, pattern);
            // 更新访问统计
            this.updateAccessStats(patternId, metaStore);
          }
          completed++;
          
          if (completed === total) {
            resolve(results);
          }
        };
        
        request.onerror = () => {
          completed++;
          if (completed === total) {
            resolve(results);
          }
        };
      }
    });
  }

  /**
   * 批量存储图案
   */
  async batchSet(patterns: Map<string, PatternData>): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns', 'cache_meta'], 'readwrite');
      const patternStore = transaction.objectStore('patterns');
      const metaStore = transaction.objectStore('cache_meta');
      
      let completed = 0;
      const total = patterns.size;
      
      if (total === 0) {
        resolve();
        return;
      }
      
      for (const [patternId, pattern] of patterns) {
        // 准备图案数据
        const patternData = {
          ...pattern,
          id: patternId,
          lastAccessed: Date.now(),
          cachedAt: Date.now()
        };
        
        // 存储图案数据
        const patternRequest = patternStore.put(patternData);
        
        // 存储缓存元数据
        const metaData: CacheMeta = {
          key: patternId,
          lastAccessed: Date.now(),
          accessCount: 1,
          size: this.calculateSize(pattern),
          priority: this.calculatePriority(pattern)
        };
        
        const metaRequest = metaStore.put(metaData);
        
        patternRequest.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        
        patternRequest.onerror = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
      }
    });
  }

  /**
   * 删除图案
   */
  async delete(patternId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns', 'cache_meta'], 'readwrite');
      const patternStore = transaction.objectStore('patterns');
      const metaStore = transaction.objectStore('cache_meta');
      
      const patternRequest = patternStore.delete(patternId);
      const metaRequest = metaStore.delete(patternId);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 批量删除图案
   */
  async batchDelete(patternIds: string[]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns', 'cache_meta'], 'readwrite');
      const patternStore = transaction.objectStore('patterns');
      const metaStore = transaction.objectStore('cache_meta');
      
      let completed = 0;
      const total = patternIds.length;
      
      if (total === 0) {
        resolve();
        return;
      }
      
      for (const patternId of patternIds) {
        const patternRequest = patternStore.delete(patternId);
        const metaRequest = metaStore.delete(patternId);
        
        patternRequest.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        
        patternRequest.onerror = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
      }
    });
  }

  /**
   * 检查图案是否存在
   */
  async exists(patternId: string): Promise<boolean> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns'], 'readonly');
      const patternStore = transaction.objectStore('patterns');
      
      const request = patternStore.get(patternId);
      
      request.onsuccess = () => {
        resolve(!!request.result);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取所有图案ID
   */
  async getAllKeys(): Promise<string[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns'], 'readonly');
      const patternStore = transaction.objectStore('patterns');
      
      const request = patternStore.getAllKeys();
      
      request.onsuccess = () => {
        resolve(request.result as string[]);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取缓存统计
   */
  async getStats(): Promise<{
    totalPatterns: number;
    totalSize: number;
    averageSize: number;
    oldestPattern: number;
    newestPattern: number;
  }> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns', 'cache_meta'], 'readonly');
      const patternStore = transaction.objectStore('patterns');
      const metaStore = transaction.objectStore('cache_meta');
      
      const patternRequest = patternStore.getAll();
      const metaRequest = metaStore.getAll();
      
      Promise.all([
        new Promise<any[]>((resolve, reject) => {
          patternRequest.onsuccess = () => resolve(patternRequest.result);
          patternRequest.onerror = () => reject(patternRequest.error);
        }),
        new Promise<CacheMeta[]>((resolve, reject) => {
          metaRequest.onsuccess = () => resolve(metaRequest.result);
          metaRequest.onerror = () => reject(metaRequest.error);
        })
      ]).then(([patterns, metas]) => {
        const totalPatterns = patterns.length;
        const totalSize = metas.reduce((sum, meta) => sum + meta.size, 0);
        const averageSize = totalPatterns > 0 ? totalSize / totalPatterns : 0;
        
        const cachedAts = patterns.map(p => p.cachedAt);
        const oldestPattern = cachedAts.length > 0 ? Math.min(...cachedAts) : 0;
        const newestPattern = cachedAts.length > 0 ? Math.max(...cachedAts) : 0;
        
        resolve({
          totalPatterns,
          totalSize,
          averageSize,
          oldestPattern,
          newestPattern
        });
      }).catch(reject);
    });
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpired(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.db) await this.init();
    
    const cutoffTime = Date.now() - maxAge;
    const expiredKeys: string[] = [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns'], 'readonly');
      const patternStore = transaction.objectStore('patterns');
      const index = patternStore.index('cachedAt');
      
      const request = index.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.value.cachedAt < cutoffTime) {
            expiredKeys.push(cursor.value.id);
          }
          cursor.continue();
        } else {
          // 删除过期缓存
          if (expiredKeys.length > 0) {
            this.batchDelete(expiredKeys).then(() => {
              resolve(expiredKeys.length);
            }).catch(reject);
          } else {
            resolve(0);
          }
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 更新访问统计
   */
  private updateAccessStats(patternId: string, metaStore: IDBObjectStore): void {
    const request = metaStore.get(patternId);
    request.onsuccess = () => {
      const meta = request.result;
      if (meta) {
        meta.lastAccessed = Date.now();
        meta.accessCount = (meta.accessCount || 0) + 1;
        metaStore.put(meta);
      }
    };
  }

  /**
   * 计算数据大小
   */
  private calculateSize(pattern: PatternData): number {
    const data = pattern.data || '';
    return new Blob([data]).size;
  }

  /**
   * 计算优先级
   */
  private calculatePriority(pattern: PatternData): number {
    let priority = 5; // 默认优先级
    
    // 根据渲染类型调整优先级
    switch (pattern.render_type) {
      case 'color':
        priority = 3; // 颜色优先级较低
        break;
      case 'emoji':
        priority = 6; // emoji优先级中等
        break;
      case 'complex':
        priority = 8; // 复杂图案优先级较高
        break;
    }
    
    // 根据类别调整优先级
    if (pattern.category === 'alliance_flag') {
      priority += 2; // 联盟旗帜优先级更高
    }
    
    return Math.min(priority, 10); // 最高优先级为10
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns', 'cache_meta', 'cache_stats'], 'readwrite');
      
      const clearPromises = [
        transaction.objectStore('patterns').clear(),
        transaction.objectStore('cache_meta').clear(),
        transaction.objectStore('cache_stats').clear()
      ];
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
