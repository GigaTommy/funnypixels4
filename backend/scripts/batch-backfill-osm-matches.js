/**
 * 批量回填OSM匹配数据脚本
 * 用于将历史像素数据使用PostGIS进行精确的城市匹配
 *
 * 使用方法：
 * node scripts/batch-backfill-osm-matches.js [--table=pixels|pixels_history] [--batch-size=1000] [--max-distance=20000]
 */

const { db } = require('../src/config/database');
const postgisMatchService = require('../src/services/postgisMatchService');
const logger = require('../src/utils/logger');

// 命令行参数解析
const args = process.argv.slice(2);
const options = {
  table: 'pixels', // 默认处理pixels表
  batchSize: 1000,
  maxDistance: 20000,
  dryRun: false
};

args.forEach(arg => {
  if (arg.startsWith('--table=')) {
    options.table = arg.split('=')[1];
  } else if (arg.startsWith('--batch-size=')) {
    options.batchSize = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--max-distance=')) {
    options.maxDistance = parseInt(arg.split('=')[1]);
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
批量OSM匹配回填脚本

使用方法:
  node scripts/batch-backfill-osm-matches.js [选项]

选项:
  --table=pixels|pixels_history    要处理的表 (默认: pixels)
  --batch-size=NUMBER             批处理大小 (默认: 1000)
  --max-distance=METERS           最大匹配距离米 (默认: 20000)
  --dry-run                       预览模式，不实际更新数据
  --help, -h                      显示帮助信息

示例:
  node scripts/batch-backfill-osm-matches.js
  node scripts/batch-backfill-osm-matches.js --table=pixels_history --batch-size=500
  node scripts/batch-backfill-osm-matches.js --dry-run
`);
    process.exit(0);
  }
});

class OsmBatchBackfillService {
  constructor() {
    this.stats = {
      total: 0,
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      osmMatched: 0,
      fallbackMatched: 0
    };
  }

  /**
   * 执行批量回填
   */
  async run() {
    const startTime = Date.now();

    console.log(`🚀 开始批量OSM匹配回填...`);
    console.log(`📋 配置: 表=${options.table}, 批大小=${options.batchSize}, 最大距离=${options.maxDistance}m`);
    console.log(`🔖 模式: ${options.dryRun ? '预览模式' : '实际更新'}`);

    try {
      // 检查表是否存在
      await this.checkTableExists();

      // 获取需要处理的记录总数
      await this.getCounts();

      if (this.stats.total === 0) {
        console.log('✅ 没有需要处理的记录');
        return;
      }

      console.log(`📊 总共需要处理 ${this.stats.total} 条记录`);

      // 分批处理
      while (this.stats.processed < this.stats.total) {
        await this.processBatch();

        // 显示进度
        const progress = ((this.stats.processed / this.stats.total) * 100).toFixed(2);
        console.log(`📈 进度: ${progress}% (${this.stats.processed}/${this.stats.total}) | 更新: ${this.stats.updated} | OSM匹配: ${this.stats.osmMatched} | 回退: ${this.stats.fallbackMatched}`);

        // 防止数据库过载，批次间稍作延迟
        if (!options.dryRun) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const duration = Date.now() - startTime;
      console.log(`\n🎉 批量回填完成！`);
      console.log(`⏱️ 总耗时: ${(duration / 1000).toFixed(2)}秒`);
      console.log(`📊 最终统计:`);
      console.log(`   - 总记录数: ${this.stats.total}`);
      console.log(`   - 已处理: ${this.stats.processed}`);
      console.log(`   - 已更新: ${this.stats.updated}`);
      console.log(`   - OSM精确匹配: ${this.stats.osmMatched}`);
      console.log(`   - 回退匹配: ${this.stats.fallbackMatched}`);
      console.log(`   - 跳过: ${this.stats.skipped}`);
      console.log(`   - 错误: ${this.stats.errors}`);

      // 更新统计信息
      await this.updateProcessingStats();

    } catch (error) {
      console.error('❌ 批量回填失败:', error);
      process.exit(1);
    }
  }

  /**
   * 检查表是否存在
   */
  async checkTableExists() {
    const result = await db.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = '${options.table}'
      ) as exists
    `);

    if (!result.rows[0].exists) {
      throw new Error(`表 ${options.table} 不存在`);
    }
  }

  /**
   * 获取需要处理的记录总数
   */
  async getCounts() {
    const countQuery = options.table === 'pixels'
      ? `
        SELECT COUNT(*) as total
        FROM ${options.table}
        WHERE
          matched_osm_id IS NULL
          OR matched_method IS NULL
          OR matched_method = 'unmatched'
      `
      : `
        SELECT COUNT(*) as total
        FROM ${options.table}
        WHERE
          matched_osm_id IS NULL
          OR matched_method IS NULL
          OR matched_method = 'unmatched'
          AND created_at >= NOW() - INTERVAL '30 days'
      `;  // 只处理最近30天的历史记录

    const result = await db.raw(countQuery);
    this.stats.total = parseInt(result.rows[0].total);
  }

  /**
   * 处理一个批次
   */
  async processBatch() {
    const offset = this.stats.processed;
    const limit = Math.min(options.batchSize, this.stats.total - this.stats.processed);

    // 获取批次数据
    const recordsQuery = options.table === 'pixels'
      ? `
        SELECT id, latitude, longitude, city, province, country, matched_osm_id, matched_method
        FROM ${options.table}
        WHERE
          matched_osm_id IS NULL
          OR matched_method IS NULL
          OR matched_method = 'unmatched'
        ORDER BY id
        LIMIT ? OFFSET ?
      `
      : `
        SELECT id, latitude, longitude, city, province, country, matched_osm_id, matched_method
        FROM ${options.table}
        WHERE
          (matched_osm_id IS NULL
          OR matched_method IS NULL
          OR matched_method = 'unmatched')
          AND created_at >= NOW() - INTERVAL '30 days'
        ORDER BY created_at
        LIMIT ? OFFSET ?
      `;

    const records = await db.raw(recordsQuery, [limit, offset]);

    if (records.rows.length === 0) {
      console.log('⚠️ 没有找到需要处理的记录');
      return;
    }

    // 处理每条记录
    for (const record of records.rows) {
      try {
        const matchResult = await this.processRecord(record);

        if (matchResult && matchResult.matched_method !== 'unmatched') {
          this.stats.updated++;

          if (matchResult.matched_method === 'contains') {
            this.stats.osmMatched++;
          } else {
            this.stats.fallbackMatched++;
          }
        } else {
          this.stats.skipped++;
        }

        this.stats.processed++;

      } catch (error) {
        console.error(`❌ 处理记录 ${record.id} 失败:`, error.message);
        this.stats.errors++;
        this.stats.processed++;
      }
    }
  }

  /**
   * 处理单条记录
   */
  async processRecord(record) {
    // 执行OSM匹配
    const matchResult = await postgisMatchService.matchPoint(
      record.latitude,
      record.longitude,
      { maxDistance: options.maxDistance }
    );

    // 如果没有变化，跳过
    if (record.matched_osm_id === matchResult.osm_id &&
        record.matched_method === matchResult.matched_method) {
      return null;
    }

    // 预览模式，不实际更新
    if (options.dryRun) {
      console.log(`🔍 预览: ID=${record.id}, 坐标=(${record.latitude}, ${record.longitude}) -> ${matchResult.city} (${matchResult.matched_method})`);
      return matchResult;
    }

    // 实际更新数据库
    if (options.table === 'pixels') {
      await db('pixels')
        .where('id', record.id)
        .update({
          country: matchResult.country,
          province: matchResult.province,
          city: matchResult.city,
          adcode: matchResult.adcode,
          formatted_address: matchResult.formatted_address,
          geocoded: matchResult.geocoded,
          geocoded_at: matchResult.geocoded_at,

          // OSM匹配字段
          osm_id: matchResult.osm_id,
          admin_level: matchResult.admin_level,
          matched_method: matchResult.matched_method,
          distance_m: matchResult.distance_m,
          match_quality: matchResult.match_quality,
          match_source: matchResult.source,
          match_version: matchResult.data_version
        });
    } else {
      await db('pixels_history')
        .where('id', record.id)
        .update({
          country: matchResult.country,
          province: matchResult.province,
          city: matchResult.city,
          adcode: matchResult.adcode,
          formatted_address: matchResult.formatted_address,
          geocoded: matchResult.geocoded,
          geocoded_at: matchResult.geocoded_at,

          // OSM匹配字段
          osm_id: matchResult.osm_id,
          admin_level: matchResult.admin_level,
          matched_method: matchResult.matched_method,
          distance_m: matchResult.distance_m,
          match_quality: matchResult.match_quality,
          match_source: matchResult.source,
          match_version: matchResult.data_version
        });
    }

    return matchResult;
  }

  /**
   * 更新处理统计信息
   */
  async updateProcessingStats() {
    try {
      const stats = {
        processed_at: new Date(),
        table: options.table,
        batch_size: options.batchSize,
        max_distance: options.maxDistance,
        ...this.stats,
        postgis_service_stats: postgisMatchService.getServiceStatus()
      };

      // 这里可以将统计信息保存到日志表或发送到监控系统
      console.log('📈 处理统计信息:', JSON.stringify(stats, null, 2));

    } catch (error) {
      console.warn('⚠️ 更新统计信息失败:', error.message);
    }
  }
}

// 主程序入口
async function main() {
  const service = new OsmBatchBackfillService();

  // 添加错误处理和优雅退出
  process.on('SIGINT', () => {
    console.log('\n🛑 收到中断信号，正在退出...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 收到终止信号，正在退出...');
    process.exit(0);
  });

  await service.run();
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('💥 脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = OsmBatchBackfillService;