/**
 * 对比生产环境和开发环境的数据库表结构差异
 * 用于分析两个环境之间的表结构差异，帮助识别需要同步的内容
 * 
 * 使用方法:
 * node scripts/compare-schemas.js
 * 
 * 前置条件:
 * 1. 先运行 check-production-schema.js 生成生产环境表结构文件
 * 2. 先运行 check-development-schema.js 生成开发环境表结构文件
 */

const fs = require('fs');
const path = require('path');

function compareSchemas() {
  try {
    console.log('🔍 对比生产环境和开发环境数据库表结构...');
    
    // 读取两个环境的表结构
    const productionSchemaPath = '../data-export/production-schema-latest.json';
    const developmentSchemaPath = '../data-export/development-schema-latest.json';
    
    if (!fs.existsSync(productionSchemaPath)) {
      console.error('❌ 生产环境表结构文件不存在，请先运行 check-production-schema.js');
      return;
    }
    
    if (!fs.existsSync(developmentSchemaPath)) {
      console.error('❌ 开发环境表结构文件不存在，请先运行 check-development-schema.js');
      return;
    }
    
    const productionSchema = JSON.parse(fs.readFileSync(productionSchemaPath, 'utf8'));
    const developmentSchema = JSON.parse(fs.readFileSync(developmentSchemaPath, 'utf8'));
    
    const productionTables = Object.keys(productionSchema);
    const developmentTables = Object.keys(developmentSchema);
    
    console.log('\n📊 表数量对比:');
    console.log(`生产环境: ${productionTables.length} 个表`);
    console.log(`开发环境: ${developmentTables.length} 个表`);
    
    // 找出缺失的表
    const missingInProduction = developmentTables.filter(table => !productionTables.includes(table));
    const missingInDevelopment = productionTables.filter(table => !developmentTables.includes(table));
    
    console.log('\n❌ 生产环境缺失的表:');
    if (missingInProduction.length > 0) {
      console.table(missingInProduction);
    } else {
      console.log('✅ 无缺失表');
    }
    
    console.log('\n❌ 开发环境缺失的表:');
    if (missingInDevelopment.length > 0) {
      console.table(missingInDevelopment);
    } else {
      console.log('✅ 无缺失表');
    }
    
    // 对比共同表的列结构
    const commonTables = productionTables.filter(table => developmentTables.includes(table));
    console.log(`\n🔍 对比 ${commonTables.length} 个共同表的结构差异...`);
    
    const differences = [];
    
    for (const tableName of commonTables) {
      const prodTable = productionSchema[tableName];
      const devTable = developmentSchema[tableName];
      
      // 对比列数
      if (prodTable.columns.length !== devTable.columns.length) {
        differences.push({
          table: tableName,
          type: 'column_count',
          production: prodTable.columns.length,
          development: devTable.columns.length
        });
      }
      
      // 对比索引数
      if (prodTable.indexes.length !== devTable.indexes.length) {
        differences.push({
          table: tableName,
          type: 'index_count',
          production: prodTable.indexes.length,
          development: devTable.indexes.length
        });
      }
      
      // 对比约束数
      if (prodTable.constraints.length !== devTable.constraints.length) {
        differences.push({
          table: tableName,
          type: 'constraint_count',
          production: prodTable.constraints.length,
          development: devTable.constraints.length
        });
      }
      
      // 对比列名
      const prodColumns = prodTable.columns.map(col => col.column_name).sort();
      const devColumns = devTable.columns.map(col => col.column_name).sort();
      
      if (JSON.stringify(prodColumns) !== JSON.stringify(devColumns)) {
        const missingInProd = devColumns.filter(col => !prodColumns.includes(col));
        const missingInDev = prodColumns.filter(col => !devColumns.includes(col));
        
        if (missingInProd.length > 0) {
          differences.push({
            table: tableName,
            type: 'missing_columns_in_production',
            columns: missingInProd
          });
        }
        
        if (missingInDev.length > 0) {
          differences.push({
            table: tableName,
            type: 'missing_columns_in_development',
            columns: missingInDev
          });
        }
      }
    }
    
    console.log('\n📋 结构差异汇总:');
    if (differences.length > 0) {
      console.table(differences);
    } else {
      console.log('✅ 所有共同表结构完全一致');
    }
    
    // 重点关注关键表
    const criticalTables = ['pixels', 'pixels_history', 'users', 'alliances', 'leaderboard_personal', 'leaderboard_alliance', 'leaderboard_region'];
    console.log('\n🎯 关键表详细对比:');
    
    for (const tableName of criticalTables) {
      if (productionSchema[tableName] && developmentSchema[tableName]) {
        const prodTable = productionSchema[tableName];
        const devTable = developmentSchema[tableName];
        
        console.log(`\n📊 ${tableName}:`);
        console.log(`  生产环境: ${prodTable.columns.length}列, ${prodTable.indexes.length}索引, ${prodTable.constraints.length}约束`);
        console.log(`  开发环境: ${devTable.columns.length}列, ${devTable.indexes.length}索引, ${devTable.constraints.length}约束`);
        
        // 显示列名差异
        const prodColumns = prodTable.columns.map(col => col.column_name).sort();
        const devColumns = devTable.columns.map(col => col.column_name).sort();
        
        if (JSON.stringify(prodColumns) !== JSON.stringify(devColumns)) {
          const missingInProd = devColumns.filter(col => !prodColumns.includes(col));
          const missingInDev = prodColumns.filter(col => !devColumns.includes(col));
          
          if (missingInProd.length > 0) {
            console.log(`  ❌ 生产环境缺失列: ${missingInProd.join(', ')}`);
          }
          if (missingInDev.length > 0) {
            console.log(`  ❌ 开发环境缺失列: ${missingInDev.join(', ')}`);
          }
        } else {
          console.log(`  ✅ 列结构一致`);
        }
      }
    }
    
    // 保存差异报告
    const report = {
      timestamp: new Date().toISOString(),
      tableCounts: {
        production: productionTables.length,
        development: developmentTables.length
      },
      missingTables: {
        inProduction: missingInProduction,
        inDevelopment: missingInDevelopment
      },
      differences: differences,
      criticalTables: criticalTables.reduce((acc, tableName) => {
        if (productionSchema[tableName] && developmentSchema[tableName]) {
          acc[tableName] = {
            production: {
              columns: productionSchema[tableName].columns.length,
              indexes: productionSchema[tableName].indexes.length,
              constraints: productionSchema[tableName].constraints.length
            },
            development: {
              columns: developmentSchema[tableName].columns.length,
              indexes: developmentSchema[tableName].indexes.length,
              constraints: developmentSchema[tableName].constraints.length
            }
          };
        }
        return acc;
      }, {})
    };
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `schema-differences-${timestamp}.json`;
    const filepath = `../data-export/${filename}`;
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\n💾 差异报告已保存到 ${filepath}`);
    
    // 同时保存最新版本
    fs.writeFileSync('../data-export/schema-differences-latest.json', JSON.stringify(report, null, 2));
    console.log('💾 同时保存为最新版本: data-export/schema-differences-latest.json');
    
    return report;
    
  } catch (error) {
    console.error('❌ 对比表结构失败:', error.message);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  compareSchemas();
}

module.exports = { compareSchemas };
