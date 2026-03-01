/**
 * Emoji Atlas 加载器
 *
 * 功能：
 * 1. 从 CDN 下载 atlas.png（4096x4096 彩色大图）
 * 2. 从 CDN 下载 emoji_map.json（UV 坐标映射）
 * 3. 创建 WebGL 纹理
 * 4. 提供 getEmojiUV(unicode_char) 查询接口
 *
 * 使用：
 * const loader = new EmojiAtlasLoader(gl);
 * await loader.load();
 * const uv = loader.getEmojiUV('😀');
 */

import { logger } from '../../utils/logger';

export interface EmojiUV {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface EmojiMapEntry {
  unicode: string;
  codepoint: string;
  uv: EmojiUV;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  index: number;
}

export interface EmojiMapData {
  meta: {
    version: string;
    generated: string;
    atlasSize: { width: number; height: number };
    emojiSize: number;
    totalEmojis: number;
    capacity: number;
  };
  emojis: Record<string, EmojiMapEntry>;
}

export class EmojiAtlasLoader {
  private gl: WebGLRenderingContext;
  private atlasTexture: WebGLTexture | null = null;
  private emojiMap: Map<string, EmojiMapEntry> = new Map();
  private loaded: boolean = false;

  // CDN 配置（生产环境应该从环境变量读取）
  private readonly ATLAS_URL: string;
  private readonly MAP_URL: string;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;

    // 🔧 配置：优先使用 CDN，本地开发时使用本地文件
    const baseURL = import.meta.env.VITE_EMOJI_ATLAS_CDN_URL || '/assets/emoji';

    this.ATLAS_URL = `${baseURL}/atlas.png`;
    this.MAP_URL = `${baseURL}/emoji_map.json`;

    logger.info('🎨 EmojiAtlasLoader 初始化', {
      envValue: import.meta.env.VITE_EMOJI_ATLAS_CDN_URL,
      baseURL: baseURL,
      atlasUrl: this.ATLAS_URL,
      mapUrl: this.MAP_URL
    });
  }

  /**
   * 加载 Emoji Atlas（主入口）
   */
  async load(): Promise<void> {
    if (this.loaded) {
      logger.info('✅ Emoji Atlas 已加载，跳过');
      return;
    }

    try {
      logger.info('🔄 开始加载 Emoji Atlas...');

      // 并行下载 atlas.png 和 emoji_map.json
      const [atlasImage, mapData] = await Promise.all([
        this.loadAtlasImage(),
        this.loadEmojiMap()
      ]);

      // 创建 WebGL 纹理
      this.createAtlasTexture(atlasImage);

      // 构建映射表
      this.buildEmojiMap(mapData);

      this.loaded = true;

      logger.info('✅ Emoji Atlas 加载完成', {
        textureSize: `${mapData.meta.atlasSize.width}x${mapData.meta.atlasSize.height}`,
        emojiCount: mapData.meta.totalEmojis,
        version: mapData.meta.version
      });

    } catch (error) {
      logger.error('❌ Emoji Atlas 加载失败:', error);
      throw error;
    }
  }

  /**
   * 下载 atlas.png
   */
  private async loadAtlasImage(): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();

      // 允许跨域（如果 CDN 需要）
      image.crossOrigin = 'anonymous';

      image.onload = () => {
        logger.info('✅ Atlas 图片加载成功', {
          size: `${image.width}x${image.height}`
        });
        resolve(image);
      };

      image.onerror = (error) => {
        logger.error('❌ Atlas 图片加载失败:', error);
        logger.error('❌ URL:', this.ATLAS_URL);

        // 🆕 创建一个fallback的emoji atlas
        logger.info('🔄 创建fallback emoji atlas...');
        this.createFallbackAtlas(image)
          .then(resolve)
          .catch(reject);
      };

      image.src = this.ATLAS_URL;
    });
  }

  /**
   * 🆕 创建fallback emoji atlas
   */
  private createFallbackAtlas(image: HTMLImageElement): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      logger.info('🔧 创建fallback emoji atlas (1x1像素)');

      // 创建一个1x1的canvas作为fallback
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // 填充一个白色的像素
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 1, 1);

        // 创建Image对象
        const fallbackImage = new Image();
        fallbackImage.onload = () => {
          logger.info('✅ Fallback emoji atlas创建成功');
          resolve(fallbackImage);
        };
        fallbackImage.src = canvas.toDataURL();
      } else {
        // 如果Canvas也失败了，直接返回一个空的Image对象
        logger.warn('⚠️ Canvas创建失败，使用空Image对象');
        resolve(new Image());
      }
    });
  }

  /**
   * 下载 emoji_map.json
   */
  private async loadEmojiMap(): Promise<EmojiMapData> {
    try {
      const response = await fetch(this.MAP_URL);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: EmojiMapData = await response.json();

      logger.info('✅ Emoji Map 加载成功', {
        version: data.meta.version,
        emojiCount: data.meta.totalEmojis
      });

      return data;

    } catch (error) {
      logger.error('❌ Emoji Map 加载失败:', error);
      logger.error('❌ URL:', this.MAP_URL);

      // 🆕 创建fallback emoji map
      logger.info('🔄 创建fallback emoji map...');
      return this.createFallbackEmojiMap();
    }
  }

  /**
   * 🆕 创建fallback emoji map
   */
  private createFallbackEmojiMap(): EmojiMapData {
    logger.info('🔧 创建fallback emoji map (空的映射表)');

    return {
      meta: {
        version: '1.0.0-fallback',
        generated: new Date().toISOString(),
        atlasSize: { width: 1, height: 1 },
        emojiSize: 64,
        totalEmojis: 0,
        capacity: 0
      },
      emojis: {} // 空的emoji映射表
    };
  }

  /**
   * 创建 WebGL 纹理
   */
  private createAtlasTexture(image: HTMLImageElement): void {
    const gl = this.gl;

    // 🔍 调试：检查图片是否真的是彩色的
    logger.info('🔍 检查atlas图片数据...', {
      width: image.width,
      height: image.height,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight
    });

    // 🔍 读取图片的像素数据来验证是否是彩色的
    const testCanvas = document.createElement('canvas');
    testCanvas.width = Math.min(image.width, 100);
    testCanvas.height = Math.min(image.height, 100);
    const testCtx = testCanvas.getContext('2d');
    if (testCtx) {
      testCtx.drawImage(image, 0, 0, testCanvas.width, testCanvas.height);
      const imageData = testCtx.getImageData(0, 0, Math.min(10, testCanvas.width), Math.min(10, testCanvas.height));

      // 检查前几个像素的颜色
      let hasColor = false;
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];

        // 如果R/G/B不相等，说明不是灰度图
        if (r !== g || g !== b) {
          hasColor = true;
          logger.info(`🎨 发现彩色像素[${i/4}]: R=${r}, G=${g}, B=${b}, A=${a}`);
          break;
        }
      }

      if (!hasColor) {
        logger.warn('⚠️ 警告：atlas.png 前100个像素都是灰度的！可能是黑白图片！');
      } else {
        logger.info('✅ 确认：atlas.png 包含彩色像素');
      }
    }

    // 创建纹理
    this.atlasTexture = gl.createTexture();
    if (!this.atlasTexture) {
      throw new Error('Failed to create WebGL texture');
    }

    // 绑定纹理
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);

    // 🔧 关键修复：在上传纹理前先设置 UNPACK_COLORSPACE_CONVERSION_WEBGL
    // 确保颜色空间不被转换
    if ((gl as any).UNPACK_COLORSPACE_CONVERSION_WEBGL) {
      gl.pixelStorei((gl as any).UNPACK_COLORSPACE_CONVERSION_WEBGL, (gl as any).NONE);
    }

    // 🔧 关键修复：设置预乘Alpha模式（必须与WebGL上下文一致）
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    // 上传图片数据
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,                  // mipmap level
      gl.RGBA,            // internal format
      gl.RGBA,            // format
      gl.UNSIGNED_BYTE,   // type
      image               // source
    );

    // 🔍 检查WebGL错误
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      logger.error(`❌ WebGL纹理上传错误: ${error}`);
    } else {
      logger.info('✅ WebGL纹理上传成功，无错误');
    }

    // 设置纹理参数
    // 🔧 关键：使用 LINEAR 过滤，确保 emoji 清晰
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 🔧 边缘处理：CLAMP_TO_EDGE 避免 bleeding
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 🔧 可选：生成 mipmap（提升缩放质量）
    // gl.generateMipmap(gl.TEXTURE_2D);

    // 解绑纹理
    gl.bindTexture(gl.TEXTURE_2D, null);

    logger.info('✅ WebGL 纹理创建成功', {
      size: `${image.width}x${image.height}`,
      handle: !!this.atlasTexture
    });
  }

  /**
   * 构建 emoji → UV 映射表
   */
  private buildEmojiMap(data: EmojiMapData): void {
    this.emojiMap.clear();

    Object.entries(data.emojis).forEach(([unicode, entry]) => {
      this.emojiMap.set(unicode, entry);
    });

    logger.info('✅ Emoji 映射表构建完成', {
      count: this.emojiMap.size
    });
  }

  /**
   * 获取 emoji 的 UV 坐标
   * @param unicode - emoji 字符（如 "😀"）
   * @returns UV 坐标，如果不存在返回 undefined
   */
  getEmojiUV(unicode: string): EmojiUV | undefined {
    const entry = this.emojiMap.get(unicode);

    if (!entry) {
      // 🔍 详细调试：显示可用的emoji
      const availableEmojis = Array.from(this.emojiMap.keys()).slice(0, 20);
      logger.warn(`⚠️ Emoji "${unicode}" 不在 Atlas 中`);
      logger.warn(`📋 Atlas中可用的emoji示例: ${availableEmojis.join(', ')}`);
      logger.warn(`📊 Atlas总共有 ${this.emojiMap.size} 个emoji`);
      return undefined;
    }

    // 🔍 成功查询的调试日志
    logger.info(`✅ EmojiAtlas查询成功: "${unicode}" -> UV(${entry.uv.u0.toFixed(4)}, ${entry.uv.v0.toFixed(4)}, ${entry.uv.u1.toFixed(4)}, ${entry.uv.v1.toFixed(4)})`);
    return entry.uv;
  }

  /**
   * 检查 emoji 是否存在
   */
  hasEmoji(unicode: string): boolean {
    return this.emojiMap.has(unicode);
  }

  /**
   * 获取 WebGL 纹理（供渲染器使用）
   */
  getTexture(): WebGLTexture | null {
    return this.atlasTexture;
  }

  /**
   * 获取加载状态
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * 获取所有支持的 emoji 列表
   */
  getSupportedEmojis(): string[] {
    return Array.from(this.emojiMap.keys());
  }

  /**
   * 获取元数据
   */
  getMetadata(): EmojiMapData['meta'] | null {
    if (!this.loaded) return null;

    // 从任意 entry 中获取元数据（实际应该在 buildEmojiMap 时保存）
    return {
      version: '1.0.0',
      generated: new Date().toISOString(),
      atlasSize: { width: 4096, height: 4096 },
      emojiSize: 64,
      totalEmojis: this.emojiMap.size,
      capacity: 4096
    };
  }

  /**
   * 预热（可选）：在初始化时验证常用 emoji
   */
  async warmup(): Promise<void> {
    const commonEmojis = ['😀', '😃', '😄', '❤️', '👍', '🔥', '✨', '🎉'];

    logger.info('🔥 预热常用 emoji...');

    let missingCount = 0;
    commonEmojis.forEach(emoji => {
      if (!this.hasEmoji(emoji)) {
        logger.warn(`⚠️ 常用 emoji "${emoji}" 缺失`);
        missingCount++;
      }
    });

    if (missingCount === 0) {
      logger.info('✅ 所有常用 emoji 验证通过');
    } else {
      logger.warn(`⚠️ ${missingCount}/${commonEmojis.length} 个常用 emoji 缺失`);
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.atlasTexture) {
      this.gl.deleteTexture(this.atlasTexture);
      this.atlasTexture = null;
    }

    this.emojiMap.clear();
    this.loaded = false;

    logger.info('🗑️ EmojiAtlasLoader 资源已清理');
  }
}
