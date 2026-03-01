#!/usr/bin/env node

/**
 * 批量导入modood行政区划数据
 * 按级别顺序导入：省级 -> 地级 -> 县级 -> 乡级 -> 村级
 */

const RegionDataImportService = require('../src/services/regionDataImportService');
const path = require('path');

async function main() {
  console.log('🗺️ 开始批量导入modood行政区划数据...');
  console.log('📚 数据源: modood/administrative-divisions-of-china');
  console.log('📊 包含: 省级、地级、县级、乡级、村级数据\n');
  
  // 检查命令行参数
  const args = process.argv.slice(2);
  const clearExisting = args.includes('--clear') || args.includes('-c');
  
  if (clearExisting) {
    console.log('⚠️ 将清空现有数据后重新导入');
  } else {
    console.log('💡 提示: 使用 --clear 或 -c 参数可以清空现有数据后重新导入');
  }
  
  const importService = new RegionDataImportService();
  const dataDir = path.join(__dirname, '../data');
  
  // 按级别顺序导入
  const importLevels = [
    { file: 'provinces.json', level: '省级', description: '省份、直辖市、自治区' },
    { file: 'cities.json', level: '地级', description: '城市' },
    { file: 'areas.json', level: '县级', description: '区县' },
    { file: 'streets.json', level: '乡级', description: '乡镇、街道' },
    { file: 'villages.json', level: '村级', description: '村委会、居委会' }
  ];
  
  let totalImported = 0;
  
  for (const { file, level, description } of importLevels) {
    const filePath = path.join(dataDir, file);
    
    console.log(`\n📦 导入${level}数据 (${description})...`);
    console.log(`📁 文件: ${file}`);
    
    try {
      // 检查文件是否存在
      const fs = require('fs');
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ 文件不存在，跳过: ${filePath}`);
        continue;
      }
      
      // 导入数据（只在第一次导入时清空数据）
      const shouldClear = clearExisting && i === 0;
      const count = await importService.importChinaRegions('modood', filePath, shouldClear);
      totalImported += count;
      
      console.log(`✅ ${level}数据导入完成: ${count} 条`);
      
    } catch (error) {
      console.error(`❌ ${level}数据导入失败:`, error.message);
      // 继续导入下一级数据
    }
  }
  
  console.log(`\n📊 导入完成统计:`);
  console.log(`   总计导入: ${totalImported} 条行政区划数据`);
  
  // 验证最终数据
  console.log('\n🔍 验证最终数据...');
  try {
    const stats = await importService.validateImportedData();
    console.log('📊 数据库中的行政区划统计:');
    stats.forEach(stat => {
      console.log(`  ${stat.level}: ${stat.count} 个`);
    });
  } catch (error) {
    console.error('❌ 验证数据失败:', error.message);
  }
  
  console.log('\n✅ 批量导入完成！');
  console.log('\n💡 接下来可以运行以下命令测试地理统计功能:');
  console.log('   node scripts/test-geographic-stats.js');
}

// 显示使用说明
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🗺️ modood行政区划数据批量导入工具

用法:
  node import-modood-all.js [选项]

选项:
  --clear, -c    清空现有数据后重新导入

功能:
  - 按级别顺序导入所有行政区划数据
  - 支持省级、地级、县级、乡级、村级
  - 自动验证导入结果

前提条件:
  - 已运行 npm run migrate 创建数据库表
  - 已下载modood数据文件到 data/ 目录
  - 数据库已安装PostGIS扩展

数据文件:
  - data/provinces.json  省级数据
  - data/cities.json     地级数据  
  - data/areas.json      县级数据
  - data/streets.json    乡级数据
  - data/villages.json   村级数据

示例:
  node import-modood-all.js              # 追加导入
  node import-modood-all.js --clear      # 清空后重新导入
  `);
  process.exit(0);
}

main().catch(console.error);
