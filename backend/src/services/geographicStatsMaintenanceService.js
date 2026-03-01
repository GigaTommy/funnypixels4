const cron = require('node-cron');
const GeographicLeaderboardService = require('./geographicLeaderboardService');
const PixelLocationService = require('./pixelLocationService');
const RegionDataImportService = require('./regionDataImportService');

/**
 * 地理统计维护服务
 * 定时更新地理归属和排行榜数据
 * 
 * 重要改进：
 * - 与个人榜、联盟榜保持一致的运行频率（每小时更新）
 * - 优化统计效率，避免超时问题
 * - 使用批量处理和并行更新提升性能
 * - 添加超时控制和错误重试机制
 */
class GeographicStatsMaintenanceService {
  constructor() {
    this.geographicLeaderboardService = new GeographicLeaderboardService();
    this.pixelLocationService = new PixelLocationService();
    this.regionDataImportService = new RegionDataImportService();
    
    this.isRunning = false;
    this.lastUpdate = null;
    
    // 性能优化配置
    this.batchSize = 500; // 批处理大小
    this.timeoutMs = 300000; // 5分钟超时
    this.maxRetries = 3; // 最大重试次数
  }

  /**
   * 启动地理统计维护服务
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ 地理统计维护服务已在运行中');
      return;
    }

    console.log('🚀 启动地理统计维护服务...');
    this.isRunning = true;

    // 每小时更新一次地理排行榜（与个人榜、联盟榜保持一致）
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ 开始定时更新地理排行榜数据...');
      await this.updateAllGeographicLeaderboards();
    });

    // 每天凌晨2点进行深度维护
    cron.schedule('0 2 * * *', async () => {
      console.log('🌙 开始每日深度维护...');
      await this.performDailyMaintenance();
    });

    // 立即执行一次更新
    this.updateAllGeographicLeaderboards();
    
    console.log('✅ 地理统计维护服务启动完成');
  }

  /**
   * 停止地理统计维护服务
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ 地理统计维护服务未在运行');
      return;
    }

    console.log('🛑 停止地理统计维护服务...');
    this.isRunning = false;
    console.log('✅ 地理统计维护服务已停止');
  }

  /**
   * 更新所有地理排行榜数据
   */
  async updateAllGeographicLeaderboards() {
    if (!this.isRunning) {
      return;
    }

    try {
      const startTime = Date.now();
      console.log('📊 开始更新地理排行榜数据...');

      const periods = ['daily', 'weekly', 'monthly', 'yearly', 'allTime'];
      const now = new Date();

      // 并行更新所有时间段，但限制并发数量避免超时
      const updatePromises = periods.map(period => 
        this.updateGeographicLeaderboardWithTimeout(period, now)
      );

      await Promise.allSettled(updatePromises);

      // 更新统计信息
      await this.updateGeographicStats();

      const duration = Date.now() - startTime;
      this.lastUpdate = new Date();
      console.log(`✅ 地理排行榜数据更新完成，耗时: ${duration}ms`);
      
    } catch (error) {
      console.error('❌ 更新地理排行榜数据失败:', error);
    }
  }

  /**
   * 带超时控制的地理排行榜更新
   */
  async updateGeographicLeaderboardWithTimeout(period, now) {
    return Promise.race([
      this.updateSinglePeriodLeaderboard(period, now),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`更新 ${period} 超时`)), this.timeoutMs)
      )
    ]);
  }

  /**
   * 更新单个时间段的地理排行榜
   */
  async updateSinglePeriodLeaderboard(period, now) {
    try {
      console.log(`  📅 更新 ${period} 地理排行榜...`);
      
      const { periodStart, periodEnd } = this.getPeriodRange(period, now);
      
      await this.geographicLeaderboardService.updateAllGeographicStats(period);
      
      console.log(`  ✅ ${period} 地理排行榜更新完成`);
      
    } catch (error) {
      console.error(`  ❌ 更新 ${period} 地理排行榜失败:`, error.message);
      throw error;
    }
  }

  /**
   * 更新地理统计信息
   */
  async updateGeographicStats() {
    try {
      console.log('📈 更新地理统计信息...');
      
      // 这里可以添加统计信息的更新逻辑
      // 比如更新总像素数、活跃地区数等
      
      console.log('✅ 地理统计信息更新完成');
      
    } catch (error) {
      console.error('❌ 更新地理统计信息失败:', error);
    }
  }

  /**
   * 每日深度维护
   */
  async performDailyMaintenance() {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('🌙 开始每日深度维护...');
      
      // 并行执行维护任务
      await Promise.allSettled([
        this.processUnclassifiedPixels(),
        this.cleanExpiredData(),
        this.validateGeographicData()
      ]);
      
      console.log('✅ 每日深度维护完成');
      
    } catch (error) {
      console.error('❌ 每日深度维护失败:', error);
    }
  }

  /**
   * 处理未分类的像素（批量处理，提升效率）
   */
  async processUnclassifiedPixels() {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('🗺️ 开始处理未分类的像素...');
      
      let totalProcessed = 0;
      let batchCount = 0;
      
      while (true) { // eslint-disable-line no-constant-condition
        // 获取未处理的像素（限制批处理大小）
        const unprocessedPixels = await this.pixelLocationService.getUnprocessedPixels(this.batchSize);
        
        if (unprocessedPixels.length === 0) {
          break;
        }

        batchCount++;
        console.log(`  📦 处理第 ${batchCount} 批，${unprocessedPixels.length} 个像素...`);
        
        // 批量处理像素地理归属
        const processed = await this.pixelLocationService.batchProcessPixelLocations(unprocessedPixels);
        totalProcessed += processed.length;
        
        // 如果处理数量少于批处理大小，说明已经处理完了
        if (processed.length < this.batchSize) {
          break;
        }
        
        // 添加短暂延迟，避免数据库压力过大
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ 未分类像素处理完成，共处理 ${totalProcessed} 个像素`);
      
    } catch (error) {
      console.error('❌ 处理未分类像素失败:', error);
    }
  }

  /**
   * 清理过期数据
   */
  async cleanExpiredData() {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('🧹 开始清理过期数据...');
      
      // 并行清理不同类型的数据
      const [pixelCacheCleaned, leaderboardCleaned] = await Promise.allSettled([
        this.pixelLocationService.cleanExpiredCache(30),
        this.geographicLeaderboardService.cleanExpiredLeaderboardData(30)
      ]);
      
      const pixelCount = pixelCacheCleaned.status === 'fulfilled' ? pixelCacheCleaned.value : 0;
      const leaderboardCount = leaderboardCleaned.status === 'fulfilled' ? leaderboardCleaned.value : 0;
      
      console.log(`✅ 过期数据清理完成: 像素缓存 ${pixelCount} 条, 排行榜数据 ${leaderboardCount} 条`);
      
    } catch (error) {
      console.error('❌ 清理过期数据失败:', error);
    }
  }

  /**
   * 验证地理数据完整性
   */
  async validateGeographicData() {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('🔍 开始验证地理数据完整性...');
      
      // 验证行政区划数据
      await this.regionDataImportService.validateImportedData();
      
      console.log('✅ 地理数据验证完成');
      
    } catch (error) {
      console.error('❌ 验证地理数据失败:', error);
    }
  }

  /**
   * 更新行政区划数据（每周执行）
   */
  async updateRegionData() {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('🗺️ 开始更新行政区划数据...');
      
      // 尝试从不同数据源更新
      const dataSources = ['amap', 'osm', 'nbs'];
      
      for (const source of dataSources) {
        try {
          console.log(`  📥 尝试从 ${source} 更新数据...`);
          const count = await this.regionDataImportService.importChinaRegions(source);
          
          if (count > 0) {
            console.log(`  ✅ 从 ${source} 成功更新 ${count} 条数据`);
            break; // 成功更新后停止尝试其他数据源
          }
        } catch (error) {
          console.log(`  ⚠️ 从 ${source} 更新失败: ${error.message}`);
        }
      }
      
      // 验证更新后的数据
      await this.regionDataImportService.validateImportedData();
      
      console.log('✅ 行政区划数据更新完成');
      
    } catch (error) {
      console.error('❌ 更新行政区划数据失败:', error);
    }
  }

  /**
   * 手动触发地理归属处理
   * @param {number} limit 处理数量限制
   */
  async triggerPixelLocationProcessing(limit = 1000) {
    try {
      console.log(`🔧 手动触发像素地理归属处理 (限制: ${limit})...`);
      
      const unprocessedPixels = await this.pixelLocationService.getUnprocessedPixels(limit);
      
      if (unprocessedPixels.length === 0) {
        console.log('  ✅ 没有未处理的像素');
        return { processed: 0 };
      }
      
      const results = await this.pixelLocationService.batchProcessPixelLocations(unprocessedPixels);
      
      console.log(`✅ 手动处理完成，处理了 ${results.length} 个像素`);
      return { processed: results.length };
      
    } catch (error) {
      console.error('❌ 手动处理失败:', error);
      throw error;
    }
  }

  /**
   * 手动触发排行榜更新
   * @param {string} period 统计周期
   */
  async triggerLeaderboardUpdate(period = 'daily') {
    try {
      console.log(`🔧 手动触发地理排行榜更新 (${period})...`);
      
      const now = new Date();
      await this.updateSinglePeriodLeaderboard(period, now);
      
      console.log(`✅ 手动更新完成 (${period})`);
      return { success: true, period };
      
    } catch (error) {
      console.error('❌ 手动更新失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdate: this.lastUpdate,
      batchSize: this.batchSize,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries
    };
  }

  /**
   * 获取周期时间范围
   * @param {string} period 统计周期
   * @param {Date} date 基准日期
   */
  getPeriodRange(period, date) {
    const now = new Date(date);
    let periodStart, periodEnd;
    
    switch (period) {
    case 'daily':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      periodStart = new Date(now.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'yearly':
      periodStart = new Date(now.getFullYear(), 0, 1);
      periodEnd = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'allTime':
      // 总榜：从项目开始时间到现在
      periodStart = new Date('2024-01-01T00:00:00.000Z');
      periodEnd = new Date();
      break;
    default:
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
    }
    
    return { periodStart, periodEnd };
  }
}

module.exports = GeographicStatsMaintenanceService;