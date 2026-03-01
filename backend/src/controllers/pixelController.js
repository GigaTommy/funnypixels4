const { db } = require('../config/database');
const Pixel = require('../models/Pixel');
const logger = require('../utils/logger');
const { snapToGrid } = require('../../shared/utils/gridUtils');

// 简单内存缓存：避免高并发下重复执行聚合查询
const _cache = {};
function getCached(key, ttlMs, fn) {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data);
  return fn().then(data => { _cache[key] = { data, ts: Date.now() }; return data; });
}

class PixelController {
  /**
   * 获取像素统计信息（真实绘制统计，剔除道具类像素）
   */
  static async getPixelStats(req, res) {
    try {
      const stats = await getCached('pixelStats', 30000, async () => {
        const PixelStatsService = require('../services/pixelStatsService');
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        // 🔧 性能优化：合并 5 个独立的 pixels 表查询为 1 次条件聚合 + realStats 并行
        const [realStats, traditionalStats, latestPixel] = await Promise.all([
          PixelStatsService.getGlobalRealPixelStats(),
          db('pixels')
            .select(
              db.raw('COUNT(*) as total'),
              db.raw('COUNT(*) FILTER (WHERE DATE(created_at) = ?) as today', [today]),
              db.raw('COUNT(*) FILTER (WHERE created_at >= ?) as week', [weekAgo]),
              db.raw('COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as active_users')
            )
            .first(),
          db('pixels').orderBy('created_at', 'desc').select('id', 'grid_id', 'color', 'pixel_type', 'user_id', 'created_at').first(),
        ]);

        const totalCount = parseInt(traditionalStats.total) || 0;

        return {
          realStats: {
            totalPixels: realStats.totalRealPixels,
            todayPixels: realStats.todayRealPixels,
            weekPixels: realStats.weekRealPixels,
            activeUsers: realStats.activeUsers
          },
          traditionalStats: {
            totalPixels: totalCount,
            todayPixels: parseInt(traditionalStats.today) || 0,
            weekPixels: parseInt(traditionalStats.week) || 0,
            activeUsers: parseInt(traditionalStats.active_users) || 0
          },
          propPixelsStats: {
            totalPropPixels: realStats.totalPropPixels,
            propPixelsByType: realStats.propPixelsByType
          },
          latestPixel: latestPixel ? {
            id: latestPixel.id,
            grid_id: latestPixel.grid_id,
            color: latestPixel.color,
            pixel_type: latestPixel.pixel_type,
            user_id: latestPixel.user_id,
            created_at: latestPixel.created_at
          } : null,
          comparison: {
            propPixelsPercentage: realStats.totalPropPixels > 0
              ? ((realStats.totalPropPixels / totalCount) * 100).toFixed(2) + '%'
              : '0%',
            realPixelsPercentage: realStats.totalRealPixels > 0
              ? ((realStats.totalRealPixels / totalCount) * 100).toFixed(2) + '%'
              : '0%'
          }
        };
      });

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('获取像素统计失败', { error: error.message });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  /**
   * 获取单个像素
   */
  static async getPixel(req, res) {
    try {
      const { id } = req.params;
      const pixel = await Pixel.findById(id);

      if (!pixel) {
        return res.status(404).json({ error: '像素未找到' });
      }

      res.json(pixel);
    } catch (error) {
      logger.error('获取像素失败', { error: error.message, pixelId: req.params.id });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  /**
   * 获取像素列表
   */
  static async getPixels(req, res) {
    try {
      const pixels = await Pixel.findAll();
      res.json(pixels);
    } catch (error) {
      logger.error('获取像素列表失败', { error: error.message });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  /**
   * 创建像素
   */
  static async createPixel(req, res) {
    try {
      const pixelData = req.body;

      // 🔧 强制坐标网格对齐
      // 解决前端点选坐标精度导致网格错位的问题
      if (pixelData.latitude !== undefined && pixelData.longitude !== undefined) {
        const { lat, lng } = snapToGrid(parseFloat(pixelData.latitude), parseFloat(pixelData.longitude));
        pixelData.latitude = lat;
        pixelData.longitude = lng;
        // 确保同时更新lat/lng别名（如果存在）
        pixelData.lat = lat;
        pixelData.lng = lng;

        logger.debug('创建像素：坐标已自动对齐', {
          original: { lat: req.body.latitude, lng: req.body.longitude },
          snapped: { lat, lng }
        });
      }

      const pixel = await Pixel.create(pixelData);

      // 🏆 Achievement: Track pixel drawing and check for new achievements
      let newAchievements = [];
      if (pixel && pixel.user_id) {
        try {
          const Achievement = require('../models/Achievement');
          await Achievement.updateUserStats(pixel.user_id, {
            pixels_drawn_count: 1
          });

          // 🆕 Check for newly unlocked achievements
          newAchievements = await Achievement.checkAndUnlockAchievements(pixel.user_id);
          if (newAchievements.length > 0) {
            logger.info('🏆 New achievements unlocked', {
              userId: pixel.user_id,
              achievements: newAchievements.map(a => a.name)
            });
          }
        } catch (achievementError) {
          // Don't fail pixel creation if achievement tracking fails
          logger.error('Achievement tracking failed', { error: achievementError.message });
        }
      }

      // 🆕 Return pixel with new achievements
      res.status(201).json({
        ...pixel,
        newAchievements: newAchievements.length > 0 ? newAchievements : undefined
      });
    } catch (error) {
      logger.error('创建像素失败', { error: error.message, pixelData: req.body });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  /**
   * 更新像素
   */
  static async updatePixel(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // 🔧 强制坐标网格对齐（如果更新包含坐标）
      if (updateData.latitude !== undefined && updateData.longitude !== undefined) {
        const { lat, lng } = snapToGrid(parseFloat(updateData.latitude), parseFloat(updateData.longitude));
        updateData.latitude = lat;
        updateData.longitude = lng;
        updateData.lat = lat;
        updateData.lng = lng;
      }

      const pixel = await Pixel.update(id, updateData);

      if (!pixel) {
        return res.status(404).json({ error: '像素未找到' });
      }

      res.json(pixel);
    } catch (error) {
      logger.error('更新像素失败', { error: error.message, pixelId: req.params.id, updateData: req.body });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  /**
   * 删除像素
   */
  static async deletePixel(req, res) {
    try {
      const { id } = req.params;
      const success = await Pixel.delete(id);

      if (!success) {
        return res.status(404).json({ error: '像素未找到' });
      }

      res.json({ message: '像素删除成功' });
    } catch (error) {
      logger.error('删除像素失败', { error: error.message, pixelId: req.params.id });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  /**
   * 批量获取像素
   */
  static async getPixelsBatch(req, res) {
    try {
      const { gridIds } = req.body;

      if (!gridIds || !Array.isArray(gridIds)) {
        return res.status(400).json({ error: 'gridIds必须是数组' });
      }

      const pixels = await Pixel.findByGridIds(gridIds);
      res.json(pixels);
    } catch (error) {
      logger.error('批量获取像素失败', { error: error.message });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  /**
   * 按地理范围获取像素 - 高效版本
   * 直接按经纬度范围查询，避免网格ID批量查询
   */
  static async getPixelsByArea(req, res) {
    try {
      const { bounds, zoom } = req.body;

      if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
        return res.status(400).json({ error: '无效的地理边界参数' });
      }

      // 🔧 关键修复：数据库中存储的是GCJ-02坐标，前端传入的也是GCJ-02坐标，无需转换
      const originalBounds = { ...bounds };
      const { north, south, east, west } = bounds;

      logger.info('坐标系统确认', {
        查询边界: originalBounds,
        坐标系统: 'GCJ-02 (数据库与前端统一)'
      });

      // 根据缩放级别调整查询精度
      const precision = zoom >= 20 ? 6 : zoom >= 17 ? 5 : 4;

      // 🔧 优化：增加适当缓冲区以确保边界像素完整查询
      // 缓冲区约0.0001度(≈11米)，对应一个像素格子的尺寸
      const buffer = 0.0001;
      const bufferedBounds = {
        north: north + buffer,
        south: south - buffer,
        east: east + buffer,
        west: west - buffer
      };

      // 直接按地理范围查询，使用索引优化
      // 注意：latitude 和 longitude 字段在数据库中是字符串类型，需要转换为数字后比较
      // 🔧 修复：LEFT JOIN pattern_assets 表，使用正确的字段匹配
      // pixels.pattern_id (varchar) 应该匹配 pattern_assets.key (varchar)
      const pixels = await db('pixels')
        .leftJoin('pattern_assets', function () {
          this.on('pixels.pattern_id', '=', 'pattern_assets.key')
            .andOnNull('pattern_assets.deleted_at'); // 🔧 关键：只JOIN未删除的pattern
        })
        .select(
          'pixels.id',
          'pixels.grid_id',
          'pixels.latitude',
          'pixels.longitude',
          'pixels.color',
          'pixels.pattern_id',
          'pixels.pattern_anchor_x',
          'pixels.pattern_anchor_y',
          'pixels.pattern_rotation',
          'pixels.pattern_mirror',
          'pixels.user_id',
          'pixels.created_at',
          'pixels.updated_at',
          'pixels.pixel_type', // 🔧 关键修复：添加 pixel_type 字段，确保广告像素能被正确识别
          'pixels.related_id', // 🔧 添加 related_id 字段，用于关联广告投放记录
          // 🔧 关键修复：添加pattern_assets的渲染信息
          'pattern_assets.render_type',
          'pattern_assets.unicode_char',
          'pattern_assets.material_id',
          'pattern_assets.encoding',
          // payload removed: clients use sprite endpoint URL via pattern_id instead of inline base64
          'pattern_assets.category' // 🔧 新增：添加category字段，用于前端判断
        )
        .whereRaw('CAST(pixels.latitude AS DECIMAL) >= ?', [bufferedBounds.south])
        .whereRaw('CAST(pixels.latitude AS DECIMAL) <= ?', [bufferedBounds.north])
        .whereRaw('CAST(pixels.longitude AS DECIMAL) >= ?', [bufferedBounds.west])
        .whereRaw('CAST(pixels.longitude AS DECIMAL) <= ?', [bufferedBounds.east])
        .orderBy('pixels.latitude', 'asc')
        .orderBy('pixels.longitude', 'asc');

      // 🔧 修复：数据库存储的是GCJ-02坐标，前端使用的也是GCJ-02坐标，无需转换
      // 直接过滤出在查询边界内的像素
      const filteredPixels = pixels.filter(pixel => {
        const lat = parseFloat(pixel.latitude);
        const lng = parseFloat(pixel.longitude);
        return lat >= originalBounds.south &&
          lat <= originalBounds.north &&
          lng >= originalBounds.west &&
          lng <= originalBounds.east;
      });

      // 🔧 简化:统一限制最大像素数为100,000
      // 理论视窗像素数(1920×1080屏幕):
      // - zoom 15: ~24,336格 → 100,000上限足够 (4x余量)
      // - zoom 16: ~6,032格 → 100,000上限足够 (16x余量)
      // - zoom 17: ~1,508格 → 100,000上限足够 (66x余量)
      // - zoom 18: ~390格 → 100,000上限足够 (256x余量)
      const maxPixels = 100000;
      const limitedPixels = filteredPixels.slice(0, maxPixels);

      // 🔧 统计JOIN成功/失败的像素数
      const joinedPixels = pixels.filter(p => p.render_type !== null).length;
      const unjoinedPixels = pixels.filter(p => p.render_type === null).length;

      logger.info('地理范围查询完成(坐标系统已统一)', {
        查询边界: originalBounds,
        缓冲区查询边界: bufferedBounds,
        数据库返回像素数: pixels.length,
        JOIN成功像素数: joinedPixels,
        JOIN失败像素数: unjoinedPixels,
        过滤后像素数: filteredPixels.length,
        最终返回像素数: limitedPixels.length,
        坐标系统: 'GCJ-02 (统一)',
        zoom
      });

      // 🔍 详细日志：如果有JOIN失败的像素，记录详情
      if (unjoinedPixels > 0) {
        const unjoinedSamples = pixels.filter(p => p.render_type === null).slice(0, 5);
        logger.warn('⚠️ 部分像素未能JOIN到pattern_assets:', {
          数量: unjoinedPixels,
          示例: unjoinedSamples.map(p => ({
            grid_id: p.grid_id,
            pattern_id: p.pattern_id,
            color: p.color
          }))
        });
      }

      res.json({
        success: true,
        pixels: limitedPixels,
        total: filteredPixels.length,
        limited: limitedPixels.length < filteredPixels.length,
        bounds: originalBounds, // 返回GCJ-02边界
        zoom,
        coordinateSystem: 'GCJ-02',
        converted: false // 标记无需坐标转换
      });

    } catch (error) {
      logger.error('地理范围查询失败', { error: error.message, bounds: req.body });
      res.status(500).json({ error: '查询失败', details: error.message });
    }
  }

  /**
   * 获取像素详细信息 - 包含用户信息和联盟信息
   * 用于像素信息卡片显示
   */
  static async getPixelDetails(req, res) {
    try {
      const { gridId } = req.params;

      if (!gridId) {
        return res.status(400).json({ error: '缺少gridId参数' });
      }

      logger.debug('获取像素详细信息', { gridId });

      // 查询像素基本信息
      let pixel = await db('pixels')
        .where('grid_id', gridId)
        .first();

      // 如果数据库中找不到，尝试从缓存获取
      if (!pixel) {
        logger.debug('数据库中未找到像素，尝试从缓存获取', { gridId });
        try {
          const CacheService = require('../services/cacheService');
          const cachedPixel = await CacheService.getPixel(gridId);
          if (cachedPixel) {
            logger.info('从缓存中找到像素', { gridId });
            // 构造一个类似数据库记录的像素对象
            pixel = {
              grid_id: gridId,
              latitude: cachedPixel.latitude ?? cachedPixel.lat,
              longitude: cachedPixel.longitude ?? cachedPixel.lng,
              color: cachedPixel.color,
              pattern_id: cachedPixel.patternId,
              pattern_anchor_x: cachedPixel.pattern_anchor_x || 0,
              pattern_anchor_y: cachedPixel.pattern_anchor_y || 0,
              pattern_rotation: cachedPixel.pattern_rotation || 0,
              pattern_mirror: cachedPixel.pattern_mirror || false,
              user_id: cachedPixel.userId,
              // 地理位置字段（缓存可能不包含这些，设为null）
              city: cachedPixel.city || null,
              province: cachedPixel.province || null,
              country: cachedPixel.country || null,
              created_at: new Date(cachedPixel.timestamp),
              updated_at: new Date(cachedPixel.timestamp)
            };
          }
        } catch (cacheError) {
          logger.error('从缓存获取像素失败', { error: cacheError.message, gridId });
        }
      }

      if (!pixel) {
        return res.status(404).json({ error: '像素未找到' });
      }

      // 查询用户信息和隐私设置
      let userInfo = null;
      let privacySettings = null;
      if (pixel.user_id) {
        const userResult = await db('users')
          .select('id', 'username', 'avatar_url', 'avatar', 'display_name')
          .where('id', pixel.user_id)
          .first();

        if (userResult) {
          userInfo = userResult;
          privacySettings = await db('privacy_settings')
            .where('user_id', pixel.user_id)
            .first();
        }
      }

      // 查询联盟信息
      let allianceInfo = null;
      if (pixel.user_id) {
        const allianceResult = await db('alliance_members as am')
          .join('alliances as a', 'am.alliance_id', 'a.id')
          .where('am.user_id', pixel.user_id)
          .select('a.id', 'a.name', 'a.flag_pattern_id', 'a.flag_unicode_char', 'a.flag_render_type', 'a.color', 'am.role')
          .first();

        if (allianceResult) {
          // 获取图案详细信息
          let patternInfo = null;
          if (allianceResult.flag_pattern_id) {
            try {
              // ✅ 统一使用 key 查询图案信息
              const patternColumns = ['id', 'key', 'name', 'category', 'render_type', 'unicode_char', 'width', 'height', 'verified', 'material_id', 'material_version', 'material_metadata'];
              const pattern = await db('pattern_assets')
                .where('key', allianceResult.flag_pattern_id)
                .select(patternColumns)
                .first();

              if (pattern) {
                patternInfo = {
                  pattern_id: pattern.id.toString(),
                  key: pattern.key,
                  name: pattern.name,
                  category: pattern.category,
                  render_type: pattern.render_type || 'complex',
                  unicode_char: pattern.unicode_char,
                  width: pattern.width,
                  height: pattern.height,
                  verified: pattern.verified,
                  material_id: pattern.material_id,
                  material_version: pattern.material_version,
                  material_metadata: typeof pattern.material_metadata === 'string' ? JSON.parse(pattern.material_metadata) : pattern.material_metadata || {}
                };
              }
            } catch (patternError) {
              console.warn('获取图案信息失败:', patternError);
            }
          }

          allianceInfo = {
            id: allianceResult.id,
            name: allianceResult.name,
            flag: patternInfo?.unicode_char || allianceResult.flag_unicode_char,
            pattern_id: allianceResult.flag_pattern_id,
            flag_pattern_id: allianceResult.flag_pattern_id,
            flag_unicode_char: patternInfo?.unicode_char || allianceResult.flag_unicode_char,
            flag_render_type: patternInfo?.render_type || allianceResult.flag_render_type || 'complex',
            color: allianceResult.color,
            role: allianceResult.role,
            pattern_info: patternInfo
          };
        }
      }

      // 查询像素点赞信息 - 暂时设置为0，因为pixel_likes表不存在
      const likesCount = { count: 0 };

      // 构造返回数据
      const latitude = parseFloat(pixel.latitude);
      const longitude = parseFloat(pixel.longitude);

      const isAnonymous = privacySettings?.hide_nickname === true;
      const hideAlliance = privacySettings?.hide_alliance === true;
      const hideAllianceFlag = privacySettings?.hide_alliance_flag === true;

      const pixelDetails = {
        grid_id: pixel.grid_id,
        latitude,
        longitude,
        lat: latitude,
        lng: longitude,
        color: pixel.color,
        pattern_id: pixel.pattern_id,
        pattern_anchor_x: pixel.pattern_anchor_x,
        pattern_anchor_y: pixel.pattern_anchor_y,
        pattern_rotation: pixel.pattern_rotation,
        pattern_mirror: pixel.pattern_mirror,
        user_id: pixel.user_id,
        username: isAnonymous ? '匿名用户' : (userInfo?.username || null),
        avatar: isAnonymous ? null : (userInfo?.avatar || userInfo?.avatar_url || null),
        avatar_url: isAnonymous ? null : (userInfo?.avatar_url || null),
        display_name: isAnonymous ? '匿名用户' : (userInfo?.display_name || null),
        // 地理位置字段
        city: pixel.city,
        province: pixel.province,
        country: pixel.country,
        alliance_id: (hideAlliance || !allianceInfo) ? null : allianceInfo.id,
        alliance_name: (hideAlliance || !allianceInfo) ? null : allianceInfo.name,
        alliance_flag: (hideAlliance || hideAllianceFlag || !allianceInfo) ? null : allianceInfo.flag,
        alliance: hideAlliance ? null : (allianceInfo || null),
        likes_count: parseInt(likesCount.count) || 0,
        created_at: pixel.created_at,
        updated_at: pixel.updated_at
      };

      logger.info('像素详细信息获取成功', {
        grid_id: pixelDetails.grid_id,
        username: pixelDetails.username,
        city: pixelDetails.city,
        province: pixelDetails.province,
        country: pixelDetails.country,
        alliance_name: pixelDetails.alliance_name
      });

      res.json({
        success: true,
        data: pixelDetails
      });

    } catch (error) {
      logger.error('获取像素详细信息失败', { error: error.message, gridId: req.params.gridId });
      res.status(500).json({ error: '服务器内部错误', details: error.message });
    }
  }

  /**
   * 举报像素
   */
  static async reportPixel(req, res) {
    try {
      const { lat, lng } = req.params;
      const { reason, context } = req.body;
      const reporterId = req.user.id;

      // 验证输入
      if (!reason || !context) {
        return res.status(400).json({
          success: false,
          message: '举报原因和说明不能为空'
        });
      }

      // 获取像素信息
      const pixel = await db('pixels')
        .where({ lat: parseFloat(lat), lng: parseFloat(lng) })
        .first();

      if (!pixel) {
        return res.status(404).json({
          success: false,
          message: '像素不存在'
        });
      }

      // 创建举报记录
      const Report = require('../models/Report');
      const report = await Report.create({
        reporterId,
        targetType: 'pixel',
        targetId: pixel.grid_id,
        reason,
        description: context,
        metadata: {
          pixel: {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            gridId: pixel.grid_id,
            userId: pixel.user_id,
            color: pixel.color
          }
        }
      });

      logger.info('像素举报创建成功', {
        reportId: report.id,
        targetId: pixel.grid_id,
        reporterId,
        reason
      });

      res.json({
        success: true,
        data: report,
        message: '举报提交成功'
      });

    } catch (error) {
      logger.error('举报像素失败', { error: error.message, lat: req.params.lat, lng: req.params.lng });
      res.status(500).json({
        success: false,
        message: '举报提交失败',
        error: error.message
      });
    }
  }

  /**
   * 获取热门区域 (Hot Zones)
   */
  static async getHotZones(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const zones = await getCached(`hotZones:${limit}`, 120000, () => Pixel.getHotZones(limit));

      res.json({
        success: true,
        data: zones
      });
    } catch (error) {
      logger.error('获取热门区域失败', { error: error.message });
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
}

module.exports = PixelController;

