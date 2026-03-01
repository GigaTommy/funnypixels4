/**
 * WebGL像素渲染服务
 * 统一管理WebGL渲染，替代Canvas 2D渲染
 * 🆕 支持 Emoji Atlas 预渲染系统
 */

import { logger } from '../../utils/logger';
import { WebGLPixelRenderer, PixelData, RenderOptions } from './WebGLPixelRenderer-v2';  // 🆕 使用 v2 版本
import { PatternPreprocessor, PatternAsset } from './PatternPreprocessor';
import { UnifiedTextureAtlas } from './UnifiedTextureAtlas';
import { checkWebGLSupport } from './index';

// 🆕 Emoji key 到 unicode 的映射（数据库中的 emoji）
const EMOJI_KEY_TO_UNICODE: Record<string, string> = {
  'emoji_crown': '👑',
  'emoji_star': '⭐',
  'emoji_heart': '❤️',
  'emoji_fire': '🔥',
  'emoji_water': '💧',
  'emoji_leaf': '🍃',
  'emoji_sun': '☀️',
  'emoji_moon': '🌙',
  'emoji_cloud': '☁️',
  'emoji_rainbow': '🌈',
  'emoji_thunder': '⚡',
  'emoji_snow': '❄️',
  'emoji_rain': '☔',
  'emoji_anchor': '⚓',
  'emoji_compass': '🧭',
  'emoji_earth': '🌍'
};

export interface WebGLServiceConfig {
  maxPixels?: number;
  enableLOD?: boolean;  // 是否启用LOD（Level of Detail）
  debug?: boolean;  // 是否启用调试模式
}

export class WebGLPixelService {
  private renderer: WebGLPixelRenderer | null = null;
  private preprocessor: PatternPreprocessor | null = null;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;

  private isInitialized: boolean = false;
  private config: Required<WebGLServiceConfig>;

  // 缓存的像素数据
  private pixelDataMap: Map<string, PixelData> = new Map();

  // 添加渲染锁，防止递归调用
  private isRendering = false;

  // 记录最后一次渲染时的 zoom 级别，供 addBatchPixels 使用
  private lastKnownZoom: number = 0;

  // 🔥 缓存最后的渲染选项，用于立即渲染
  private lastRenderOptions: any = null;

  // 🔥 修复频繁重绘：标记是否需要立即渲染
  private needsImmediateRender = false;

  constructor(canvas: HTMLCanvasElement, config: WebGLServiceConfig = {}) {
    this.canvas = canvas;
    this.config = {
      maxPixels: config.maxPixels || 100000,
      enableLOD: config.enableLOD !== undefined ? config.enableLOD : true,
      debug: config.debug !== undefined ? config.debug : false,
    };
  }

  /**
   * 使用现有的WebGL上下文初始化（用于MapLibre Custom Layer）
   */
  async initializeWithContext(gl: WebGLRenderingContext): Promise<boolean> {
    if (this.isInitialized) {
      logger.warn('⚠️ WebGL已初始化，跳过');
      return true;
    }

    logger.info('🔍 WebGLPixelService开始初始化（使用现有context）...');

    this.gl = gl;

    // 检查WebGL支持
    const support = checkWebGLSupport();
    if (!support.supported) {
      logger.error(`❌ WebGL不支持: ${support.reason}`);
      return false;
    }

    logger.info('✅ WebGL支持检测通过:', {
      vendor: support.vendor,
      renderer: support.renderer,
      maxTextureSize: support.maxTextureSize,
    });

    logger.info('✅ 使用现有WebGL上下文');

    // 创建WebGL渲染器
    logger.info('🔍 创建WebGLPixelRenderer...');
    try {
      this.renderer = new WebGLPixelRenderer(this.gl, this.config.maxPixels);
      logger.info('✅ WebGLPixelRenderer创建成功');
    } catch (rendererError) {
      logger.error('❌ WebGLPixelRenderer创建失败:', rendererError);
      return false;
    }

    // 继续其余初始化...
    return this.continueInitialization();
  }

  private async continueInitialization(): Promise<boolean> {
    if (!this.gl || !this.renderer) {
      return false;
    }

    // 设置WebGL状态
    logger.info('🔍 设置WebGL状态...');
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.clearColor(0, 0, 0, 0); // 透明背景
    logger.info('✅ WebGL状态设置完成');

    // 创建PatternPreprocessor
    logger.info('🔍 创建PatternPreprocessor...');
    try {
      this.preprocessor = new PatternPreprocessor(this.renderer.getTextureAtlas());
      logger.info('✅ PatternPreprocessor创建成功');
    } catch (preprocessorError) {
      logger.error('❌ PatternPreprocessor创建失败:', preprocessorError);
      return false;
    }

    logger.info('🔍 完成纹理图集初始化...');
    try {
      // 完成纹理图集初始化
      this.renderer.finalizeComplexAtlas();
      logger.info('✅ 纹理图集初始化完成');
    } catch (atlasError) {
      logger.error('❌ 纹理图集初始化失败:', atlasError);
      return false;
    }

    // 加载 Emoji Atlas
    logger.info('🔍 加载 Emoji Atlas...');
    try {
      await this.renderer.loadEmojiAtlas();
      logger.info('✅ Emoji Atlas 加载成功');
    } catch (emojiError) {
      logger.error('❌ Emoji Atlas 加载失败:', emojiError);
      logger.warn('⚠️ 将继续使用，但 emoji 可能无法正常显示');
      // 不阻止初始化，允许降级使用
    }

    this.isInitialized = true;
    logger.info('🎉 WebGL渲染服务完全初始化成功');

    return true;
  }

  /**
   * 初始化WebGL（原始方法，用于独立创建WebGL上下文）
   */

  /**
   * 初始化WebGL
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      logger.warn('⚠️ WebGL已初始化，跳过');
      return true;
    }

    logger.info('🔍 WebGLPixelService开始初始化...');

    // 检查WebGL支持
    logger.info('🔍 检查WebGL支持...');
    const support = checkWebGLSupport();

    if (!support.supported) {
      logger.error(`❌ WebGL不支持: ${support.reason}`);
      return false;
    }

    logger.info('✅ WebGL支持检测通过:', {
      vendor: support.vendor,
      renderer: support.renderer,
      maxTextureSize: support.maxTextureSize,
    });

    // 创建WebGL上下文
    logger.info('🔍 创建WebGL上下文...');

    // 🔧 尝试多种WebGL上下文配置，提高兼容性
    const contextConfigs = [
      // 优先配置（性能最佳）
      {
        alpha: true,
        antialias: false,  // 像素画不需要抗锯齿
        depth: false,      // 不需要深度缓冲
        premultipliedAlpha: true,
        preserveDrawingBuffer: true  // 🔧 修复：必须true，否则Canvas被清空
      },
      // 备用配置1：启用抗锯齿
      {
        alpha: true,
        antialias: true,
        depth: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true  // 🔧 修复：必须true
      },
      // 备用配置2：禁用alpha混合
      {
        alpha: false,
        antialias: false,
        depth: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true  // 🔧 修复：必须true
      },
      // 最简配置（兼容性最佳）
      {
        alpha: true,
        antialias: true,
        depth: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true
      }
    ];

    let gl: WebGLRenderingContext | null = null;
    let usedConfig = null;

    for (let i = 0; i < contextConfigs.length; i++) {
      const config = contextConfigs[i];
      logger.info(`🔍 尝试配置 ${i + 1}/${contextConfigs.length}:`, config);

      try {
        gl = this.canvas.getContext('webgl', config) as WebGLRenderingContext || this.canvas.getContext('experimental-webgl', config) as WebGLRenderingContext;
        if (gl) {
          usedConfig = config;
          logger.info(`✅ WebGL上下文创建成功，使用配置 ${i + 1}`);
          break;
        }
      } catch (error) {
        logger.warn(`⚠️ 配置 ${i + 1} 创建失败:`, error.message);
      }
    }

    if (!gl) {
      logger.error('❌ 所有WebGL上下文配置都失败');
      logger.error('Canvas信息:', {
        width: this.canvas.width,
        height: this.canvas.height,
        contextType: 'webgl'
      });
      return false;
    }

    logger.info('✅ WebGL上下文创建成功:', {
      version: gl.getParameter(gl.VERSION),
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      usedConfig: usedConfig
    });

    this.gl = gl;

    // 🔧 添加WebGL context lost/restored事件监听
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      logger.error('❌ WebGL Context Lost!', {
        reason: 'GPU资源耗尽、驱动崩溃或shader编译失败',
        timestamp: new Date().toISOString()
      });
    }, false);

    this.canvas.addEventListener('webglcontextrestored', () => {
      logger.info('✅ WebGL Context Restored');
    }, false);

    // 🔧 检查context是否已经丢失
    if (gl.isContextLost()) {
      logger.error('❌ WebGL context在创建后立即丢失！');
      return false;
    }

    // 设置WebGL状态
    logger.info('🔍 设置WebGL状态...');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0); // 透明背景
    logger.info('✅ WebGL状态设置完成');

    // 创建渲染器
    logger.info('🔍 创建WebGLPixelRenderer...');
    try {
      // 🔧 创建前检查context状态
      if (gl.isContextLost()) {
        logger.error('❌ WebGL context在创建渲染器前丢失！');
        return false;
      }

      this.renderer = new WebGLPixelRenderer(gl, this.config.maxPixels);
      logger.info('✅ WebGLPixelRenderer创建成功');

      // 🔧 创建后检查context状态
      if (gl.isContextLost()) {
        logger.error('❌ WebGL context在创建渲染器后丢失！可能是shader编译失败');
        return false;
      }
    } catch (rendererError) {
      logger.error('❌ WebGLPixelRenderer创建失败:', rendererError);
      logger.error('错误堆栈:', rendererError.stack);

      // 🔧 检查是否是context lost导致的错误
      if (gl.isContextLost()) {
        logger.error('❌ 确认：WebGL context已丢失');
      }
      return false;
    }

    logger.info('🔍 创建PatternPreprocessor...');
    try {
      this.preprocessor = new PatternPreprocessor(this.renderer.getTextureAtlas());
      logger.info('✅ PatternPreprocessor创建成功');
    } catch (preprocessorError) {
      logger.error('❌ PatternPreprocessor创建失败:', preprocessorError);
      return false;
    }

    logger.info('🔍 完成纹理图集初始化...');
    try {
      // 完成纹理图集初始化
      this.renderer.finalizeComplexAtlas();

      // 🔧 调试功能已清理 - 移除纹理图集调试视图
      // this.renderer.debugExportAtlas();

      logger.info('✅ 纹理图集初始化完成');
    } catch (atlasError) {
      logger.error('❌ 纹理图集初始化失败:', atlasError);
      return false;
    }

    // 🆕 加载 Emoji Atlas（预渲染 emoji 纹理）
    logger.info('🔍 加载 Emoji Atlas...');
    try {
      await this.renderer.loadEmojiAtlas();
      logger.info('✅ Emoji Atlas 加载成功');
    } catch (emojiError) {
      logger.error('❌ Emoji Atlas 加载失败:', emojiError);
      logger.warn('⚠️ 将继续使用，但 emoji 可能无法正常显示');
      // 不阻止初始化，允许降级使用
    }

    this.isInitialized = true;
    logger.info('🎉 WebGL渲染服务完全初始化成功');

    return true;
  }

  /**
   * 获取纹理图集（用于检查纹理是否存在）
   */
  getTextureAtlas(): UnifiedTextureAtlas {
    if (!this.renderer) {
      throw new Error('WebGL未初始化');
    }
    return this.renderer.getTextureAtlas();
  }

  /**
   * 获取图案预处理器
   */
  getPatternPreprocessor(): PatternPreprocessor {
    if (!this.preprocessor) {
      throw new Error('WebGL未初始化');
    }
    return this.preprocessor;
  }

  /**
   * 预处理Patterns
   * 必须在渲染前调用
   */
  async preprocessPatterns(patterns: PatternAsset[]): Promise<void> {
    if (!this.preprocessor) {
      throw new Error('WebGL未初始化');
    }

    logger.info(`🔄 开始预处理 ${patterns.length} 个patterns...`);

    const successCount = await this.preprocessor.preprocessPatterns(patterns);

    logger.info(`✅ Patterns预处理完成: ${successCount}/${patterns.length}`);

    // 完成图集并创建WebGL纹理
    if (this.renderer) {
      this.renderer.finalizeComplexAtlas();
    }
  }

  /**
   * 添加/更新像素
   */
  addPixel(pixelData: {
    gridId: string;
    lat: number;
    lng: number;
    patternKey: string;
    renderType: 'color' | 'emoji' | 'complex';
    color?: string;
    // 🔧 新增：complex类型的额外信息
    patternId?: string;  // 原始pattern_id (如 'emoji_fire')
    materialId?: string; // 材质ID (如 '57f71649-...')
  }): void {
    if (!this.renderer) {
      logger.warn('⚠️ WebGL未初始化，无法添加像素');
      return;
    }

    // 🔧 修复：patternKey 对于emoji类型是 pattern_assets.key（如 'emoji_fire'）
    // unicodeChar 需要从传入数据中获取或通过映射得到
    const unicodeChar = (pixelData as any).unicodeChar;

    // 🔍 Emoji调试日志
    if (pixelData.renderType === 'emoji') {
      logger.info(`🔥 WebGLService emoji处理: patternKey=${pixelData.patternKey}, unicodeChar=${unicodeChar}`);
    }

    const pixel: PixelData = {
      gridId: pixelData.gridId,
      lat: pixelData.lat,
      lng: pixelData.lng,
      renderType: pixelData.renderType,
      patternKey: pixelData.patternKey,
      color: pixelData.color,
      unicodeChar: unicodeChar,
    };

    this.pixelDataMap.set(pixelData.gridId, pixel);

    // 🔧 关键修复：只有在非渲染状态下才直接更新渲染器
    // 避免在渲染过程中更新像素导致递归调用
    if (!this.isRendering) {
      this.renderer.updatePixel(pixel);
    } else {
      logger.debug('⚠️ 渲染进行中，延迟像素更新');
    }
  }

  /**
   * 批量添加/更新像素
   */
  async addBatchPixels(pixelsData: Array<{
    gridId: string;
    lat: number;
    lng: number;
    patternKey: string;
    renderType: 'color' | 'emoji' | 'complex';
    color?: string;
    // 🔧 新增：complex类型的额外信息
    patternId?: string;  // 原始pattern_id (如 'emoji_fire')
    materialId?: string; // 材质ID (如 '57f71649-...')
    unicodeChar?: string; // 🔧 关键修复：emoji类型的unicode字符
  }>, zoom?: number): Promise<void> {
    if (!this.renderer || !this.preprocessor) {
      logger.warn('⚠️ WebGL未初始化，无法添加像素');
      return;
    }

    // 🔧 关键修复：收集需要预处理的patterns
    const patternsToPreprocess: PatternAsset[] = [];
    const textureAtlas = this.renderer.getTextureAtlas();

    for (const pd of pixelsData) {
      // 🔧 关键修复：使用正确的texture key
      // - 对于complex类型：使用patternId (如 'emoji_fire') 作为texture key
      // - 对于其他类型：使用patternKey
      const textureKey = pd.renderType === 'complex' ? (pd.patternId || pd.patternKey) : pd.patternKey;

      // 检查纹理是否已存在
      if (!textureAtlas.hasTexture(textureKey)) {
        // 🔧 修复：过滤无效的patterns，避免无限循环
        // 只处理有效的patterns：
        // - 对于complex类型：必须有material_id
        // - 对于emoji类型：patternKey应该是有效的unicode字符
        // - 对于color类型：不需要预处理纹理

        let isValidPattern = false;

        if (pd.renderType === 'complex') {
          // complex类型必须有material_id
          isValidPattern = !!pd.materialId;
        } else if (pd.renderType === 'emoji') {
          // emoji类型patternKey应该是pattern_assets.key（如 'emoji_fire'）
          // 不应该是unicode字符，而是pattern标识符
          isValidPattern = pd.patternKey &&
                          !pd.patternKey.includes('#') &&
                          pd.patternKey.length > 1 &&
                          pd.patternKey.startsWith('emoji_');
        } else {
          // color类型不需要纹理预处理
          isValidPattern = false;
        }

        if (isValidPattern) {
          const patternAsset: PatternAsset = {
            id: pd.patternId || pd.patternKey,
            key: pd.patternId || pd.patternKey,
            render_type: pd.renderType,
            color: pd.color,
            unicode_char: pd.renderType === 'emoji' ? pd.unicodeChar : undefined,
            material_id: pd.renderType === 'complex' ? pd.materialId : undefined
          };
          patternsToPreprocess.push(patternAsset);
        } else {
          logger.debug(`⚠️ 跳过无效pattern: ${textureKey}, renderType: ${pd.renderType}, materialId: ${pd.materialId}`);
        }
      }
    }

    // 🔧 预处理patterns（如果有新的）
    if (patternsToPreprocess.length > 0) {
      logger.debug(`🔄 预处理 ${patternsToPreprocess.length} 个新patterns...`);
      try {
        await this.preprocessor.preprocessPatterns(patternsToPreprocess);
        // 重新完成图集（更新WebGL纹理）
        this.renderer.finalizeComplexAtlas();
        logger.debug(`✅ Patterns预处理完成`);
      } catch (error) {
        logger.error('❌ Patterns预处理失败:', error);
        // 继续处理，使用默认纹理
      }
    }

    const pixels: PixelData[] = pixelsData.map(pd => ({
      gridId: pd.gridId,
      lat: pd.lat,
      lng: pd.lng,
      renderType: pd.renderType,
      patternKey: pd.patternKey,
      color: pd.color,
      // 🔧 关键修复：使用传入的 unicodeChar，而不是从 patternKey 推断
      unicodeChar: pd.unicodeChar,
    }));

    // 更新缓存
    pixels.forEach(pixel => {
      this.pixelDataMap.set(pixel.gridId, pixel);
    });

    // 🔥 关键修复：使用传入的zoom或实时获取zoom
    // 优先使用传入的zoom，避免lastKnownZoom死锁问题
    const effectiveZoom = zoom ?? this.lastKnownZoom;

    // 🔥 关键修复：只有在非渲染状态下才直接更新渲染器
    // 避免在渲染过程中更新像素导致递归调用
    if (!this.isRendering) {
      // 🔥 关键修复：确保zoom有效才处理像素
      if (effectiveZoom && effectiveZoom > 0) {
        // 更新 lastKnownZoom 以便后续使用
        this.lastKnownZoom = effectiveZoom;
        this.renderer.updateBatchPixels(pixels, effectiveZoom);
        logger.info(`🔥 addBatchPixels: 更新了 ${pixels.length} 个像素，zoom=${effectiveZoom}`);
      } else {
        // 🔥 修复：当zoom无效时，先缓存像素，等待有效的zoom
        logger.warn(`⚠️ addBatchPixels: zoom=${effectiveZoom}无效，缓存像素等待有效zoom`);
        // 像素已经在上面添加到pixelDataMap了，这里直接返回
        return;
      }

      // 🔥 修复频繁重绘：不再立即触发渲染，只标记需要渲染
      // 渲染将由MapLibre的render循环在下一帧自动调用
      this.needsImmediateRender = true;

      logger.debug(`🔥 addBatchPixels: 像素已更新，等待下一帧渲染 (${pixels.length} 个像素)`);
    } else {
      logger.debug('⚠️ 渲染进行中，延迟批量像素更新');
    }
  }

  /**
   * 删除像素
   */
  removePixel(gridId: string): void {
    if (!this.renderer) return;

    this.pixelDataMap.delete(gridId);

    // 🔧 关键修复：只有在非渲染状态下才直接更新渲染器
    // 避免在渲染过程中更新像素导致递归调用
    if (!this.isRendering) {
      this.renderer.removePixel(gridId);
    } else {
      logger.debug('⚠️ 渲染进行中，延迟像素删除');
    }
  }

  /**
   * 渲染一帧
   */
  render(options: RenderOptions): void {
    if (!this.renderer) {
      logger.warn('⚠️ WebGL未初始化，无法渲染');
      return;
    }

    // 🔧 关键修复：防止递归调用
    if (this.isRendering) {
      logger.debug('⚠️ 渲染正在进行中，跳过递归调用');
      return;
    }

    // 🔥 缓存渲染选项，供立即渲染使用
    this.lastRenderOptions = { ...options };

    this.isRendering = true;

    try {
      // 确保Canvas尺寸与地图分辨率匹配
      if (options.resolution) {
        this.canvas.width = options.resolution.width;
        this.canvas.height = options.resolution.height;
      }

      // 🔥 关键修复：记录当前 zoom 级别，供 addBatchPixels 使用
      this.lastKnownZoom = options.zoom;

      // 🔥 关键修复：如果有缓存的像素且现在有了有效的zoom，立即处理它们
      if (this.lastKnownZoom && this.lastKnownZoom > 0 && this.pixelDataMap.size > 0) {
        const cachedPixels = Array.from(this.pixelDataMap.values());
        logger.info(`🔄 处理缓存的 ${cachedPixels.length} 个像素，zoom=${this.lastKnownZoom}`);
        this.renderer.updateBatchPixels(cachedPixels, this.lastKnownZoom);
      }

      // 🔧 移除导致无限递归的代码
      // 问题：每次渲染时都重新更新所有像素到渲染器，这会触发新的渲染
      // 修复：不再在这里重新更新像素数据，只进行纯粹的渲染
      // 像素数据更新应该通过 addPixel/addBatchPixels 方法在适当时机进行

      // 🔥 修复频繁重绘：只在需要时才渲染
      if (this.needsImmediateRender || this.pixelDataMap.size > 0) {
        logger.debug(`🎨 开始渲染 ${this.pixelDataMap.size} 个像素，zoom=${options.zoom}`);
        this.renderer.render(options);
        this.needsImmediateRender = false; // 重置标记
        logger.debug(`✅ 渲染完成`);
      } else {
        logger.debug(`⏳ 无需渲染，像素数据未变化`);
      }
    } finally {
      // 确保无论如何都释放渲染锁
      this.isRendering = false;
    }
  }

  /**
   * 清空所有像素
   */
  clear(): void {
    if (!this.renderer) return;

    this.pixelDataMap.forEach((_, gridId) => {
      this.renderer!.removePixel(gridId);
    });

    this.pixelDataMap.clear();
  }

  /**
   * 调整Canvas尺寸
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }

    logger.debug(`📐 Canvas已调整尺寸: ${width}x${height}`);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    if (!this.renderer) {
      return {
        initialized: false,
        pixelCount: 0,
      };
    }

    return {
      initialized: this.isInitialized,
      ...this.renderer.getStats(),
      cachedPixelCount: this.pixelDataMap.size,
    };
  }

  /**
   * 🔧 调试：验证像素数据持久性
   */
  debugPixelPersistence() {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🔍 像素数据持久性检查:', {
        pixelDataMapSize: this.pixelDataMap.size,
        rendererPixelCount: this.renderer?.getStats().pixelCount || 0,
        pixelDataEntries: Array.from(this.pixelDataMap.entries()).slice(0, 3).map(([gridId, pixel]) => ({
          gridId,
          lat: pixel.lat.toFixed(6),
          lng: pixel.lng.toFixed(6),
          renderType: pixel.renderType,
          patternKey: pixel.patternKey
        }))
      });
    }
  }

  /**
   * 导出纹理图集（用于调试）
   */
  exportAtlasCanvas(): HTMLCanvasElement | null {
    if (!this.renderer) return null;

    return this.renderer.getTextureAtlas().exportCanvas();
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized && this.renderer !== null;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.preprocessor = null;
    this.pixelDataMap.clear();
    this.isInitialized = false;

    logger.info('🗑️ WebGL渲染服务已清理');
  }
}
