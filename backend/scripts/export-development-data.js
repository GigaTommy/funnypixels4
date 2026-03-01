/**
 * 导出开发环境基础数据
 * 用于将开发环境的基础数据导出，供生产环境同步使用
 * 
 * 使用方法:
 * node scripts/export-development-data.js
 */

const { db } = require('../src/config/database');

async function exportDevelopmentData() {
  try {
    console.log('🔍 导出开发环境基础数据...');
    
    // 需要导出的基础数据表
    const baseDataTables = [
      'pattern_assets',    // 图案资源
      'shop_skus',         // 商店SKU
      'store_items',       // 商店物品
      'regions',           // 地区数据
      'achievements',      // 成就系统
      'ad_products',       // 广告产品
      'advertisements'     // 广告数据
    ];
    
    const exportedData = {};
    
    for (const tableName of baseDataTables) {
      console.log(`\n📝 导出表: ${tableName}`);
      
      try {
        const data = await db(tableName).select('*');
        exportedData[tableName] = data;
        console.log(`✅ 导出 ${data.length} 条记录`);
      } catch (error) {
        console.log(`⚠️ 表 ${tableName} 不存在或为空: ${error.message}`);
        exportedData[tableName] = [];
      }
    }
    
    // 保存到文件
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `development-base-data-${timestamp}.json`;
    const filepath = `../data-export/${filename}`;
    
    fs.writeFileSync(filepath, JSON.stringify(exportedData, null, 2));
    console.log(`\n💾 开发环境基础数据已保存到 ${filepath}`);
    
    // 同时保存最新版本
    fs.writeFileSync('../data-export/development-base-data-latest.json', JSON.stringify(exportedData, null, 2));
    console.log('💾 同时保存为最新版本: data-export/development-base-data-latest.json');
    
    // 显示数据统计
    console.log('\n📊 数据统计:');
    for (const [tableName, data] of Object.entries(exportedData)) {
      console.log(`  ${tableName}: ${data.length} 条记录`);
    }
    
    return exportedData;
    
  } catch (error) {
    console.error('❌ 导出开发环境数据失败:', error.message);
  } finally {
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  exportDevelopmentData();
}

module.exports = { exportDevelopmentData };
