#!/usr/bin/env node

/**
 * 单独导入修复后的 pattern_assets 数据
 */

const fs = require('fs');
const path = require('path');
const knex = require('knex');

async function importPatternAssetsFinal() {
  console.log('🚀 导入最终修复的 pattern_assets 数据...');

  // 生产环境配置
  let productionConfig = {
    client: 'postgresql',
    connection: {
      host: process.env.PROD_DB_HOST || 'localhost',
      port: process.env.PROD_DB_PORT || 5432,
      user: process.env.PROD_DB_USER || 'postgres',
      password: process.env.PROD_DB_PASSWORD || '',
      database: process.env.PROD_DB_NAME || 'funnypixels_prod',
      ssl: process.env.PROD_DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    }
  };

  const prodConfigPath = path.join(__dirname, '../config/production-database.json');
  if (fs.existsSync(prodConfigPath)) {
    const prodConfig = JSON.parse(fs.readFileSync(prodConfigPath, 'utf8'));
    productionConfig = {
      client: 'postgresql',
      connection: {
        host: prodConfig.database.host,
        port: prodConfig.database.port,
        user: prodConfig.database.user,
        password: prodConfig.database.password,
        database: prodConfig.database.database,
        ssl: prodConfig.database.ssl ? { rejectUnauthorized: false } : false
      }
    };
  }

  const db = knex(productionConfig);

  try {
    // 读取修复后的数据
    const dataFile = path.join(__dirname, '../data-export/pattern_assets_2025-09-21_final.json');
    if (!fs.existsSync(dataFile)) {
      console.error('❌ 修复后的数据文件不存在');
      return;
    }

    const patternAssets = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    console.log(`📊 准备导入 ${patternAssets.length} 条记录`);

    // 清空现有数据
    console.log('🗑️  清空现有 pattern_assets 数据...');
    await db('pattern_assets').truncate();

    // 分批插入数据
    const batchSize = 10;
    for (let i = 0; i < patternAssets.length; i += batchSize) {
      const batch = patternAssets.slice(i, i + batchSize);
      await db('pattern_assets').insert(batch);
      console.log(`📝 已插入 ${Math.min(i + batchSize, patternAssets.length)}/${patternAssets.length} 条记录`);
    }

    console.log('✅ pattern_assets 数据导入成功！');

    // 验证导入结果
    const count = await db('pattern_assets').count('* as count').first();
    console.log(`🔍 验证: 数据库中现有 ${count.count} 条记录`);

  } catch (error) {
    console.error('❌ 导入失败:', error.message);
  } finally {
    await db.destroy();
  }
}

// 执行导入
if (require.main === module) {
  importPatternAssetsFinal();
}

module.exports = { importPatternAssetsFinal };