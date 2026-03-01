#!/usr/bin/env node
'use strict';

/**
 * 分析pixels_history分区表结构和管理机制
 * 详细说明主表和分区表的区别、管理策略
 */

// 设置环境变量
process.env.NODE_ENV = 'development';
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../backend/src/config/database');

/**
 * 分析分区表结构
 */
async function analyzePartitionStructure() {
  console.log('🔍 分析pixels_history分区表结构...\n');
  
  try {
    // 1. 检查主表结构
    console.log('📋 主表 pixels_history 结构:');
    console.log('='.repeat(60));
    
    const mainTableInfo = await db.raw(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'pixels_history' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('字段列表:');
    mainTableInfo.rows.forEach(col => {
      console.log(`  📌 ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // 2. 检查分区信息
    console.log('\n🗂️ 分区表信息:');
    console.log('='.repeat(60));
    
    const partitionInfo = await db.raw(`
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_tables 
      WHERE tablename LIKE 'pixels_history_%'
      ORDER BY tablename;
    `);
    
    console.log('现有分区表:');
    partitionInfo.rows.forEach(partition => {
      console.log(`  📁 ${partition.tablename}`);
    });
    
    // 3. 检查分区约束
    console.log('\n🔒 分区约束信息:');
    console.log('='.repeat(60));
    
    const constraintInfo = await db.raw(`
      SELECT 
        c.relname as table_name,
        pg_get_expr(c.relpartbound, c.oid) as partition_constraint
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
      AND c.relname LIKE 'pixels_history_%'
      ORDER BY c.relname;
    `);
    
    constraintInfo.rows.forEach(constraint => {
      console.log(`  🔐 ${constraint.table_name}: ${constraint.partition_constraint}`);
    });
    
    // 4. 检查索引信息
    console.log('\n📊 索引信息:');
    console.log('='.repeat(60));
    
    const indexInfo = await db.raw(`
      SELECT 
        t.relname as table_name,
        i.relname as index_name,
        pg_get_indexdef(i.oid) as index_definition
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE t.relname LIKE 'pixels_history%'
      ORDER BY t.relname, i.relname;
    `);
    
    const indexGroups = {};
    indexInfo.rows.forEach(index => {
      if (!indexGroups[index.table_name]) {
        indexGroups[index.table_name] = [];
      }
      indexGroups[index.table_name].push(index);
    });
    
    Object.keys(indexGroups).forEach(tableName => {
      console.log(`\n  📋 ${tableName}:`);
      indexGroups[tableName].forEach(index => {
        console.log(`    🔍 ${index.index_name}: ${index.index_definition}`);
      });
    });
    
    // 5. 检查数据分布
    console.log('\n📈 数据分布统计:');
    console.log('='.repeat(60));
    
    const dataStats = await db.raw(`
      SELECT 
        'pixels_history' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history
      
      UNION ALL
      
      SELECT 
        'pixels_history_202501' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202501
      
      UNION ALL
      
      SELECT 
        'pixels_history_202502' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202502
      
      UNION ALL
      
      SELECT 
        'pixels_history_202503' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202503
      
      UNION ALL
      
      SELECT 
        'pixels_history_202504' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202504
      
      UNION ALL
      
      SELECT 
        'pixels_history_202505' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202505
      
      UNION ALL
      
      SELECT 
        'pixels_history_202506' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202506
      
      UNION ALL
      
      SELECT 
        'pixels_history_202507' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202507
      
      UNION ALL
      
      SELECT 
        'pixels_history_202508' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202508
      
      UNION ALL
      
      SELECT 
        'pixels_history_202509' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202509
      
      UNION ALL
      
      SELECT 
        'pixels_history_202510' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202510
      
      UNION ALL
      
      SELECT 
        'pixels_history_202511' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202511
      
      UNION ALL
      
      SELECT 
        'pixels_history_202512' as table_name,
        COUNT(*) as record_count,
        MIN(history_date) as earliest_date,
        MAX(history_date) as latest_date
      FROM pixels_history_202512
      
      ORDER BY table_name;
    `);
    
    dataStats.rows.forEach(stat => {
      console.log(`  📊 ${stat.table_name}: ${stat.record_count} 条记录 (${stat.earliest_date || 'N/A'} ~ ${stat.latest_date || 'N/A'})`);
    });
    
  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error.message);
  }
}

/**
 * 分析分区管理机制
 */
async function analyzePartitionManagement() {
  console.log('\n\n🔧 分区管理机制分析:');
  console.log('='.repeat(60));
  
  try {
    // 1. 检查管理函数
    console.log('\n📋 分区管理函数:');
    
    const functions = await db.raw(`
      SELECT 
        routine_name,
        routine_definition
      FROM information_schema.routines 
      WHERE routine_name IN ('create_monthly_partition', 'cleanup_old_partitions', 'archive_old_pixels_history')
      AND routine_schema = 'public';
    `);
    
    functions.rows.forEach(func => {
      console.log(`  🔧 ${func.routine_name}: 已定义`);
    });
    
    // 2. 测试分区创建函数
    console.log('\n🧪 测试分区管理功能:');
    
    // 测试创建新分区（2026年1月）
    try {
      await db.raw(`SELECT create_monthly_partition('pixels_history', '2026-01-01'::date)`);
      console.log('  ✅ 分区创建函数测试成功');
    } catch (error) {
      console.log(`  ⚠️ 分区创建函数测试: ${error.message}`);
    }
    
    // 3. 检查分区策略
    console.log('\n📋 分区策略说明:');
    console.log('  🗓️ 分区方式: 按日期范围分区 (RANGE PARTITION)');
    console.log('  📅 分区粒度: 月度分区 (每月一个分区)');
    console.log('  🔄 分区键: history_date 字段');
    console.log('  📊 分区范围: 2025年1月 - 2025年12月 (已预创建)');
    console.log('  🔧 自动管理: 支持动态创建新分区');
    console.log('  🗑️ 自动清理: 支持清理旧分区 (默认保留12个月)');
    
  } catch (error) {
    console.error('❌ 管理机制分析失败:', error.message);
  }
}

/**
 * 生成分区表对比分析
 */
function generateComparisonAnalysis() {
  console.log('\n\n📊 主表与分区表对比分析:');
  console.log('='.repeat(60));
  
  console.log('\n🔍 主要区别:');
  console.log('  📋 主表 (pixels_history):');
  console.log('    - 逻辑表，不直接存储数据');
  console.log('    - 定义表结构和约束');
  console.log('    - 提供统一的查询接口');
  console.log('    - 自动路由到对应分区');
  
  console.log('\n  📁 分区表 (pixels_history_YYYYMM):');
  console.log('    - 物理表，实际存储数据');
  console.log('    - 继承主表的所有字段和约束');
  console.log('    - 按日期范围存储特定月份的数据');
  console.log('    - 独立的索引和统计信息');
  
  console.log('\n🎯 管理优势:');
  console.log('  ⚡ 性能优化:');
  console.log('    - 查询时只扫描相关分区');
  console.log('    - 索引更小，查询更快');
  console.log('    - 并行查询支持');
  
  console.log('\n  💾 存储管理:');
  console.log('    - 可以独立备份/恢复分区');
  console.log('    - 可以删除旧分区释放空间');
  console.log('    - 支持分区级别的维护操作');
  
  console.log('\n  🔧 运维便利:');
  console.log('    - 自动分区创建');
  console.log('    - 自动旧分区清理');
  console.log('    - 分区级别的监控');
  
  console.log('\n📋 数据路由机制:');
  console.log('  🔄 写入路由:');
  console.log('    - 根据 history_date 字段自动路由到对应分区');
  console.log('    - 如果分区不存在，会报错');
  console.log('    - 需要预先创建分区或使用自动创建函数');
  
  console.log('\n  🔍 查询路由:');
  console.log('    - 带日期条件的查询只扫描相关分区');
  console.log('    - 跨分区查询会自动合并结果');
  console.log('    - 无日期条件的查询会扫描所有分区');
  
  console.log('\n⚠️ 注意事项:');
  console.log('  📅 分区预创建: 需要提前创建未来月份的分区');
  console.log('  🔧 维护任务: 需要定期清理旧分区');
  console.log('  📊 统计更新: 分区表的统计信息需要定期更新');
  console.log('  🔍 查询优化: 查询时尽量包含分区键条件');
}

/**
 * 主分析函数
 */
async function runPartitionAnalysis() {
  console.log('🚀 开始分析pixels_history分区表结构和管理机制...\n');
  
  try {
    await analyzePartitionStructure();
    await analyzePartitionManagement();
    generateComparisonAnalysis();
    
    console.log('\n\n🎉 分区表分析完成！');
    
  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error);
  } finally {
    // 关闭数据库连接
    await db.destroy();
  }
}

// 运行分析
runPartitionAnalysis();
