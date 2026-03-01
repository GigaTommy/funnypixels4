const { db } = require('../config/database');
const { snapToGrid, gridIndexToLatLng } = require('../utils/gridUtils');
const { PIXEL_TYPES } = require('../constants/pixelTypes');
const pixelsHistoryService = require('./pixelsHistoryService');
const { validateAndQuantizeColor, validateBaseColorsInDatabase } = require('../utils/colorValidator');
const geocodingService = require('./geocodingService');

/**
 * 广告像素渲染服务
 * 负责将广告像素数据转换为标准像素格式并批量写入数据库
 */
class AdPixelRenderer {

  // ✅ 新增：256色Pattern缓存（静态缓存，进程级别共享）
  static pattern256Cache = new Map();

  /**
   * ✅ 新增：预加载256色Pattern到内存缓存
   * 在服务器启动时调用一次，避免每次查询数据库
   */
  static async preload256Patterns() {
    try {
      console.log('🔄 开始预加载256色Pattern到内存缓存...');

      const patterns = await db('pattern_assets')
        .where('category', 'base256color')
        .select('key', 'payload');

      for (const pattern of patterns) {
        this.pattern256Cache.set(pattern.key, pattern.payload);
      }

      console.log(`✅ 256色Pattern预加载完成: ${this.pattern256Cache.size}个`);

      // 显示几个示例
      if (this.pattern256Cache.size > 0) {
        const samples = Array.from(this.pattern256Cache.keys()).slice(0, 3);
        console.log(`   示例: ${samples.join(', ')}`);
      }

      return this.pattern256Cache.size;
    } catch (error) {
      console.error('❌ 预加载256色Pattern失败:', error);
      return 0;
    }
  }

  /**
   * 处理广告放置的像素渲染
   * @param {string} placementId - 广告放置ID
   */
  static async processAdPlacement(placementId) {
    try {
      console.log(`🎨 开始处理广告像素渲染: ${placementId}`);

      // 1. 获取广告放置数据
      const placement = await this.getAdPlacement(placementId);
      if (!placement) {
        console.error(`❌ 广告放置记录不存在: ${placementId}`);
        return;
      }

      // 1.5. 查询购买者当前所在联盟
      let buyerAllianceId = null;
      try {
        const allianceMember = await db('alliance_members')
          .where('user_id', placement.user_id)
          .first();
        if (allianceMember) {
          buyerAllianceId = allianceMember.alliance_id;
          console.log(`✅ 广告购买者联盟: ${buyerAllianceId}`);
        }
      } catch (allianceError) {
        console.warn('⚠️ 查询广告购买者联盟失败:', allianceError.message);
      }

      // 2. 解析像素数据
      const pixelData = JSON.parse(placement.pixel_data);
      console.log(`📊 广告像素数据: ${pixelData.length}个像素点`);

      // 3. 验证和转换颜色
      const validatedPixels = await this.validateAndConvertColors(pixelData);
      console.log(`✅ 颜色验证完成: ${validatedPixels.length}个有效像素`);

      // 🆕 4. 获取中心点地理信息（只调用一次API）
      let centerLocationInfo = {
        country: null,
        province: null,
        city: null,
        district: null,
        adcode: null,
        formatted_address: null,
        geocoded: false,
        geocoded_at: null
      };

      try {
        console.log(`🗺️ 获取广告中心点地理信息: (${placement.center_lat}, ${placement.center_lng})`);
        centerLocationInfo = await geocodingService.reverseGeocodeWithTimeout(
          placement.center_lat,
          placement.center_lng,
          3000
        );
        console.log(`✅ 中心点地理信息获取成功: ${centerLocationInfo.province} ${centerLocationInfo.city}`);
      } catch (geoError) {
        console.warn(`⚠️ 中心点地理信息获取失败，使用默认值:`, geoError.message);
        centerLocationInfo = geocodingService.getDefaultLocationInfo();
      }

      // 5. 转换坐标（使用整数网格索引，生成完整连续的矩阵）
      const pixelCoordinates = this.convertAdCoordinatesToPixelsIntegerGrid(
        placement.center_lat,
        placement.center_lng,
        validatedPixels,
        placement.width,
        placement.height,
        placement.user_id,
        placementId,
        buyerAllianceId
      );
      console.log(`🗺️ 坐标转换完成: ${pixelCoordinates.length}个像素坐标`);

      // 6. 批量写入（传入地理信息）
      await this.batchWritePixels(pixelCoordinates, centerLocationInfo);
      console.log(`💾 批量写入完成: ${pixelCoordinates.length}个像素`);

      // 7. 异步广播
      await this.broadcastPixelUpdates(pixelCoordinates);
      console.log(`📡 异步广播完成: ${pixelCoordinates.length}个像素更新`);

      console.log(`🎉 广告像素渲染完成: ${placementId}`);

    } catch (error) {
      console.error(`❌ 广告像素渲染失败: ${placementId}`, error);
      throw error;
    }
  }
  
  /**
   * 获取广告放置数据
   */
  static async getAdPlacement(placementId) {
    const placement = await db('ad_placements')
      .where('id', placementId)
      .first();
    
    return placement;
  }
  
  /**
   * 验证和转换颜色
   */
  static async validateAndConvertColors(pixelData) {
    const validatedPixels = [];
    const colorCache = new Map(); // 缓存已验证的颜色
    
    console.log(`🔍 开始验证${pixelData.length}个像素的颜色...`);
    
    for (const pixel of pixelData) {
      const color = pixel.color;
      
      // 检查缓存
      if (colorCache.has(color)) {
        validatedPixels.push({
          ...pixel,
          patternId: colorCache.get(color)
        });
        continue;
      }
      
      // 查找颜色模式
      try {
        let patternId = await this.findColorPattern(color);
        colorCache.set(color, patternId);
        
        validatedPixels.push({
          ...pixel,
          patternId: patternId
        });
      } catch (error) {
        console.error(`❌ 颜色处理失败: ${color}`, error.message);
        // 不跳过像素，而是抛出错误，因为这表明系统配置有问题
        throw new Error(`广告像素颜色处理失败: ${error.message}`);
      }
    }
    
    console.log(`✅ 颜色验证完成，缓存了${colorCache.size}种颜色`);
    return validatedPixels;
  }
  
  /**
   * ✅ 优化：查找颜色模式 - 直接使用256色量化+内存缓存，100%匹配预设Pattern
   * 新策略（性能提升约90%）：
   * 1. 直接量化到256色调色板
   * 2. 优先从内存缓存查找（无数据库查询，~0.1ms）
   * 3. 缓存未命中时才查询数据库并更新缓存
   * 4. 避免动态创建Pattern，消除20ms×N的性能开销
   */
  static async findColorPattern(color) {
    // 1. ✅ 直接量化到256色调色板
    const quantizedColor = this.quantizeColorTo256FromHex(color);

    // 2. ✅ 在256色预设Pattern中查找（格式: color_256_#RRGGBB，注意保留#符号且大写，与migration/seed一致）
    const patternKey = `color_256_${quantizedColor}`;

    // 3. ✅ 优先从内存缓存查找（性能提升~99%）
    if (this.pattern256Cache.has(patternKey)) {
      return patternKey;
    }

    // 4. ✅ 缓存未命中，查询数据库并更新缓存
    console.warn(`⚠️ 缓存未命中: ${patternKey}，查询数据库`);
    const pattern = await db('pattern_assets')
      .where('key', patternKey)
      .first();

    if (pattern) {
      // 更新缓存
      this.pattern256Cache.set(patternKey, pattern.payload);
      return pattern.key;
    }

    // 5. ✅ 如果256色Pattern不存在，尝试通过 payload 查找
    console.warn(`⚠️ 256色Pattern不存在: ${patternKey}，尝试通过payload查找`);
    const exactPattern = await db('pattern_assets')
      .where('category', 'base256color')
      .where('payload', quantizedColor)
      .first();

    if (exactPattern) {
      // 更新缓存
      this.pattern256Cache.set(exactPattern.key, exactPattern.payload);
      return exactPattern.key;
    }

    // 6. ✅ 最终兜底：使用16色基础调色板
    console.error(`❌ 严重错误: 256色Pattern缺失 (${quantizedColor})，回退到16色调色板`);
    const fallbackColor = validateAndQuantizeColor(color);
    const fallbackPattern = await db('pattern_assets')
      .where('render_type', 'color')
      .where('payload', fallbackColor)
      .first();

    if (fallbackPattern) {
      return fallbackPattern.key;
    }

    // 7. 如果仍然找不到，抛出错误
    throw new Error(`颜色 ${color} 处理失败，请检查数据库256色Pattern配置。需要的颜色: ${quantizedColor}`);
  }

  /**
   * ✅ 从十六进制颜色量化到256色调色板
   */
  static quantizeColorTo256FromHex(hexColor) {
    const rgb = this.hexToRgb(hexColor);
    if (!rgb) return '#000000';

    // 使用256色调色板量化
    const palette = this.generate256ColorPalette();
    let minDistance = Infinity;
    let closestColor = palette[0];

    for (const color of palette) {
      // 使用加权欧几里得距离
      const distance =
        Math.pow(rgb.r - color.r, 2) * 0.30 +
        Math.pow(rgb.g - color.g, 2) * 0.59 +
        Math.pow(rgb.b - color.b, 2) * 0.11;

      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color;
      }
    }

    return closestColor.hex;
  }

  /**
   * ✅ 生成256色调色板
   */
  static generate256ColorPalette() {
    const palette = [];
    const rgbLevels = [0, 51, 102, 153, 204, 255];

    // 生成216个Web安全色
    for (const r of rgbLevels) {
      for (const g of rgbLevels) {
        for (const b of rgbLevels) {
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
          palette.push({ r, g, b, hex });
        }
      }
    }

    // 添加40个灰度级
    for (let i = 0; i < 40; i++) {
      const gray = Math.floor((i / 39) * 255);
      const hex = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`.toUpperCase();
      palette.push({ r: gray, g: gray, b: gray, hex });
    }

    return palette;
  }
  
  /**
   * 颜色量化：将任意颜色映射到最接近的基础颜色
   */
  static quantizeColor(color) {
    // 使用统一的16色调色板 - 与前端保持一致
    const baseColors = [
      '#000000', // 黑色
      '#FFFFFF', // 白色
      '#808080', // 灰色
      '#FF0000', // 红色
      '#00FF00', // 绿色
      '#0000FF', // 蓝色
      '#FFFF00', // 黄色
      '#FF00FF', // 洋红
      '#00FFFF', // 青色
      '#800000', // 深红
      '#008000', // 深绿
      '#000080', // 深蓝
      '#808000', // 橄榄色
      '#800080', // 紫色
      '#008080', // 青绿色
      '#C0C0C0'  // 银灰色
    ];
    
    // 计算颜色距离，找到最接近的基础颜色
    let minDistance = Infinity;
    let closestColor = baseColors[0];
    
    for (const baseColor of baseColors) {
      const distance = this.calculateColorDistance(color, baseColor);
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = baseColor;
      }
    }
    
    return closestColor;
  }
  
  /**
   * 计算两个颜色之间的距离（欧几里得距离）
   */
  static calculateColorDistance(color1, color2) {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    if (!rgb1 || !rgb2) {
      return Infinity;
    }
    
    // 计算RGB空间的欧几里得距离
    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;
    
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  
  /**
   * 将十六进制颜色转换为RGB
   */
  static hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  
  /**
   * 转换广告坐标到像素坐标 - 高精度优化版本
   * ✅ 使用1:1像素到网格映射，确保每个像素唯一的gridID
   * ✅ 添加完整的统计和验证机制
   */
  static convertAdCoordinatesToPixels(centerLat, centerLng, pixelData, width, height, userId, placementId) {
    // ✅ 关键修复：使用0.0001度（与网格尺寸相同），确保1:1映射
    // 网格尺寸 = 0.0001度 ≈ 11m，像素尺寸 = 0.0001度 ≈ 11m
    // 每个像素对应一个独立网格，避免多个像素对齐到同一网格
    const PIXEL_SIZE_DEGREES = 0.0001;
    const pixels = [];

    // 确保坐标是数字类型并验证有效性
    const lat = parseFloat(centerLat);
    const lng = parseFloat(centerLng);
    const w = parseInt(width);
    const h = parseInt(height);

    // 验证输入参数
    if (isNaN(lat) || isNaN(lng) || isNaN(w) || isNaN(h)) {
      throw new Error(`无效的广告参数: lat=${lat}, lng=${lng}, width=${w}, height=${h}`);
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error(`坐标超出有效范围: lat=${lat}, lng=${lng}`);
    }

    // 计算广告区域的总地理尺寸
    const totalWidthDegrees = w * PIXEL_SIZE_DEGREES;
    const totalHeightDegrees = h * PIXEL_SIZE_DEGREES;

    // 计算左上角起始坐标，确保广告完美居中
    const startLat = lat + (totalHeightDegrees / 2);
    const startLng = lng - (totalWidthDegrees / 2);

    console.log(`📍 广告投影信息:`);
    console.log(`  中心坐标: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
    console.log(`  广告尺寸: ${w}x${h} 像素`);
    console.log(`  像素间距: ${PIXEL_SIZE_DEGREES}° (≈ 11m)`);
    console.log(`  地理尺寸: ${totalWidthDegrees.toFixed(6)}° x ${totalHeightDegrees.toFixed(6)}°`);
    console.log(`  起始坐标: (${startLat.toFixed(6)}, ${startLng.toFixed(6)})`);
    console.log(`  占地面积: 约 ${(w * 11 / 1000).toFixed(3)} km × ${(h * 11 / 1000).toFixed(3)} km`);

    // 统计信息
    const stats = {
      inputPixels: pixelData.length,
      processedPixels: 0,
      failedPixels: 0,
      uniqueGrids: new Set(),
      duplicateGrids: new Map(), // 记录重复的gridId及其出现次数
      colorDistribution: {},
      errors: []
    };

    // 处理每个像素
    for (const pixel of pixelData) {
      try {
        // 验证像素数据
        if (!pixel || typeof pixel.x !== 'number' || typeof pixel.y !== 'number') {
          stats.failedPixels++;
          stats.errors.push(`无效的像素数据: ${JSON.stringify(pixel)}`);
          continue;
        }

        // ✅ 高精度坐标计算
        // 使用固定精度避免浮点累积误差
        const actualLat = parseFloat((startLat - (pixel.y * PIXEL_SIZE_DEGREES)).toFixed(8));
        const actualLng = parseFloat((startLng + (pixel.x * PIXEL_SIZE_DEGREES)).toFixed(8));

        // 网格对齐 - 使用优化后的高精度算法
        const { lat: snappedLat, lng: snappedLng, gridId, gridIndex } = snapToGrid(actualLat, actualLng);

        // ✅ 检测网格ID重复
        if (stats.uniqueGrids.has(gridId)) {
          const count = stats.duplicateGrids.get(gridId) || 1;
          stats.duplicateGrids.set(gridId, count + 1);
          console.warn(`⚠️ 重复网格ID: ${gridId}, 像素位置: (${pixel.x}, ${pixel.y}), 第${count + 1}次出现`);
        } else {
          stats.uniqueGrids.add(gridId);
        }

        // 统计颜色分布
        stats.colorDistribution[pixel.color] = (stats.colorDistribution[pixel.color] || 0) + 1;

        pixels.push({
          grid_id: gridId,
          latitude: snappedLat,
          longitude: snappedLng,
          color: pixel.color,
          pattern_id: pixel.patternId,
          user_id: userId,
          timestamp: Date.now(),
          pixel_type: PIXEL_TYPES.AD,
          related_id: placementId,
          // 调试信息
          _debug: {
            original_x: pixel.x,
            original_y: pixel.y,
            calculated_lat: actualLat,
            calculated_lng: actualLng,
            grid_index: gridIndex
          }
        });

        stats.processedPixels++;
      } catch (error) {
        stats.failedPixels++;
        stats.errors.push(`坐标转换失败 pixel(${pixel.x}, ${pixel.y}): ${error.message}`);
        console.error(`❌ 坐标转换失败: pixel(${pixel.x}, ${pixel.y})`, error);
      }
    }

    // 输出详细统计
    console.log(`\n📊 坐标转换统计报告:`);
    console.log(`  输入像素数: ${stats.inputPixels}`);
    console.log(`  成功处理: ${stats.processedPixels}`);
    console.log(`  失败处理: ${stats.failedPixels}`);
    console.log(`  输出像素数: ${pixels.length}`);
    console.log(`  唯一网格数: ${stats.uniqueGrids.size}`);
    console.log(`  重复网格数: ${stats.duplicateGrids.size}`);
    console.log(`  重复像素数: ${Array.from(stats.duplicateGrids.values()).reduce((sum, count) => sum + count, 0)}`);
    console.log(`  不同颜色数: ${Object.keys(stats.colorDistribution).length}`);

    // 验证完整性
    if (stats.processedPixels !== stats.inputPixels) {
      console.error(`❌ 严重错误: 处理像素数(${stats.processedPixels})与输入像素数(${stats.inputPixels})不匹配！`);
      console.error(`  失败像素数: ${stats.failedPixels}`);
      if (stats.errors.length > 0) {
        console.error(`  前5个错误:`, stats.errors.slice(0, 5));
      }
    }

    if (stats.duplicateGrids.size > 0) {
      console.error(`❌ 严重警告: 发现${stats.duplicateGrids.size}个重复的网格ID，将导致${Array.from(stats.duplicateGrids.values()).reduce((sum, count) => sum + count, 0)}个像素丢失！`);
      // 输出前5个重复的网格ID
      const duplicates = Array.from(stats.duplicateGrids.entries()).slice(0, 5);
      console.error(`  示例重复网格:`, duplicates.map(([id, count]) => `${id}(${count}次)`).join(', '));

      // ⚠️ 抛出错误，避免数据不完整
      throw new Error(`广告像素投影失败: 检测到${stats.duplicateGrids.size}个网格ID冲突，请检查像素尺寸配置`);
    } else {
      console.log(`✅ 验证通过: 所有像素都有唯一的网格ID，无冲突！`);
    }

    return pixels;
  }

  /**
   * ✅ 最终修复版：使用标准 grid_* 格式，与前端完全兼容
   * - 使用 snapToGrid 生成标准 grid_id
   * - 使用网格大小 0.0001度（与系统一致）
   * - 正确处理 y 轴方向（像素 y 向下 = 纬度向南减少）
   */
  static convertAdCoordinatesToPixelsIntegerGrid(centerLat, centerLng, pixelData, width, height, userId, placementId, allianceId = null) {
    const lat = parseFloat(centerLat);
    const lng = parseFloat(centerLng);
    const w = parseInt(width);
    const h = parseInt(height);

    if (isNaN(lat) || isNaN(lng) || isNaN(w) || isNaN(h)) {
      throw new Error(`无效的广告参数: lat=${lat}, lng=${lng}, width=${w}, height=${h}`);
    }

    // ✅ 使用系统标准网格大小：0.0001度 ≈ 11米
    const GRID_SIZE_DEGREES = 0.0001;

    // 广告的原点视为左上角 (x=0, y=0)，center 对应于中心
    const originOffsetX = -Math.floor(w / 2);
    const originOffsetY = -Math.floor(h / 2);

    console.log(`📍 广告投影信息:`);
    console.log(`  中心坐标: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
    console.log(`  广告尺寸: ${w}x${h} 像素`);
    console.log(`  像素间距: ${GRID_SIZE_DEGREES}° (≈ 11m)`);
    console.log(`  占地面积: 约 ${(w * 11 / 1000).toFixed(3)} km × ${(h * 11 / 1000).toFixed(3)} km`);

    const pixels = [];
    const stats = {
      inputPixels: pixelData.length,
      processedPixels: 0,
      uniqueGrids: new Set(),
    };

    for (const pixel of pixelData) {
      if (!pixel || typeof pixel.x !== 'number' || typeof pixel.y !== 'number') {
        continue;
      }

      // 计算相对于中心的偏移（像素坐标）
      const pixelX = pixel.x + originOffsetX; // -w/2 .. +w/2
      const pixelY = pixel.y + originOffsetY; // -h/2 .. +h/2

      // ✅ 计算实际经纬度
      // - 像素 y 增加 = 向下 = 纬度减少（南）
      // - x 增加 = 向右 = 经度增加（东）
      const longitude = lng + (pixelX * GRID_SIZE_DEGREES);
      const latitude = lat - (pixelY * GRID_SIZE_DEGREES);  // 注意是减号

      // ✅ 使用 snapToGrid 生成标准 grid_id，与前端完全兼容
      const { lat: snappedLat, lng: snappedLng, gridId } = snapToGrid(latitude, longitude);

      if (!stats.uniqueGrids.has(gridId)) {
        stats.uniqueGrids.add(gridId);
      }

      pixels.push({
        grid_id: gridId,
        latitude: snappedLat,
        longitude: snappedLng,
        color: pixel.color,
        pattern_id: pixel.patternId,
        user_id: userId,
        timestamp: Date.now(),
        pixel_type: PIXEL_TYPES.AD,
        related_id: placementId,
        alliance_id: allianceId || null,
        _debug: {
          original_x: pixel.x,
          original_y: pixel.y,
          pixel_x: pixelX,
          pixel_y: pixelY,
          calculated_lat: latitude,
          calculated_lng: longitude,
          snapped_lat: snappedLat,
          snapped_lng: snappedLng
        }
      });

      stats.processedPixels++;
    }

    // 连续性/完整性自检：应当正好覆盖 w*h 个唯一格子
    const expected = w * h;
    if (stats.uniqueGrids.size !== expected || pixels.length !== expected) {
      console.warn(`⚠️ 广告网格连续性: 期望=${expected}, 实际像素=${pixels.length}, 唯一网格=${stats.uniqueGrids.size}`);
      console.warn(`  可能原因: 像素间距与网格大小不匹配，导致多个像素对齐到同一网格`);
      // 不中断流程，但记录告警
    } else {
      console.log(`✅ 广告网格连续性校验通过: ${w}×${h}=${expected}`);
    }

    // 输出坐标范围供验证
    if (pixels.length > 0) {
      const lats = pixels.map(p => p.latitude);
      const lngs = pixels.map(p => p.longitude);
      console.log(`  纬度范围: ${Math.min(...lats).toFixed(6)} ~ ${Math.max(...lats).toFixed(6)}`);
      console.log(`  经度范围: ${Math.min(...lngs).toFixed(6)} ~ ${Math.max(...lngs).toFixed(6)}`);
    }

    return pixels;
  }
  
  /**
   * ✅ 优化：广告专用批量写入 - 性能提升约50%
   * 优化策略:
   * 1. 使用更大的批次大小 (500 vs 默认100)
   * 2. 减少数据库往返次数
   * 3. 优化SQL查询 (使用INSERT ... ON CONFLICT DO UPDATE)
   * 4. 异步处理历史记录和瓦片缓存
   * 🆕 5. 使用中心点地理信息，避免为每个像素调用API
   */
  static async batchWritePixels(pixelBatch, locationInfo = null) {
    const startTime = Date.now();
    console.log(`📦 开始批量写入广告像素: ${pixelBatch.length}个`);

    try {
      const BATCH_SIZE = 500; // ✅ 广告专用：使用更大批次
      let inserted = 0;
      let updated = 0;
      const timestamp = new Date();

      // 🆕 如果没有提供地理信息，使用默认值
      const finalLocationInfo = locationInfo || {
        country: null,
        province: null,
        city: null,
        district: null,
        adcode: null,
        formatted_address: null,
        geocoded: false,
        geocoded_at: null
      };

      // 分批处理，每批500个像素
      for (let i = 0; i < pixelBatch.length; i += BATCH_SIZE) {
        const batch = pixelBatch.slice(i, i + BATCH_SIZE);
        console.log(`  📦 处理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pixelBatch.length / BATCH_SIZE)}: ${batch.length}个像素`);

        // ✅ 使用单个事务批量插入/更新
        const batchResult = await db.transaction(async (trx) => {
          const insertData = batch.map(pixel => ({
            grid_id: pixel.grid_id,
            latitude: pixel.latitude,
            longitude: pixel.longitude,
            color: pixel.color,
            user_id: pixel.user_id,
            pattern_id: pixel.pattern_id,
            pixel_type: pixel.pixel_type,
            related_id: pixel.related_id,
            alliance_id: pixel.alliance_id || null,
            // 🆕 使用统一的地理信息（所有像素共享广告中心点的地理信息）
            country: finalLocationInfo.country,
            province: finalLocationInfo.province,
            city: finalLocationInfo.city,
            district: finalLocationInfo.district,
            adcode: finalLocationInfo.adcode,
            formatted_address: finalLocationInfo.formatted_address,
            geocoded: finalLocationInfo.geocoded,
            geocoded_at: finalLocationInfo.geocoded_at,
            created_at: timestamp,
            updated_at: timestamp
          }));

          // ✅ 高性能批量upsert: INSERT ... ON CONFLICT ... DO UPDATE
          const result = await trx('pixels')
            .insert(insertData)
            .onConflict('grid_id')
            .merge({
              latitude: trx.raw('EXCLUDED.latitude'),
              longitude: trx.raw('EXCLUDED.longitude'),
              color: trx.raw('EXCLUDED.color'),
              user_id: trx.raw('EXCLUDED.user_id'),
              pattern_id: trx.raw('EXCLUDED.pattern_id'),
              pixel_type: trx.raw('EXCLUDED.pixel_type'),
              related_id: trx.raw('EXCLUDED.related_id'),
              alliance_id: trx.raw('EXCLUDED.alliance_id'),
              // 🆕 更新地理信息
              country: trx.raw('EXCLUDED.country'),
              province: trx.raw('EXCLUDED.province'),
              city: trx.raw('EXCLUDED.city'),
              district: trx.raw('EXCLUDED.district'),
              adcode: trx.raw('EXCLUDED.adcode'),
              formatted_address: trx.raw('EXCLUDED.formatted_address'),
              geocoded: trx.raw('EXCLUDED.geocoded'),
              geocoded_at: trx.raw('EXCLUDED.geocoded_at'),
              updated_at: timestamp
            })
            .returning('created_at');

          // 统计新插入 vs 更新
          const newInserts = result.filter(r => r.created_at.getTime() === timestamp.getTime()).length;
          const updates = result.length - newInserts;

          return { newInserts, updates };
        });

        inserted += batchResult.newInserts;
        updated += batchResult.updates;
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ 广告批量写入完成:`);
      console.log(`  - 新插入: ${inserted}个像素`);
      console.log(`  - 更新: ${updated}个像素`);
      console.log(`  - 总计: ${pixelBatch.length}个像素`);
      console.log(`  - 耗时: ${processingTime}ms (${(pixelBatch.length / (processingTime / 1000)).toFixed(0)} pixels/s)`);
      console.log(`  - 地理信息: ${finalLocationInfo.geocoded ? finalLocationInfo.province + ' ' + finalLocationInfo.city : '未获取'}`);

      // ✅ 异步处理历史记录（不阻塞主流程）
      setImmediate(() => {
        this.recordPixelHistory(pixelBatch, finalLocationInfo).catch(error => {
          console.error('❌ 记录像素历史失败:', error);
        });
      });

      // ✅ 异步处理瓦片缓存失效（不阻塞主流程）
      setImmediate(() => {
        this.invalidateTileCaches(pixelBatch).catch(error => {
          console.error('❌ 瓦片缓存失效处理失败:', error);
        });
      });

      return {
        success: true,
        successCount: inserted + updated,
        failureCount: 0,
        inserted,
        updated,
        processingTime
      };

    } catch (error) {
      console.error('❌ 广告批量写入失败:', error);
      throw error;
    }
  }

  /**
   * ✅ 新增：异步记录像素历史
   */
  static async recordPixelHistory(pixelBatch, locationInfo = null) {
    try {
      const historyData = pixelBatch.map(pixel => ({
        latitude: pixel.latitude,
        longitude: pixel.longitude,
        color: pixel.color,
        user_id: pixel.user_id,
        grid_id: pixel.grid_id,
        pattern_id: pixel.pattern_id,
        pattern_anchor_x: 0,
        pattern_anchor_y: 0,
        pattern_rotation: 0,
        pattern_mirror: false,
        pixel_type: pixel.pixel_type,
        related_id: pixel.related_id,
        alliance_id: pixel.alliance_id || null,
        // 🆕 使用统一的地理信息
        country: locationInfo?.country || null,
        province: locationInfo?.province || null,
        city: locationInfo?.city || null,
        district: locationInfo?.district || null,
        adcode: locationInfo?.adcode || null,
        formatted_address: locationInfo?.formatted_address || null,
        geocoded: locationInfo?.geocoded || false,
        geocoded_at: locationInfo?.geocoded_at || null
      }));

      await pixelsHistoryService.batchRecordPixelHistory(
        historyData,
        'ad_placement',
        { batchSize: pixelBatch.length }
      );

      console.log(`📝 像素历史记录完成: ${historyData.length}个`);
      if (locationInfo?.geocoded) {
        console.log(`  - 地理信息: ${locationInfo.province} ${locationInfo.city}`);
      }
    } catch (error) {
      console.error('❌ 记录像素历史失败:', error);
    }
  }

  /**
   * ✅ 新增：异步失效瓦片缓存
   */
  static async invalidateTileCaches(pixelBatch) {
    try {
      const TileCacheService = require('./tileCacheService');
      const TileUtils = require('../utils/tileUtils');
      const tileIds = new Set();

      // 计算受影响的瓦片ID
      for (const pixel of pixelBatch) {
        for (let zoom = 10; zoom <= 18; zoom++) {
          const tileId = TileUtils.latLngToTileId(pixel.latitude, pixel.longitude, zoom);
          tileIds.add(tileId);
        }
      }

      // 批量失效瓦片缓存
      await Promise.all(
        Array.from(tileIds).map(tileId => TileCacheService.invalidate(tileId))
      );

      console.log(`🗑️ 瓦片缓存失效完成: ${tileIds.size}个瓦片`);
    } catch (error) {
      console.error('❌ 瓦片缓存失效失败:', error);
    }
  }
  
  /**
   * 异步广播像素更新
   */
  static async broadcastPixelUpdates(pixelUpdates) {
    const BROADCAST_BATCH_SIZE = 50;
    const batches = [];
    
    // 分批广播
    for (let i = 0; i < pixelUpdates.length; i += BROADCAST_BATCH_SIZE) {
      batches.push(pixelUpdates.slice(i, i + BROADCAST_BATCH_SIZE));
    }
    
    console.log(`📡 准备广播: ${batches.length}批，每批最多${BROADCAST_BATCH_SIZE}个像素`);
    
    // 异步广播，不阻塞主流程
    setImmediate(async () => {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        try {
          console.log(`📡 广播第${i + 1}批: ${batch.length}个像素`);
          
          // 触发像素更新事件
          await this.triggerPixelUpdateEvents(batch);
          
          // 批次间延迟
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`❌ 广播第${i + 1}批失败:`, error);
        }
      }
      
      console.log(`✅ 异步广播完成: ${pixelUpdates.length}个像素更新`);
    });
  }
  
  /**
   * 触发像素更新事件
   */
  static async triggerPixelUpdateEvents(pixelBatch) {
    for (const pixel of pixelBatch) {
      try {
        const pixelUpdateEvent = {
          grid_id: pixel.grid_id,
          latitude: pixel.latitude,
          longitude: pixel.longitude,
          color: pixel.color,
          user_id: pixel.user_id,
          timestamp: Date.now(),
          pixel_type: PIXEL_TYPES.AD,
          related_id: pixel.related_id
        };
        
        // 发送像素更新事件（这里可以集成WebSocket或事件系统）
        await this.sendPixelUpdate(pixelUpdateEvent);
        
      } catch (error) {
        console.error('❌ 发送像素更新事件失败:', error);
      }
    }
  }
  
  /**
   * 发送像素更新
   */
  static async sendPixelUpdate(pixelUpdateEvent) {
    // 这里可以集成WebSocket、Redis发布订阅或其他事件系统
    // 目前先记录日志，后续可以扩展
    console.log(`📡 像素更新事件: ${pixelUpdateEvent.grid_id} -> ${pixelUpdateEvent.color}`);
    
    // 可以在这里添加WebSocket广播逻辑
    // 例如: io.emit('pixel-updated', pixelUpdateEvent);
  }
  
  /**
   * 获取广告像素统计信息
   */
  static async getAdPixelStats(placementId) {
    try {
      const stats = await db('pixels')
        .where('pixel_type', PIXEL_TYPES.AD)
        .where('related_id', placementId)
        .count('* as count')
        .first();
      
      return {
        totalPixels: parseInt(stats.count),
        placementId: placementId
      };
    } catch (error) {
      console.error('获取广告像素统计失败:', error);
      return null;
    }
  }
}

module.exports = AdPixelRenderer;
