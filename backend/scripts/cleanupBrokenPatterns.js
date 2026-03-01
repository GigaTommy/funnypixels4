#!/usr/bin/env node

/**
 * 清理损坏的pattern数据
 * 删除payload数据无效的patterns
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { db } = require('../src/config/database');

async function cleanupBrokenPatterns() {
  console.log('\n' + '='.repeat(70));
  console.log('🧹 清理损坏的pattern数据');
  console.log('='.repeat(70));

  try {
    // 获取所有payload数据无效的patterns
    console.log('\n📋 检查损坏的patterns...');

    const brokenPatterns = await db('pattern_assets')
      .where('encoding', 'png_base64')
      .orWhere('encoding', 'image')
      .orWhere('encoding', 'png')
      .select('id', 'key', 'name', 'encoding', db.raw('LENGTH(payload) as payload_size'), 'material_id')
      .orderBy('id');

    if (brokenPatterns.length === 0) {
      console.log('✅ 无损坏的patterns');
      process.exit(0);
    }

    console.log(`\n⚠️  发现 ${brokenPatterns.length} 个patterns with old encoding`);
    console.log('\n数据详情：');
    console.table(brokenPatterns.map(p => ({
      ID: p.id,
      Key: p.key || '(NULL)',
      Name: p.name,
      Encoding: p.encoding,
      PayloadSize: `${p.payload_size} bytes`,
      MaterialID: p.material_id ? '有' : '无'
    })));

    // 对于已有material_id的，只需更新encoding为'material'
    console.log('\n🔄 更新已有material_id的patterns...');
    const updated = await db('pattern_assets')
      .where(builder => {
        builder.where('encoding', 'png_base64')
          .orWhere('encoding', 'image')
          .orWhere('encoding', 'png');
      })
      .whereNotNull('material_id')
      .update({
        encoding: 'material',
        payload: null,
        updated_at: db.fn.now()
      });

    console.log(`✅ 更新了 ${updated} 个patterns`);

    // 对于无material_id且payload无效的，删除
    console.log('\n🗑️  清理无material_id的损坏patterns...');

    const toDelete = brokenPatterns.filter(p => !p.material_id);

    if (toDelete.length > 0) {
      console.log(`准备删除 ${toDelete.length} 个patterns:`);
      console.table(toDelete.map(p => ({
        ID: p.id,
        Key: p.key || '(NULL)',
        Name: p.name
      })));

      const deleteIds = toDelete.map(p => p.id);
      const deleted = await db('pattern_assets')
        .whereIn('id', deleteIds)
        .del();

      console.log(`✅ 删除了 ${deleted} 个patterns`);
    } else {
      console.log('✅ 无需删除（所有patterns都已有material_id）');
    }

    // 验证结果
    console.log('\n🔍 验证清理结果...');

    const remaining = await db('pattern_assets')
      .where(builder => {
        builder.where('encoding', 'png_base64')
          .orWhere('encoding', 'image')
          .orWhere('encoding', 'png');
      })
      .count('* as count')
      .first();

    console.log(`剩余有旧encoding的patterns: ${remaining.count}`);

    const materialPatterns = await db('pattern_assets')
      .where('encoding', 'material')
      .count('* as count')
      .first();

    console.log(`使用Material System的patterns: ${materialPatterns.count}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ 清理完成！');
    console.log('='.repeat(70));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 清理失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

cleanupBrokenPatterns();
