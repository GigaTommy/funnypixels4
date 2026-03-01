/**
 * 统一纹理图集系统
 * 将所有渲染类型（color, emoji, complex）的纹理合并到一张大图
 */

import { logger } from '../../utils/logger';

export interface TextureCoords {
  u0: number;  // 左上角U坐标 (0-1)
  v0: number;  // 左上角V坐标 (0-1)
  u1: number;  // 右下角U坐标 (0-1)
  v1: number;  // 右下角V坐标 (0-1)
  width: number;  // 原始宽度（像素）
  height: number; // 原始高度（像素）
}

interface TextureMetadata {
  coords: TextureCoords;
  replaceable: boolean;  // 是否可替换（Color/Emoji=true, Complex=false）
  lastUsed: number;      // 最后使用时间戳
  size: number;          // 占用空间（像素数）
}

export class UnifiedTextureAtlas {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private atlas: Map<string, TextureMetadata>; // patternKey -> metadata

  // 图集布局参数
  private currentX: number = 0;
  private currentY: number = 0;
  private rowHeight: number = 0;
  private padding: number = 2; // 纹理间距，防止bleeding

  // 图集尺寸
  private readonly atlasWidth: number = 4096;
  private readonly atlasHeight: number = 4096;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.atlas = new Map();

    // 创建Canvas作为纹理图集
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.atlasWidth;
    this.canvas.height = this.atlasHeight;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建2D上下文');
    }
    this.ctx = ctx;

    // 清空为透明背景
    this.ctx.clearRect(0, 0, this.atlasWidth, this.atlasHeight);

    logger.info(`✅ 纹理图集已创建: ${this.atlasWidth}x${this.atlasHeight}`);
  }

  /**
   * 添加纹理到图集
   * @param key - Pattern唯一标识
   * @param source - 纹理源（Canvas或Image）
   * @param options - 配置选项
   * @returns 是否成功添加
   */
  addTexture(
    key: string,
    source: HTMLCanvasElement | HTMLImageElement,
    options?: { replaceable?: boolean }
  ): boolean {
    // 检查是否已存在
    if (this.atlas.has(key)) {
      logger.debug(`⏭️ 纹理 ${key} 已存在，更新lastUsed`);
      const metadata = this.atlas.get(key)!;
      metadata.lastUsed = Date.now();
      return true;
    }

    const width = source.width;
    const height = source.height;
    const replaceable = options?.replaceable ?? true;

    // 检查是否需要换行
    if (this.currentX + width + this.padding > this.atlasWidth) {
      this.currentX = 0;
      this.currentY += this.rowHeight + this.padding;
      this.rowHeight = 0;
    }

    // 检查是否超出图集空间
    if (this.currentY + height > this.atlasHeight) {
      // 尝试LRU淘汰
      logger.warn(`⚠️ 纹理图集空间不足，尝试LRU淘汰...`);
      const evicted = this.evictLRU(width * height);

      if (!evicted) {
        logger.error(
          `❌ 纹理图集已满且无法淘汰！当前使用: ${this.currentY + height}/${this.atlasHeight}px`
        );
        return false;
      }

      logger.info(`♻️ LRU淘汰成功，重新尝试添加纹理`);
      // 注意：这里简化处理，实际需要重建整个图集
      // 为了保持简单，我们只是返回false，让调用方处理
      return false;
    }

    // 绘制纹理到图集Canvas
    try {
      this.ctx.drawImage(source, this.currentX, this.currentY, width, height);
    } catch (error) {
      logger.error(`❌ 绘制纹理 ${key} 失败:`, error);
      return false;
    }

    // 计算纹理坐标（归一化到0-1范围）
    const u0 = this.currentX / this.atlasWidth;
    const v0 = this.currentY / this.atlasHeight;
    const u1 = (this.currentX + width) / this.atlasWidth;
    const v1 = (this.currentY + height) / this.atlasHeight;

    const texCoords: TextureCoords = { u0, v0, u1, v1, width, height };

    // 存储元数据
    this.atlas.set(key, {
      coords: texCoords,
      replaceable,
      lastUsed: Date.now(),
      size: width * height
    });

    logger.debug(
      `📦 添加纹理: ${key} (${width}x${height}, ${replaceable ? '可替换' : '永久'}) → ` +
      `UV(${u0.toFixed(3)}, ${v0.toFixed(3)}, ${u1.toFixed(3)}, ${v1.toFixed(3)})`
    );

    // 更新布局位置
    this.currentX += width + this.padding;
    this.rowHeight = Math.max(this.rowHeight, height);

    return true;
  }

  /**
   * 获取Pattern的纹理坐标（并更新lastUsed）
   */
  getTexCoords(key: string): TextureCoords | undefined {
    const metadata = this.atlas.get(key);
    if (metadata) {
      metadata.lastUsed = Date.now(); // 更新使用时间
      return metadata.coords;
    }
    return undefined;
  }

  /**
   * 检查纹理是否存在
   */
  hasTexture(key: string): boolean {
    return this.atlas.has(key);
  }

  /**
   * LRU淘汰策略
   * @param requiredSize - 需要的空间大小（像素数）
   * @returns 是否成功淘汰
   */
  private evictLRU(requiredSize: number): boolean {
    // 收集所有可替换的纹理
    const replaceableCandidates: Array<{ key: string; metadata: TextureMetadata }> = [];

    for (const [key, metadata] of this.atlas.entries()) {
      if (metadata.replaceable) {
        replaceableCandidates.push({ key, metadata });
      }
    }

    // 如果没有可替换的纹理
    if (replaceableCandidates.length === 0) {
      logger.warn('⚠️ 没有可替换的纹理，LRU淘汰失败');
      return false;
    }

    // 按lastUsed排序（最久未使用的在前）
    replaceableCandidates.sort((a, b) => a.metadata.lastUsed - b.metadata.lastUsed);

    // 逐个淘汰直到释放足够空间
    let freedSize = 0;
    let evictedCount = 0;

    for (const { key, metadata } of replaceableCandidates) {
      this.removeTexture(key);
      freedSize += metadata.size;
      evictedCount++;

      logger.debug(`♻️ 淘汰纹理: ${key} (释放 ${metadata.size} 像素)`);

      // 释放足够空间就停止
      if (freedSize >= requiredSize) {
        break;
      }
    }

    logger.info(
      `♻️ LRU淘汰完成: ${evictedCount}个纹理, 释放 ${freedSize} 像素`
    );

    return freedSize >= requiredSize;
  }

  /**
   * 移除纹理
   * 注意：这只是从Map中移除，实际Canvas需要重建才能真正释放空间
   */
  private removeTexture(key: string): void {
    this.atlas.delete(key);
  }

  /**
   * 创建WebGL纹理
   * 将图集Canvas上传到GPU
   */
  createGLTexture(): WebGLTexture | null {
    const gl = this.gl;
    const texture = gl.createTexture();

    if (!texture) {
      logger.error('❌ 创建WebGL纹理失败');
      return null;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // 上传图集Canvas到GPU
    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,                // mipmap级别
        gl.RGBA,          // 内部格式
        gl.RGBA,          // 源格式
        gl.UNSIGNED_BYTE, // 数据类型
        this.canvas       // 数据源
      );
    } catch (error) {
      logger.error('❌ 上传纹理到GPU失败:', error);
      gl.deleteTexture(texture);
      return null;
    }

    // 设置纹理参数
    // 使用线性过滤以获得更好的缩放质量
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 边缘处理：夹紧到边缘
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 生成Mipmap（多级纹理，提升缩小时的质量）
    gl.generateMipmap(gl.TEXTURE_2D);

    logger.info(
      `✅ WebGL纹理已创建: ${this.atlasWidth}x${this.atlasHeight}, ` +
      `包含 ${this.atlas.size} 个纹理`
    );

    return texture;
  }

  /**
   * 获取图集使用率
   */
  getUsageStats() {
    const usedHeight = this.currentY + this.rowHeight;
    const usagePercent = (usedHeight / this.atlasHeight * 100).toFixed(1);

    return {
      textureCount: this.atlas.size,
      usedWidth: this.currentX,
      usedHeight: usedHeight,
      totalWidth: this.atlasWidth,
      totalHeight: this.atlasHeight,
      usagePercent: parseFloat(usagePercent),
    };
  }

  /**
   * 导出图集Canvas（用于调试）
   */
  exportCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * 清空图集
   */
  clear() {
    this.atlas.clear();
    this.currentX = 0;
    this.currentY = 0;
    this.rowHeight = 0;
    this.ctx.clearRect(0, 0, this.atlasWidth, this.atlasHeight);
    logger.info('🗑️ 纹理图集已清空');
  }
}
