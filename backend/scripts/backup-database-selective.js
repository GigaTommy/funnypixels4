#!/usr/bin/env node

/**
 * 选择性数据库备份脚本
 * 备份关键表，排除大数据量表（如regions、spatial_ref_sys等）
 * 使用方法: node scripts/backup-database-selective.js
 */

const knex = require('knex');
const fs = require('fs');
const path = require('path');

// 加载环境配置
const { loadEnvConfig } = require('../src/config/env');
loadEnvConfig();

const config = require('../knexfile.js');

// 要备份的关键表（排除大数据量表）
const TABLES_TO_BACKUP = [
  'users',
  'pixels',
  'alliances',
  'alliance_members',
  'pattern_assets',
  'store_items',
  'shop_skus',
  'user_inventory',
  'user_pixel_states',
  'user_points',
  'user_achievements',
  'user_items',
  'notifications',
  'chat_messages',
  'custom_flag_orders',
  'user_custom_patterns',
  'ad_orders',
  'ad_placements',
  'ad_products',
  'advertisements',
  'user_ad_credits',
  'user_ad_inventory',
  'recharge_orders',
  'wallet_ledger',
  'idempotency_keys',
  'temp_pattern_storage',
  'cosmetics',
  'leaderboard_personal',
  'leaderboard_alliance',
  'leaderboard_stats',
  'knex_migrations',
  'knex_migrations_lock'
];

// 要排除的大数据量表
const EXCLUDED_TABLES = [
  'regions',
  'region_codes', 
  'spatial_ref_sys',
  'tianditu_regions',
  'pixels_history',
  'pixels_history_202501',
  'pixels_history_202502',
  'pixels_history_202503',
  'pixels_history_202504',
  'pixels_history_202505',
  'pixels_history_202506',
  'pixels_history_202507',
  'pixels_history_202508',
  'pixels_history_202509',
  'pixels_history_202510',
  'pixels_history_202511',
  'pixels_history_202512',
  'pixels_history_202601',
  'pixel_location_cache'
];

/**
 * 获取所有表名
 */
async function getAllTables(db) {
  try {
    const result = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = current_schema() 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    return result.rows.map(row => row.table_name);
  } catch (error) {
    console.error('❌ 获取表列表失败:', error.message);
    throw error;
  }
}

/**
 * 导出表结构信息
 */
async function exportTableSchema(db, tableName) {
  try {
    const columns = await db.raw(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_name = ? AND table_schema = current_schema()
      ORDER BY ordinal_position
    `, [tableName]);

    const constraints = await db.raw(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_name = ? AND tc.table_schema = current_schema()
    `, [tableName]);

    return {
      columns: columns.rows,
      constraints: constraints.rows
    };
  } catch (error) {
    console.log(`⚠️  获取表 ${tableName} 结构信息失败: ${error.message}`);
    return { columns: [], constraints: [] };
  }
}

/**
 * 导出表数据
 */
async function exportTableData(db, tableName) {
  try {
    console.log(`📊 导出表: ${tableName}`);
    
    // 检查表是否存在
    const tableExists = await db.schema.hasTable(tableName);
    if (!tableExists) {
      console.log(`⚠️  表 ${tableName} 不存在，跳过`);
      return null;
    }

    // 获取表结构
    const schema = await exportTableSchema(db, tableName);
    
    // 导出数据
    const data = await db(tableName).select('*');
    
    const tableExport = {
      tableName,
      exportedAt: new Date().toISOString(),
      schema: schema,
      rowCount: data.length,
      data: data
    };
    
    console.log(`✅ ${tableName}: ${data.length} 条记录`);
    return tableExport;
    
  } catch (error) {
    console.error(`❌ 导出表 ${tableName} 失败:`, error.message);
    return null;
  }
}

/**
 * 生成备份文件名
 */
function generateBackupFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const sequence = '001';
  
  return `${year}${month}${day}_${sequence}_funnypixels_postgres_backup.js`;
}

/**
 * 主导出函数
 */
async function backupDatabase() {
  const db = knex(config.development);
  
  try {
    console.log('🚀 开始选择性数据库备份...');
    console.log('📅 备份时间:', new Date().toISOString());
    
    // 获取所有表
    const allTables = await getAllTables(db);
    console.log(`📋 发现 ${allTables.length} 个表`);
    
    // 过滤要备份的表
    const tablesToBackup = allTables.filter(table => 
      TABLES_TO_BACKUP.includes(table) && !EXCLUDED_TABLES.includes(table)
    );
    
    console.log(`📋 将备份 ${tablesToBackup.length} 个关键表:`, tablesToBackup.join(', '));
    console.log(`⚠️  排除 ${EXCLUDED_TABLES.length} 个大表:`, EXCLUDED_TABLES.join(', '));
    
    const backupData = {};
    let successCount = 0;
    let skipCount = 0;
    
    // 创建备份目录
    const backupDir = path.join(__dirname, '../data-export');
    await fs.promises.mkdir(backupDir, { recursive: true });
    
    // 生成备份文件名
    const backupFileName = generateBackupFileName();
    const backupFilePath = path.join(backupDir, backupFileName);
    
    // 导出每个表的数据
    for (const tableName of tablesToBackup) {
      const tableData = await exportTableData(db, tableName);
      if (tableData) {
        backupData[tableName] = tableData;
        successCount++;
      } else {
        skipCount++;
      }
    }
    
    // 创建完整的备份数据
    const fullBackupData = {
      backupInfo: {
        backupFileName,
        backedUpAt: new Date().toISOString(),
        source: 'development',
        database: process.env.DB_NAME || 'funnypixels_postgres',
        totalTables: allTables.length,
        successTables: successCount,
        skippedTables: skipCount,
        excludedTables: EXCLUDED_TABLES.length,
        version: '1.0.0',
        note: '选择性备份，排除大数据量表'
      },
      tables: backupData
    };
    
    // 保存为JSON格式
    const jsonFilePath = backupFilePath.replace('.js', '.json');
    await fs.promises.writeFile(jsonFilePath, JSON.stringify(fullBackupData, null, 2), 'utf8');
    
    // 同时保存为JS格式（便于直接导入）
    const jsContent = `// FunnyPixels 数据库选择性备份
// 备份时间: ${new Date().toISOString()}
// 数据库: ${process.env.DB_NAME || 'funnypixels_postgres'}
// 表数量: ${successCount}/${tablesToBackup.length} (排除 ${EXCLUDED_TABLES.length} 个大表)

module.exports = ${JSON.stringify(fullBackupData, null, 2)};
`;
    
    await fs.promises.writeFile(backupFilePath, jsContent, 'utf8');
    
    console.log('\n📊 备份统计:');
    console.log(`📁 JSON备份文件: ${jsonFilePath}`);
    console.log(`📁 JS备份文件: ${backupFilePath}`);
    console.log(`📋 总表数: ${allTables.length}`);
    console.log(`✅ 成功备份: ${successCount} 个表`);
    console.log(`⚠️  跳过表数: ${skipCount} 个表`);
    console.log(`🚫 排除大表: ${EXCLUDED_TABLES.length} 个表`);
    
    console.log('\n📈 详细统计:');
    Object.entries(backupData).forEach(([tableName, tableData]) => {
      console.log(`  ${tableName}: ${tableData.rowCount} 条记录`);
    });
    
    console.log('\n📋 排除的大表:');
    EXCLUDED_TABLES.forEach(tableName => {
      console.log(`  ${tableName}: 大数据量表（未备份）`);
    });
    
    console.log('\n✅ 数据库选择性备份完成！');
    
    return {
      jsonFile: jsonFilePath,
      jsFile: backupFilePath,
      successCount,
      skipCount,
      totalTables: allTables.length,
      excludedTables: EXCLUDED_TABLES.length
    };
    
  } catch (error) {
    console.error('❌ 数据库备份失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  backupDatabase()
    .then((result) => {
      console.log('\n🎉 备份脚本执行完成');
      console.log(`📁 备份文件已保存: ${result.jsFile}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 备份脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { backupDatabase, generateBackupFileName };
