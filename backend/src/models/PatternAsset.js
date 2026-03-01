const crypto = require('crypto');
const { db } = require('../config/database');
const MaterialAssetService = require('../services/materialAssetService');

class PatternAsset {
  constructor(data) {
    this.id = data.id;
    this.key = data.key;
    this.name = data.name;
    this.description = data.description;
    this.category = data.category;
    this.render_type = data.render_type;
    this.unicode_char = data.unicode_char;
    this.color = data.color; // 添加color字段
    this.width = data.width;
    this.height = data.height;
    this.encoding = data.encoding;
    this.payload = data.payload;
    this.image_url = data.image_url; // 添加image_url字段
    this.verified = data.verified;
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.deleted_at = data.deleted_at;
    this.material_id = data.material_id;
    this.material_version = data.material_version;
    this.material_metadata = data.material_metadata || {};
  }

  // 创建图案资源
  static async create(patternData) {
    const {
      key,
      name,
      category,
      width,
      height,
      encoding,
      payload,
      render_type,
      created_by,
      verified = false,
      unicode_char,
      color,
      material_config = {},
      image_url, // 添加image_url
      material_id,
      material_version,
      material_metadata
    } = patternData;

    // 验证尺寸限制 - 增大到64x64
    if (width > 64 || height > 64) {
      throw new Error('图案尺寸不能超过64x64');
    }

    const prepared = await PatternAsset.preparePatternData({
      key,
      encoding,
      payload,
      render_type,
      unicode_char,
      material_config,
      created_by,
      image_url: image_url || patternData.image_url, // 传递image_url
      material_id,
      material_version,
      material_metadata
    });

    const finalEncoding = prepared.encoding || encoding;
    const finalPayload = prepared.payload || payload;
    const finalRenderType = prepared.renderType;
    const finalUnicode = prepared.unicodeChar || unicode_char || null;
    const finalMaterialId = prepared.materialId || null;
    const finalMaterialVersion = prepared.materialVersion || 1;
    const finalMaterialMetadata = prepared.materialMetadata || {};
    const finalImageUrl = prepared.imageUrl || image_url || null; // 获取最终image_url

    // ✅ 改进：支持Material System编码（Plan B优化）
    // 验证编码格式
    if (!['rle', 'png_base64', 'png_url', 'material'].includes(finalEncoding)) {
      throw new Error('不支持的编码格式');
    }

    // 验证payload（material encoding不需要payload）
    if (finalEncoding === 'rle') {
      if (!PatternAsset.validateRLEPayload(finalPayload, width, height)) {
        throw new Error('RLE编码数据格式无效');
      }
    } else if (finalEncoding === 'png_base64') {
      if (!PatternAsset.validatePNGBase64(finalPayload)) {
        throw new Error('PNG base64数据格式无效');
      }
    } else if (finalEncoding === 'png_url') {
      if (!finalPayload || !finalPayload.startsWith('/uploads/')) {
        throw new Error('PNG URL格式无效');
      }
    } else if (finalEncoding === 'material') {
      // ✅ Material System编码不需要payload验证
      console.log(`✅ 使用Material System编码，Material ID: ${finalMaterialId}`);
      if (!finalMaterialId) {
        throw new Error('Material编码必须提供Material ID');
      }
    }

    const [pattern] = await db('pattern_assets')
      .insert({
        key,
        name: name || key,
        category,
        width,
        height,
        encoding: finalEncoding,
        payload: finalPayload,
        render_type: finalRenderType,
        unicode_char: finalUnicode,
        color,
        verified,
        created_by,
        material_id: finalMaterialId,
        material_version: finalMaterialVersion,
        material_metadata: finalMaterialMetadata
      })
      .returning('*');

    return new PatternAsset(pattern);
  }

  // 根据ID获取图案
  static async getById(id) {
    const pattern = await db('pattern_assets')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    return pattern ? new PatternAsset(pattern) : null;
  }

  // 根据key获取图案
  static async getByKey(key) {
    const pattern = await db('pattern_assets')
      .where('key', key)
      .whereNull('deleted_at')
      .first();

    return pattern ? new PatternAsset(pattern) : null;
  }

  // 获取图案清单（用于客户端预加载）
  static async getManifest() {
    try {
      // 首先检查表结构，只选择存在的字段
      const tableInfo = await db.raw(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'pattern_assets' 
        AND table_schema = current_schema()
      `);

      const availableColumns = tableInfo.rows.map(row => row.column_name);
      console.log('pattern_assets 表可用字段:', availableColumns);

      // 构建安全的查询字段列表
      const selectFields = ['id', 'updated_at'];
      const optionalFields = ['key', 'name', 'category', 'render_type', 'unicode_char', 'color', 'width', 'height', 'encoding', 'verified', 'payload', 'material_id', 'material_version', 'material_metadata'];

      for (const field of optionalFields) {
        if (availableColumns.includes(field)) {
          selectFields.push(field);
        }
      }

      console.log('将查询的字段:', selectFields);

      const patterns = await db('pattern_assets')
        .select(selectFields)
        .whereNull('deleted_at')
        .orderBy(availableColumns.includes('key') ? 'key' : 'id');

      // 生成清单版本号（基于所有图案的最新更新时间）
      const latestUpdate = patterns.reduce((latest, pattern) => {
        const updateTime = new Date(pattern.updated_at).getTime();
        return updateTime > latest ? updateTime : latest;
      }, 0);

      return {
        version: latestUpdate.toString(),
        patterns: patterns.map(pattern => {
          const renderType = pattern.render_type || 'simple';
          return {
            id: pattern.id,
            key: pattern.key || `pattern_${pattern.id}`,
            name: pattern.name || `Pattern ${pattern.id}`,
            category: pattern.category || 'default',
            render_type: renderType,
            unicode_char: renderType === 'emoji' ? (pattern.unicode_char || '●') : pattern.unicode_char,
            color: renderType === 'color' ? (pattern.color || '#000000') : pattern.color,
            width: pattern.width || 32,
            height: pattern.height || 32,
            encoding: pattern.encoding || 'rle',
            verified: pattern.verified || false,
            material_id: pattern.material_id || null,
            material_version: pattern.material_version || 1,
            material_metadata: typeof pattern.material_metadata === 'string' ? PatternAsset.safeJsonParse(pattern.material_metadata) : pattern.material_metadata || {},
            updated_at: pattern.updated_at,
            hash: PatternAsset.generateHash(pattern.payload || pattern.key || pattern.id)
          };
        })
      };
    } catch (error) {
      console.error('获取图案清单失败:', error);
      // 返回空清单而不是抛出错误
      return {
        version: Date.now().toString(),
        patterns: []
      };
    }
  }

  // 获取图案变更列表（增量同步）
  static async getChanges(sinceVersion) {
    const sinceTime = parseInt(sinceVersion) || 0;

    const changedPatterns = await db('pattern_assets')
      .select('id', 'key', 'name', 'category', 'render_type', 'unicode_char', 'color', 'width', 'height', 'encoding', 'verified', 'payload', 'material_id', 'material_version', 'material_metadata', 'updated_at', 'deleted_at')
      .where('updated_at', '>', new Date(sinceTime))
      .orderBy('updated_at', 'desc');

    // 生成新的版本号
    const latestUpdate = changedPatterns.reduce((latest, pattern) => {
      const updateTime = new Date(pattern.updated_at).getTime();
      return updateTime > latest ? updateTime : latest;
    }, sinceTime);

    return {
      version: latestUpdate.toString(),
      changes: changedPatterns.map(pattern => ({
        id: pattern.id,
        key: pattern.key,
        name: pattern.name,
        category: pattern.category,
        render_type: pattern.render_type,
        unicode_char: pattern.unicode_char,
        color: pattern.color,
        width: pattern.width,
        height: pattern.height,
        encoding: pattern.encoding,
        verified: pattern.verified,
        material_id: pattern.material_id,
        material_version: pattern.material_version,
        material_metadata: typeof pattern.material_metadata === 'string' ? PatternAsset.safeJsonParse(pattern.material_metadata) : pattern.material_metadata || {},
        updated_at: pattern.updated_at,
        deleted: !!pattern.deleted_at,
        hash: PatternAsset.generateHash(pattern.payload || pattern.key)
      }))
    };
  }

  // 获取图案清单版本号（轻量级检查）
  static async getManifestVersion() {
    const result = await db('pattern_assets')
      .max('updated_at as latest_update')
      .first();

    const latestUpdate = result.latest_update ? new Date(result.latest_update).getTime() : 0;
    return latestUpdate.toString();
  }

  static async preparePatternData(inputData, existingPattern = null) {
    const renderType = inputData.render_type || existingPattern?.render_type || 'color';
    const materialConfig = inputData.material_config || {};

    let encoding = inputData.encoding !== undefined ? inputData.encoding : existingPattern?.encoding;
    let payload = inputData.payload !== undefined ? inputData.payload : existingPattern?.payload;
    // ✅ 改进：支持直接传递material_id（Plan B优化）
    let materialId = inputData.material_id !== undefined ? inputData.material_id : (existingPattern?.material_id || null);
    let materialVersion = inputData.material_version !== undefined ? inputData.material_version : (existingPattern?.material_version || 1);
    let materialMetadata = inputData.material_metadata !== undefined ? inputData.material_metadata : (existingPattern?.material_metadata || {});
    let unicodeChar = inputData.unicode_char !== undefined ? inputData.unicode_char : existingPattern?.unicode_char;

    if (renderType === 'emoji') {
      const unicode = materialConfig.unicode || unicodeChar;
      if (!unicode) {
        throw new Error('Emoji 图案需要提供 unicode 字符');
      }
      const materialResult = await MaterialAssetService.ensureStandardEmojiMaterial({
        unicode,
        fontFamily: materialConfig.fontFamily,
        glyphSize: materialConfig.glyphSize,
        key: materialConfig.materialKey,
        uploadedBy: inputData.created_by || existingPattern?.created_by || null
      });

      materialId = materialResult.material.id;
      materialVersion = materialResult.material.version;
      materialMetadata = materialResult.metadata;
      unicodeChar = unicode;

      if (!payload || materialConfig.refresh === true || inputData.payload === undefined) {
        payload = materialResult.previewPayload || payload;
        encoding = materialResult.previewEncoding || encoding || 'png_base64';
      }
    } else if (renderType === 'complex') {
      // ✅ 改进：优化Material System集成逻辑
      // 如果已有material_id（来自Material System），直接使用，无需重建
      if (materialId) {
        console.log(`✅ 复杂图案已有Material: ${materialId}，直接使用`);
        encoding = 'material';
        payload = null; // Material System不需要存储base64
      } else {
        // 需要从base64创建新的Material
        const base64 = materialConfig.base64 || inputData.payload;
        if (!base64) {
          throw new Error('复杂图案需要提供图像数据');
        }

        let resolvedKey = materialConfig.materialKey || null;
        if (!resolvedKey && existingPattern?.material_id) {
          const existingMaterial = await MaterialAssetService.getMaterialById(existingPattern.material_id);
          resolvedKey = existingMaterial?.key || null;
        }

        if (!resolvedKey) {
          resolvedKey = `sticker_${inputData.key || existingPattern?.key || crypto.randomUUID()}`;
        }

        const materialResult = await MaterialAssetService.createCustomStickerMaterial({
          base64,
          key: resolvedKey,
          fileName: materialConfig.fileName,
          mimeType: materialConfig.mimeType,
          uploadedBy: inputData.created_by || existingPattern?.created_by || null
        });

        materialId = materialResult.material.id;
        materialVersion = materialResult.material.version;
        materialMetadata = materialResult.metadata;
        payload = materialResult.previewPayload || payload;
        encoding = materialResult.previewEncoding || encoding || 'png_base64';
      }
    } else {
      // 纯色类型不依赖素材
      materialId = null;
      materialVersion = 1;
      materialMetadata = {};
    }

    return {
      renderType,
      encoding,
      payload,
      materialId,
      materialVersion,
      materialMetadata,
      unicodeChar
    };
  }

  // 获取已验证的图案（可用于商店）
  static async getVerifiedPatterns() {
    const patterns = await db('pattern_assets')
      .where('verified', true)
      .whereNull('deleted_at')
      .orderBy('key');

    return patterns.map(pattern => new PatternAsset(pattern));
  }

  // 验证RLE编码数据
  static validateRLEPayload(payload, width, height) {
    try {
      const data = JSON.parse(payload);
      if (!Array.isArray(data)) return false;

      let totalPixels = 0;
      for (const run of data) {
        if (typeof run.count !== 'number' || typeof run.color !== 'string') {
          return false;
        }
        totalPixels += run.count;
      }

      return totalPixels === width * height;
    } catch (error) {
      return false;
    }
  }

  // 验证PNG base64数据
  static validatePNGBase64(payload) {
    try {
      // 支持完整的data URL格式
      let base64Data = payload;
      if (payload.startsWith('data:image/png;base64,')) {
        base64Data = payload.split(',')[1];
      }

      // 检查是否为有效的base64
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
        return false;
      }

      // 检查PNG文件头
      const buffer = Buffer.from(base64Data, 'base64');
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

      return buffer.length >= 8 && buffer.subarray(0, 8).equals(pngHeader);
    } catch (error) {
      return false;
    }
  }

  static safeJsonParse(value) {
    if (!value) {
      return {};
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('pattern material_metadata 解析失败', error);
      return {};
    }
  }

  // 生成数据哈希（用于缓存验证）
  static generateHash(data) {
    try {
      const crypto = require('crypto');
      return crypto.createHash('md5').update(String(data)).digest('hex');
    } catch (error) {
      console.error('生成哈希失败:', error);
      return 'hash_error';
    }
  }

  // 软删除图案
  async softDelete() {
    await db('pattern_assets')
      .where('id', this.id)
      .update({ deleted_at: db.fn.now() });

    this.deleted_at = new Date();
  }

  // 验证图案
  async verify() {
    await db('pattern_assets')
      .where('id', this.id)
      .update({ verified: true });

    this.verified = true;
  }

  // 更新图案
  async update(updateData) {
    const prepared = await PatternAsset.preparePatternData({
      key: updateData.key || this.key,
      encoding: updateData.encoding,
      payload: updateData.payload,
      render_type: updateData.render_type || this.render_type,
      unicode_char: updateData.unicode_char,
      material_config: updateData.material_config,
      created_by: this.created_by
    }, this);

    const updateFields = {};
    const allowedFields = ['key', 'width', 'height', 'verified', 'color'];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    }

    if (updateData.render_type !== undefined || prepared.renderType !== this.render_type) {
      updateFields.render_type = prepared.renderType;
    }

    if (prepared.encoding !== undefined && prepared.encoding !== this.encoding) {
      updateFields.encoding = prepared.encoding;
    }

    if (prepared.payload !== undefined && prepared.payload !== this.payload) {
      updateFields.payload = prepared.payload;
    }

    if (prepared.unicodeChar !== undefined && prepared.unicodeChar !== this.unicode_char) {
      updateFields.unicode_char = prepared.unicodeChar;
    }

    if (prepared.materialId !== undefined && prepared.materialId !== this.material_id) {
      updateFields.material_id = prepared.materialId;
    }

    if (prepared.materialVersion !== undefined && prepared.materialVersion !== this.material_version) {
      updateFields.material_version = prepared.materialVersion;
    }

    if (prepared.materialMetadata !== undefined) {
      updateFields.material_metadata = prepared.materialMetadata;
    }

    if (Object.keys(updateFields).length === 0) {
      return;
    }

    // 验证尺寸限制
    if (updateFields.width !== undefined || updateFields.height !== undefined) {
      const newWidth = updateFields.width !== undefined ? updateFields.width : this.width;
      const newHeight = updateFields.height !== undefined ? updateFields.height : this.height;
      if (newWidth > 64 || newHeight > 64) {
        throw new Error('图案尺寸不能超过64x64');
      }
    }

    const finalEncoding = updateFields.encoding !== undefined ? updateFields.encoding : this.encoding;
    const finalPayload = updateFields.payload !== undefined ? updateFields.payload : this.payload;

    // ✅ 改进：支持Material System编码验证
    if (finalEncoding === 'rle') {
      if (!PatternAsset.validateRLEPayload(finalPayload, updateFields.width || this.width, updateFields.height || this.height)) {
        throw new Error('RLE编码数据格式无效');
      }
    } else if (finalEncoding === 'png_base64') {
      if (!PatternAsset.validatePNGBase64(finalPayload)) {
        throw new Error('PNG base64数据格式无效');
      }
    } else if (finalEncoding === 'material') {
      // Material System编码不需要payload验证
      console.log(`✅ 更新为Material System编码`);
    }

    updateFields.updated_at = db.fn.now();

    await db('pattern_assets')
      .where('id', this.id)
      .update(updateFields);

    Object.assign(this, updateFields);
  }
}

module.exports = PatternAsset;
