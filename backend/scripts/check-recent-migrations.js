#!/usr/bin/env node
const { db } = require('../src/config/database');

async function checkMigrations() {
  try {
    console.log('🔍 检查最近的数据库迁移...\n');

    const migrations = await db('knex_migrations')
      .orderBy('migration_time', 'desc')
      .limit(10);

    console.log('最近10次迁移：');
    migrations.forEach(m => {
      console.log(`- ${m.name} (${new Date(m.migration_time).toLocaleString()})`);
    });

    // 检查alliance_members表的创建时间和最后修改
    console.log('\n🔍 检查alliance_members表结构...');
    const tableInfo = await db.raw(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'alliance_members'
      ORDER BY ordinal_position;
    `);

    console.log('alliance_members表结构：');
    console.log(tableInfo.rows);

    // 检查是否有任何alliance_members记录
    console.log('\n🔍 检查alliance_members表总记录数...');
    const count = await db('alliance_members').count('* as count').first();
    console.log(`总记录数: ${count.count}`);

    // 如果有记录，显示几个样本
    if (parseInt(count.count) > 0) {
      const samples = await db('alliance_members')
        .select('user_id', 'alliance_id', 'status', 'joined_at')
        .limit(5);
      console.log('\n前5条记录样本：');
      console.log(samples);
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    await db.destroy();
  }
}

checkMigrations();
