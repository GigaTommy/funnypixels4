const crypto = require('crypto');
const sharp = require('sharp');
const { db } = require('../config/database');
const TileUtils = require('../utils/tileUtils');
const logger = require('../utils/logger');
const materialRendererCache = require('./materialRendererCache');
const TileCacheService = require('./tileCacheService');
// 注意：已移除tileRenderQueue - Canvas 2D瓦片渲染系统已被废弃

const TABLE_MATERIAL_ASSETS = 'material_assets';
const TABLE_MATERIAL_VARIANTS = 'material_variants';
const TABLE_PATTERN_ASSETS = 'pattern_assets';

class MaterialAssetService {
  constructor() {
    this.config = {
      maxUploadSizeBytes: 2 * 1024 * 1024, // 2MB
      minDimension: 16,
      maxDimension: 512,
      spriteSheet: {
        minSize: 64,
        padding: 8
      },
      distanceField: {
        size: 128,
        blurRadius: 4
      },
      invalidation: {
        zoomLevels: [8, 10, 12, 14, 16, 18],
        maxTiles: 3000,
        maxPixelsPerPattern: 8000
      }
    };
  }

  /**
   * 解析并解码 Base64 图片
   * @param {string|Buffer} input
   * @param {string} [explicitMime]
   * @returns {{ buffer: Buffer, mimeType: string }}
   */
  decodeBase64Image(input, explicitMime) {
    if (!input) {
      throw new Error('素材数据不能为空');
    }

    if (Buffer.isBuffer(input)) {
      return { buffer: input, mimeType: explicitMime || 'image/png' };
    }

    if (typeof input !== 'string') {
      throw new Error('素材数据格式不正确');
    }

    let mimeType = explicitMime || 'image/png';
    let base64String = input;

    if (input.startsWith('data:')) {
      const matches = input.match(/^data:(.*?);base64,(.*)$/);
      if (!matches) {
        throw new Error('Base64 DataURL 格式无效');
      }
      mimeType = matches[1];
      base64String = matches[2];
    }

    const buffer = Buffer.from(base64String, 'base64');

    return { buffer, mimeType };
  }

  /**
   * 校验图片尺寸与格式
   * @param {Buffer} buffer
   * @returns {Promise<object>}
   */
  async validateImageBuffer(buffer) {
    if (!buffer || !buffer.length) {
      throw new Error('素材文件不能为空');
    }

    if (buffer.length > this.config.maxUploadSizeBytes) {
      throw new Error('素材文件过大，最大支持 2MB');
    }

    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('无法解析素材尺寸');
    }

    if (metadata.width < this.config.minDimension || metadata.height < this.config.minDimension) {
      throw new Error(`素材尺寸过小，最小需要 ${this.config.minDimension}px`);
    }

    if (metadata.width > this.config.maxDimension || metadata.height > this.config.maxDimension) {
      throw new Error(`素材尺寸过大，最大支持 ${this.config.maxDimension}px`);
    }

    if (!['png', 'webp', 'avif'].includes(metadata.format)) {
      throw new Error('仅支持 PNG / WebP / AVIF 素材');
    }

    return metadata;
  }

  /**
   * 渲染标准 Emoji 字形
   * @param {string} unicode
   * @param {string} fontFamily
   * @param {number} glyphSize
   */
  async renderEmojiGlyph(unicode, fontFamily = 'Noto Color Emoji', glyphSize = 128) {
    if (!unicode) {
      throw new Error('Emoji 字符不能为空');
    }

    const size = Math.max(this.config.minDimension, glyphSize);

    // 使用 Sharp 创建一个简单的白色背景图像
    // 注意：这里不再渲染实际的 emoji，只是返回一个占位符图像
    // 因为 Canvas 渲染系统已被移除
    const buffer = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .png()
      .toBuffer();

    return {
      buffer,
      width: size,
      height: size,
      format: 'png'
    };
  }

  /**
   * 计算校验值
   * @param {Buffer} buffer
   */
  computeChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * 求不小于输入的 2 的幂
   */
  nextPowerOfTwo(value) {
    let n = 1;
    while (n < value) {
      n *= 2;
    }
    return n;
  }

  /**
   * 生成雪碧图 - 修复：保持原始尺寸以提高存取效率
   * @param {Buffer} buffer
   * @param {number} width
   * @param {number} height
   */
  async generateSpriteSheet(buffer, width, height) {
    // ✅ 修复：对于用户自定义旗帜，保持原始尺寸避免扩展
    // 只在尺寸过小时进行最小尺寸保证，不强制使用2的幂
    const minSize = this.config.spriteSheet.minSize;
    const targetWidth = Math.max(width, minSize);
    const targetHeight = Math.max(height, minSize);

    // 如果原始尺寸已经满足最小尺寸要求，直接使用原始尺寸
    const sheetWidth = targetWidth;
    const sheetHeight = targetHeight;
    const padding = this.config.spriteSheet.padding;
    const totalWidth = sheetWidth + padding * 2;
    const totalHeight = sheetHeight + padding * 2;

    // 计算居中位置
    const top = padding + Math.floor((totalHeight - sheetHeight) / 2);
    const left = padding + Math.floor((totalWidth - sheetWidth) / 2);

    const composite = await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([
        { input: buffer, top, left }
      ])
      .png()
      .toBuffer();

    return {
      buffer: composite,
      width: totalWidth,
      height: totalHeight,
      format: 'png', // ✅ 修复：使用文件扩展名而不是MIME类型
      metadata: {
        cellSize: Math.max(totalWidth, totalHeight),
        padding,
        origin: { x: left, y: top },
        sourceSize: { width, height },
        // 添加原始尺寸信息以便渲染时正确缩放
        originalSize: { width, height },
        scaleRatio: { x: width / sheetWidth, y: height / sheetHeight }
      }
    };
  }

  /**
   * 生成距离场纹理 - 修复：优化尺寸处理以提高效率
   * @param {Buffer} buffer
   * @param {number} width
   * @param {number} height
   */
  async generateDistanceField(buffer, width, height) {
    // ✅ 修复：根据原始尺寸智能调整距离场尺寸，避免过度扩展
    const maxDimension = Math.max(width, height);
    const minSdfSize = this.config.distanceField.size;

    // 对于小尺寸图案，使用标准距离场尺寸
    // 对于大尺寸图案，使用合适的尺寸避免内存浪费
    let sdfSize = minSdfSize;
    if (maxDimension > minSdfSize) {
      // 对于大图案，按比例缩放但限制最大尺寸
      sdfSize = Math.min(maxDimension, minSdfSize * 2);
    }

    const padding = this.config.spriteSheet.padding;
    const targetSize = Math.max(sdfSize - padding * 2, 16);

    const sdfBuffer = await sharp(buffer)
      .ensureAlpha()
      .resize({
        width: targetSize,
        height: targetSize,
        fit: 'contain', // 修复：使用contain保持完整图像
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toColourspace('b-w')
      .gamma()
      .blur(this.config.distanceField.blurRadius)
      .normalize()
      .png()
      .toBuffer();

    return {
      buffer: sdfBuffer,
      width: sdfSize,
      height: sdfSize,
      format: 'png', // ✅ 修复：使用文件扩展名而不是MIME类型
      metadata: {
        radius: this.config.distanceField.blurRadius,
        baseSize: { width, height },
        targetSize,
        scaleRatio: Math.max(width, height) / targetSize
      }
    };
  }

  /**
   * 为标准 Emoji 生成或复用素材
   */
  async ensureStandardEmojiMaterial({ unicode, fontFamily = 'Noto Color Emoji', glyphSize = 128, key, uploadedBy }) {
    if (!unicode) {
      throw new Error('缺少 emoji 字符');
    }

    const normalizedKey = key || `emoji_${this.getUnicodeKey(unicode)}`;

    const { buffer, width, height, format } = await this.renderEmojiGlyph(unicode, fontFamily, glyphSize);

    return this.persistMaterial({
      key: normalizedKey,
      displayName: unicode,
      materialType: 'standard_emoji',
      sourceType: 'unicode_font',
      unicode,
      fontFamily,
      baseBuffer: buffer,
      format,
      width,
      height,
      uploadedBy,
      metadataExtra: {
        unicode,
        fontFamily,
        glyphSize
      }
    });
  }

  /**
   * 创建自定义贴图素材
   */
  async createCustomStickerMaterial({ base64, buffer, key, fileName, mimeType, uploadedBy }) {
    const identifier = key || `sticker_${crypto.randomUUID()}`;
    const decoded = buffer ? { buffer, mimeType: mimeType || 'image/png' } : this.decodeBase64Image(base64, mimeType);
    const meta = await this.validateImageBuffer(decoded.buffer);

    const detectedMime = `image/${meta.format || 'png'}`;

    return this.persistMaterial({
      key: identifier,
      displayName: fileName || identifier,
      materialType: 'custom_sticker',
      sourceType: 'upload',
      baseBuffer: decoded.buffer,
      format: detectedMime,
      width: meta.width,
      height: meta.height,
      uploadedBy,
      metadataExtra: {
        originalFileName: fileName || null,
        originalMimeType: mimeType || detectedMime
      }
    });
  }

  /**
   * 保存素材并生成衍生资源
   */
  async persistMaterial({
    key,
    displayName,
    materialType,
    sourceType,
    unicode,
    fontFamily,
    baseBuffer,
    format,
    width,
    height,
    uploadedBy,
    metadataExtra = {}
  }) {
    if (!key) {
      throw new Error('素材 key 不能为空');
    }

    const checksum = this.computeChecksum(baseBuffer);

    const existing = await db(TABLE_MATERIAL_ASSETS).where({ key }).first();

    if (existing && existing.checksum === checksum && existing.status === 'ready') {
      logger.info(`♻️ 素材 ${key} 已存在且无变化，直接复用`);
      const variants = await this.loadVariants(existing.id, existing.version);
      return {
        material: existing,
        metadata: typeof existing.metadata === 'string' ? this.safeJsonParse(existing.metadata) : existing.metadata || {},
        variants,
        previewPayload: variants.spriteSheet?.payload || null,
        previewEncoding: variants.spriteSheet ? this.mapFormatToEncoding(variants.spriteSheet.format) : null
      };
    }

    const baseMetadata = {
      ...metadataExtra,
      sourceType,
      format,
      width,
      height,
      checksum
    };

    let materialId;
    let version = 1;
    let isUpdate = false;

    if (existing) {
      version = existing.version + 1;
      isUpdate = true;
      await db(TABLE_MATERIAL_ASSETS)
        .where({ id: existing.id })
        .update({
          display_name: displayName,
          material_type: materialType,
          source_type: sourceType,
          status: 'processing',
          unicode_codepoint: unicode ? this.getUnicodeKey(unicode) : null,
          font_family: fontFamily || null,
          width,
          height,
          file_format: format,
          file_size: baseBuffer.length,
          checksum,
          metadata: baseMetadata,
          version,
          updated_at: db.fn.now(),
          processed_at: null,
          failed_at: null,
          failure_reason: null
        });
      materialId = existing.id;
    } else {
      const [inserted] = await db(TABLE_MATERIAL_ASSETS)
        .insert({
          key,
          display_name: displayName,
          material_type: materialType,
          source_type: sourceType,
          status: 'processing',
          unicode_codepoint: unicode ? this.getUnicodeKey(unicode) : null,
          font_family: fontFamily || null,
          width,
          height,
          file_format: format,
          file_size: baseBuffer.length,
          checksum,
          metadata: baseMetadata,
          version,
          uploaded_by: uploadedBy || null
        })
        .returning('*');

      materialId = inserted.id;
    }

    const spriteSheet = await this.generateSpriteSheet(baseBuffer, width, height);
    const distanceField = await this.generateDistanceField(baseBuffer, width, height);

    const spriteVariant = await this.registerVariant({
      materialId,
      variantType: 'sprite_sheet',
      version,
      buffer: spriteSheet.buffer,
      format: spriteSheet.format,
      width: spriteSheet.width,
      height: spriteSheet.height,
      metadata: spriteSheet.metadata
    });

    const distanceVariant = await this.registerVariant({
      materialId,
      variantType: 'distance_field',
      version,
      buffer: distanceField.buffer,
      format: distanceField.format,
      width: distanceField.width,
      height: distanceField.height,
      metadata: distanceField.metadata
    });

    // ✅ 修复：将MIME类型转换为文件扩展名
    const sourceFormat = format.replace('image/', '');

    const sourceVariant = await this.registerVariant({
      materialId,
      variantType: 'source',
      version,
      buffer: baseBuffer,
      format: sourceFormat,
      width,
      height,
      metadata: metadataExtra
    });

    const metadata = {
      source: this.pickVariantMetadata(sourceVariant),
      spriteSheet: this.pickVariantMetadata(spriteVariant),
      distanceField: this.pickVariantMetadata(distanceVariant)
    };

    await db(TABLE_MATERIAL_ASSETS)
      .where({ id: materialId })
      .update({
        status: 'ready',
        processed_at: db.fn.now(),
        metadata,
        updated_at: db.fn.now(),
        version
      });

    const material = await db(TABLE_MATERIAL_ASSETS).where({ id: materialId }).first();

    if (isUpdate) {
      await db(TABLE_PATTERN_ASSETS)
        .where({ material_id: materialId })
        .update({
          material_version: version,
          material_metadata: metadata,
          updated_at: db.fn.now()
        });
    }

    await this.invalidateRendererCaches(materialId);

    if (isUpdate) {
      await this.triggerTileInvalidation(materialId);
    }

    return {
      material,
      metadata,
      variants: {
        source: sourceVariant,
        spriteSheet: spriteVariant,
        distanceField: distanceVariant
      },
      previewPayload: spriteVariant.payload || null,
      previewEncoding: this.mapFormatToEncoding(spriteVariant.format)
    };
  }

  mapFormatToEncoding(format) {
    switch (format) {
      case 'image/png':
      case 'png':
        return 'png_base64';
      case 'image/webp':
      case 'webp':
        return 'webp_base64';
      default:
        return 'png_base64';
    }
  }

  pickVariantMetadata(variant) {
    if (!variant) {
      return null;
    }
    return {
      id: variant.id,
      format: variant.format,
      width: variant.width,
      height: variant.height,
      sizeBytes: typeof variant.size_bytes === 'string' ? parseInt(variant.size_bytes, 10) : variant.size_bytes,
      checksum: variant.checksum,
      metadata: variant.metadata
    };
  }

  async registerVariant({ materialId, variantType, version, buffer, format, width, height, metadata }) {
    const checksum = buffer ? this.computeChecksum(buffer) : null;
    const sizeBytes = buffer ? buffer.length : 0;

    // ✅ 使用存储适配器上传文件到本地/CDN
    let cdnUrl = null;
    let storagePath = null;
    let fileHash = null;
    let payload = null; // 默认不保存payload

    if (buffer) {
      try {
        const { getMaterialStorage } = require('./storage');
        const storage = getMaterialStorage();

        // 构建文件名：{materialId}_{variantType}.{format}
        const fileName = `${materialId}_${variantType}.${format}`;

        // 上传到存储
        const uploadResult = await storage.upload(buffer, {
          fileName,
          variantType,
          materialId,
          format
        });

        cdnUrl = uploadResult.cdnUrl;
        storagePath = uploadResult.storagePath;
        fileHash = uploadResult.fileHash;

        logger.info(`✅ Material变体已上传: ${variantType} -> ${cdnUrl}`);
      } catch (error) {
        logger.error(`❌ Material变体上传失败: ${variantType}`, error);
        // 上传失败时，回退到payload存储（仅开发环境）
        if (process.env.NODE_ENV === 'development') {
          logger.warn('⚠️ 上传失败，使用payload作为fallback');
          payload = buffer.toString('base64');
        } else {
          throw error; // 生产环境不允许fallback
        }
      }
    }

    // 标记旧版本为不活跃
    await db(TABLE_MATERIAL_VARIANTS)
      .where({ material_id: materialId, variant_type: variantType })
      .update({ is_active: false, updated_at: db.fn.now() });

    // 插入新版本
    const [variant] = await db(TABLE_MATERIAL_VARIANTS)
      .insert({
        material_id: materialId,
        variant_type: variantType,
        format,
        width,
        height,
        size_bytes: sizeBytes,
        checksum,
        cdn_url: cdnUrl,
        storage_path: storagePath,
        file_hash: fileHash,
        payload, // 仅在上传失败时的fallback
        metadata,
        version,
        is_active: true
      })
      .returning('*');

    return variant;
  }

  async loadVariants(materialId, version) {
    const records = await db(TABLE_MATERIAL_VARIANTS)
      .where({ material_id: materialId, version })
      .select('*');

    const byType = {};
    for (const record of records) {
      switch (record.variant_type) {
        case 'sprite_sheet':
          byType.spriteSheet = record;
          break;
        case 'distance_field':
          byType.distanceField = record;
          break;
        case 'source':
          byType.source = record;
          break;
        default:
          byType[record.variant_type] = record;
      }
    }
    return byType;
  }

  safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      logger.warn('素材 metadata 解析失败', error);
      return {};
    }
  }

  async getActiveVariant(materialId, variantType, expectedVersion) {
    const query = db(TABLE_MATERIAL_VARIANTS)
      .where({ material_id: materialId, variant_type: variantType, is_active: true })
      .orderBy('version', 'desc');

    if (expectedVersion) {
      query.where({ version: expectedVersion });
    }

    const variant = await query.first();
    if (!variant) {
      return null;
    }

    return this.fillPayloadFromFile(variant);
  }

  /**
   * 从文件系统加载payload（如果数据库和CDN中都没有）
   * @param {Object} variant - Variant 对象
   * @returns {Promise<Object>} 处理后的 Variant 对象
   */
  async fillPayloadFromFile(variant) {
    if (variant.payload || variant.storage_key) {
      return variant;
    }

    const fs = require('fs');
    const path = require('path');

    const materialIdStr = String(variant.material_id);
    const prefix1 = materialIdStr.substring(0, 2);
    const prefix2 = materialIdStr.substring(2, 4);
    const variantType = variant.variant_type;
    const format = variant.format || 'png';
    const fileName = `${variant.material_id}_${variantType}.${format}`;
    const filePath = path.join(
      __dirname,
      '../../public/uploads/materials',
      variantType,
      prefix1,
      prefix2,
      fileName
    );

    try {
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        variant.payload = fileBuffer.toString('base64');
        logger.debug(`✅ 从文件加载Material payload: ${filePath} (${fileBuffer.length} bytes)`);
      } else {
        logger.warn(`⚠️ Material文件不存在: ${filePath}`);
      }
    } catch (fileError) {
      logger.error(`❌ 读取Material文件失败: ${filePath}`, fileError);
    }

    return variant;
  }

  async getMaterialById(materialId) {
    if (!materialId) {
      return null;
    }
    return db(TABLE_MATERIAL_ASSETS).where({ id: materialId }).first();
  }

  getUnicodeKey(unicode) {
    const codepoints = [];
    for (const symbol of Array.from(unicode)) {
      const code = symbol.codePointAt(0);
      if (code !== undefined) {
        codepoints.push(code.toString(16));
      }
    }
    return codepoints.join('_');
  }

  async invalidateRendererCaches(materialId) {
    materialRendererCache.invalidateMaterial(materialId);
    materialRendererCache.invalidatePatternsByMaterial(materialId);
  }

  async triggerTileInvalidation(materialId) {
    try {
      const patterns = await db(TABLE_PATTERN_ASSETS)
        .select('id', 'key')
        .where({ material_id: materialId })
        .whereNull('deleted_at');

      if (!patterns.length) {
        return;
      }

      const tileIds = new Set();

      for (const pattern of patterns) {
        const identifiers = new Set([
          pattern.key,
          String(pattern.id),
          `pattern_${pattern.id}`
        ]);

        const pixelQuery = db('pixels')
          .select('latitude', 'longitude')
          .where(builder => {
            let first = true;
            for (const ident of identifiers) {
              if (!ident) continue;
              if (first) {
                builder.where('pattern_id', ident);
                first = false;
              } else {
                builder.orWhere('pattern_id', ident);
              }
            }
          })
          .limit(this.config.invalidation.maxPixelsPerPattern);

        const pixels = await pixelQuery;

        for (const pixel of pixels) {
          for (const zoom of this.config.invalidation.zoomLevels) {
            const tile = TileUtils.latLngToTile(pixel.latitude, pixel.longitude, zoom);
            const tileId = TileUtils.getTileId(tile.x, tile.y, zoom);
            tileIds.add(tileId);
            if (tileIds.size >= this.config.invalidation.maxTiles) {
              break;
            }
          }
          if (tileIds.size >= this.config.invalidation.maxTiles) {
            break;
          }
        }

        if (tileIds.size >= this.config.invalidation.maxTiles) {
          logger.warn(`素材 ${materialId} 触发的瓦片数达到上限 ${this.config.invalidation.maxTiles}`);
          break;
        }
      }

      logger.info(`🧼 素材 ${materialId} 更新，需刷新 ${tileIds.size} 个瓦片`);

      for (const tileId of tileIds) {
        await TileCacheService.invalidate(tileId);
        // 注意：Canvas 2D瓦片渲染系统已被废弃，无需触发瓦片重渲
        // 像素现在由客户端MapLibre GL直接渲染
      }
    } catch (error) {
      logger.error('素材更新触发瓦片重渲失败', { materialId, error: error.message });
    }
  }

  /**
   * 获取Material变体列表
   * @param {string|number} materialId - Material ID
   * @param {string} variantType - 变体类型 (sprite_sheet, distance_field, source)
   * @returns {Promise<Array>} Material变体列表
   */
  async getMaterialVariants(materialId, variantType = 'sprite_sheet') {
    try {
      const variants = await db(TABLE_MATERIAL_VARIANTS)
        .where({
          material_id: materialId,
          variant_type: variantType,
          is_active: true
        })
        .orderBy('version', 'desc')
        .orderBy('created_at', 'desc');

      logger.debug(`🎨 获取Material变体: materialId=${materialId}, variant=${variantType}, count=${variants.length}`);

      for (const variant of variants) {
        await this.fillPayloadFromFile(variant);
      }

      return variants;

    } catch (error) {
      logger.error('❌ 获取Material变体失败:', { materialId, variantType, error: error.message });
      return [];
    }
  }

  /**
   * 根据变体ID获取Material变体详情
   * @param {string|number} variantId - 变体ID
   * @returns {Promise<Object|null>} Material变体详情
   */
  async getMaterialVariantById(variantId) {
    try {
      const variant = await db(TABLE_MATERIAL_VARIANTS)
        .where({
          id: variantId,
          is_active: true
        })
        .first();

      logger.debug(`🎨 获取Material变体详情: variantId=${variantId}, found=${!!variant}`);
      return variant;

    } catch (error) {
      logger.error('❌ 获取Material变体详情失败:', { variantId, error: error.message });
      return null;
    }
  }

  /**
   * 获取Material系统统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getMaterialStats() {
    try {
      const [assetCount, variantCount, activeVariantCount] = await Promise.all([
        db(TABLE_MATERIAL_ASSETS).count('* as count').first(),
        db(TABLE_MATERIAL_VARIANTS).count('* as count').first(),
        db(TABLE_MATERIAL_VARIANTS).where('is_active', true).count('* as count').first()
      ]);

      const [sizeStats] = await db(TABLE_MATERIAL_VARIANTS)
        .select('variant_type')
        .count('* as count')
        .sum('size_bytes as total_size')
        .where('is_active', true)
        .groupBy('variant_type');

      const [recentUpload] = await db(TABLE_MATERIAL_ASSETS)
        .select('created_at')
        .orderBy('created_at', 'desc')
        .first();

      const stats = {
        total_materials: parseInt(assetCount.count) || 0,
        total_variants: parseInt(variantCount.count) || 0,
        active_variants: parseInt(activeVariantCount.count) || 0,
        size_breakdown: sizeStats || {},
        last_upload: recentUpload?.created_at || null,
        storage_enabled: !!process.env.CDN_BASE_URL,
        storage_type: process.env.CDN_PROVIDER || 'local'
      };

      logger.debug('📊 Material系统统计:', stats);
      return stats;

    } catch (error) {
      logger.error('❌ 获取Material统计失败:', error);
      return {
        total_materials: 0,
        total_variants: 0,
        active_variants: 0,
        size_breakdown: {},
        last_upload: null,
        storage_enabled: false,
        storage_type: 'error'
      };
    }
  }
}

module.exports = new MaterialAssetService();
