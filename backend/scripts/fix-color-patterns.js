/**
 * 修复颜色 patterns 被错误标记为 emoji 的问题
 * 所有 key 以 'color_' 开头的 pattern 应该是 render_type = 'color'
 */

const { db } = require('../src/config/database');

async function fixColorPatterns() {
  try {
    console.log('🔍 检查数据库中的颜色 patterns...');

    // 1. 查找所有被错误标记的颜色 patterns
    const wrongPatterns = await db('pattern_assets')
      .where('key', 'like', 'color_%')
      .where('render_type', '!=', 'color')
      .select('key', 'render_type', 'unicode_char');

    if (wrongPatterns.length === 0) {
      console.log('✅ 没有发现错误的颜色 patterns');
      process.exit(0);
    }

    console.log(`⚠️ 发现 ${wrongPatterns.length} 个错误的颜色 patterns:`);
    wrongPatterns.forEach(p => {
      console.log(`  - ${p.key}: render_type="${p.render_type}", unicode_char="${p.unicode_char || 'null'}"`);
    });

    // 2. 修正这些 patterns
    console.log('\n🔧 开始修正...');
    const result = await db('pattern_assets')
      .where('key', 'like', 'color_%')
      .where('render_type', '!=', 'color')
      .update({
        render_type: 'color',
        unicode_char: null,
        updated_at: new Date()
      });

    console.log(`✅ 成功修正 ${result} 个 patterns`);

    // 3. 验证修正结果
    const remainingWrong = await db('pattern_assets')
      .where('key', 'like', 'color_%')
      .where('render_type', '!=', 'color')
      .count('* as count')
      .first();

    if (remainingWrong.count > 0) {
      console.log(`⚠️ 仍有 ${remainingWrong.count} 个未修正的 patterns`);
      process.exit(1);
    } else {
      console.log('✅ 所有颜色 patterns 已修正');
    }

    // 4. 显示修正后的统计
    const stats = await db('pattern_assets')
      .where('key', 'like', 'color_%')
      .select('render_type')
      .count('* as count')
      .groupBy('render_type');

    console.log('\n📊 修正后的统计:');
    stats.forEach(s => {
      console.log(`  - render_type="${s.render_type}": ${s.count} 个`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 修正失败:', error);
    process.exit(1);
  }
}

fixColorPatterns();
