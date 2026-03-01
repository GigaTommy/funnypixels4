#!/usr/bin/env node

/**
 * 优化版完整数据库备份脚本
 * 使用流式写入和分批处理，支持大数据量备份
 * 使用方法: node scripts/backup-database-optimized.js
 */

const knex = require('knex');
const fs = require('fs');
const path = require('path');

// 加载环境配置
const { loadEnvConfig } = require('../src/config/env');
loadEnvConfig();

const config = require('../knexfile.js');

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
 * 分批导出表数据
 */
async function exportTableDataInBatches(db, tableName, batchSize = 1000) {
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
    
    // 获取总记录数
    const countResult = await db(tableName).count('* as count').first();
    const totalRows = parseInt(countResult.count);
    
    console.log(`📈 ${tableName}: 总共 ${totalRows} 条记录`);
    
    if (totalRows === 0) {
      return {
        tableName,
        exportedAt: new Date().toISOString(),
        schema: schema,
        rowCount: 0,
        data: []
      };
    }
    
    // 分批导出数据
    const allData = [];
    let offset = 0;
    
    while (offset < totalRows) {
      const batch = await db(tableName)
        .select('*')
        .limit(batchSize)
        .offset(offset);
      
      allData.push(...batch);
      offset += batchSize;
      
      // 显示进度
      const progress = Math.min(100, Math.round((offset / totalRows) * 100));
      process.stdout.write(`\r  📊 进度: ${progress}% (${offset}/${totalRows})`);
    }
    
    console.log(`\n✅ ${tableName}: ${allData.length} 条记录`);
    
    return {
      tableName,
      exportedAt: new Date().toISOString(),
      schema: schema,
      rowCount: allData.length,
      data: allData
    };
    
  } catch (error) {
    console.error(`\n❌ 导出表 ${tableName} 失败:`, error.message);
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
  const sequence = '001'; // 可以后续扩展为动态序列号
  
  return `${year}${month}${day}_${sequence}_funnypixels_postgres_backup.js`;
}

/**
 * 流式写入JSON文件
 */
async function writeBackupToFile(backupData, filePath) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });
    
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    
    // 写入文件头
    writeStream.write('// FunnyPixels 数据库完整备份\n');
    writeStream.write(`// 备份时间: ${new Date().toISOString()}\n`);
    writeStream.write(`// 数据库: ${process.env.DB_NAME || 'funnypixels_postgres'}\n`);
    writeStream.write(`// 表数量: ${backupData.backupInfo.successTables}/${backupData.backupInfo.totalTables}\n\n`);
    writeStream.write('module.exports = ');
    
    // 分批写入数据
    let isFirst = true;
    const writeData = (data) => {
      const jsonStr = JSON.stringify(data, null, 2);
      const chunks = [];
      const chunkSize = 1024 * 1024; // 1MB chunks
      
      for (let i = 0; i < jsonStr.length; i += chunkSize) {
        chunks.push(jsonStr.slice(i, i + chunkSize));
      }
      
      chunks.forEach((chunk, index) => {
        if (isFirst) {
          writeStream.write(chunk);
          isFirst = false;
        } else {
          writeStream.write(chunk);
        }
      });
    };
    
    writeData(backupData);
    writeStream.write(';\n');
    writeStream.end();
  });
}

/**
 * 主导出函数
 */
async function backupDatabase() {
  const db = knex(config.development);
  
  try {
    console.log('🚀 开始完整数据库备份（优化版）...');
    console.log('📅 备份时间:', new Date().toISOString());
    
    // 获取所有表
    const allTables = await getAllTables(db);
    console.log(`📋 发现 ${allTables.length} 个表`);
    
    const backupData = {
      backupInfo: {
        backupFileName: '',
        backedUpAt: new Date().toISOString(),
        source: 'development',
        database: process.env.DB_NAME || 'funnypixels_postgres',
        totalTables: allTables.length,
        successTables: 0,
        skippedTables: 0,
        version: '1.0.0'
      },
      tables: {}
    };
    
    let successCount = 0;
    let skipCount = 0;
    
    // 创建备份目录
    const backupDir = path.join(__dirname, '../data-export');
    await fs.promises.mkdir(backupDir, { recursive: true });
    
    // 生成备份文件名
    const backupFileName = generateBackupFileName();
    backupData.backupInfo.backupFileName = backupFileName;
    const backupFilePath = path.join(backupDir, backupFileName);
    
    console.log(`📁 备份文件: ${backupFileName}`);
    
    // 导出每个表的数据
    for (const tableName of allTables) {
      const tableData = await exportTableDataInBatches(db, tableName);
      if (tableData) {
        backupData.tables[tableName] = tableData;
        successCount++;
      } else {
        skipCount++;
      }
    }
    
    // 更新统计信息
    backupData.backupInfo.successTables = successCount;
    backupData.backupInfo.skippedTables = skipCount;
    
    // 保存为JS格式（使用流式写入）
    console.log('\n💾 正在写入备份文件...');
    await writeBackupToFile(backupData, backupFilePath);
    
    // 保存为JSON格式（仅保存备份信息，不包含大数据）
    const jsonFilePath = backupFilePath.replace('.js', '.json');
    const jsonBackupData = {
      ...backupData,
      tables: Object.keys(backupData.tables).reduce((acc, tableName) => {
        acc[tableName] = {
          ...backupData.tables[tableName],
          data: [] // 不包含实际数据，只保留结构信息
        };
        return acc;
      }, {})
    };
    
    await fs.promises.writeFile(jsonFilePath, JSON.stringify(jsonBackupData, null, 2), 'utf8');
    
    console.log('\n📊 备份统计:');
    console.log(`📁 JSON备份文件: ${jsonFilePath}`);
    console.log(`📁 JS备份文件: ${backupFilePath}`);
    console.log(`📋 总表数: ${allTables.length}`);
    console.log(`✅ 成功备份: ${successCount} 个表`);
    console.log(`⚠️  跳过表数: ${skipCount} 个表`);
    
    console.log('\n📈 详细统计:');
    Object.entries(backupData.tables).forEach(([tableName, tableData]) => {
      console.log(`  ${tableName}: ${tableData.rowCount} 条记录`);
    });
    
    console.log('\n✅ 数据库完整备份完成！');
    
    return {
      jsonFile: jsonFilePath,
      jsFile: backupFilePath,
      successCount,
      skipCount,
      totalTables: allTables.length
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
