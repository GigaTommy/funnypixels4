/**
 * WebGL像素渲染器 v2 - 支持 Emoji Atlas
 *
 * 架构升级：
 * 1. color 类型：纯色渲染（不使用纹理）✅
 * 2. emoji 类型：从 Emoji Atlas 采样（业界标准方案）🆕
 * 3. complex 类型：从 Material 纹理图集采样（联盟旗帜等）✅
 *
 * 变更：
 * - 移除 PatternPreprocessor 对 emoji 的预处理
 * - emoji 直接使用 EmojiAtlasLoader 提供的 UV 坐标
 * - UnifiedTextureAtlas 只存储 complex 类型纹理
 */

import { logger } from '../../utils/logger';
import { createShaderProgram, getShaderLocations, ShaderLocations } from './shaders';
import { UnifiedTextureAtlas, TextureCoords } from './UnifiedTextureAtlas';
import { EmojiAtlasLoader, EmojiUV } from './EmojiAtlasLoader';

export interface PixelData {
  gridId: string;
  lat: number;
  lng: number;
  renderType: 'color' | 'emoji' | 'complex';
  patternKey: string;
  color?: string;  // 用于 color 类型
  unicodeChar?: string;  // 🆕 用于 emoji 类型的 unicode 字符
}

export interface RenderOptions {
  mapCenter: { lat: number; lng: number };
  zoom: number;
  resolution: { width: number; height: number };
  pixelSize: number; // 地理单位（度）

  // MapLibre GL Custom Layer 兼容性参数
  matrix?: Float32Array | ArrayLike<number>; // MapLibre提供的投影矩阵（4x4）
  gl?: WebGLRenderingContext; // MapLibre的WebGL上下文（用于状态同步）
}

export class WebGLPixelRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private locations: ShaderLocations | null = null;

  // 🆕 双纹理系统
  private complexTextureAtlas: UnifiedTextureAtlas;  // Complex 类型（Material）
  private emojiAtlasLoader: EmojiAtlasLoader;        // Emoji 类型（预渲染大图）

  private atlasTexture: WebGLTexture | null = null;  // Complex 纹理
  private emojiTexture: WebGLTexture | null = null;  // Emoji 纹理
  private emojiTextureValidated: boolean = false;    // 🔍 用于标记是否已验证emoji纹理

  // 顶点缓冲
  private vertexBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;

  // 像素索引映射
  private pixelIndexMap: Map<string, number> = new Map();
  private freeSlots: number[] = [];
  private nextSlot: number = 0;
  private maxPixels: number;

  // 顶点数据结构（扩展：支持双纹理）
  private readonly VERTEX_SIZE = 10; // lat, lng, u, v, r, g, b, a, renderType, textureSlot
  private readonly VERTICES_PER_PIXEL = 4;
  private readonly INDICES_PER_PIXEL = 6;

  private vertexData: Float32Array;
  private indexData: Uint16Array;
  private dirtyPixels: Set<string> = new Set();
  private currentZoom?: number; // 当前地图zoom级别，用于动态计算像素偏移

  constructor(gl: WebGLRenderingContext, maxPixels: number = 100000) {
    logger.info('🔍 WebGLPixelRenderer v2 初始化（支持 Emoji Atlas）...');
    this.gl = gl;

    // 🔧 关键修复：检查是否支持32位索引
    const ext = gl.getExtension('OES_element_index_uint');

    if (!ext) {
      // 不支持32位索引，限制maxPixels以避免Uint16Array溢出
      // Uint16Array最大值65535，每个像素4个顶点，因此maxPixels <= 16383
      const maxPixelsWithUint16 = Math.floor(65535 / 4);
      if (maxPixels > maxPixelsWithUint16) {
        logger.warn(`⚠️ 不支持OES_element_index_uint扩展，maxPixels从${maxPixels}降低到${maxPixelsWithUint16}`);
        maxPixels = maxPixelsWithUint16;
      }
    } else {
      logger.info('✅ 支持OES_element_index_uint扩展，可使用32位索引');
    }

    this.maxPixels = maxPixels;

    try {
      // 初始化 Shader
      this.initShaders();

      // 🆕 初始化双纹理系统
      this.complexTextureAtlas = new UnifiedTextureAtlas(gl);
      this.emojiAtlasLoader = new EmojiAtlasLoader(gl);

      // 预分配顶点和索引数据
      const vertexCount = maxPixels * this.VERTICES_PER_PIXEL;
      const indexCount = maxPixels * this.INDICES_PER_PIXEL;

      this.vertexData = new Float32Array(vertexCount * this.VERTEX_SIZE);
      this.indexData = new Uint16Array(indexCount);

      // 生成索引
      this.generateIndices();

      // 创建缓冲区
      this.createBuffers();

      logger.info(`✅ WebGLPixelRenderer v2 初始化完成: 最大像素数 ${maxPixels}`);
    } catch (error) {
      logger.error('❌ WebGLPixelRenderer v2 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 🆕 加载 Emoji Atlas（异步，应在初始化后立即调用）
   */
  async loadEmojiAtlas(): Promise<void> {
    try {
      logger.info('🔄 开始加载 Emoji Atlas...');
      await this.emojiAtlasLoader.load();

      // 获取 Emoji 纹理
      this.emojiTexture = this.emojiAtlasLoader.getTexture();

      if (!this.emojiTexture) {
        throw new Error('Emoji 纹理加载失败');
      }

      // 可选：预热验证
      await this.emojiAtlasLoader.warmup();

      logger.info('✅ Emoji Atlas 加载完成！');
    } catch (error) {
      logger.error('❌ Emoji Atlas 加载失败:', error);
      throw error;
    }
  }

  private initShaders() {
    logger.info('🔧 开始初始化Shader程序...');

    // 🔧 检查WebGL context状态
    if (this.gl.isContextLost()) {
      const error = new Error('WebGL context在初始化shader前已丢失');
      logger.error('❌', error.message);
      throw error;
    }

    const program = createShaderProgram(this.gl);

    // 🔧 再次检查context状态
    if (this.gl.isContextLost()) {
      const error = new Error('WebGL context在shader编译过程中丢失（shader编译失败）');
      logger.error('❌', error.message);
      throw error;
    }

    if (!program) {
      const error = new Error('Shader程序创建失败（createShaderProgram返回null）');
      logger.error('❌', error.message);
      throw error;
    }

    this.program = program;
    this.locations = getShaderLocations(this.gl, program);

    logger.info('✅ Shader程序初始化成功');
  }

  private generateIndices() {
    for (let i = 0; i < this.maxPixels; i++) {
      const vertexOffset = i * this.VERTICES_PER_PIXEL;
      const indexOffset = i * this.INDICES_PER_PIXEL;

      this.indexData[indexOffset + 0] = vertexOffset + 0;
      this.indexData[indexOffset + 1] = vertexOffset + 1;
      this.indexData[indexOffset + 2] = vertexOffset + 2;
      this.indexData[indexOffset + 3] = vertexOffset + 0;
      this.indexData[indexOffset + 4] = vertexOffset + 2;
      this.indexData[indexOffset + 5] = vertexOffset + 3;
    }
  }

  private createBuffers() {
    const gl = this.gl;

    this.vertexBuffer = gl.createBuffer();
    if (!this.vertexBuffer) {
      throw new Error('创建顶点缓冲失败');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.DYNAMIC_DRAW);

    this.indexBuffer = gl.createBuffer();
    if (!this.indexBuffer) {
      throw new Error('创建索引缓冲失败');
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData, gl.STATIC_DRAW);
  }

  /**
   * 🆕 更新像素（支持 Emoji Atlas）
   */
  updatePixel(pixel: PixelData) {
    // 1. 查找或分配槽位
    let slotIndex: number;

    if (this.pixelIndexMap.has(pixel.gridId)) {
      slotIndex = this.pixelIndexMap.get(pixel.gridId)!;
    } else {
      if (this.freeSlots.length > 0) {
        slotIndex = this.freeSlots.pop()!;
      } else {
        slotIndex = this.nextSlot++;

        if (slotIndex >= this.maxPixels) {
          logger.error(`❌ 像素数量超过最大值 ${this.maxPixels}`);
          return;
        }
      }

      this.pixelIndexMap.set(pixel.gridId, slotIndex);
    }

    // 2. 🆕 根据渲染类型获取 UV 坐标和纹理槽
    let texCoords: TextureCoords | EmojiUV | undefined;
    let textureSlot: number = 0; // 0=complex, 1=emoji

    if (pixel.renderType === 'color') {
      // ✅ color 类型：使用默认 UV，不采样纹理
      texCoords = { u0: 0, v0: 0, u1: 1, v1: 1 };
      textureSlot = 0; // 不重要，因为 Shader 会跳过纹理采样

    } else if (pixel.renderType === 'emoji') {
      // 🆕 emoji 类型：从 EmojiAtlasLoader 查询 UV（使用unicodeChar）
      const emojiChar = pixel.unicodeChar || pixel.patternKey; // 回退到patternKey

      texCoords = this.emojiAtlasLoader.getEmojiUV(emojiChar);

      if (!texCoords) {
        if (import.meta.env.DEV) {
          logger.warn(`⚠️ Emoji "${emojiChar}" 不在 Atlas 中，使用color回退`);
        }

        // 🔧 回退方案：尝试使用color类型渲染
        pixel.renderType = 'color';
        pixel.color = pixel.color || '#4ECDC4'; // 默认绿色（统一 fallback 颜色）
        this.updatePixel(pixel); // 递归调用，使用color类型
        return;
      }

      textureSlot = 1; // 使用 Emoji 纹理

    } else if (pixel.renderType === 'complex') {
      // ✅ complex 类型：从 Material 纹理图集查询 UV
      texCoords = this.complexTextureAtlas.getTexCoords(pixel.patternKey);

      if (!texCoords) {
        if (import.meta.env.DEV) {
          logger.warn(`⚠️ Material "${pixel.patternKey}" 不在图集中，使用color回退`);
        }

        // 🔧 回退方案：尝试使用color类型渲染（如用户头像加载失败）
        pixel.renderType = 'color';
        pixel.color = pixel.color || '#4ECDC4'; // 默认绿色（统一 fallback 颜色）
        this.updatePixel(pixel); // 递归调用，使用color类型
        return;
      }

      textureSlot = 0; // 使用 Complex 纹理
    }

    // 3. 生成顶点数据
    this.updateVertexData(slotIndex, pixel, texCoords!, textureSlot);

    // 4. 标记为脏
    this.dirtyPixels.add(pixel.gridId);
  }

  /**
   * 🆕 更新顶点数据（支持 textureSlot）
   */
  private updateVertexData(
    slotIndex: number,
    pixel: PixelData,
    texCoords: TextureCoords | EmojiUV,
    textureSlot: number
  ) {
    const { lat, lng, renderType, color } = pixel;

    // 🔍 [TRACE] 调试：记录像素数据
    if (slotIndex === 0) {
      logger.info(`🔍 [TRACE] updateVertexData 第一个像素: gridId=${pixel.gridId}, lat=${lat}, lng=${lng}, patternKey=${pixel.patternKey}, renderType=${renderType}`);
    }

    // 渲染类型标记
    let renderTypeFlag: number;
    if (renderType === 'color') {
      renderTypeFlag = 0.0;
    } else if (renderType === 'emoji') {
      renderTypeFlag = 1.0;
    } else {
      renderTypeFlag = 2.0;
    }

    // UV 坐标
    const u0 = texCoords.u0;
    const v0 = texCoords.v0;
    const u1 = texCoords.u1;
    const v1 = texCoords.v1;

    // 颜色处理
    let rgba: { r: number; g: number; b: number; a: number };
    if (renderType === 'color') {
      rgba = this.parseColor(color || '#4ECDC4'); // 默认绿色（统一 fallback 颜色）
    } else {
      // emoji 和 complex 使用白色（让纹理显示原色）
      rgba = { r: 1, g: 1, b: 1, a: 1 };
    }

    // 🎯 计算像素偏移 - 这是关键！
    // 每个像素应该是一个小方块，4个顶点需要略微不同的坐标
    // 根据zoom级别动态调整偏移大小，确保在不同缩放级别下都能看到
    let pixelOffset: number;
    if (this.currentZoom !== undefined) {
      // zoom越大，偏移越小（因为视野越小）
      // 基础偏移：在zoom=18时约为0.0001度（约10米）
      const rawOffset = 0.0001 * Math.pow(2, 18 - this.currentZoom);
      pixelOffset = Math.max(rawOffset, 0.00001); // 确保最小偏移，避免像素太小看不见
    } else {
      pixelOffset = 0.0001; // 默认偏移
    }

    // 计算顶点位置
    const offset = slotIndex * this.VERTICES_PER_PIXEL * this.VERTEX_SIZE;

    // 🔥 修复：现在shader将处理坐标转换，所以我们直接传递经纬度坐标
    // 🔥 关键修复：重新计算像素大小，确保在不同zoom下都可见
    let pixelSize: number;
    if (this.currentZoom !== undefined) {
      // 基础原理：
      // - 在 zoom=10 时，一个像素应该覆盖约100米（0.001度）
      // - 在 zoom=13 时，一个像素应该覆盖约30米（0.0003度）
      // - 在 zoom=15 时，一个像素应该覆盖约10米（0.0001度）
      // - 在 zoom=18 时，一个像素应该覆盖约2米（0.00002度）

      const baseZoom = 13;
      const baseSize = 0.0003; // 在zoom=13时约30米，足够可见

      // 正确的缩放逻辑：zoom增大时，像素应该变小（因为视野更详细）
      // zoom减小（缩小）：像素应该变大（确保仍然可见）
      const zoomFactor = Math.pow(0.7, this.currentZoom - baseZoom);
      pixelSize = baseSize * zoomFactor;

      // 确保最小和最大尺寸限制
      pixelSize = Math.max(pixelSize, 0.00001);  // 高zoom时最小约1米
      pixelSize = Math.min(pixelSize, 0.002);    // 低zoom时最大约200米

      logger.info(`🎯 [TRACE] Zoom=${this.currentZoom}, pixelSize=${pixelSize.toFixed(6)}度 (约${(pixelSize * 111000).toFixed(1)}米)`);
    } else {
      pixelSize = 0.0003; // 默认大小（约30米）
    }

    // 🆕 顶点数据：[lat, lng, u, v, r, g, b, a, renderType, textureSlot]
    // 直接传递经纬度坐标，让shader进行转换

    // 顶点 0（左上）
    this.vertexData[offset + 0] = lat - pixelSize;
    this.vertexData[offset + 1] = lng - pixelSize;
    this.vertexData[offset + 2] = u0;
    this.vertexData[offset + 3] = v1;
    this.vertexData[offset + 4] = rgba.r;
    this.vertexData[offset + 5] = rgba.g;
    this.vertexData[offset + 6] = rgba.b;
    this.vertexData[offset + 7] = rgba.a;
    this.vertexData[offset + 8] = renderTypeFlag;
    this.vertexData[offset + 9] = textureSlot;

    // 顶点 1（右上）
    this.vertexData[offset + 10] = lat - pixelSize;
    this.vertexData[offset + 11] = lng + pixelSize;
    this.vertexData[offset + 12] = u1;
    this.vertexData[offset + 13] = v1;
    this.vertexData[offset + 14] = rgba.r;
    this.vertexData[offset + 15] = rgba.g;
    this.vertexData[offset + 16] = rgba.b;
    this.vertexData[offset + 17] = rgba.a;
    this.vertexData[offset + 18] = renderTypeFlag;
    this.vertexData[offset + 19] = textureSlot;

    // 顶点 2（右下）
    this.vertexData[offset + 20] = lat + pixelSize;
    this.vertexData[offset + 21] = lng + pixelSize;
    this.vertexData[offset + 22] = u1;
    this.vertexData[offset + 23] = v0;
    this.vertexData[offset + 24] = rgba.r;
    this.vertexData[offset + 25] = rgba.g;
    this.vertexData[offset + 26] = rgba.b;
    this.vertexData[offset + 27] = rgba.a;
    this.vertexData[offset + 28] = renderTypeFlag;
    this.vertexData[offset + 29] = textureSlot;

    // 顶点 3（左下）
    this.vertexData[offset + 30] = lat + pixelSize;
    this.vertexData[offset + 31] = lng - pixelSize;
    this.vertexData[offset + 32] = u0;
    this.vertexData[offset + 33] = v0;
    this.vertexData[offset + 34] = rgba.r;
    this.vertexData[offset + 35] = rgba.g;
    this.vertexData[offset + 36] = rgba.b;
    this.vertexData[offset + 37] = rgba.a;
    this.vertexData[offset + 38] = renderTypeFlag;
    this.vertexData[offset + 39] = textureSlot;
  }

  private parseColor(colorStr: string): { r: number; g: number; b: number; a: number } {
    const hex = colorStr.replace('#', '');

    let r, g, b, a = 1.0;

    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
    } else if (hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
      a = parseInt(hex.substring(6, 8), 16) / 255;
    } else {
      r = 1.0;
      g = 0.0;
      b = 0.0;
    }

    return { r, g, b, a };
  }

  updateBatchPixels(pixels: PixelData[], zoom?: number) {
    // 🔥 关键修复：在批量更新像素前设置 currentZoom
    // 这样 updatePixel() 中的 pixelOffset 计算才能使用正确的 zoom 级别
    if (zoom !== undefined) {
      this.currentZoom = zoom;
    }

    const beforeSize = this.pixelIndexMap.size;
    logger.info(`🔄 [TRACE] updateBatchPixels开始: 输入${pixels.length}个像素, 当前pixelIndexMap=${beforeSize}, zoom=${zoom}`);

    // 🔥 关键修复：强制标记所有已存在的像素为dirty，确保重新计算坐标
    // 这确保了 zoom 变化时，所有像素的 pixelOffset 都会重新计算
    this.pixelIndexMap.forEach((_, gridId) => {
      this.dirtyPixels.add(gridId);
    });

    // 处理新的像素数据
    pixels.forEach(pixel => this.updatePixel(pixel));

    const afterSize = this.pixelIndexMap.size;
    logger.info(`✅ [TRACE] updateBatchPixels完成: pixelIndexMap=${afterSize} (增加${afterSize - beforeSize}个), dirtyPixels=${this.dirtyPixels.size}`);
  }

  removePixel(gridId: string) {
    const slotIndex = this.pixelIndexMap.get(gridId);

    if (slotIndex === undefined) return;

    const offset = slotIndex * this.VERTICES_PER_PIXEL * this.VERTEX_SIZE;
    this.vertexData.fill(0, offset, offset + this.VERTICES_PER_PIXEL * this.VERTEX_SIZE);

    this.freeSlots.push(slotIndex);
    this.pixelIndexMap.delete(gridId);
    this.dirtyPixels.add(gridId);
  }

  private uploadDirtyData() {
    // 🚀 性能优化：只上传dirty数据，而非整个缓冲区
    if (this.dirtyPixels.size === 0) {
      logger.debug(`🔍 [TRACE] uploadDirtyData: 没有dirty数据，跳过上传`);
      return;
    }

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    // 🔍 [TRACE] 检查vertexData中的实际数据
    if (this.vertexData && this.vertexData.length > 0) {
      const firstNonZeroIndex = Array.from(this.vertexData).findIndex(v => v !== 0);
      const hasValidData = firstNonZeroIndex !== -1;

      logger.info(`🔍 [TRACE] uploadDirtyData: dirtyPixels=${this.dirtyPixels.size}, vertexData长度=${this.vertexData.length}, 第一个非零值索引=${firstNonZeroIndex}`);

      if (!hasValidData) {
        logger.warn(`⚠️ [TRACE] uploadDirtyData: vertexData全为0！这可能是问题所在`);
      } else {
        logger.info(`✅ [TRACE] uploadDirtyData: vertexData包含有效数据`);
      }
    }

    // 🔥 性能优化：按需上传dirty像素数据
    // 如果dirty像素超过总数的50%，则上传整个缓冲区；否则按像素上传
    if (this.dirtyPixels.size > this.pixelIndexMap.size * 0.5) {
      logger.info(`📤 [TRACE] uploadDirtyData: 上传整个缓冲区 (${this.dirtyPixels.size} > ${this.pixelIndexMap.size * 0.5})`);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData);
    } else {
      // 逐个上传dirty像素
      logger.info(`📤 [TRACE] uploadDirtyData: 逐个上传${this.dirtyPixels.size}个dirty像素`);
      for (const gridId of this.dirtyPixels) {
        const slotIndex = this.pixelIndexMap.get(gridId);
        if (slotIndex !== undefined) {
          const offset = slotIndex * this.VERTICES_PER_PIXEL * this.VERTEX_SIZE;
          const size = this.VERTICES_PER_PIXEL * this.VERTEX_SIZE;
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            offset * 4, // 转为字节偏移
            this.vertexData.subarray(offset, offset + size)
          );
        }
      }
    }

    // 检查WebGL错误
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      logger.error(`❌ uploadDirtyData WebGL错误: ${error} (${this.getWebGLErrorString(error)})`);
    } else {
      logger.info(`✅ [TRACE] uploadDirtyData完成，无WebGL错误`);
    }

    // 清空dirty pixels标记
    this.dirtyPixels.clear();
  }

  /**
   * 🆕 渲染一帧（双纹理支持）
   */
  render(options: RenderOptions) {
    const gl = this.gl;

    if (!this.program || !this.locations || !this.atlasTexture || !this.emojiTexture) {
      logger.warn('⚠️ WebGL未初始化完成，跳过渲染');
      return;
    }

    // 🎯 更新当前zoom级别，用于动态计算像素偏移
    this.currentZoom = options.zoom;

    // 🚀 性能优化：大幅减少日志输出，只在debug模式下输出
    if (import.meta.env.DEV && this.pixelIndexMap.size === 0) {
      logger.debug("🔍 当前地图 zoom=", this.currentZoom, "像素数量=", this.pixelIndexMap.size);
    }

    // 上传脏数据
    this.uploadDirtyData();

    // 🔥 CRITICAL FIX: 不要设置viewport！MapLibre会管理viewport
    // 设置viewport会导致像素渲染在错误的坐标空间中
    // gl.viewport(0, 0, options.resolution.width, options.resolution.height);

    // 🚨 修复：不要清屏！这会清除MapLibre已经渲染的底图
    // gl.clearColor(0.0, 0.0, 0.0, 0.0);
    // gl.clear(gl.COLOR_BUFFER_BIT);

    // 🎯 关键修复：深度测试和深度写入
    // 保存当前状态（可选但推荐）
    const prevDepthTest = gl.getParameter(gl.DEPTH_TEST);
    const prevDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);
    const prevBlend = gl.getParameter(gl.BLEND);

    // 禁用深度测试并禁止深度写入
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);

    // 混合模式 - 确保像素能正确叠加在底图上
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 🎯 测试quad已禁用 - 已确认渲染管线工作
    // drawTestQuad会污染WebGL状态，导致实际像素无法渲染
    // logger.info('🔥 开始强制绘制测试quad');
    // this.drawTestQuad(gl);
    // gl.flush();
    // gl.finish();

    // 使用 Shader
    gl.useProgram(this.program);

    // 设置 Uniform
    gl.uniform2f(this.locations.u_mapCenter, options.mapCenter.lat, options.mapCenter.lng);
    gl.uniform1f(this.locations.u_zoom, options.zoom);
    gl.uniform2f(this.locations.u_resolution, options.resolution.width, options.resolution.height);
    gl.uniform1f(this.locations.u_pixelSize, options.pixelSize);

    // 🗺️ MapLibre GL矩阵支持：优先使用MapLibre提供的投影矩阵
    if (this.locations.u_matrix) {
      try {
        let matrix: Float32Array;

        if (options.matrix && this.isValidMatrix(options.matrix)) {
          // 确保matrix是Float32Array格式，WebGL2要求特定的可迭代对象
          if (options.matrix instanceof Float32Array) {
            matrix = options.matrix;
          } else if (Array.isArray(options.matrix) && options.matrix.length === 16) {
            matrix = new Float32Array(options.matrix);
          } else if (options.matrix.length === 16) {
            // 转换其他类型的可迭代对象
            matrix = new Float32Array(Array.from(options.matrix));
          } else {
            logger.warn('⚠️ MapLibre矩阵格式无效，使用回退矩阵');
            matrix = this.calculateProjectionMatrix(options);
          }

          gl.uniformMatrix4fv(this.locations.u_matrix, false, matrix);

          // 🚀 性能优化：只在DEV模式下验证矩阵（减少每帧计算）
          if (import.meta.env.DEV) {
            const hasNaN = Array.from(matrix).some(v => isNaN(v));
            const isAllZero = Array.from(matrix).every(v => v === 0);
            const hasInfinity = Array.from(matrix).some(v => !isFinite(v));

            if (hasNaN || isAllZero || hasInfinity) {
              logger.error('❌ 矩阵数据异常!', { hasNaN, isAllZero, hasInfinity });
            }
          }
        } else {
          // 回退到自定义矩阵计算（用于独立测试）
          matrix = this.calculateProjectionMatrix(options);
          gl.uniformMatrix4fv(this.locations.u_matrix, false, matrix);
        }

        // 🚀 性能优化：只在DEV模式下检查WebGL错误
        if (import.meta.env.DEV) {
          const error = gl.getError();
          if (error !== gl.NO_ERROR) {
            logger.error(`❌ uniformMatrix4fv WebGL错误: ${error} (${this.getWebGLErrorString(error)})`);
          }
        }

      } catch (error) {
        logger.error('❌ 矩阵处理失败，跳过矩阵设置:', error);
      }
    }

    // 🆕 绑定双纹理
    // Texture Unit 0: Complex Atlas
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(this.locations.u_complexAtlas, 0);

    // Texture Unit 1: Emoji Atlas
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.emojiTexture);
    gl.uniform1i(this.locations.u_emojiAtlas, 1);

    // 🔍 读取 Emoji 纹理的一个像素来验证数据（仅首次渲染时执行）
    if (this.emojiTexture && !this.emojiTextureValidated) {
      this.emojiTextureValidated = true;

      // 创建临时 framebuffer 来读取纹理数据
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.emojiTexture, 0);

      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
        const pixels = new Uint8Array(4);
        // 采样多个位置
        const samplePoints = [[100, 100], [500, 500], [1000, 1000]];

        for (const [x, y] of samplePoints) {
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          logger.info(`🎨 Emoji纹理像素采样[${x},${y}]: R=${pixels[0]}, G=${pixels[1]}, B=${pixels[2]}, A=${pixels[3]}`);
        }

        // 检查第一个采样点
        gl.readPixels(100, 100, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        if (pixels[0] === 0 && pixels[1] === 0 && pixels[2] === 0 && pixels[3] > 0) {
          logger.error('❌ 纹理数据是黑色的！图片上传到WebGL时出了问题！');
          logger.error('💡 可能原因：图片加载时的CORS问题、颜色空间转换或预乘Alpha问题');
        } else if (pixels[0] !== pixels[1] || pixels[1] !== pixels[2]) {
          logger.info('✅ 纹理数据包含彩色像素！');
        } else {
          logger.warn('⚠️ 纹理数据看起来是灰度的');
        }
      } else {
        logger.warn('⚠️ 无法创建framebuffer读取纹理数据');
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
    }

    // 绑定缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    // 设置 Attribute 指针（支持 textureSlot）
    const stride = this.VERTEX_SIZE * 4; // 10 个 float = 40 bytes

    gl.enableVertexAttribArray(this.locations.a_latLng);
    gl.vertexAttribPointer(this.locations.a_latLng, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(this.locations.a_texCoord);
    gl.vertexAttribPointer(this.locations.a_texCoord, 2, gl.FLOAT, false, stride, 8);

    gl.enableVertexAttribArray(this.locations.a_color);
    gl.vertexAttribPointer(this.locations.a_color, 4, gl.FLOAT, false, stride, 16);

    gl.enableVertexAttribArray(this.locations.a_renderType);
    gl.vertexAttribPointer(this.locations.a_renderType, 1, gl.FLOAT, false, stride, 32);

    // 🆕 新增：textureSlot 属性
    gl.enableVertexAttribArray(this.locations.a_textureSlot);
    gl.vertexAttribPointer(this.locations.a_textureSlot, 1, gl.FLOAT, false, stride, 36);

    // 绘制
    const pixelCount = this.pixelIndexMap.size;
    const indexCount = pixelCount * this.INDICES_PER_PIXEL;

    // 🔥 [TRACE] 追踪像素数量和绘制调用
    logger.info(`🎨 [TRACE] 准备绘制: pixelCount=${pixelCount}, indexCount=${indexCount}`);

    // 只有在有像素数据时才绘制
    if (pixelCount > 0) {
      // 🔥 [TRACE] 额外检查：确认vertex buffer数据
      if (this.vertexData && this.vertexData.length > 0) {
        const firstPixelLat = this.vertexData[0];
        const firstPixelLng = this.vertexData[1];
        const firstPixelColor = `R:${this.vertexData[4].toFixed(2)}, G:${this.vertexData[5].toFixed(2)}, B:${this.vertexData[6].toFixed(2)}, A:${this.vertexData[7].toFixed(2)}`;

        logger.info(`🔍 [TRACE] 第一个像素数据: lat=${firstPixelLat}, lng=${firstPixelLng}, color=${firstPixelColor}`);
        logger.info(`🔍 [TRACE] 当前zoom: ${this.currentZoom}, matrix有效: ${!!options.matrix}`);
      }

      logger.info(`✅ [TRACE] 调用 gl.drawElements(TRIANGLES, ${indexCount}, UNSIGNED_SHORT, 0)`);

      // 🔍 [TRACE] 关键状态检查
      logger.info(`🔍 [TRACE] 绘制前状态检查:`);
      logger.info(`  - program有效: ${!!this.program && gl.isProgram(this.program)}`);
      logger.info(`  - vertexBuffer有效: ${!!this.vertexBuffer && gl.isBuffer(this.vertexBuffer)}`);
      logger.info(`  - indexBuffer有效: ${!!this.indexBuffer && gl.isBuffer(this.indexBuffer)}`);
      logger.info(`  - vertexArrayBuffer: ${gl.getParameter(gl.ARRAY_BUFFER_BINDING)}`);
      logger.info(`  - elementArrayBuffer: ${gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)}`);
      logger.info(`  - INDEX_ARRAY_BUFFER绑定: ${!!this.indexBuffer}`);

      try {
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
        logger.info(`✅ [TRACE] gl.drawElements() 完成`);
      } catch (drawError) {
        logger.error(`❌ [TRACE] gl.drawElements() 抛出异常:`, drawError);
        logger.error(`  - 异常类型: ${drawError.constructor.name}`);
        logger.error(`  - 异常消息: ${drawError.message}`);

        // 尝试获取WebGL错误
        const glError = gl.getError();
        if (glError !== gl.NO_ERROR) {
          logger.error(`  - WebGL错误: ${glError} (${this.getWebGLErrorString(glError)})`);
        } else {
          logger.error(`  - WebGL无直接错误，可能是上下文或其他问题`);
        }

        // 检查WebGL上下文状态
        if (gl.isContextLost()) {
          logger.error(`  - WebGL上下文已丢失!`);
        }

        throw drawError;
      }

      // 🚀 性能优化：只在DEV模式下检查绘制错误
      if (import.meta.env.DEV) {
        const drawError = gl.getError();
        if (drawError !== gl.NO_ERROR) {
          logger.error(`❌ drawElements WebGL错误: ${drawError} (${this.getWebGLErrorString(drawError)})`);
        } else {
          logger.info(`✅ [TRACE] WebGL状态正常，无错误`);

          // 🔍 [TRACE] 额外检查：确认绘制后的状态
          const viewport = gl.getParameter(gl.VIEWPORT);
          logger.info(`🔍 [TRACE] 当前viewport: [${viewport[0]}, ${viewport[1]}, ${viewport[2]}, ${viewport[3]}]`);

          const blendEnabled = gl.getParameter(gl.BLEND);
          const depthTestEnabled = gl.getParameter(gl.DEPTH_TEST);
          logger.info(`🔍 [TRACE] WebGL状态: BLEND=${blendEnabled}, DEPTH_TEST=${depthTestEnabled}`);
        }
      }
    } else {
      logger.warn(`❌ [TRACE] pixelCount=0，跳过绘制`);

      // 🔍 [TRACE] 额外信息：为什么没有像素？
      logger.warn(`🔍 [TRACE] pixelIndexMap.size: ${this.pixelIndexMap.size}`);
      logger.warn(`🔍 [TRACE] vertexData length: ${this.vertexData?.length || 0}`);
      logger.warn(`🔍 [TRACE] currentZoom: ${this.currentZoom}`);
    }

    // 🎯 恢复WebGL状态（可选但推荐）
    if (prevDepthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
    gl.depthMask(prevDepthMask);
    if (!prevBlend) gl.disable(gl.BLEND);
  }

  /**
   * 完成 Complex 纹理图集
   */
  finalizeComplexAtlas() {
    this.atlasTexture = this.complexTextureAtlas.createGLTexture();

    if (!this.atlasTexture) {
      throw new Error('创建 Complex WebGL 纹理失败');
    }

    logger.info('✅ Complex 纹理图集已完成');
  }

  getTextureAtlas(): UnifiedTextureAtlas {
    return this.complexTextureAtlas;
  }

  getEmojiAtlasLoader(): EmojiAtlasLoader {
    return this.emojiAtlasLoader;
  }

  
  getStats() {
    return {
      pixelCount: this.pixelIndexMap.size,
      maxPixels: this.maxPixels,
      dirtyPixels: this.dirtyPixels.size,
      freeSlots: this.freeSlots.length,
      complexAtlasStats: this.complexTextureAtlas.getUsageStats(),
      emojiAtlasLoaded: this.emojiAtlasLoader.isLoaded(),
      supportedEmojis: this.emojiAtlasLoader.getSupportedEmojis().length
    };
  }

  /**
   * 验证矩阵是否有效
   */
  private isValidMatrix(matrix: any): boolean {
    return matrix && (
      (matrix instanceof Float32Array && matrix.length === 16) ||
      (Array.isArray(matrix) && matrix.length === 16) ||
      (typeof matrix.length === 'number' && matrix.length === 16)
    );
  }

  /**
   * 获取WebGL错误字符串
   */
  private getWebGLErrorString(error: number): string {
    const gl = this.gl;
    switch (error) {
      case gl.NO_ERROR: return 'NO_ERROR';
      case gl.INVALID_ENUM: return 'INVALID_ENUM';
      case gl.INVALID_VALUE: return 'INVALID_VALUE';
      case gl.INVALID_OPERATION: return 'INVALID_OPERATION';
      case gl.INVALID_FRAMEBUFFER_OPERATION: return 'INVALID_FRAMEBUFFER_OPERATION';
      case gl.OUT_OF_MEMORY: return 'OUT_OF_MEMORY';
      case gl.CONTEXT_LOST_WEBGL: return 'CONTEXT_LOST_WEBGL';
      default: return `UNKNOWN_ERROR (${error})`;
    }
  }

  /**
   * 计算自定义投影矩阵（回退方案）
   */
  private calculateProjectionMatrix(options: RenderOptions): Float32Array {
    // 简单的正交投影矩阵，用于测试
    const aspectRatio = options.resolution.width / options.resolution.height;
    const zoom = Math.max(1, options.zoom);

    // 创建正交投影矩阵
    const matrix = [
      2 / (aspectRatio * zoom), 0, 0, 0,
      0, -2 / zoom, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];

    return new Float32Array(matrix);
  }

  dispose() {
    const gl = this.gl;

    if (this.vertexBuffer) {
      gl.deleteBuffer(this.vertexBuffer);
    }

    if (this.indexBuffer) {
      gl.deleteBuffer(this.indexBuffer);
    }

    if (this.atlasTexture) {
      gl.deleteTexture(this.atlasTexture);
    }

    if (this.emojiTexture) {
      gl.deleteTexture(this.emojiTexture);
    }

    if (this.program) {
      gl.deleteProgram(this.program);
    }

    this.emojiAtlasLoader.dispose();

    logger.info('🗑️ WebGLPixelRenderer v2 已清理');
  }

  /**
   * 🧭 4x4矩阵变换辅助函数 - 用于调试坐标转换
   */
  private transformMatrix4(matrix: Float32Array, vector: number[]): number[] {
    const result = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i] += matrix[i * 4 + j] * vector[j];
      }
    }
    return result;
  }
}
