// 简化的缓存实现，后续可扩展为IndexedDB
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { emojiFontLoader } from '../services/emojiFontLoader';

declare global {
  interface Window {
    patternCache?: PatternCache;
  }
}

// 图案数据结构
export interface PatternData {
  id: string;
  key: string;
  name?: string;
  width: number;
  height: number;
  encoding: 'rle' | 'png_base64' | 'color_hex' | 'color' | 'emoji';
  payload: string;
  verified: boolean;
  hash?: string;
  bitmap?: ImageBitmap | Uint32Array;
  render_type?: 'color' | 'emoji' | 'complex';
  color?: string;
  unicode_char?: string;
  category?: string;
  // CDN相关字段
  file_url?: string;
  file_path?: string;
  file_hash?: string;
  file_size?: number;
  // Material系统字段
  material_id?: string | null;
  material_version?: string | null;
  material_metadata?: any;
}

// 图案清单项
export interface PatternManifest {
  id: string;
  key: string;
  width: number;
  height: number;
  encoding: 'rle' | 'png_base64';
  verified: boolean;
  hash: string;
}

// 简化的LRU缓存
class LRUCache {
  private capacity: number;
  private cache = new Map<string, PatternData>();

  constructor(capacity: number = 100) {
    this.capacity = capacity;
  }

  get(key: string): PatternData | undefined {
    const value = this.cache.get(key);
    if (value) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  put(key: string, value: PatternData): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// 图案缓存管理器
export class PatternCache {
  private memoryCache: LRUCache;
  private loadingPatterns = new Set<string>();
  private failedUrls = new Set<string>(); // 记录CDN加载失败的URL，避免重复尝试

  constructor() {
    this.memoryCache = new LRUCache(100);
  }

  async getPatternById(id: string): Promise<PatternData | null> {
    return this.getPattern(id);
  }

  // 获取图案清单
  async getManifest(): Promise<PatternManifest[]> {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/patterns/manifest`);
      if (!response.ok) throw new Error('Failed to fetch manifest');
      return await response.json();
    } catch (error) {
      logger.error('Failed to fetch pattern manifest:', error);
      return [];
    }
  }

  // 获取图案数据
  async getPattern(id: string): Promise<PatternData | null> {
    // 检查内存缓存
    const cached = this.memoryCache.get(id);
    if (cached) {
      try {
        // 若为emoji并带有description（font_version），预热字体
        if ((cached as any).encoding === 'emoji' && (cached as any).description) {
          emojiFontLoader.ensure((cached as any).description);
        }
      } catch {}
      return cached;
    }

    // 检查是否正在加载
    if (this.loadingPatterns.has(id)) {
      return null; // 避免重复加载
    }

    // 开始加载
    this.loadingPatterns.add(id);
    try {
      const pattern = await this.fetchPatternFromAPI(id);
      if (pattern) {
        try {
          await this.decodePattern(pattern);
          this.memoryCache.put(id, pattern);

          // 预热emoji字体
          if ((pattern as any).encoding === 'emoji' && (pattern as any).description) {
            emojiFontLoader.ensure((pattern as any).description);
          }
        } catch (decodeError) {
          // 解码失败，但仍然返回部分解码的pattern
          logger.error(`Pattern decode failed for ${id}, but returning partially decoded pattern:`, decodeError);
          this.memoryCache.put(id, pattern);
          return pattern;
        }
      }
      return pattern;
    } catch (fetchError) {
      logger.warn(`Pattern fetch failed for ${id}:`, fetchError);
      return null;
    } finally {
      this.loadingPatterns.delete(id);
    }
  }

  // 从API获取图案
  private async fetchPatternFromAPI(id: string): Promise<PatternData | null> {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/patterns/${encodeURIComponent(id)}`);
      if (!response.ok) {
        // 如果是404错误，记录为警告而不是错误，因为可能是正常的API缺失
        if (response.status === 404) {
          logger.warn(`Pattern not found: ${id} (404) - this is expected for flag patterns`);
        } else {
          logger.error(`Failed to fetch pattern ${id}: HTTP ${response.status}`);
        }
        throw new Error(`Failed to fetch pattern: HTTP ${response.status}`);
      }

      const apiResponse = await response.json();

      // 处理API返回的数据结构
      if (apiResponse.success && apiResponse.data) {
        const apiData = apiResponse.data;

        // 调试日志：记录API响应结构
        logger.info(`Pattern API response for ${id}:`, {
          apiDataKeys: Object.keys(apiData),
          hasData: 'data' in apiData,
          hasPayload: 'payload' in apiData,
          renderType: apiData.render_type,
          encoding: apiData.encoding
        });

        // 转换为PatternData格式
        const patternData: PatternData = {
          id: String(apiData.id || id), // 确保id始终是字符串类型
          key: apiData.key || id,
          name: apiData.name,
          width: apiData.width || 16,
          height: apiData.height || 16,
          encoding: apiData.encoding || 'png_base64',
          payload: apiData.data || apiData.payload || '',
          verified: apiData.verified || true,
          hash: apiData.hash,
          render_type: apiData.render_type,
          color: apiData.color,
          unicode_char: apiData.unicode_char,
          category: apiData.category,
          // Material系统字段
          material_id: apiData.material_id || null,
          material_version: apiData.material_version || null,
          material_metadata: apiData.material_metadata || null
        };

        // 调试日志：记录转换后的pattern数据
        logger.info(`Converted pattern data for ${String(id)}:`, {
          payloadType: typeof patternData.payload,
          payloadSample: typeof patternData.payload === 'string'
            ? patternData.payload.substring(0, 50) + '...'
            : JSON.stringify(patternData.payload).substring(0, 100) + '...',
          renderType: patternData.render_type,
          encoding: patternData.encoding,
          patternId: patternData.id,
          patternIdType: typeof patternData.id
        });

        return patternData;
      }

      return null;
    } catch (error) {
      // 只在非404错误时记录为错误
      if (!(error as Error).message.includes('404')) {
        logger.error('Failed to fetch pattern:', error);
      }
      return null;
    }
  }

  // 解码图案数据
  private async decodePattern(pattern: PatternData): Promise<void> {
    if (pattern.bitmap) return;

    // 特别关注杭州西湖樱花的图案
    const patternIdStr = String(pattern.id || ''); // 确保转换为字符串
    const isSakuraPattern = patternIdStr.includes('sakura') || patternIdStr.includes('西湖') || patternIdStr.includes('hangzhou');
    if (isSakuraPattern) {
      logger.info(`🌸 解码樱花图案 ${patternIdStr}:`, {
        encoding: pattern.encoding,
        render_type: pattern.render_type,
        payloadType: typeof pattern.payload,
        payload: pattern.payload,
        unicode_char: pattern.unicode_char
      });
    }

    try {
      // 🎯 优先根据render_type处理，而不是encoding
      const renderType = pattern.render_type || 'color';

      switch (renderType) {
        case 'emoji':
          // emoji类型：直接使用unicode_char，不受encoding影响
          if (!pattern.unicode_char && this.isEmojiPayload(pattern.payload)) {
            logger.info(`emoji图案缺少unicode_char，使用payload: ${pattern.id}`);
            pattern.unicode_char = pattern.payload;
          }
          return; // emoji处理完成，直接返回

        case 'color':
          // 颜色类型：使用color字段
          if (!pattern.color && this.isColorPayload(pattern.payload)) {
            pattern.color = pattern.payload;
          }
          return; // color处理完成，直接返回

        case 'complex':
          // 三级降级策略：CDN → payload → 占位符
          logger.info(`解码复杂图案: ${pattern.id}`, {
            hasFileUrl: !!pattern.file_url,
            hasPayload: !!pattern.payload,
            fileSize: pattern.file_size
          });

          // 第1级：尝试从CDN加载高清图像
          if (pattern.file_url && !this.failedUrls.has(pattern.file_url)) {
            try {
              logger.info(`🚀 尝试从CDN加载高清图像: ${pattern.id}`, { url: pattern.file_url });
              pattern.bitmap = await this.loadImageFromUrl(pattern.file_url);
              logger.info(`✅ CDN图像加载成功: ${pattern.id}`);
              return; // 成功，直接返回
            } catch (cdnError) {
              logger.warn(`⚠️ CDN图像加载失败，降级到payload: ${pattern.id}`, cdnError);
              this.failedUrls.add(pattern.file_url);
            }
          }

          // 第2级：降级到payload解码（缩略图）
          if (pattern.payload) {
            try {
              logger.info(`📦 使用payload解码缩略图: ${pattern.id}`);

              if (pattern.encoding === 'rle') {
                // 检查payload是否为纯色（误标为rle的情况）
                if (this.isColorPayload(pattern.payload)) {
                  logger.info(`Correcting mislabeled complex pattern ${pattern.id} to color`);
                  pattern.encoding = 'color_hex';
                  pattern.color = pattern.payload;
                  return;
                }

                // 检查payload是否为emoji（误标为complex的emoji）
                if (this.isEmojiPayload(pattern.payload)) {
                  logger.info(`Correcting mislabeled complex pattern ${pattern.id} to emoji`);
                  pattern.encoding = 'emoji';
                  pattern.unicode_char = pattern.payload;
                  return;
                }

                pattern.bitmap = this.decodeRLE(pattern.payload, pattern.width, pattern.height);
                logger.info(`✅ Payload RLE解码成功: ${pattern.id}`);
                return; // 成功，直接返回
              } else if (pattern.encoding === 'png_base64') {
                pattern.bitmap = await this.decodePNGBase64(pattern.payload);
                logger.info(`✅ Payload PNG解码成功: ${pattern.id}`);
                return; // 成功，直接返回
              }
            } catch (payloadError) {
              logger.error(`❌ Payload解码失败，使用占位符: ${pattern.id}`, payloadError);
            }
          }

          // 第3级：最终降级为占位符
          logger.warn(`🚨 复杂图案完全加载失败，使用占位符: ${pattern.id}`);
          pattern.encoding = 'color_hex';
          pattern.color = '#4ECDC4'; // 绿色占位符（统一 fallback 颜色）
          break;

        default:
          logger.warn(`未知的render_type: ${renderType}, pattern: ${pattern.id}, encoding: ${pattern.encoding}`);
          // 根据encoding决定如何处理
          if (pattern.encoding === 'rle') {
            // 检查payload是否为纯色（误标为rle的情况）
            if (this.isColorPayload(pattern.payload)) {
              logger.info(`Correcting default pattern ${pattern.id} to color`);
              pattern.encoding = 'color_hex';
              pattern.color = pattern.payload;
              return;
            }
            // 检查payload是否为emoji（误标为rle的emoji）
            if (this.isEmojiPayload(pattern.payload)) {
              logger.info(`Correcting default pattern ${pattern.id} to emoji`);
              pattern.encoding = 'emoji';
              pattern.unicode_char = pattern.payload;
              return;
            }
            // 尝试解码RLE
            pattern.bitmap = this.decodeRLE(pattern.payload, pattern.width, pattern.height);
          } else if (pattern.encoding === 'png_base64') {
            // 尝试解码PNG Base64
            pattern.bitmap = await this.decodePNGBase64(pattern.payload);
          } else if (this.isColorPayload(pattern.payload)) {
            // 如果payload是颜色值，降级为颜色
            pattern.encoding = 'color_hex';
            pattern.color = pattern.payload;
          } else if (this.isEmojiPayload(pattern.payload)) {
            // 如果payload是emoji，降级为emoji
            pattern.encoding = 'emoji';
            pattern.unicode_char = pattern.payload;
          } else {
            // 最后的降级：使用默认颜色
            logger.warn(`Cannot determine pattern type for ${pattern.id}, using default color`);
            pattern.encoding = 'color_hex';
            pattern.color = '#FF0000';
          }
          break;
      }

      if (isSakuraPattern) {
        logger.info(`🌸 樱花图案解码完成:`, {
          encoding: pattern.encoding,
          render_type: pattern.render_type,
          unicode_char: pattern.unicode_char,
          hasBitmap: !!pattern.bitmap
        });
      }
    } catch (error) {
      logger.error('Failed to decode pattern:', {
        patternId: pattern.id,
        encoding: pattern.encoding,
        payloadType: typeof pattern.payload,
        payload: pattern.payload,
        error: error
      });

      // 解码失败时的降级策略
      this.fallbackDecode(pattern);
    }
  }

  // 检查是否为颜色payload
  private isColorPayload(payload: any): boolean {
    return payload &&
           typeof payload === 'string' &&
           payload.startsWith &&
           payload.startsWith('#') &&
           payload.length >= 7;
  }

  // 检查是否为emoji payload
  private isEmojiPayload(payload: any): boolean {
    if (!payload || typeof payload !== 'string') return false;

    // 测试特定的emoji - 调试用
    if (payload === '🌸') {
      logger.info('🌸 检测到樱花emoji payload');
      return true;
    }

    // 简单的emoji检测 - 大多数emoji是2个字符（代理对）
    const isEmoji = payload.length >= 2 && /\p{Emoji}/u.test(payload);

    // 如果检测到emoji，记录日志
    if (isEmoji && (payload.includes('🌸') || payload.includes('樱花'))) {
      logger.info(`检测到樱花相关emoji: ${payload}`);
    }

    return isEmoji;
  }

  // 降级解码策略
  private fallbackDecode(pattern: PatternData): void {
    const payload = pattern.payload;

    // 尝试降级为颜色
    if (this.isColorPayload(payload)) {
      logger.warn(`Fallback: Converting pattern ${pattern.id} to color due to decode failure`);
      pattern.encoding = 'color_hex';
      pattern.color = payload;
      return;
    }

    // 尝试降级为emoji
    if (this.isEmojiPayload(payload)) {
      logger.warn(`Fallback: Converting pattern ${pattern.id} to emoji due to decode failure`);
      pattern.encoding = 'emoji';
      pattern.unicode_char = payload;
      return;
    }

    // 最后的降级：使用默认颜色
    logger.error(`All decode attempts failed for pattern ${pattern.id}, using default color`);
    pattern.encoding = 'color_hex';
    pattern.color = '#808080'; // 默认灰色
  }

  // 解码RLE数据
  private decodeRLE(payload: string, width: number, height: number): Uint32Array {
    let data;

    try {
      // 处理payload可能是对象或字符串的情况
      if (typeof payload === 'string') {
        // 如果是字符串，尝试解析为JSON
        data = JSON.parse(payload);
      } else if (typeof payload === 'object') {
        // 如果已经是对象，直接使用
        data = payload;
      } else {
        throw new Error(`Invalid payload type: ${typeof payload}`);
      }
    } catch (error) {
      logger.error('Failed to parse RLE payload:', {
        payloadType: typeof payload,
        payload: payload,
        error: error
      });
      throw new Error(`Invalid RLE payload: ${error}`);
    }

    // 验证数据结构
    if (!Array.isArray(data)) {
      throw new Error('RLE data must be an array');
    }

    const bitmap = new Uint32Array(width * height);
    let index = 0;

    for (const run of data) {
      // 验证run结构
      if (!run || typeof run !== 'object' || !run.color || typeof run.count !== 'number') {
        logger.warn('Invalid RLE run structure:', run);
        continue;
      }

      const color = this.parseColor(run.color);
      for (let i = 0; i < run.count; i++) {
        if (index < bitmap.length) {
          bitmap[index++] = color;
        }
      }
    }

    return bitmap;
  }

  // 解码PNG base64数据
  private async decodePNGBase64(payload: string): Promise<ImageBitmap> {
    // 处理data URL格式的payload
    let base64Data = payload;
    if (payload.startsWith('data:')) {
      const base64Index = payload.indexOf('base64,');
      if (base64Index !== -1) {
        base64Data = payload.substring(base64Index + 7); // 'base64,'.length = 7
      }
    }

    const blob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], {
      type: 'image/png'
    });
    return createImageBitmap(blob);
  }

  // 从CDN URL加载图像
  private async loadImageFromUrl(url: string): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          // 将Image元素转换为ImageBitmap
          createImageBitmap(img).then(bitmap => {
            resolve(bitmap);
          }).catch(error => {
            logger.error(`创建ImageBitmap失败: ${url}`, error);
            reject(error);
          });
        } catch (error) {
          logger.error(`图像处理失败: ${url}`, error);
          reject(error);
        }
      };

      img.onerror = (error) => {
        logger.error(`图像加载失败: ${url}`, error);
        reject(new Error(`Failed to load image from CDN: ${url}`));
      };

      // 设置跨域属性
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  // 解析颜色字符串为Uint32
  private parseColor(colorStr: string): number {
    const hex = colorStr.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (255 << 24) | (r << 16) | (g << 8) | b;
  }

  // 预加载常用图案
  async preloadCommonPatterns(): Promise<void> {
    const manifest = await this.getManifest();
    const commonPatterns = manifest.filter(p => p.verified).slice(0, 20);
    
    const loadPromises = commonPatterns.map(pattern => 
      this.getPattern(pattern.id).catch(() => null)
    );
    
    await Promise.all(loadPromises);
  }

  // 清理缓存
  clearCache(): void {
    this.memoryCache.clear();
    this.failedUrls.clear(); // 同时清除失败的CDN URL记录
    logger.info('🧹 图案缓存和CDN失败URL记录已清空');
  }

  // 重试CDN加载（清除指定URL的失败记录）
  retryCdnUrl(url: string): void {
    if (this.failedUrls.has(url)) {
      this.failedUrls.delete(url);
      logger.info(`🔄 已清除CDN URL失败记录，准备重试: ${url}`);
    }
  }

  // 重试所有CDN URL
  retryAllCdnUrls(): void {
    const failedCount = this.failedUrls.size;
    if (failedCount > 0) {
      this.failedUrls.clear();
      logger.info(`🔄 已清除所有CDN URL失败记录 (${failedCount}个)，准备重试`);
    }
  }

  // 获取缓存统计
  getCacheStats(): { memory: number } {
    return {
      memory: this.memoryCache.size()
    };
  }
}

// 全局图案缓存实例
export const patternCache = new PatternCache();

if (typeof window !== 'undefined') {
  window.patternCache = patternCache;
}
