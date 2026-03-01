/**
 * 生成并插入256色调色板到 pattern_assets 表
 * 这些是广告系统使用的标准颜色
 */

// 设置环境变量
process.env.LOCAL_VALIDATION = 'true';

const { db } = require('../config/database');

/**
 * 生成256色调色板
 */
function generate256ColorPalette() {
  const palette = [];
  const rgbLevels = [0, 51, 102, 153, 204, 255];

  // 生成216个Web安全色 (6×6×6 RGB立方体)
  for (const r of rgbLevels) {
    for (const g of rgbLevels) {
      for (const b of rgbLevels) {
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toLowerCase();
        palette.push({ r, g, b, hex });
      }
    }
  }

  // 添加40个灰度级
  for (let i = 0; i < 40; i++) {
    const gray = Math.floor((i / 39) * 255);
    const hex = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`.toLowerCase();
    palette.push({ r: gray, g: gray, b: gray, hex });
  }

  return palette;
}

/**
 * 主函数：插入256色Pattern到数据库
 */
async function seedPatterns() {
  try {
    console.log('🎨 开始生成256色调色板Pattern...\n');

    // 生成调色板
    const palette = generate256ColorPalette();
    console.log(`✅ 生成256色调色板: ${palette.length}种颜色\n`);

    // 检查数据库连接
    await db.raw('SELECT 1');
    console.log('✅ 数据库连接成功\n');

    // 检查是否已存在256色Pattern
    const existingPatterns = await db('pattern_assets')
      .where('category', 'base256color')
      .count('* as count')
      .first();

    console.log(`📊 当前数据库中已有 ${existingPatterns.count} 个256色Pattern\n`);

    if (existingPatterns.count >= 256) {
      console.log('⚠️ 256色Pattern已经完整，跳过插入');
      console.log('如需重新插入，请先删除旧Pattern: DELETE FROM pattern_assets WHERE category = \'base256color\';\n');
      return;
    }

    console.log('🔄 开始批量插入Pattern...\n');

    // 批量插入
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalSkipped = 0;

    for (let i = 0; i < palette.length; i += BATCH_SIZE) {
      const batch = palette.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(palette.length / BATCH_SIZE);

      console.log(`📦 处理批次 ${batchNumber}/${totalBatches}: ${batch.length}个颜色`);

      const patterns = batch.map(color => {
        const key = `color_256_${color.hex.replace('#', '').toLowerCase()}`;
        return {
          key,
          name: `256色_${color.hex.toUpperCase()}`,
          category: 'base256color',
          payload: JSON.stringify({
            type: 'solidColor',
            color: color.hex,
            rgb: { r: color.r, g: color.g, b: color.b }
          }),
          description: `256色调色板颜色: ${color.hex.toUpperCase()} (R:${color.r}, G:${color.g}, B:${color.b})`,
          render_type: 'color',
          color: color.hex,
          width: 32,
          height: 32,
          encoding: 'rle',
          verified: true,
          is_public: true,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        };
      });

      try {
        // 使用 INSERT ... ON CONFLICT DO NOTHING 避免重复插入
        const inserted = await db('pattern_assets')
          .insert(patterns)
          .onConflict('key')
          .ignore();

        const insertedCount = Array.isArray(inserted) ? inserted.length : batch.length;
        totalInserted += insertedCount;
        totalSkipped += batch.length - insertedCount;

        console.log(`  ✅ 插入 ${insertedCount} 个, 跳过 ${batch.length - insertedCount} 个\n`);
      } catch (error) {
        console.error(`  ❌ 批次 ${batchNumber} 插入失败:`, error.message);
        throw error;
      }
    }

    // 验证插入结果
    const finalCount = await db('pattern_assets')
      .where('category', 'base256color')
      .count('* as count')
      .first();

    console.log('=' .repeat(60));
    console.log('✅ 256色Pattern插入完成!');
    console.log('=' .repeat(60));
    console.log(`📊 插入统计:`);
    console.log(`  - 新插入: ${totalInserted} 个`);
    console.log(`  - 跳过已存在: ${totalSkipped} 个`);
    console.log(`  - 数据库总计: ${finalCount.count} 个256色Pattern\n`);

    // 显示几个示例
    const samples = await db('pattern_assets')
      .where('category', 'base256color')
      .orderBy('key')
      .limit(5);

    console.log('📋 示例Pattern:');
    samples.forEach(p => {
      console.log(`  - ${p.key}: ${p.name}`);
    });

    console.log('\n💡 下一步:');
    console.log('  1. 重启服务器,让AdPixelRenderer预加载256色Pattern到内存');
    console.log('  2. 使用广告道具,像素将自动使用256色调色板');
    console.log('  3. 所有颜色都能找到对应的Pattern,写入不会再失败\n');

  } catch (error) {
    console.error('❌ 插入失败:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 运行
seedPatterns();
