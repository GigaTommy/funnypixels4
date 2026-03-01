/**
 * Production Sprite Loader
 *
 * Features:
 * - Concurrency queue (max 6-8 parallel requests)
 * - LRU eviction when GPU cache exceeds 2000 icons
 * - Automatic retry with exponential backoff
 * - Memory leak prevention
 */

// 不需要导入maplibregl，我们将使用CDN版本

declare global {
  interface Window {
    maplibregl?: any;
  }
}

// 获取CDN的MapLibre GL
const getMapLibreGL = () => {
  if (typeof window !== 'undefined' && window.maplibregl) {
    return window.maplibregl;
  }
  throw new Error('MapLibre GL not loaded from CDN');
};

interface SpriteQueueItem {
  key: string;
  type: 'emoji' | 'complex';
  priority: number;
  retries: number;
}

interface LRUNode {
  key: string;
  prev: LRUNode | null;
  next: LRUNode | null;
}

// Template URL for sprites (optional override)
const TEMPLATE_URL = import.meta.env.VITE_SPRITE_URL || null;

export class SpriteLoader {
  private map: any;
  private baseUrl: string;
  private scale: number;

  // Concurrency control
  private queue: SpriteQueueItem[] = [];
  private activeRequests = 0;
  private readonly maxConcurrency = 8;

  // LRU cache tracking
  private loadedSprites = new Map<string, LRUNode>();
  private lruHead: LRUNode | null = null;
  private lruTail: LRUNode | null = null;
  private readonly maxCacheSize = 2000;

  // Deduplication
  private pendingKeys = new Set<string>();

  // Fallback tracking
  private failedSprites = new Map<string, number>(); // retry count
  private blockedUntil = new Map<string, number>(); // ms timestamp

  // Placeholder tracking
  private placeholders = new Set<string>();

  constructor(map: any, baseUrl: string) {
    this.map = map;
    this.baseUrl = baseUrl;
    // Use more precise scale for better quality
    const pixelRatio = window.devicePixelRatio || 1;
    this.scale = pixelRatio >= 3 ? 3 : (pixelRatio >= 2 ? 2 : 1);
  }

  /**
   * Get sprite URL based on template or fallback
   */
  private getSpriteUrl(key: string, type: 'emoji' | 'complex'): string {
    // Backend expects scale as number (1, 2, 3) not "1x", "2x", etc.
    const scaleNum = this.scale.toString();

    // Use template if available
    if (TEMPLATE_URL) {
      return TEMPLATE_URL
        .replace('{scale}', scaleNum)
        .replace('{type}', type)
        .replace('{key}', encodeURIComponent(key));
    }

    // Fallback to hardcoded path
    return `${this.baseUrl}/api/sprites/icon/${scaleNum}/${type}/${encodeURIComponent(key)}.png`;
  }

  /**
   * Load sprite from direct URL (for user avatars)
   * Returns a Promise that resolves when the sprite is loaded
   */
  async loadSpriteFromUrl(key: string, imageUrl: string, priority = 0): Promise<void> {
    // Skip if already loaded (but not if it's just a placeholder)
    if (this.map.hasImage(key) && !this.placeholders.has(key)) {
      return Promise.resolve();
    }

    // Add an empty placeholder immediately
    if (!this.map.hasImage(key)) {
      const placeholder = new ImageData(1, 1); // 1x1 transparent pixel
      this.map.addImage(key, placeholder, {
        sdf: false,
        pixelRatio: 1
      });
      this.placeholders.add(key);
      console.debug(`[SPRITE_PLACEHOLDER] Added placeholder for user avatar: ${key}`);
    }

    // If pending, create a waiter
    if (this.pendingKeys.has(key)) {
      return new Promise((resolve) => {
        const checkLoaded = () => {
          if (this.map.hasImage(key) && !this.placeholders.has(key)) {
            resolve();
          } else {
            setTimeout(checkLoaded, 50);
          }
        };
        checkLoaded();
      });
    }

    this.pendingKeys.add(key);

    try {
      console.debug(`[SPRITE_URL_LOAD] Loading user avatar from URL: ${imageUrl}`);

      // Load image directly from URL
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            // Remove existing if present
            if (this.map.hasImage(key)) {
              this.map.removeImage(key);
            }

            // Add the new image
            this.map.addImage(key, img, {
              sdf: false,
              pixelRatio: this.scale
            });

            // Remove from placeholders set
            this.placeholders.delete(key);

            // Track in LRU
            this.addToLRU(key);

            // Evict if cache is full
            if (this.loadedSprites.size > this.maxCacheSize) {
              this.evictLRU();
            }

            // Trigger a re-render
            this.map.triggerRepaint();

            console.log(`✅ User avatar sprite loaded from URL: ${key}`);
            resolve();
          } catch (error) {
            console.error(`[SPRITE_URL_ERR] Failed to add user avatar sprite: ${key}`, error);
            reject(error);
          }
        };

        img.onerror = (error) => {
          console.error(`[SPRITE_URL_ERR] Failed to load user avatar from URL: ${imageUrl}`, error);
          // 🔧 降级到绿色方块
          if (this.map.hasImage(key)) {
            this.map.removeImage(key);
          }
          const fallbackSquare = new ImageData(16, 16);
          const greenColor = { r: 78, g: 205, b: 196, a: 255 }; // #4ECDC4
          for (let i = 0; i < 16 * 16 * 4; i += 4) {
            fallbackSquare.data[i] = greenColor.r;
            fallbackSquare.data[i + 1] = greenColor.g;
            fallbackSquare.data[i + 2] = greenColor.b;
            fallbackSquare.data[i + 3] = greenColor.a;
          }
          this.map.addImage(key, fallbackSquare, { sdf: false, pixelRatio: 1 });
          this.placeholders.delete(key);
          console.log(`🔧 User avatar fallback to green square: ${key}`);
          reject(error);
        };

        img.src = imageUrl;
      });
    } finally {
      this.pendingKeys.delete(key);
    }
  }

  /**
   * Load sprite (queued, with deduplication)
   * Returns a Promise that resolves when the sprite is loaded
   */
  async loadSprite(key: string, type: 'emoji' | 'complex' = 'emoji', priority = 0): Promise<void> {
    // Skip if already loaded (but not if it's just a placeholder)
    if (this.map.hasImage(key) && !this.placeholders.has(key)) {
      return Promise.resolve();
    }

    // Add an empty placeholder immediately to prevent MapLibre errors
    // This will be replaced once the actual sprite loads
    if (!this.map.hasImage(key)) {
      const placeholder = new ImageData(1, 1); // 1x1 transparent pixel
      this.map.addImage(key, placeholder, {
        sdf: false,
        pixelRatio: 1
      });
      this.placeholders.add(key);
      console.debug(`[SPRITE_PLACEHOLDER] Added placeholder for ${key}`);
    }

    // If pending, create a waiter
    if (this.pendingKeys.has(key)) {
      return new Promise((resolve) => {
        const checkLoaded = () => {
          if (this.map.hasImage(key) && !this.placeholders.has(key)) {
            resolve();
          } else {
            setTimeout(checkLoaded, 50);
          }
        };
        checkLoaded();
      });
    }

    this.pendingKeys.add(key);

    // Create a promise that resolves when the sprite is loaded
    const loadPromise = new Promise<void>((resolve, reject) => {
      const item = { key, type, priority, retries: 0 };

      // Store resolve/reject handlers
      (item as any)._resolve = resolve;
      (item as any)._reject = reject;

      this.queue.push(item);
      this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first

      this.processQueue();
    });

    return loadPromise;
  }

  /**
   * Process sprite queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrency) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeRequests++;

      this.fetchAndAddSprite(item)
        .finally(() => {
          this.activeRequests--;
          this.pendingKeys.delete(item.key);
          this.processQueue(); // Process next item
        });
    }
  }

  /**
   * Fetch sprite and add to map (with detailed logging)
   */
  private async fetchAndAddSprite(item: SpriteQueueItem): Promise<void> {
    const { key, type, retries } = item;
    const resolve = (item as any)._resolve;
    const reject = (item as any)._reject;

    // Check if sprite is temporarily blocked
    const now = Date.now();
    const blockedUntil = this.blockedUntil.get(key) || 0;
    if (blockedUntil > now) {
      console.debug(`[SPRITE_BLOCKED] ${key} blocked for ${Math.ceil((blockedUntil - now) / 1000)}s`);
      if (resolve) resolve(); // Resolve silently, don't block the queue
      return;
    }

    const start = performance.now();
    const url = this.getSpriteUrl(key, type);
    console.debug('[SPRITE_REQ_START]', { key: item.key, type, url, retries });

    try {
      const ac = new AbortController();
      const timeout = setTimeout(() => {
        ac.abort();
        console.debug('[SPRITE_REQ_TIMEOUT]', { key: item.key, url, dt: performance.now() - start });
      }, 5500);

      // 准备请求头
      const headers: Record<string, string> = {
        'Accept': 'image/png,*/*;q=0.8'
      };

      // 添加游客ID（如果存在）
      const guestId = localStorage.getItem('funnypixels_guest_id');
      if (guestId) {
        headers['x-guest-id'] = guestId;
      }

      const resp = await fetch(url, {
        signal: ac.signal,
        credentials: 'include',
        mode: 'cors',
        headers
      });

      clearTimeout(timeout);
      console.debug('[SPRITE_RESP]', {
        url,
        status: resp.status,
        headers: Object.fromEntries(resp.headers.entries()),
        dt: performance.now() - start
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const isFallback = resp.headers.get('X-Sprite-Fallback') === 'true';
      const buf = await resp.arrayBuffer();
      console.debug('[SPRITE_BUF]', { url, bytes: buf.byteLength, dt: performance.now() - start });

      if (buf.byteLength === 0) {
        throw new Error('Empty response buffer');
      }

      // Try createImageBitmap first
      try {
        const bmp = await createImageBitmap(new Blob([buf], { type: 'image/png' }));
        console.debug('[SPRITE_BMP_OK]', { url, dt: performance.now() - start });

        // Always update the image, even if it exists
        // First remove if it exists to avoid conflicts
        if (this.map.hasImage(key)) {
          this.map.removeImage(key);
        }

        // Add the new image
        this.map.addImage(key, bmp, {
          sdf: false,
          pixelRatio: this.scale
        });
        console.debug('[SPRITE_ADD_OK]', { key: item.key, url });

        // Remove from placeholders set
        this.placeholders.delete(key);

        if (isFallback) {
          console.log(`🔄 Sprite served by fallback: ${key}`);
          this.failedSprites.set(key, 0); // Reset retry count
        } else {
          console.log(`✅ Sprite loaded and added: ${key}`);
        }

        // Track in LRU
        this.addToLRU(key);

        // Evict if cache is full
        if (this.loadedSprites.size > this.maxCacheSize) {
          this.evictLRU();
        }

        // Trigger a re-render since we've updated the sprite
        this.map.triggerRepaint();
      } catch (bmpError) {
        console.warn('[SPRITE_BMP_FAIL]', { url, error: bmpError.message });

        // Fallback to Image element
        console.debug('[SPRITE_IMG_FALLBACK]', { url });
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise<void>((imgResolve, imgReject) => {
          img.onload = () => {
            try {
              // Always update the image
              if (this.map.hasImage(key)) {
                this.map.removeImage(key);
              }

              this.map.addImage(key, img, {
                sdf: false,
                pixelRatio: this.scale
              });
              console.debug('[SPRITE_IMG_OK]', { key: item.key, url });

              // Remove from placeholders set
              this.placeholders.delete(key);

              // Trigger a re-render
              this.map.triggerRepaint();

              imgResolve();
            } catch (addError) {
              imgReject(addError);
            }
          };

          img.onerror = (imgErr) => {
            console.warn('[SPRITE_IMG_ERR]', { url, error: imgErr });
            imgReject(new Error(`Image element failed: ${imgErr}`));
          };

          img.src = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
        });
      }

      // Resolve the outer promise
      if (resolve) resolve();

    } catch (error) {
      console.warn('[SPRITE_ERR]', { url, error: error.message, dt: performance.now() - start });

      // Update failure count
      const currentFailures = (this.failedSprites.get(key) || 0) + 1;
      this.failedSprites.set(key, currentFailures);

      // Block sprite after multiple failures
      if (currentFailures >= 2) {
        this.blockedUntil.set(key, Date.now() + 5 * 60 * 1000); // 5 minutes
        console.warn(`[SPRITE_BLOCKED] ${key} blocked for 5 minutes due to repeated failures`);

        // For complex sprites, try emoji fallback as last resort
        if (type === 'complex') {
          const emojiFallback = this.getEmojiFallback(key);
          console.log(`[SPRITE_EMOJI_FALLBACK] ${key} -> ${emojiFallback}`);
          await this.loadSprite(emojiFallback, 'emoji', item.priority);
        }
      }

      // Retry with exponential backoff
      if (retries < 3) {
        const delay = Math.pow(2, retries) * 1000; // 1s, 2s, 4s
        console.debug(`[SPRITE_RETRY] ${key} retry ${retries + 1}/3 in ${delay}ms`);
        setTimeout(() => {
          item.retries++;
          this.queue.unshift(item); // Retry at front of queue
          this.processQueue();
        }, delay);
      } else {
        console.error(`[SPRITE_MAX_RETRIES] ${key} max retries reached`);
        // Max retries reached, reject the promise
        if (reject) reject(error);
      }
    }
  }

  /**
   * Get emoji fallback for complex sprites
   */
  private getEmojiFallback(key: string): string {
    const fallbackMap: Record<string, string> = {
      office: '🏢',
      swimming_pool: '🏊',
      gate: '🚪',
      lift_gate: '🚧',
      sports_centre: '⚽',
      ferry_terminal: '⛴️',
      hospital: '🏥',
      school: '🏫',
      shop: '🛍️',
      restaurant: '🍽️',
      parking: '🅿️',
      pharmacy: '💊',
      bank: '🏦',
      fuel: '⛽',
      hotel: '🏨',
      library: '📚'
    };
    return fallbackMap[key] || '📍';
  }

  /**
   * Add sprite to LRU (mark as recently used)
   */
  private addToLRU(key: string): void {
    // Remove existing node if present
    if (this.loadedSprites.has(key)) {
      this.removeFromLRU(key);
    }

    // Create new node
    const node: LRUNode = { key, prev: null, next: this.lruHead };

    if (this.lruHead) {
      this.lruHead.prev = node;
    }

    this.lruHead = node;

    if (!this.lruTail) {
      this.lruTail = node;
    }

    this.loadedSprites.set(key, node);
  }

  /**
   * Remove sprite from LRU tracking
   */
  private removeFromLRU(key: string): void {
    const node = this.loadedSprites.get(key);
    if (!node) return;

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.lruHead = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.lruTail = node.prev;
    }

    this.loadedSprites.delete(key);
  }

  /**
   * Evict least recently used sprite from GPU memory
   */
  private evictLRU(): void {
    if (!this.lruTail) return;

    const key = this.lruTail.key;

    if (this.map.hasImage(key)) {
      this.map.removeImage(key);
      console.debug(`🗑️ Evicted sprite from GPU: ${key}`);
    }

    this.removeFromLRU(key);
  }

  /**
   * Touch sprite (mark as recently used, prevent eviction)
   */
  touchSprite(key: string): void {
    if (this.loadedSprites.has(key)) {
      this.addToLRU(key); // Move to head
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      loaded: this.loadedSprites.size,
      maxSize: this.maxCacheSize,
      queueLength: this.queue.length,
      activeRequests: this.activeRequests
    };
  }

  /**
   * Clear all sprites and queue
   */
  destroy(): void {
    this.queue = [];
    this.pendingKeys.clear();
    this.failedSprites.clear();
    this.blockedUntil.clear();

    for (const key of this.loadedSprites.keys()) {
      if (this.map.hasImage(key)) {
        this.map.removeImage(key);
      }
    }

    this.loadedSprites.clear();
    this.lruHead = null;
    this.lruTail = null;
  }
}
