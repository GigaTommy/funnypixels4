/**
 * 验证 color_256 pattern 修复结果
 */

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../config/database');

async function verify() {
  try {
    console.log('🔍 验证 color_256 pattern 修复结果...\n');

    // 1. 查询示例
    const patterns = await db('pattern_assets')
      .where('key', 'like', 'color_256_%')
      .select('key', 'color', 'payload', 'render_type')
      .limit(10);

    console.log('========== 示例 Pattern ==========');
    patterns.forEach(p => {
      console.log(`key: ${p.key}`);
      console.log(`  color: ${p.color}`);
      console.log(`  payload: ${p.payload}`);
      console.log(`  render_type: ${p.render_type}\n`);
    });

    // 2. 统计
    const nullColorCount = await db('pattern_assets')
      .where('key', 'like', 'color_256_%')
      .whereNull('color')
      .count('* as count')
      .first();

    const totalCount = await db('pattern_assets')
      .where('key', 'like', 'color_256_%')
      .count('* as count')
      .first();

    console.log('========== 统计 ==========');
    console.log(`总数: ${totalCount.count}`);
    console.log(`color 为 null: ${nullColorCount.count}`);
    console.log(`color 已设置: ${totalCount.count - nullColorCount.count}\n`);

    if (nullColorCount.count === '0') {
      console.log('✅ 所有 color_256 pattern 的 color 字段已正确设置');
    } else {
      console.log(`⚠️ 还有 ${nullColorCount.count} 个 pattern 需要修复`);
    }

    await db.destroy();
    console.log('\n✅ 验证完成!');

  } catch (error) {
    console.error('❌ 验证失败:', error);
    await db.destroy();
    process.exit(1);
  }
}

verify();
