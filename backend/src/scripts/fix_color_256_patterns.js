/**
 * 修复 color_256_* pattern 的 color 字段
 * 将 payload 的颜色值复制到 color 字段
 */

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../config/database');

async function fixColor256Patterns() {
  try {
    console.log('🔧 开始修复 color_256 pattern...\n');

    // 1. 查找所有 color_256_* pattern
    console.log('========== 步骤1: 查找所有 color_256 pattern ==========');
    const patterns = await db('pattern_assets')
      .where('key', 'like', 'color_256_%')
      .select('id', 'key', 'color', 'payload');

    console.log(`找到 ${patterns.length} 个 color_256 pattern\n`);

    if (patterns.length === 0) {
      console.log('❌ 没有找到任何 color_256 pattern');
      await db.destroy();
      return;
    }

    // 2. 检查需要修复的 pattern
    const needsFix = patterns.filter(p => !p.color && p.payload);
    console.log(`需要修复: ${needsFix.length} 个 pattern`);
    console.log(`已正确: ${patterns.length - needsFix.length} 个 pattern\n`);

    if (needsFix.length === 0) {
      console.log('✅ 所有 pattern 的 color 字段已正确设置');
      await db.destroy();
      return;
    }

    // 3. 显示前5个需要修复的示例
    console.log('需要修复的示例（前5个）:');
    needsFix.slice(0, 5).forEach((p, i) => {
      console.log(`${i + 1}. key: ${p.key}, color: ${p.color}, payload: ${p.payload}`);
    });

    // 4. 批量更新
    console.log('\n========== 步骤2: 批量更新 color 字段 ==========');
    let updatedCount = 0;

    for (const pattern of needsFix) {
      await db('pattern_assets')
        .where('id', pattern.id)
        .update({
          color: pattern.payload,
          updated_at: db.fn.now()
        });
      updatedCount++;

      if (updatedCount % 100 === 0) {
        console.log(`进度: ${updatedCount}/${needsFix.length}`);
      }
    }

    console.log(`✅ 已更新 ${updatedCount} 个 pattern\n`);

    // 5. 验证修复结果
    console.log('========== 步骤3: 验证修复结果 ==========');
    const verifyPatterns = await db('pattern_assets')
      .where('key', 'like', 'color_256_%')
      .whereNull('color')
      .count('* as count')
      .first();

    if (verifyPatterns.count === '0') {
      console.log('✅ 所有 color_256 pattern 的 color 字段已正确设置');
    } else {
      console.log(`⚠️ 还有 ${verifyPatterns.count} 个 pattern 的 color 字段为 null`);
    }

    // 6. 显示修复后的示例
    console.log('\n修复后的示例（前5个）:');
    const fixedPatterns = await db('pattern_assets')
      .where('key', 'like', 'color_256_%')
      .select('key', 'color', 'payload')
      .limit(5);

    fixedPatterns.forEach((p, i) => {
      console.log(`${i + 1}. key: ${p.key}, color: ${p.color}, payload: ${p.payload}`);
    });

    await db.destroy();
    console.log('\n✅ 修复完成!');

  } catch (error) {
    console.error('❌ 修复失败:', error);
    await db.destroy();
    process.exit(1);
  }
}

fixColor256Patterns();
