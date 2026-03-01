/**
 * 检查 color_256_ 开头的 patterns
 */

const { db } = require('../src/config/database');

async function checkColor256Patterns() {
  try {
    console.log('🔍 检查 color_256_ patterns...\n');

    // 1. 查找所有 color_256_ patterns
    const patterns = await db('pattern_assets')
      .where('key', 'like', 'color_256_%')
      .select('key', 'name', 'render_type', 'unicode_char', 'color', 'category')
      .orderBy('key')
      .limit(20);

    console.log(`📊 找到 ${patterns.length} 个 color_256_ patterns:\n`);

    patterns.forEach((p, i) => {
      console.log(`${i + 1}. ${p.key}`);
      console.log(`   name: ${p.name}`);
      console.log(`   render_type: ${p.render_type}`);
      console.log(`   color: ${p.color || 'null'}`);
      console.log(`   unicode_char: ${p.unicode_char || 'null'}`);
      console.log(`   category: ${p.category || 'null'}`);
      console.log('');
    });

    // 2. 统计 render_type
    const stats = await db('pattern_assets')
      .where('key', 'like', 'color_256_%')
      .select('render_type')
      .count('* as count')
      .groupBy('render_type');

    console.log('📈 render_type 统计:');
    stats.forEach(s => {
      console.log(`   ${s.render_type}: ${s.count} 个`);
    });

    // 3. 检查是否有错误标记的
    const wrongOnes = await db('pattern_assets')
      .where('key', 'like', 'color_256_%')
      .where('render_type', '=', 'emoji')
      .select('key', 'render_type');

    if (wrongOnes.length > 0) {
      console.log(`\n⚠️ 发现 ${wrongOnes.length} 个被错误标记为 emoji 的 color_256_ patterns`);
      console.log('需要修正这些 patterns 的 render_type 为 "color"');
    } else {
      console.log('\n✅ 所有 color_256_ patterns 的 render_type 都正确');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkColor256Patterns();
