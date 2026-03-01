#!/usr/bin/env node

/**
 * 清理regions表数据
 * 解决重复数据问题，并更新region_codes表
 */

const { db } = require('../src/config/database');

async function cleanupRegionsData() {
  console.log('🧹 开始清理regions表数据...\n');
  
  try {
    // 1. 检查重复数据
    console.log('🔍 检查重复数据...');
    const duplicates = await db('regions')
      .select('code')
      .count('* as count')
      .groupBy('code')
      .having(db.raw('count(*)'), '>', 1);
    
    console.log(`发现 ${duplicates.length} 个重复编码`);
    
    if (duplicates.length > 0) {
      console.log('重复编码列表:');
      duplicates.forEach(dup => {
        console.log(`  ${dup.code}: ${dup.count} 条记录`);
      });
    }
    
    // 2. 删除重复数据（保留最新的）
    if (duplicates.length > 0) {
      console.log('\n🗑️ 删除重复数据...');
      
      for (const dup of duplicates) {
        const records = await db('regions')
          .where('code', dup.code)
          .orderBy('id', 'desc');
        
        // 保留第一条（最新的），删除其他
        if (records.length > 1) {
          const idsToDelete = records.slice(1).map(r => r.id);
          await db('regions').whereIn('id', idsToDelete).del();
          console.log(`  ✅ 删除编码 ${dup.code} 的 ${idsToDelete.length} 条重复记录`);
        }
      }
    }
    
    // 3. 更新region_codes表
    console.log('\n📝 更新region_codes表...');
    
    // 清空region_codes表
    await db('region_codes').del();
    console.log('  ✅ region_codes表已清空');
    
    // 从regions表重新生成region_codes数据
    const regions = await db('regions')
      .select('code', 'name', 'level', 'parent_code', 'is_active');
    
    const codesData = regions.map(region => ({
      code: region.code,
      name: region.name,
      level: region.level,
      parent_code: region.parent_code,
      full_name: region.name, // 简化版本，不构建完整路径
      is_active: region.is_active
    }));
    
    // 分批插入region_codes数据
    const batchSize = 1000;
    for (let i = 0; i < codesData.length; i += batchSize) {
      const batch = codesData.slice(i, i + batchSize);
      await db('region_codes').insert(batch);
      console.log(`  ✅ 已插入 ${Math.min(i + batchSize, codesData.length)}/${codesData.length} 条region_codes数据`);
    }
    
    // 4. 最终统计
    console.log('\n📊 清理完成统计:');
    
    const finalStats = await db('regions')
      .select('level')
      .count('* as count')
      .groupBy('level')
      .orderBy('level');
    
    finalStats.forEach(stat => {
      console.log(`  ${stat.level}: ${stat.count} 个`);
    });
    
    const totalCount = await db('regions').count('* as count').first();
    console.log(`  总计: ${totalCount.count} 个行政区划`);
    
    const regionCodesCount = await db('region_codes').count('* as count').first();
    console.log(`  region_codes: ${regionCodesCount.count} 个编码`);
    
    console.log('\n✅ 数据清理完成！');
    
  } catch (error) {
    console.error('❌ 清理失败:', error.message);
    process.exit(1);
  } finally {
    process.exit();
  }
}

// 显示使用说明
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🧹 regions表数据清理工具

用法:
  node cleanup-regions-data.js

功能:
  - 删除重复的行政区划数据
  - 更新region_codes表
  - 验证数据完整性

注意:
  - 此操作会删除重复数据，请谨慎使用
  - 建议在清理前备份数据
  `);
  process.exit(0);
}

cleanupRegionsData();
