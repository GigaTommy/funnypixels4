#!/usr/bin/env node

/**
 * 导入行政区划数据脚本
 * 支持从多种数据源导入中国行政区划边界数据
 */

const RegionDataImportService = require('../src/services/regionDataImportService');
const logger = require('../src/utils/logger');

async function main() {
  console.log('🗺️ 开始导入行政区划数据...');
  
  const importService = new RegionDataImportService();
  
  try {
    // 检查命令行参数
    const args = process.argv.slice(2);
    const source = args[0] || 'amap'; // 默认使用高德地图数据
    const filePath = args[1] || null; // 可选的文件路径
    
    console.log(`📥 数据源: ${source}`);
    if (filePath) {
      console.log(`📁 文件路径: ${filePath}`);
    }
    
    // 导入数据
    const count = await importService.importChinaRegions(source, filePath);
    
    console.log(`✅ 成功导入 ${count} 条行政区划数据`);
    
    // 验证导入的数据
    console.log('🔍 验证导入的数据...');
    const stats = await importService.validateImportedData();
    
    console.log('📊 导入完成统计:');
    stats.forEach(stat => {
      console.log(`  ${stat.level}: ${stat.count} 个`);
    });
    
  } catch (error) {
    console.error('❌ 导入失败:', error.message);
    process.exit(1);
  }
}

// 显示使用说明
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🗺️ 行政区划数据导入工具

用法:
  node import-region-data.js [数据源] [文件路径]

数据源:
  amap    高德地图 (默认)
  nbs     国家统计局
  osm     OpenStreetMap
  modood  modood/administrative-divisions-of-china

示例:
  node import-region-data.js amap
  node import-region-data.js nbs ./data/nbs-regions.geojson
  node import-region-data.js osm ./data/osm-regions.geojson
  node import-region-data.js modood ./data/provinces.json
  node import-region-data.js modood ./data/cities.json
  node import-region-data.js modood ./data/areas.json

注意:
  - GeoJSON格式文件应包含行政区划边界数据
  - modood格式文件为JSON格式，包含行政区划编码和名称
  - 支持省、市、县、乡、村五级行政区划
  `);
  process.exit(0);
}

main().catch(console.error);
