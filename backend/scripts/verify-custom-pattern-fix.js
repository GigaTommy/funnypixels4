#!/usr/bin/env node

/**
 * 验证custom_pattern是否已经完全修复
 */

const { db } = require('../src/config/database');

async function verifyFix() {
  try {
    console.log('🔍 验证custom_pattern修复...\n');

    // 1. 检查是否还有color为'custom_pattern'的像素
    const count = await db('pixels')
      .where('color', 'custom_pattern')
      .count('* as count');

    console.log(`📊 仍有'custom_pattern'颜色的像素数量: ${count[0].count}`);

    // 2. 检查一些有pattern_id的像素，确保它们有正确的颜色
    const samplePixels = await db('pixels')
      .whereNotNull('pattern_id')
      .limit(5)
      .select('id', 'grid_id', 'color', 'pattern_id');

    console.log('\n📋 有pattern_id的像素示例:');
    samplePixels.forEach(pixel => {
      console.log(`  - Pixel ${pixel.id}: color="${pixel.color}", pattern_id="${pixel.pattern_id}"`);
    });

    // 3. 检查pattern_assets表中的示例
    const patterns = await db('pattern_assets')
      .limit(5)
      .select('key', 'render_type', 'unicode_char', 'color');

    console.log('\n📋 pattern_assets示例:');
    patterns.forEach(pattern => {
      console.log(`  - Pattern ${pattern.key}: render_type="${pattern.render_type}", unicode_char="${pattern.unicode_char}", color="${pattern.color}"`);
    });

    console.log('\n✅ 验证完成！');

  } catch (error) {
    console.error('❌ 验证失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  verifyFix()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 验证失败:', error);
      process.exit(1);
    });
}

module.exports = { verifyFix };