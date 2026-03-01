/**
 * 检查当前 pattern_assets 表结构和数据
 */

const { db } = require('./src/config/database');

async function checkCurrentFlags() {
  try {
    // 获取当前表结构
    const columns = await db.raw(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pattern_assets'
      ORDER BY ordinal_position
    `);

    console.log('📋 当前 pattern_assets 表结构:');
    console.log(columns.rows.map(c => `  ${c.column_name}: ${c.data_type}`).join('\n'));

    // 获取当前的分类
    const categories = await db('pattern_assets')
      .distinct('category')
      .select('category');

    console.log('\n📊 当前的分类:', categories.map(c => c.category));

    // 获取当前的旗帜数据
    const patterns = await db('pattern_assets')
      .select('key', 'name', 'category', 'render_type', 'unicode_char', 'color');

    console.log('\n📊 当前的旗帜数据:');
    console.log('总数:', patterns.length);

    const byCategory = {};
    patterns.forEach(p => {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    });

    Object.entries(byCategory).forEach(([cat, items]) => {
      console.log(`  ${cat}: ${items.length} 个`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkCurrentFlags();
