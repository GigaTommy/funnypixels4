import { logger } from '../utils/logger';

export interface CachedTileRecord {
  tileId: string;
  version?: string | number;
  bitmap: ImageBitmap;
  timestamp: number;
}

interface IndexedDBTileRecord {
  tileId: string;
  version?: string | number;
  data: ArrayBuffer;
  updatedAt: number;
}

interface TileCacheOptions {
  maxMemoryEntries?: number;
  enableIndexedDB?: boolean;
  databaseName?: string;
  storeName?: string;
}

/**
 * 前端瓦片缓存
 * 同时支持内存和 IndexedDB，保证刷新后的快速恢复
 */
export class TileCache {
  private memoryCache = new Map<string, CachedTileRecord>();
  private options: Required<TileCacheOptions>;
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor(options: TileCacheOptions = {}) {
    this.options = {
      maxMemoryEntries: options.maxMemoryEntries ?? 200,
      enableIndexedDB: options.enableIndexedDB ?? true,
      databaseName: options.databaseName ?? 'funnypixels-tile-cache',
      storeName: options.storeName ?? 'tiles'
    };

    if (this.options.enableIndexedDB && typeof indexedDB !== 'undefined') {
      this.dbPromise = this.openDatabase();
    } else {
      this.dbPromise = Promise.resolve(null);
    }
  }

  private async openDatabase(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return null;
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(this.options.databaseName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.options.storeName)) {
          db.createObjectStore(this.options.storeName, { keyPath: 'tileId' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        logger.warn('IndexedDB initialization failed:', request.error);
        resolve(null);
      };
    });
  }

  private ensureCapacity() {
    if (this.memoryCache.size <= this.options.maxMemoryEntries) {
      return;
    }

    const entries = Array.from(this.memoryCache.values()).sort((a, b) => a.timestamp - b.timestamp);
    const excess = this.memoryCache.size - this.options.maxMemoryEntries;
    for (let i = 0; i < excess; i++) {
      this.memoryCache.delete(entries[i].tileId);
    }
  }

  async get(tileId: string, version?: string | number): Promise<CachedTileRecord | null> {
    const cached = this.memoryCache.get(tileId);
    if (cached && (!version || cached.version === version)) {
      cached.timestamp = Date.now();
      return cached;
    }

    const db = await this.dbPromise;
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(this.options.storeName, 'readonly');
      const store = tx.objectStore(this.options.storeName);
      const request = store.get(tileId);

      request.onsuccess = async () => {
        const record = request.result as IndexedDBTileRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }

        if (version && record.version !== version) {
          resolve(null);
          return;
        }

        const blob = new Blob([record.data]);
        try {
          const bitmap = await createImageBitmap(blob);
          const result: CachedTileRecord = {
            tileId,
            version: record.version,
            bitmap,
            timestamp: Date.now()
          };
          this.memoryCache.set(tileId, result);
          this.ensureCapacity();
          resolve(result);
        } catch (error) {
          logger.warn('Failed to create ImageBitmap from IndexedDB record', error);
          resolve(null);
        }
      };

      request.onerror = () => {
        logger.warn('IndexedDB read error:', request.error);
        resolve(null);
      };
    });
  }

  async set(tileId: string, bitmap: ImageBitmap, options: { version?: string | number; rawData?: ArrayBuffer } = {}) {
    const record: CachedTileRecord = {
      tileId,
      version: options.version,
      bitmap,
      timestamp: Date.now()
    };

    this.memoryCache.set(tileId, record);
    this.ensureCapacity();

    const rawData = options.rawData;
    if (!rawData) {
      return;
    }

    const db = await this.dbPromise;
    if (!db) return;

    await new Promise<void>((resolve) => {
      const tx = db.transaction(this.options.storeName, 'readwrite');
      const store = tx.objectStore(this.options.storeName);
      const data: IndexedDBTileRecord = {
        tileId,
        version: options.version,
        data: rawData,
        updatedAt: Date.now()
      };
      store.put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        logger.warn('IndexedDB write error:', tx.error);
        resolve();
      };
    });
  }

  async invalidate(tileId: string) {
    this.memoryCache.delete(tileId);

    const db = await this.dbPromise;
    if (!db) return;

    await new Promise<void>((resolve) => {
      const tx = db.transaction(this.options.storeName, 'readwrite');
      const store = tx.objectStore(this.options.storeName);
      store.delete(tileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        logger.warn('IndexedDB delete error:', tx.error);
        resolve();
      };
    });
  }

  async clear() {
    this.memoryCache.clear();

    const db = await this.dbPromise;
    if (!db) return;

    await new Promise<void>((resolve) => {
      const tx = db.transaction(this.options.storeName, 'readwrite');
      const store = tx.objectStore(this.options.storeName);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        logger.warn('IndexedDB clear error:', tx.error);
        resolve();
      };
    });
  }

  getMemoryUsage() {
    return this.memoryCache.size;
  }

  async preload(tileIds: string[], versionResolver?: (tileId: string) => string | number | undefined) {
    const tasks = tileIds.map(async (tileId) => {
      const version = versionResolver?.(tileId);
      const cached = await this.get(tileId, version);
      if (cached) return;

      // 预取请求由 TileLayerManager 触发，通过自定义事件通知
      const event = new CustomEvent('tileCache:prefetch', {
        detail: { tileId, version }
      });
      window.dispatchEvent(event);
    });

    await Promise.all(tasks);
  }
}

export default TileCache;
