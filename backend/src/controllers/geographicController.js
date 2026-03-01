const { db } = require('../config/database');
const GeographicLeaderboardService = require('../services/geographicLeaderboardService');
const CityLeaderboardService = require('../services/cityLeaderboardService');
const PixelLocationService = require('../services/pixelLocationService');
const RegionDataImportService = require('../services/regionDataImportService');
const GeographicStatsMaintenanceService = require('../services/geographicStatsMaintenanceService');
const HotspotService = require('../services/hotspotService');
const IncrementalHotspotService = require('../services/incrementalHotspotService');
const HotspotPerformanceAnalyzer = require('../services/hotspotPerformanceAnalyzer');
const logger = require('../utils/logger');

/**
 * 地理统计控制器
 * 处理地理归属和排行榜相关的API请求
 */
class GeographicController {
  constructor() {
    this.geographicLeaderboardService = new GeographicLeaderboardService();
    this.cityLeaderboardService = CityLeaderboardService; // 使用新的城市排行榜服务
    this.pixelLocationService = new PixelLocationService();
    this.regionDataImportService = new RegionDataImportService();
    this.maintenanceService = new GeographicStatsMaintenanceService();
  }

  /**
   * 获取省份排行榜
   */
  static async getProvinceLeaderboard(req, res) {
    try {
      const { period = 'daily', limit = 20, offset = 0 } = req.query;
      
      const controller = new GeographicController();
      const leaderboard = await controller.geographicLeaderboardService.getProvinceLeaderboard(
        period, 
        parseInt(limit)
      );
      
      res.json({
        success: true,
        data: leaderboard
      });
      
    } catch (error) {
      console.error('获取省份排行榜失败:', error);
      res.status(500).json({
        success: false,
        message: '获取省份排行榜失败',
        error: error.message
      });
    }
  }

  /**
   * 获取每日热点区域（兼容旧接口）
   */
  static async getDailyHotspots(req, res) {
    try {
      const { limit = 10, period = 'monthly' } = req.query;

      logger.info(`获取热点区域请求: period=${period}, limit=${limit}`);

      const hotspots = await HotspotService.getHotspots(String(period), parseInt(limit));

      // 如果没有热点数据，返回空数组而不是错误
      if (!hotspots || hotspots.length === 0) {
        logger.info(`暂无热点数据: period=${period}`);
        return res.json({
          success: true,
          data: [],
          message: `暂无${period}周期热点数据`
        });
      }

      logger.info(`✅ 成功获取热点数据: ${hotspots.length} 个热点`);
      res.json({ success: true, data: hotspots });

    } catch (error) {
      logger.error('❌ 获取热点区域失败:', error);

      // 如果是数据库表不存在的错误，尝试自动创建
      if (error.message && error.message.includes('does not exist')) {
        logger.info('尝试创建pixel_hotspots表...');
        try {
          const { db } = require('../config/database');
          await db.raw(`
            CREATE TABLE IF NOT EXISTS pixel_hotspots (
              id SERIAL PRIMARY KEY,
              hotspot_date DATE NOT NULL,
              period VARCHAR(20) NOT NULL DEFAULT 'daily',
              rank INTEGER NOT NULL DEFAULT 1,
              center_lat DECIMAL(10,6) NOT NULL,
              center_lng DECIMAL(10,6) NOT NULL,
              pixel_count INTEGER NOT NULL DEFAULT 0,
              unique_users INTEGER NOT NULL DEFAULT 0,
              region_level VARCHAR(50),
              region_code VARCHAR(100),
              region_name VARCHAR(200),
              meta JSONB,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_pixel_hotspots_unique ON pixel_hotspots(hotspot_date, period, rank);
            CREATE INDEX IF NOT EXISTS idx_pixel_hotspots_date ON pixel_hotspots(hotspot_date);
            CREATE INDEX IF NOT EXISTS idx_pixel_hotspots_period ON pixel_hotspots(period);
            CREATE INDEX IF NOT EXISTS idx_pixel_hotspots_rank ON pixel_hotspots(rank);
            CREATE INDEX IF NOT EXISTS idx_pixel_hotspots_pixel_count ON pixel_hotspots(pixel_count);
          `);

          logger.info('✅ pixel_hotspots表创建成功，返回空数据');
          return res.json({
            success: true,
            data: [],
            message: '热点数据表已创建，暂无数据'
          });
        } catch (createError) {
          logger.error('❌ 自动创建pixel_hotspots表失败:', createError);
        }
      }

      res.status(500).json({
        success: false,
        message: '获取热点区域失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '内部服务器错误'
      });
    }
  }

  /**
   * 获取漫游城市列表（地图工具栏专用）
   */
  static async getRoamingCities(req, res) {
    try {
      const { period = 'monthly' } = req.query;

      logger.info(`获取漫游城市列表请求: period=${period}`);

      const result = await HotspotService.getRoamingCities(String(period));

      if (result.success) {
        logger.info(`✅ 成功获取漫游城市列表: ${result.total} 个城市`);
        res.json({
          success: true,
          data: result.data,
          period: result.period,
          total: result.total
        });
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      logger.error('❌ 获取漫游城市列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取漫游城市列表失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '内部服务器错误'
      });
    }
  }

  /**
   * 手动触发热点统计计算（排行榜任务后调用）
   */
  static async triggerHotspotComputation(req, res) {
    try {
      const { periods = ['daily', 'weekly', 'monthly'], useIncremental = true } = req.body;

      logger.info(`手动触发热点统计计算: periods=${periods.join(', ')}, 增量=${useIncremental}`);

      const results = await HotspotService.triggerHotspotComputation(periods);

      const successCount = Object.values(results).filter(r => r.success).length;
      const totalCount = Object.keys(results).length;

      logger.info(`✅ 热点统计计算完成: ${successCount}/${totalCount} 成功`);

      res.json({
        success: successCount > 0,
        message: `热点统计计算完成: ${successCount}/${totalCount} 成功 (${useIncremental ? '增量' : '全量'})`,
        results: results,
        method: useIncremental ? 'incremental' : 'full'
      });

    } catch (error) {
      logger.error('❌ 手动触发热点统计计算失败:', error);
      res.status(500).json({
        success: false,
        message: '手动触发热点统计计算失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '内部服务器错误'
      });
    }
  }

  /**
   * 性能对比测试接口
   */
  static async runHotspotPerformanceTest(req, res) {
    try {
      const { period = 'daily' } = req.query;

      logger.info(`开始热点统计性能对比测试: period=${period}`);

      const analyzer = new HotspotPerformanceAnalyzer();
      const report = await analyzer.runPerformanceComparison(String(period));

      res.json({
        success: true,
        message: '性能对比测试完成',
        report: report
      });

    } catch (error) {
      logger.error('❌ 热点统计性能测试失败:', error);
      res.status(500).json({
        success: false,
        message: '热点统计性能测试失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '内部服务器错误'
      });
    }
  }

  /**
   * 获取性能趋势数据
   */
  static async getHotspotPerformanceTrends(req, res) {
    try {
      const { days = 7 } = req.query;

      const analyzer = new HotspotPerformanceAnalyzer();
      const trends = await analyzer.getPerformanceTrends(parseInt(days));

      res.json({
        success: true,
        data: trends,
        total: trends.length
      });

    } catch (error) {
      logger.error('❌ 获取性能趋势失败:', error);
      res.status(500).json({
        success: false,
        message: '获取性能趋势失败',
        error: process.env.NODE_ENV === 'development' ? error.message : '内部服务器错误'
      });
    }
  }

  /**
   * 获取城市排行榜
   * 使用基于OpenStreetMap PostGIS的新服务
   */
  static async getCityLeaderboard(req, res) {
    try {
      const { period = 'daily', limit = 20, offset = 0 } = req.query;

      logger.info(`获取城市排行榜请求: period=${period}, limit=${limit}`);

      const controller = new GeographicController();
      const date = new Date().toISOString().split('T')[0];

      // 使用新的CityLeaderboardService生成排行榜
      const leaderboard = await controller.cityLeaderboardService.generateLeaderboard(
        period,
        date,
        { forceRefresh: false }
      );

      // 格式化返回数据以匹配前端期望的格式
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      const paginatedData = leaderboard.slice(offsetNum, offsetNum + limitNum);

      const formattedData = {
        level: 'city',
        period: period,
        data: paginatedData.map((item, index) => ({
          region_code: item.osm_id?.toString() || item.city || '',
          region_name: item.city || item.name || '未知',
          pixel_count: item.pixel_count || 0,
          user_count: item.user_count || 0,
          rank: offsetNum + index + 1,
          // 额外的元数据
          province: item.province,
          source: item.source,
          match_quality: item.match_quality
        })),
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: leaderboard.length
        }
      };

      logger.info(`✅ 城市排行榜获取成功: ${leaderboard.length} 个城市`);

      res.json({
        success: true,
        data: formattedData
      });

    } catch (error) {
      logger.error('❌ 获取城市排行榜失败:', error);
      res.status(500).json({
        success: false,
        message: '获取城市排行榜失败',
        error: error.message
      });
    }
  }

  /**
   * 获取国家排行榜
   */
  static async getCountryLeaderboard(req, res) {
    try {
      const { period = 'daily', limit = 20, offset = 0 } = req.query;
      
      const controller = new GeographicController();
      const leaderboard = await controller.geographicLeaderboardService.getGeographicLeaderboard(
        'country',
        period,
        parseInt(limit),
        parseInt(offset)
      );
      
      res.json({
        success: true,
        data: leaderboard
      });
      
    } catch (error) {
      console.error('获取国家排行榜失败:', error);
      res.status(500).json({
        success: false,
        message: '获取国家排行榜失败',
        error: error.message
      });
    }
  }

  /**
   * 获取地区详细统计
   */
  static async getRegionDetailStats(req, res) {
    try {
      const { regionCode, level, period = 'daily' } = req.params;
      
      const controller = new GeographicController();
      const stats = await controller.geographicLeaderboardService.getRegionDetailStats(
        regionCode, 
        level, 
        period
      );
      
      if (!stats) {
        return res.status(404).json({
          success: false,
          message: '地区统计信息不存在'
        });
      }
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('获取地区详细统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取地区详细统计失败',
        error: error.message
      });
    }
  }

  /**
   * 获取地区热力图数据
   */
  static async getRegionHeatmapData(req, res) {
    try {
      const { level = 'province', period = 'daily' } = req.query;
      
      const controller = new GeographicController();
      const heatmapData = await controller.geographicLeaderboardService.getRegionHeatmapData(level, period);
      
      res.json({
        success: true,
        data: heatmapData
      });
      
    } catch (error) {
      console.error('获取地区热力图数据失败:', error);
      res.status(500).json({
        success: false,
        message: '获取地区热力图数据失败',
        error: error.message
      });
    }
  }

  /**
   * 获取像素地理归属信息
   */
  static async getPixelLocation(req, res) {
    try {
      const { gridId } = req.params;
      const { latitude, longitude } = req.query;
      
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: '缺少经纬度参数'
        });
      }
      
      // 从gridId中提取数字ID，如果gridId格式为grid_xxx_yyy，则提取xxx作为pixelId
      let pixelId;
      if (gridId.startsWith('grid_')) {
        const parts = gridId.split('_');
        if (parts.length >= 2) {
          pixelId = parseInt(parts[1]);
        }
      } else {
        pixelId = parseInt(gridId);
      }
      
      // 如果无法提取有效的pixelId，则使用0作为默认值
      if (isNaN(pixelId)) {
        pixelId = 0;
      }
      
      const controller = new GeographicController();
      const locationInfo = await controller.pixelLocationService.getPixelLocation(
        pixelId,
        parseFloat(latitude),
        parseFloat(longitude)
      );
      
      res.json({
        success: true,
        data: locationInfo
      });
      
    } catch (error) {
      console.error('获取像素地理归属失败:', error);
      res.status(500).json({
        success: false,
        message: '获取像素地理归属失败',
        error: error.message
      });
    }
  }

  /**
   * 获取地理归属统计
   */
  static async getLocationStats(req, res) {
    try {
      const controller = new GeographicController();
      const stats = await controller.pixelLocationService.getLocationStats();
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('获取地理归属统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取地理归属统计失败',
        error: error.message
      });
    }
  }

  /**
   * 导入行政区划数据
   */
  static async importRegionData(req, res) {
    try {
      const { source = 'amap', filePath } = req.body;
      
      const controller = new GeographicController();
      const count = await controller.regionDataImportService.importChinaRegions(source, filePath);
      
      res.json({
        success: true,
        message: `成功导入 ${count} 条行政区划数据`,
        data: { count }
      });
      
    } catch (error) {
      console.error('导入行政区划数据失败:', error);
      res.status(500).json({
        success: false,
        message: '导入行政区划数据失败',
        error: error.message
      });
    }
  }

  /**
   * 验证导入的行政区划数据
   */
  static async validateRegionData(req, res) {
    try {
      const controller = new GeographicController();
      const stats = await controller.regionDataImportService.validateImportedData();
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('验证行政区划数据失败:', error);
      res.status(500).json({
        success: false,
        message: '验证行政区划数据失败',
        error: error.message
      });
    }
  }

  /**
   * 手动触发像素地理归属处理
   */
  static async triggerPixelLocationProcessing(req, res) {
    try {
      const { limit = 1000 } = req.body;
      
      const controller = new GeographicController();
      const result = await controller.maintenanceService.triggerPixelLocationProcessing(parseInt(limit));
      
      res.json({
        success: true,
        message: `成功处理 ${result.processed} 个像素的地理归属`,
        data: result
      });
      
    } catch (error) {
      console.error('手动触发像素地理归属处理失败:', error);
      res.status(500).json({
        success: false,
        message: '手动触发像素地理归属处理失败',
        error: error.message
      });
    }
  }

  /**
   * 手动触发排行榜更新
   */
  static async triggerLeaderboardUpdate(req, res) {
    try {
      const { period = 'daily' } = req.body;
      
      const controller = new GeographicController();
      const result = await controller.maintenanceService.triggerLeaderboardUpdate(period);
      
      res.json({
        success: true,
        message: `成功更新 ${period} 排行榜`,
        data: result
      });
      
    } catch (error) {
      console.error('手动触发排行榜更新失败:', error);
      res.status(500).json({
        success: false,
        message: '手动触发排行榜更新失败',
        error: error.message
      });
    }
  }

  /**
   * 获取维护服务状态
   */
  static async getMaintenanceStatus(req, res) {
    try {
      const controller = new GeographicController();
      const status = controller.maintenanceService.getStatus();
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      console.error('获取维护服务状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取维护服务状态失败',
        error: error.message
      });
    }
  }

  /**
   * 启动维护服务
   */
  static async startMaintenanceService(req, res) {
    try {
      const controller = new GeographicController();
      controller.maintenanceService.start();
      
      res.json({
        success: true,
        message: '地理统计维护服务已启动'
      });
      
    } catch (error) {
      console.error('启动维护服务失败:', error);
      res.status(500).json({
        success: false,
        message: '启动维护服务失败',
        error: error.message
      });
    }
  }

  /**
   * 停止维护服务
   */
  static async stopMaintenanceService(req, res) {
    try {
      const controller = new GeographicController();
      controller.maintenanceService.stop();
      
      res.json({
        success: true,
        message: '地理统计维护服务已停止'
      });
      
    } catch (error) {
      console.error('停止维护服务失败:', error);
      res.status(500).json({
        success: false,
        message: '停止维护服务失败',
        error: error.message
      });
    }
  }
}

module.exports = GeographicController;
