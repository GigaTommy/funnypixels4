#!/usr/bin/env node

/**
 * 像素历史表管理脚本
 * 用于维护 pixels_history 分区表
 * 
 * 使用方法:
 * node scripts/manage-pixels-history.js create-partition 2025-02-01
 * node scripts/manage-pixels-history.js cleanup-partitions 12
 * node scripts/manage-pixels-history.js archive-data 2024-12-01
 * node scripts/manage-pixels-history.js optimize-indexes
 * node scripts/manage-pixels-history.js stats
 */

const { db } = require('../src/config/database');
const pixelsHistoryService = require('../src/services/pixelsHistoryService');

class PixelsHistoryManager {
  constructor() {
    this.tableName = 'pixels_history';
  }

  /**
   * 创建新的月度分区
   * @param {string} startDateStr - 开始日期字符串 (YYYY-MM-DD)
   */
  async createPartition(startDateStr) {
    try {
      console.log(`🔧 创建月度分区: ${startDateStr}`);
      
      const startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        throw new Error('无效的日期格式，请使用 YYYY-MM-DD 格式');
      }

      const result = await pixelsHistoryService.createMonthlyPartition(startDate);
      
      if (result.success) {
        console.log(`✅ 分区创建成功: ${result.message}`);
      } else {
        console.error(`❌ 分区创建失败: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ 创建分区时发生错误:', error.message);
    }
  }

  /**
   * 清理旧分区
   * @param {number} keepMonths - 保留月数
   */
  async cleanupPartitions(keepMonths) {
    try {
      console.log(`🧹 清理旧分区，保留最近 ${keepMonths} 个月的数据`);
      
      const result = await pixelsHistoryService.cleanupOldPartitions(keepMonths);
      
      if (result.success) {
        console.log(`✅ 分区清理成功: ${result.message}`);
      } else {
        console.error(`❌ 分区清理失败: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ 清理分区时发生错误:', error.message);
    }
  }

  /**
   * 归档旧数据
   * @param {string} archiveDateStr - 归档日期字符串 (YYYY-MM-DD)
   */
  async archiveData(archiveDateStr) {
    try {
      console.log(`📦 归档旧数据: ${archiveDateStr}`);
      
      const archiveDate = new Date(archiveDateStr);
      if (isNaN(archiveDate.getTime())) {
        throw new Error('无效的日期格式，请使用 YYYY-MM-DD 格式');
      }

      const result = await pixelsHistoryService.archiveOldData(archiveDate);
      
      if (result.success) {
        console.log(`✅ 数据归档成功: ${result.message}`);
      } else {
        console.error(`❌ 数据归档失败: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ 归档数据时发生错误:', error.message);
    }
  }

  /**
   * 优化索引
   */
  async optimizeIndexes() {
    try {
      console.log('🔍 优化索引...');
      
      // 更新表统计信息
      await db.raw('ANALYZE pixels_history');
      console.log('✅ 表统计信息已更新');

      // 重建索引（如果需要）
      const indexes = await db.raw(`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE tablename LIKE 'pixels_history%'
        ORDER BY indexname
      `);

      console.log('📋 当前索引列表:');
      indexes.rows.forEach(row => {
        console.log(`  - ${row.indexname} (${row.tablename})`);
      });

      console.log('✅ 索引优化完成');
    } catch (error) {
      console.error('❌ 优化索引时发生错误:', error.message);
    }
  }

  /**
   * 显示统计信息
   */
  async showStats() {
    try {
      console.log('📊 像素历史表统计信息');
      console.log('='.repeat(50));

      // 总记录数
      const totalCount = await db(this.tableName).count('* as count').first();
      console.log(`总记录数: ${totalCount.count}`);

      // 按月份统计
      const monthlyStats = await db.raw(`
        SELECT 
          history_date,
          COUNT(*) as record_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT grid_id) as unique_locations
        FROM pixels_history
        WHERE history_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY history_date
        ORDER BY history_date DESC
        LIMIT 12
      `);

      console.log('\n📅 最近12个月统计:');
      monthlyStats.rows.forEach(row => {
        console.log(`  ${row.history_date}: ${row.record_count} 条记录, ${row.unique_users} 用户, ${row.unique_locations} 位置`);
      });

      // 按操作类型统计
      const actionStats = await db.raw(`
        SELECT 
          action_type,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM pixels_history
        WHERE history_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY action_type
        ORDER BY count DESC
      `);

      console.log('\n🎯 最近30天操作类型统计:');
      actionStats.rows.forEach(row => {
        console.log(`  ${row.action_type}: ${row.count} 次 (${row.percentage}%)`);
      });

      // 分区信息
      const partitionInfo = await db.raw(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables
        WHERE tablename LIKE 'pixels_history_%'
        ORDER BY tablename
      `);

      console.log('\n🗂️ 分区信息:');
      partitionInfo.rows.forEach(row => {
        console.log(`  ${row.tablename}: ${row.size}`);
      });

      // 索引使用情况
      const indexUsage = await db.raw(`
        SELECT 
          indexname,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE relname LIKE 'pixels_history%'
        ORDER BY idx_tup_read DESC
      `);

      console.log('\n🔍 索引使用情况:');
      indexUsage.rows.forEach(row => {
        console.log(`  ${row.indexname}: 读取 ${row.idx_tup_read} 次, 获取 ${row.idx_tup_fetch} 次`);
      });

    } catch (error) {
      console.error('❌ 获取统计信息时发生错误:', error.message);
    }
  }

  /**
   * 创建未来几个月的分区
   * @param {number} months - 创建未来几个月的分区
   */
  async createFuturePartitions(months = 3) {
    try {
      console.log(`🔮 创建未来 ${months} 个月的分区`);
      
      const today = new Date();
      const results = [];

      for (let i = 1; i <= months; i++) {
        const futureDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const dateStr = futureDate.toISOString().split('T')[0];
        
        console.log(`创建分区: ${dateStr}`);
        const result = await pixelsHistoryService.createMonthlyPartition(futureDate);
        results.push({ date: dateStr, success: result.success, message: result.message });
      }

      console.log('\n📋 创建结果:');
      results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${result.date}: ${result.message}`);
      });

    } catch (error) {
      console.error('❌ 创建未来分区时发生错误:', error.message);
    }
  }

  /**
   * 监控表性能
   */
  async monitorPerformance() {
    try {
      console.log('📈 性能监控信息');
      console.log('='.repeat(50));

      // 表大小
      const tableSize = await db.raw(`
        SELECT 
          pg_size_pretty(pg_total_relation_size('pixels_history')) as total_size,
          pg_size_pretty(pg_relation_size('pixels_history')) as table_size,
          pg_size_pretty(pg_total_relation_size('pixels_history') - pg_relation_size('pixels_history')) as index_size
      `);

      console.log('💾 存储使用情况:');
      console.log(`  总大小: ${tableSize.rows[0].total_size}`);
      console.log(`  表大小: ${tableSize.rows[0].table_size}`);
      console.log(`  索引大小: ${tableSize.rows[0].index_size}`);

      // 查询性能
      const queryStats = await db.raw(`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements
        WHERE query LIKE '%pixels_history%'
        ORDER BY total_time DESC
        LIMIT 10
      `);

      if (queryStats.rows.length > 0) {
        console.log('\n⚡ 查询性能统计:');
        queryStats.rows.forEach(row => {
          console.log(`  查询: ${row.query.substring(0, 50)}...`);
          console.log(`    调用次数: ${row.calls}, 总时间: ${row.total_time}ms, 平均时间: ${row.mean_time}ms`);
        });
      }

      // 锁等待情况
      const lockStats = await db.raw(`
        SELECT 
          COUNT(*) as lock_count,
          mode,
          granted
        FROM pg_locks
        WHERE relation = 'pixels_history'::regclass
        GROUP BY mode, granted
      `);

      if (lockStats.rows.length > 0) {
        console.log('\n🔒 锁等待情况:');
        lockStats.rows.forEach(row => {
          const status = row.granted ? '已获得' : '等待中';
          console.log(`  ${row.mode}: ${row.lock_count} 个 (${status})`);
        });
      }

    } catch (error) {
      console.error('❌ 监控性能时发生错误:', error.message);
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const manager = new PixelsHistoryManager();

  try {
    switch (command) {
      case 'create-partition':
        if (!args[1]) {
          console.error('❌ 请提供开始日期 (YYYY-MM-DD)');
          process.exit(1);
        }
        await manager.createPartition(args[1]);
        break;

      case 'cleanup-partitions':
        const keepMonths = parseInt(args[1]) || 12;
        await manager.cleanupPartitions(keepMonths);
        break;

      case 'archive-data':
        if (!args[1]) {
          console.error('❌ 请提供归档日期 (YYYY-MM-DD)');
          process.exit(1);
        }
        await manager.archiveData(args[1]);
        break;

      case 'optimize-indexes':
        await manager.optimizeIndexes();
        break;

      case 'stats':
        await manager.showStats();
        break;

      case 'create-future':
        const months = parseInt(args[1]) || 3;
        await manager.createFuturePartitions(months);
        break;

      case 'monitor':
        await manager.monitorPerformance();
        break;

      default:
        console.log('📖 使用方法:');
        console.log('  node scripts/manage-pixels-history.js <command> [options]');
        console.log('');
        console.log('🔧 可用命令:');
        console.log('  create-partition <date>    创建指定日期的分区 (YYYY-MM-DD)');
        console.log('  cleanup-partitions [months] 清理旧分区，保留指定月数 (默认12)');
        console.log('  archive-data <date>        归档指定日期之前的数据 (YYYY-MM-DD)');
        console.log('  optimize-indexes           优化索引');
        console.log('  stats                      显示统计信息');
        console.log('  create-future [months]     创建未来几个月的分区 (默认3)');
        console.log('  monitor                    监控性能');
        console.log('');
        console.log('📝 示例:');
        console.log('  node scripts/manage-pixels-history.js create-partition 2025-02-01');
        console.log('  node scripts/manage-pixels-history.js cleanup-partitions 6');
        console.log('  node scripts/manage-pixels-history.js stats');
        break;
    }
  } catch (error) {
    console.error('❌ 执行命令时发生错误:', error.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = PixelsHistoryManager;
