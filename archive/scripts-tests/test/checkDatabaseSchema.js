#!/usr/bin/env node

/**
 * 检查数据库表结构和字段映射关系
 */

const { db } = require('../../backend/src/config/database');

async function checkDatabaseSchema() {
  try {
    console.log('🔍 检查pixels表结构\n');

    // 1. 检查pixels表的所有字段
    const columns = await db.raw(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'pixels'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('📋 pixels表字段:');
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
    });

    // 2. 检查pixels_history表字段
    const historyColumns = await db.raw(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'pixels_history'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 pixels_history表字段:');
    historyColumns.rows.slice(0, 20).forEach(col => { // 只显示前20个字段
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
    });
    if (historyColumns.rows.length > 20) {
      console.log(`   ... 还有 ${historyColumns.rows.length - 20} 个字段`);
    }

    // 3. 检查当前pixels表中的数据
    console.log('\n📊 当前pixels表数据示例:');
    const sampleData = await db('pixels').select('*').limit(1);

    if (sampleData.length > 0) {
      const sample = sampleData[0];
      console.log('字段值示例:');
      Object.keys(sample).forEach(key => {
        console.log(`   ${key}: "${sample[key]}"`);
      });
    } else {
      console.log('   (表中暂无数据)');
    }

    await db.destroy();

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

checkDatabaseSchema();