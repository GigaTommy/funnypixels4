/**
 * 验证数据库迁移是否成功
 */

const knex = require('knex');
const knexConfig = require('../knexfile');

async function verifyMigration() {
  const db = knex(knexConfig.development);

  try {
    console.log('🔍 检查pixels表结构...\n');

    // 查询字段信息
    const result = await db.raw(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'pixels'
      AND column_name IN ('country', 'province', 'city', 'district', 'adcode', 'formatted_address', 'geocoded', 'geocoded_at')
      ORDER BY column_name
    `);

    if (result.rows.length > 0) {
      console.log('✅ 地区字段已成功添加到pixels表:\n');
      console.table(result.rows);
    } else {
      console.log('❌ 未找到地区字段，迁移可能失败\n');
    }

    // 查询索引
    const indexes = await db.raw(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'pixels'
      AND (indexname LIKE '%province%' OR indexname LIKE '%city%' OR indexname LIKE '%geocoded%')
    `);

    if (indexes.rows.length > 0) {
      console.log('\n✅ 已创建的索引:\n');
      console.table(indexes.rows);
    } else {
      console.log('\n⚠️  未找到相关索引\n');
    }

    // 统计已逆地理编码的像素数量
    const stats = await db('pixels')
      .count('* as total')
      .count({ geocoded: db.raw('CASE WHEN geocoded = true THEN 1 END') })
      .first();

    console.log('\n📊 像素统计:');
    console.log(`  总像素数: ${stats.total}`);
    console.log(`  已逆地理编码: ${stats.geocoded || 0}`);
    console.log(`  待处理: ${parseInt(stats.total) - parseInt(stats.geocoded || 0)}`);

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    await db.destroy();
  }
}

verifyMigration();
