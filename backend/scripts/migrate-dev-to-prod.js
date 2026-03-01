/**
 * 一键迁移开发环境基础数据到生产环境
 * 自动完成导出和导入流程
 */

const { exportAllData } = require('./export-dev-data');
const { importAllData } = require('./import-to-production');

// 需要迁移的基础数据表
const TABLES_TO_IMPORT = [
  'pattern_assets',
  'shop_skus', 
  'store_items',
  'achievements',
  'ad_products'
];

async function migrateDevToProd() {
  console.log('🚀 开始一键迁移开发环境基础数据到生产环境...');
  console.log('=' .repeat(60));
  
  try {
    // 步骤1: 导出开发环境数据
    console.log('\n📤 步骤1: 导出开发环境数据');
    console.log('-'.repeat(40));
    const exportResults = await exportAllData();
    
    // 检查导出结果
    const failedExports = exportResults.filter(result => result.error);
    if (failedExports.length > 0) {
      console.error('\n❌ 导出失败，无法继续导入:');
      failedExports.forEach(result => {
        console.error(`  - ${result.tableName}: ${result.error}`);
      });
      process.exit(1);
    }
    
    // 步骤2: 导入到生产环境
    console.log('\n📥 步骤2: 导入到生产环境');
    console.log('-'.repeat(40));
    const importResults = await importAllData();
    
    // 检查导入结果
    const failedImports = importResults.filter(result => result.status === 'error');
    if (failedImports.length > 0) {
      console.error('\n⚠️  部分导入失败:');
      failedImports.forEach(result => {
        console.error(`  - ${result.tableName}: ${result.error}`);
      });
    }
    
    // 步骤3: 生成迁移报告
    console.log('\n📊 步骤3: 生成迁移报告');
    console.log('-'.repeat(40));
    
    const migrationReport = {
      migrationDate: new Date().toISOString(),
      source: 'development',
      target: 'production',
      exportResults,
      importResults,
      summary: {
        totalTables: TABLES_TO_IMPORT.length,
        successfulExports: exportResults.filter(r => !r.error).length,
        successfulImports: importResults.filter(r => r.status === 'success').length,
        failedExports: failedExports.length,
        failedImports: failedImports.length
      }
    };
    
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '../data-export/migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2));
    
    console.log('📋 迁移报告:');
    console.log(`  📤 成功导出: ${migrationReport.summary.successfulExports}/${migrationReport.summary.totalTables} 个表`);
    console.log(`  📥 成功导入: ${migrationReport.summary.successfulImports}/${migrationReport.summary.totalTables} 个表`);
    console.log(`  ❌ 导出失败: ${migrationReport.summary.failedExports} 个表`);
    console.log(`  ❌ 导入失败: ${migrationReport.summary.failedImports} 个表`);
    console.log(`  📁 详细报告: ${reportPath}`);
    
    if (migrationReport.summary.failedExports === 0 && migrationReport.summary.failedImports === 0) {
      console.log('\n🎉 迁移完成！所有数据已成功从开发环境迁移到生产环境');
    } else {
      console.log('\n⚠️  迁移部分完成，请检查失败的表并手动处理');
    }
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateDevToProd()
    .then(() => {
      console.log('\n✅ 迁移任务完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 迁移任务失败:', error);
      process.exit(1);
    });
}

module.exports = { migrateDevToProd };
