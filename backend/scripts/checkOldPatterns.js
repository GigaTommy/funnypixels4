#!/usr/bin/env node

/**
 * 检查旧的pattern_assets数据
 * 用于决定是否需要执行迁移
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { db } = require('../src/config/database');

async function checkOldPatterns() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 检查旧的pattern_assets数据');
  console.log('='.repeat(70));

  try {
    // 获取所有patterns的统计
    console.log('\n📊 pattern_assets表统计：');

    const allPatterns = await db('pattern_assets')
      .count('* as count')
      .first();
    console.log(`  总数: ${allPatterns.count}`);

    // 按encoding分类
    const encodingStats = await db('pattern_assets')
      .groupBy('encoding')
      .select('encoding')
      .count('* as count');

    console.log('\n📋 按encoding分类：');
    let hasOldData = false;
    for (const stat of encodingStats) {
      const encoding = stat.encoding || '(NULL)';
      console.log(`  ${encoding}: ${stat.count}`);
      if (encoding === 'png_base64' || encoding === 'image' || encoding === '(NULL)') {
        hasOldData = true;
      }
    }

    // 检查是否有material_id为空的patterns
    console.log('\n📊 Material System集成情况：');
    const withMaterial = await db('pattern_assets')
      .whereNotNull('material_id')
      .count('* as count')
      .first();
    console.log(`  有material_id的: ${withMaterial.count}`);

    const withoutMaterial = await db('pattern_assets')
      .whereNull('material_id')
      .count('* as count')
      .first();
    console.log(`  无material_id的: ${withoutMaterial.count}`);

    // 检查需要迁移的patterns
    console.log('\n⚠️  需要迁移的patterns：');
    const oldPatterns = await db('pattern_assets')
      .where(builder => {
        builder.where('encoding', 'png_base64')
          .orWhere('encoding', 'image')
          .orWhereNull('material_id');
      })
      .andWhere('payload', 'not like', '')
      .select(
        'id',
        'key',
        'name',
        'encoding',
        'material_id',
        db.raw('LENGTH(payload) as payload_size')
      )
      .orderBy('created_at', 'desc')
      .limit(10);

    if (oldPatterns.length === 0) {
      console.log('  ✅ 无旧数据，无需迁移');
    } else {
      console.log(`  发现 ${oldPatterns.length} 个patterns需要迁移（显示最新的10条）：`);
      console.table(oldPatterns.map(p => ({
        ID: p.id,
        Key: p.key,
        Name: p.name,
        Encoding: p.encoding || '(NULL)',
        MaterialID: p.material_id || '(NULL)',
        PayloadSize: `${(p.payload_size / 1024).toFixed(1)}KB`
      })));
    }

    // 总结
    console.log('\n' + '='.repeat(70));
    console.log('📋 迁移建议：');
    if (hasOldData) {
      console.log('  ⚠️  存在旧数据，建议执行迁移：');
      console.log('  npm run migrate:patterns');
    } else {
      console.log('  ✅ 无旧数据，可直接部署Plan B');
    }
    console.log('='.repeat(70));

    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkOldPatterns();
