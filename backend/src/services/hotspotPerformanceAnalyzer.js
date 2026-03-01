const { db } = require('../config/database');
const HotspotService = require('./hotspotService');
const IncrementalHotspotService = require('./incrementalHotspotService');
const logger = require('../utils/logger');

/**
 * 热点统计性能分析器
 * 用于对比全量统计和增量统计的性能差异
 */
class HotspotPerformanceAnalyzer {
  constructor() {
    this.testResults = [];
  }

  /**
   * 性能对比测试
   */
  async runPerformanceComparison(period = 'daily') {
    logger.info('🚀 开始热点统计性能对比测试...');

    const testCases = [
      { name: '传统全量统计', method: 'full' },
      { name: '增量统计', method: 'incremental' }
    ];

    for (const testCase of testCases) {
      await this.runSingleTest(testCase, period);
    }

    await this.generateReport();
  }

  /**
   * 运行单个测试用例
   */
  async runSingleTest(testCase, period) {
    logger.info(`📊 测试: ${testCase.name}`);

    const startTime = Date.now();
    let result = null;

    try {
      if (testCase.method === 'full') {
        // 传统全量统计
        result = await HotspotService.computeAndStoreHotspots(period, 10, false);
      } else if (testCase.method === 'incremental') {
        // 增量统计
        const incrementalService = new IncrementalHotspotService();
        result = await incrementalService.computeIncrementalHotspots(period, false);
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 获取数据库性能指标
      const dbMetrics = await this.getDatabaseMetrics();

      const testResult = {
        testCase: testCase.name,
        method: testCase.method,
        executionTime: executionTime,
        success: true,
        recordsProcessed: result?.processed || 0,
        dbMetrics: dbMetrics,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);

      logger.info(`✅ ${testCase.name} 完成: ${executionTime}ms, 处理 ${result?.processed || 0} 条记录`);

    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      logger.error(`❌ ${testCase.name} 失败:`, error);

      const testResult = {
        testCase: testCase.name,
        method: testCase.method,
        executionTime: executionTime,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
    }
  }

  /**
   * 获取数据库性能指标
   */
  async getDatabaseMetrics() {
    try {
      const queries = [
        // pixels_history表大小
        `SELECT pg_size_pretty(pg_total_relation_size('pixels_history')) as pixels_history_size`,
        // city_hotspot_stats表大小
        `SELECT pg_size_pretty(pg_total_relation_size('city_hotspot_stats')) as city_stats_size`,
        // 活跃连接数
        `SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active'`,
        // 缓存命中率
        `SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_rate
         FROM pg_stat_user_tables WHERE schemaname = 'public'`
      ];

      const results = await Promise.all(queries.map(q => db.raw(q)));

      return {
        pixelsHistorySize: results[0].rows[0]?.pixels_history_size || 'Unknown',
        cityStatsSize: results[1].rows[0]?.city_stats_size || 'Unknown',
        activeConnections: parseInt(results[2].rows[0]?.active_connections || 0),
        cacheHitRate: parseFloat(results[3].rows[0]?.cache_hit_rate || 0).toFixed(2)
      };

    } catch (error) {
      logger.warn('⚠️ 获取数据库指标失败:', error.message);
      return {};
    }
  }

  /**
   * 生成性能对比报告
   */
  async generateReport() {
    logger.info('📈 生成性能对比报告...');

    const fullTest = this.testResults.find(r => r.method === 'full');
    const incrementalTest = this.testResults.find(r => r.method === 'incremental');

    if (!fullTest || !incrementalTest) {
      logger.error('❌ 测试数据不完整，无法生成对比报告');
      return;
    }

    const performanceImprovement = fullTest.executionTime > 0
      ? ((fullTest.executionTime - incrementalTest.executionTime) / fullTest.executionTime * 100).toFixed(2)
      : 0;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        fullStats: {
          name: fullTest.testCase,
          executionTime: fullTest.executionTime,
          success: fullTest.success,
          recordsProcessed: fullTest.recordsProcessed || 0
        },
        incrementalStats: {
          name: incrementalTest.testCase,
          executionTime: incrementalTest.executionTime,
          success: incrementalTest.success,
          recordsProcessed: incrementalTest.recordsProcessed || 0
        },
        performanceImprovement: `${performanceImprovement}%`,
        speedup: fullTest.executionTime / incrementalTest.executionTime
      },
      databaseMetrics: {
        full: fullTest.dbMetrics,
        incremental: incrementalTest.dbMetrics
      },
      recommendations: this.generateRecommendations(performanceImprovement)
    };

    // 输出报告到控制台
    console.log('\n🎯 ===== 热点统计性能对比报告 =====');
    console.log(`📊 测试时间: ${report.timestamp}`);
    console.log(`\n⏱️  执行时间对比:`);
    console.log(`   ${fullTest.testCase}: ${fullTest.executionTime}ms`);
    console.log(`   ${incrementalTest.testCase}: ${incrementalTest.executionTime}ms`);
    console.log(`   🚀 性能提升: ${performanceImprovement}%`);
    console.log(`   ⚡ 速度倍数: ${report.summary.speedup.toFixed(2)}x`);

    console.log(`\n📈 数据处理量:`);
    console.log(`   全量统计: ${fullTest.recordsProcessed} 条记录`);
    console.log(`   增量统计: ${incrementalTest.recordsProcessed} 条记录`);

    console.log(`\n💾 数据库指标:`);
    console.log(`   pixels_history表大小: ${fullTest.dbMetrics.pixelsHistorySize || 'Unknown'}`);
    console.log(`   city_hotspot_stats表大小: ${incrementalTest.dbMetrics.cityStatsSize || 'Unknown'}`);

    console.log(`\n🎯 优化建议:`);
    report.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });

    console.log('\n=====================================\n');

    // 保存报告到数据库
    await this.savePerformanceReport(report);

    return report;
  }

  /**
   * 生成优化建议
   */
  generateRecommendations(improvement) {
    const recommendations = [];

    if (improvement > 80) {
      recommendations.push('增量统计效果显著，建议在生产环境中启用');
    } else if (improvement > 50) {
      recommendations.push('增量统计有明显效果，可以考虑部署');
    } else {
      recommendations.push('增量统计效果有限，建议检查数据量和索引优化');
    }

    recommendations.push('定期清理过期的历史统计数据');
    recommendations.push('监控数据库连接池和查询性能');
    recommendations.push('考虑为高频查询添加缓存层');

    return recommendations;
  }

  /**
   * 保存性能报告到数据库
   */
  async savePerformanceReport(report) {
    try {
      await db('performance_reports').insert({
        report_type: 'hotspot_performance',
        report_data: JSON.stringify(report),
        created_at: new Date()
      });

      logger.info('✅ 性能报告已保存到数据库');

    } catch (error) {
      // 如果表不存在，创建表
      if (error.message.includes('does not exist')) {
        await this.createPerformanceReportsTable();
        await this.savePerformanceReport(report);
      } else {
        logger.warn('⚠️ 保存性能报告失败:', error.message);
      }
    }
  }

  /**
   * 创建性能报告表
   */
  async createPerformanceReportsTable() {
    await db.raw(`
      CREATE TABLE IF NOT EXISTS performance_reports (
        id SERIAL PRIMARY KEY,
        report_type VARCHAR(100) NOT NULL,
        report_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_performance_reports_type ON performance_reports(report_type);
      CREATE INDEX IF NOT EXISTS idx_performance_reports_created ON performance_reports(created_at DESC);
    `);

    logger.info('✅ performance_reports表创建成功');
  }

  /**
   * 获取历史性能趋势
   */
  async getPerformanceTrends(days = 7) {
    try {
      const result = await db.raw(`
        SELECT
          report_type,
          created_at,
          report_data->'summary'->'performanceImprovement' as performance_improvement,
          report_data->'summary'->'speedup' as speedup
        FROM performance_reports
        WHERE report_type = 'hotspot_performance'
          AND created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY created_at DESC
        LIMIT 100
      `);

      return result.rows || [];

    } catch (error) {
      logger.warn('⚠️ 获取性能趋势失败:', error.message);
      return [];
    }
  }
}

module.exports = HotspotPerformanceAnalyzer;