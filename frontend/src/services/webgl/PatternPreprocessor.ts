/**
 * Pattern预处理器
 * 将color/emoji/complex三种类型的pattern转换为纹理
 */

import { logger } from '../../utils/logger';
import { UnifiedTextureAtlas } from './UnifiedTextureAtlas';
import { materialLoaderService } from '../materialLoaderService';

export interface PatternAsset {
  id: string;
  key: string;
  name?: string;
  render_type: 'color' | 'emoji' | 'complex';
  color?: string;
  unicode_char?: string;
  material_id?: string;
  encoding?: string;
  payload?: string;
  width?: number;
  height?: number;
}

export class PatternPreprocessor {
  private textureAtlas: UnifiedTextureAtlas;
  private processedPatterns: Set<string> = new Set();

  constructor(textureAtlas: UnifiedTextureAtlas) {
    this.textureAtlas = textureAtlas;
  }

  /**
   * 预处理所有patterns
   */
  async preprocessPatterns(patterns: PatternAsset[]): Promise<number> {
    logger.info(`🔄 开始预处理 ${patterns.length} 个patterns...`);

    let successCount = 0;

    for (const pattern of patterns) {
      try {
        await this.preprocessPattern(pattern);
        successCount++;
      } catch (error) {
        logger.error(`❌ 预处理pattern ${pattern.key} 失败:`, error);
      }
    }

    logger.info(
      `✅ 预处理完成: ${successCount}/${patterns.length} 成功, ` +
      `${patterns.length - successCount} 失败`
    );

    return successCount;
  }

  /**
   * 预处理单个pattern
   * 策略：
   * - Emoji: 🆕 跳过预处理，由 EmojiAtlasLoader 直接处理（彩色 emoji）
   * - Color: 通用类型（可替换）
   * - Complex: CDN类型（永久保留）
   */
  async preprocessPattern(pattern: PatternAsset): Promise<void> {
    // 检查是否已处理
    if (this.processedPatterns.has(pattern.key)) {
      logger.debug(`⏭️ Pattern ${pattern.key} 已处理，跳过`);
      return;
    }

    const { render_type } = pattern;

    try {
      // 🆕 Emoji 类型跳过预处理，由 EmojiAtlasLoader 直接处理
      if (render_type === 'emoji') {
        logger.debug(`⏭️ Emoji pattern ${pattern.key} 跳过预处理，将使用 Emoji Atlas`);
        this.processedPatterns.add(pattern.key);
        return;
      }

      // 策略分类：Color vs Complex
      if (render_type === 'complex') {
        // CDN类型：Material API加载，永久保留
        await this.loadComplexPattern(pattern);
      } else if (render_type === 'color') {
        // Color类型：按需生成，可替换
        await this.generateUniversalTexture(pattern);
      } else {
        // 处理无效的render_type，当作color类型处理并使用默认颜色
        logger.warn(`⚠️ 无效的render_type: ${render_type}, pattern: ${pattern.key}, 当作color处理`);
        const fallbackPattern: PatternAsset = {
          ...pattern,
          render_type: 'color' as const,
          color: pattern.color || '#ffffff' // 使用原有颜色或默认白色
        };
        await this.generateUniversalTexture(fallbackPattern);
      }

      this.processedPatterns.add(pattern.key);
    } catch (error) {
      logger.error(`❌ Pattern ${pattern.key} 预处理失败:`, error);
      throw error;
    }
  }

  /**
   * 生成Color纹理（通用类型）
   * 特点：按需生成，可被LRU替换
   * 🆕 注意：Emoji 已经不再由此方法处理，改用 EmojiAtlasLoader
   */
  private async generateUniversalTexture(pattern: PatternAsset): Promise<void> {
    const { key, render_type, color } = pattern;

    if (render_type !== 'color') {
      throw new Error(`generateUniversalTexture 只处理 color 类型，收到: ${render_type}`);
    }

    // 创建Canvas纹理（只处理color）
    const canvas = this.createColorCanvas(color!);

    // 添加到纹理图集（标记为可替换）
    const added = this.textureAtlas.addTexture(key, canvas, {
      replaceable: true
    });

    if (!added) {
      throw new Error(`纹理图集已满，无法添加: ${key}`);
    }

    logger.debug(`✅ Color纹理生成: ${key}`);
  }

  // 🆕 createPatternCanvas 方法已移除，emoji 不再通过 Canvas 渲染
  // 现在 emoji 由 EmojiAtlasLoader 直接从预渲染的 Emoji Atlas 加载

  /**
   * 创建Color Canvas（1x1纯色）
   */
  private createColorCanvas(color: string): HTMLCanvasElement {
    if (!color) {
      throw new Error('Color pattern缺少color属性');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建2D上下文');
    }

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);

    return canvas;
  }

  /**
   * 🆕 createEmojiCanvas 方法已废弃
   * Emoji 现在通过 EmojiAtlasLoader 从预渲染的 4096×4096 Emoji Atlas 加载
   * 优势：
   * - 彩色 emoji（不再是灰色）
   * - 高性能（预渲染，GPU 采样）
   * - 一致性（所有平台显示相同）
   * - 支持 1366+ emoji
   */
  // private createEmojiCanvas() - 已废弃，使用 EmojiAtlasLoader 替代

  /**
   * 加载Complex类型（CDN类型）
   * 特点：Material API加载，永久保留
   */
  private async loadComplexPattern(pattern: PatternAsset): Promise<void> {
    const { key, material_id, encoding, payload } = pattern;

    logger.info(`🔍 开始加载Complex pattern: ${key}, material_id: ${material_id}`);

    let imageSource: HTMLImageElement;

    // 优先使用Material API/CDN（联盟旗帜性能最优方案）
    if (material_id) {
      try {
        logger.info(`🔍 尝试从Material系统加载: ${material_id}`);
        imageSource = await this.loadFromMaterialSystem(material_id);
        logger.info(`✅ Material加载成功: ${key}`);
      } catch (error) {
        logger.warn(`⚠️ Material加载失败，尝试降级到payload: ${key}`, error);

        // 降级：使用payload
        if (payload && (encoding === 'png_base64' || encoding === 'base64')) {
          logger.info(`🔍 尝试从Base64 payload加载: ${key}`);
          imageSource = await this.loadFromBase64(payload);
          logger.info(`✅ Base64 payload加载成功: ${key}`);
        } else {
          logger.error(`❌ Material加载失败且无有效payload: ${key}`, {
            material_id,
            encoding,
            hasPayload: !!payload
          });
          throw new Error(`Material加载失败且无有效payload: ${key}`);
        }
      }
    } else if (payload && (encoding === 'png_base64' || encoding === 'base64')) {
      // 直接使用payload
      logger.info(`🔍 直接从Base64 payload加载: ${key}`);
      imageSource = await this.loadFromBase64(payload);
      logger.info(`✅ Base64 payload加载成功: ${key}`);
    } else {
      logger.error(`❌ Complex pattern ${key} 无有效material_id或payload`, {
        material_id,
        encoding,
        hasPayload: !!payload
      });
      throw new Error(`Complex pattern ${key} 无有效material_id或payload`);
    }

    // 添加到纹理图集（标记为不可替换）
    logger.info(`🔍 添加到纹理图集: ${key}, replaceable: false`);
    const added = this.textureAtlas.addTexture(key, imageSource, {
      replaceable: false
    });

    if (!added) {
      logger.error(`❌ 纹理图集已满，无法添加CDN纹理: ${key}`);
      throw new Error(`纹理图集已满，无法添加CDN纹理: ${key}`);
    }

    logger.info(`✅ CDN纹理加载完成: ${key} (Material CDN)`);
  }

  /**
   * 从Material系统加载
   * 使用materialLoaderService的CDN加载和缓存机制
   */
  private async loadFromMaterialSystem(materialId: string): Promise<HTMLImageElement> {
    logger.info(`🔍 MaterialLoader: 开始加载materialId: ${materialId}`);

    try {
      // 使用sprite_sheet变体（适合WebGL渲染）
      logger.info(`🔍 MaterialLoader: 调用preloadMaterialImage(${materialId}, sprite_sheet)`);
      const img = await materialLoaderService.preloadMaterialImage(
        materialId,
        'sprite_sheet'
      );

      if (!img) {
        throw new Error(`MaterialLoader返回null: ${materialId}`);
      }

      logger.info(`✅ MaterialLoader: 加载成功: ${materialId}`, {
        width: img.width,
        height: img.height,
        complete: img.complete
      });

      return img;
    } catch (error) {
      logger.error(`❌ MaterialLoader: 加载失败: ${materialId}`, error);
      throw error;
    }
  }

  /**
   * 从Base64加载
   */
  private async loadFromBase64(base64: string): Promise<HTMLImageElement> {
    // 构造data URL
    let dataUrl: string;
    if (base64.startsWith('data:')) {
      dataUrl = base64;
    } else {
      dataUrl = `data:image/png;base64,${base64}`;
    }

    // 加载图片
    const img = await this.loadImage(dataUrl);

    return img;
  }

  /**
   * 加载图片
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);

      img.onerror = (error) => {
        reject(new Error(`图片加载失败: ${error}`));
      };

      // 设置跨域（如果需要）
      img.crossOrigin = 'anonymous';

      img.src = src;
    });
  }

  /**
   * 检查pattern是否已预处理
   */
  hasProcessed(key: string): boolean {
    return this.processedPatterns.has(key);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      processedCount: this.processedPatterns.size,
      atlasStats: this.textureAtlas.getUsageStats(),
    };
  }

  /**
   * 清空
   */
  clear() {
    this.processedPatterns.clear();
    this.textureAtlas.clear();
    logger.info('🗑️ Pattern预处理器已清空');
  }
}
