const PatternAsset = require('../models/PatternAsset');
const { validateRequest } = require('../middleware/validation');
const { errors } = require('../utils/i18n');

class PatternController {
  // 获取图案清单
  static async getManifest(req, res) {
    try {
      const manifest = await PatternAsset.getManifest();

      // 设置缓存头
      res.set({
        'Cache-Control': 'public, max-age=300', // 5分钟缓存
        'ETag': `"${manifest.version}"`,
        'Last-Modified': new Date().toUTCString()
      });

      res.json(manifest);
    } catch (error) {
      console.error('获取图案清单失败:', error);
      res.status(500).json({
        success: false,
        message: '获取图案清单失败',
        error: error.message
      });
    }
  }

  // 获取图案清单版本号（轻量级检查）
  static async getManifestVersion(req, res) {
    try {
      const version = await PatternAsset.getManifestVersion();

      res.set({
        'Cache-Control': 'public, max-age=60', // 1分钟缓存
        'ETag': `"${version}"`
      });

      res.json({ version });
    } catch (error) {
      console.error('获取图案清单版本失败:', error);
      res.status(500).json({
        success: false,
        message: '获取图案清单版本失败',
        error: error.message
      });
    }
  }

  // 获取图案变更列表（增量同步）
  static async getChanges(req, res) {
    try {
      const { since } = req.query;

      if (!since) {
        return res.status(400).json({
          success: false,
          message: 'since参数不能为空'
        });
      }

      const changes = await PatternAsset.getChanges(since);

      res.set({
        'Cache-Control': 'public, max-age=60', // 1分钟缓存
        'ETag': `"${changes.version}"`
      });

      res.json(changes);
    } catch (error) {
      console.error('获取图案变更失败:', error);
      res.status(500).json({
        success: false,
        message: '获取图案变更失败',
        error: error.message
      });
    }
  }

  // 获取统一的图案信息（用于联盟旗帜等）
  static async getPatternInfo(req, res) {
    try {
      const { pattern_id } = req.params;

      if (!pattern_id) {
        return res.status(400).json({
          success: false,
          message: '图案ID不能为空'
        });
      }

      // ✅ 统一使用 key 查询（不再支持 ID 查询）
      const pattern = await PatternAsset.getByKey(pattern_id);

      if (!pattern) {
        const errorResponse = errors.patternNotFound(req);
        return res.status(errorResponse.statusCode).json(errorResponse);
      }

      // 返回统一的图案信息格式
      const patternInfo = {
        pattern_id: pattern.id.toString(),
        key: pattern.key,
        name: pattern.name,
        description: pattern.description,
        category: pattern.category,
        render_type: pattern.render_type || 'complex',
        unicode_char: pattern.unicode_char,
        color: pattern.color, // 添加color字段
        encoding: pattern.encoding, // 添加encoding字段
        width: pattern.width,
        height: pattern.height,
        material_id: pattern.material_id,
        material_version: pattern.material_version,
        material_metadata: pattern.material_metadata,
        verified: pattern.verified,
        created_at: pattern.created_at,
        updated_at: pattern.updated_at
      };

      res.json({
        success: true,
        pattern: patternInfo
      });
    } catch (error) {
      console.error('获取图案信息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取图案信息失败',
        error: error.message
      });
    }
  }

  // 获取单个图案数据
  static async getPattern(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: '图案ID不能为空'
        });
      }

      let pattern;

      // ✅ 统一使用 key 查询（不再支持 ID 查询）
      pattern = await PatternAsset.getByKey(id);

      if (!pattern) {
        return res.status(404).json({
          success: false,
          message: 'Pattern not found',
          error: 'PATTERN_NOT_FOUND'
        });
      }

      // 设置缓存头
      res.set({
        'Cache-Control': 'public, max-age=3600', // 1小时缓存
        'ETag': `"${pattern.hash}"`,
        'Last-Modified': pattern.updated_at.toUTCString()
      });

      res.json({
        success: true,
        pattern: {
          id: pattern.id,
          key: pattern.key,
          name: pattern.name,
          description: pattern.description,
          category: pattern.category,
          render_type: pattern.render_type,
          unicode_char: pattern.unicode_char,
          color: pattern.color,
          width: pattern.width,
          height: pattern.height,
          encoding: pattern.encoding,
          payload: pattern.payload,
          material_id: pattern.material_id,
          material_version: pattern.material_version,
          material_metadata: pattern.material_metadata,
          verified: pattern.verified,
          created_at: pattern.created_at,
          updated_at: pattern.updated_at
        }
      });
    } catch (error) {
      console.error('获取图案失败:', error);
      res.status(500).json({
        success: false,
        message: '获取图案失败',
        error: error.message
      });
    }
  }

  // 创建图案（管理员功能）
  static async createPattern(req, res) {
    try {
      const {
        key,
        width,
        height,
        encoding,
        payload,
        render_type = 'color',
        unicode_char,
        color,
        material_config = {},
        verified = false
      } = req.body;
      const userId = req.user.id;

      // 验证必需字段
      if (!key || !width || !height) {
        return res.status(400).json({
          success: false,
          message: '缺少必需字段'
        });
      }

      // 验证尺寸限制
      if (width > 64 || height > 64) {
        return res.status(400).json({
          success: false,
          message: '图案尺寸不能超过64x64'
        });
      }

      // 针对不同渲染类型的必需参数检查
      if (render_type === 'color' && (!encoding || !payload)) {
        return res.status(400).json({
          success: false,
          message: '纯色图案需要提供编码和数据'
        });
      }

      if (render_type === 'emoji' && !unicode_char && !material_config?.unicode) {
        return res.status(400).json({
          success: false,
          message: 'Emoji 图案需要提供 unicode 字符'
        });
      }

      if (render_type === 'complex' && !payload && !material_config?.base64) {
        return res.status(400).json({
          success: false,
          message: '复杂图案需要提供素材数据'
        });
      }

      if (render_type === 'color' && !color) {
        return res.status(400).json({
          success: false,
          message: '颜色图案需要提供 color 值'
        });
      }

      // 检查key是否已存在
      const existingPattern = await PatternAsset.getByKey(key);
      if (existingPattern) {
        return res.status(400).json({
          success: false,
          message: '图案key已存在'
        });
      }

      // 创建图案
      const pattern = await PatternAsset.create({
        key,
        width,
        height,
        encoding,
        payload,
        render_type,
        unicode_char,
        color,
        material_config,
        verified,
        created_by: userId
      });

      res.status(201).json({
        success: true,
        message: '图案创建成功',
        pattern: {
          id: pattern.id,
          key: pattern.key,
          width: pattern.width,
          height: pattern.height,
          encoding: pattern.encoding,
          render_type: pattern.render_type,
          unicode_char: pattern.unicode_char,
          material_id: pattern.material_id,
          material_version: pattern.material_version,
          material_metadata: pattern.material_metadata,
          verified: pattern.verified
        }
      });
    } catch (error) {
      console.error('创建图案失败:', error);
      res.status(500).json({
        success: false,
        message: '创建图案失败',
        error: error.message
      });
    }
  }

  // 更新图案（管理员功能）
  static async updatePattern(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: '图案ID不能为空'
        });
      }

      // ✅ 统一使用 key 查询（参数虽名为 id，实际传入 key）
      const pattern = await PatternAsset.getByKey(id);
      if (!pattern) {
        return res.status(404).json({
          success: false,
          message: 'Pattern not found',
          error: 'PATTERN_NOT_FOUND'
        });
      }

      // 更新图案
      await pattern.update(updateData);

      res.json({
        success: true,
        message: '图案更新成功',
        pattern: {
          id: pattern.id,
          key: pattern.key,
          width: pattern.width,
          height: pattern.height,
          encoding: pattern.encoding,
          verified: pattern.verified
        }
      });
    } catch (error) {
      console.error('更新图案失败:', error);
      res.status(500).json({
        success: false,
        message: '更新图案失败',
        error: error.message
      });
    }
  }

  // 验证图案（管理员功能）
  static async verifyPattern(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: '图案ID不能为空'
        });
      }

      // ✅ 统一使用 key 查询（参数虽名为 id，实际传入 key）
      const pattern = await PatternAsset.getByKey(id);
      if (!pattern) {
        return res.status(404).json({
          success: false,
          message: 'Pattern not found',
          error: 'PATTERN_NOT_FOUND'
        });
      }

      // 验证图案
      await pattern.verify();

      res.json({
        success: true,
        message: '图案验证成功'
      });
    } catch (error) {
      console.error('验证图案失败:', error);
      res.status(500).json({
        success: false,
        message: '验证图案失败',
        error: error.message
      });
    }
  }

  // 删除图案（软删除）
  static async deletePattern(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: '图案ID不能为空'
        });
      }

      // ✅ 统一使用 key 查询（参数虽名为 id，实际传入 key）
      const pattern = await PatternAsset.getByKey(id);
      if (!pattern) {
        return res.status(404).json({
          success: false,
          message: 'Pattern not found',
          error: 'PATTERN_NOT_FOUND'
        });
      }

      // 软删除图案
      await pattern.softDelete();

      res.json({
        success: true,
        message: '图案删除成功'
      });
    } catch (error) {
      console.error('删除图案失败:', error);
      res.status(500).json({
        success: false,
        message: '删除图案失败',
        error: error.message
      });
    }
  }

  // 获取已验证的图案列表
  static async getVerifiedPatterns(req, res) {
    try {
      const patterns = await PatternAsset.getVerifiedPatterns();

      const patternList = patterns.map(pattern => ({
        id: pattern.id,
        key: pattern.key,
        width: pattern.width,
        height: pattern.height,
        encoding: pattern.encoding,
        verified: pattern.verified
      }));

      res.json({
        success: true,
        patterns: patternList
      });
    } catch (error) {
      console.error('获取已验证图案失败:', error);
      res.status(500).json({
        success: false,
        message: '获取已验证图案失败',
        error: error.message
      });
    }
  }
}

module.exports = PatternController;
