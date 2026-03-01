/**
 * 验证256色调色板是否已正确初始化到数据库
 */

const { db } = require('../config/database');

async function verify256ColorPalette() {
  console.log('🔍 开始验证256色调色板...\n');

  try {
    // 1. 检查 pattern_assets 表是否存在
    const tableExists = await db.schema.hasTable('pattern_assets');
    if (!tableExists) {
      console.error('❌ pattern_assets 表不存在！');
      process.exit(1);
    }
    console.log('✅ pattern_assets 表存在');

    // 2. 检查256色调色板数据
    const base256Colors = await db('pattern_assets')
      .where('category', 'base256color')
      .select('*');

    console.log(`\n📊 256色调色板统计:`);
    console.log(`  总颜色数: ${base256Colors.length}`);

    // 3. 验证预期数量
    const expectedCount = 216 + 40; // 216个Web安全色 + 40个灰度级
    if (base256Colors.length !== expectedCount) {
      console.error(`❌ 颜色数量不匹配！期望 ${expectedCount} 个，实际 ${base256Colors.length} 个`);

      if (base256Colors.length === 0) {
        console.log('\n💡 提示: 需要运行数据库迁移:');
        console.log('   npx knex migrate:latest');
      }
    } else {
      console.log(`✅ 颜色数量正确 (${expectedCount}个)`);
    }

    // 4. 按 render_type 分类统计
    const byRenderType = base256Colors.reduce((acc, color) => {
      acc[color.render_type] = (acc[color.render_type] || 0) + 1;
      return acc;
    }, {});

    console.log(`\n📋 按 render_type 分类:`);
    Object.entries(byRenderType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}个`);
    });

    // 5. 验证颜色格式
    const invalidColors = base256Colors.filter(color => {
      return !color.payload || !/^#[0-9A-F]{6}$/i.test(color.payload);
    });

    if (invalidColors.length > 0) {
      console.error(`\n❌ 发现 ${invalidColors.length} 个无效颜色格式:`);
      invalidColors.slice(0, 5).forEach(color => {
        console.error(`  ${color.key}: ${color.payload}`);
      });
    } else {
      console.log(`\n✅ 所有颜色格式正确 (HEX格式)`);
    }

    // 6. 检查是否有重复的颜色值
    const colorValues = base256Colors.map(c => c.payload);
    const uniqueColors = new Set(colorValues);
    const duplicateCount = colorValues.length - uniqueColors.size;

    if (duplicateCount > 0) {
      console.error(`\n❌ 发现 ${duplicateCount} 个重复的颜色值`);
    } else {
      console.log(`✅ 无重复颜色值`);
    }

    // 7. 抽样检查关键颜色
    const keyColors = [
      '#000000', // 黑色
      '#FFFFFF', // 白色
      '#FF0000', // 红色
      '#00FF00', // 绿色
      '#0000FF', // 蓝色
      '#FFFF00', // 黄色
      '#FF00FF', // 洋红
      '#00FFFF', // 青色
      '#808080'  // 灰色
    ];

    console.log(`\n🎨 关键颜色检查:`);
    for (const color of keyColors) {
      const found = base256Colors.find(c => c.payload === color);
      if (found) {
        console.log(`  ✅ ${color} - ${found.key}`);
      } else {
        console.error(`  ❌ ${color} - 未找到`);
      }
    }

    // 8. 验证Web安全色网格
    const rgbLevels = [0, 51, 102, 153, 204, 255];
    let webSafeCount = 0;
    for (const r of rgbLevels) {
      for (const g of rgbLevels) {
        for (const b of rgbLevels) {
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
          const found = base256Colors.find(c => c.payload === hex);
          if (found) webSafeCount++;
        }
      }
    }

    console.log(`\n🌈 Web安全色验证:`);
    console.log(`  期望: 216个 (6×6×6)`);
    console.log(`  实际: ${webSafeCount}个`);
    if (webSafeCount === 216) {
      console.log(`  ✅ Web安全色完整`);
    } else {
      console.error(`  ❌ Web安全色不完整，缺少 ${216 - webSafeCount} 个`);
    }

    // 9. 验证灰度级
    let grayscaleCount = 0;
    for (let i = 0; i < 40; i++) {
      const gray = Math.floor((i / 39) * 255);
      const hex = `#${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}${gray.toString(16).padStart(2, '0')}`.toUpperCase();
      const found = base256Colors.find(c => c.payload === hex);
      if (found) grayscaleCount++;
    }

    console.log(`\n⚪ 灰度级验证:`);
    console.log(`  期望: 40个`);
    console.log(`  实际: ${grayscaleCount}个`);
    if (grayscaleCount === 40) {
      console.log(`  ✅ 灰度级完整`);
    } else {
      console.error(`  ❌ 灰度级不完整，缺少 ${40 - grayscaleCount} 个`);
    }

    // 10. 最终结论
    console.log(`\n${'='.repeat(50)}`);
    if (base256Colors.length === expectedCount &&
        invalidColors.length === 0 &&
        duplicateCount === 0 &&
        webSafeCount === 216 &&
        grayscaleCount === 40) {
      console.log('✅ 256色调色板验证通过！所有检查项均正常。');
      console.log('✅ 系统已准备好处理广告图片。');
      process.exit(0);
    } else {
      console.error('❌ 256色调色板验证失败！请检查上述错误。');
      console.log('\n💡 修复建议:');
      console.log('   1. 运行数据库迁移: npx knex migrate:latest');
      console.log('   2. 检查迁移文件: backend/src/database/migrations/20251008120000_add_256_color_palette.js');
      console.log('   3. 如果问题持续，尝试回滚后重新迁移:');
      console.log('      npx knex migrate:rollback');
      console.log('      npx knex migrate:latest');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 验证过程中出错:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 执行验证
verify256ColorPalette();
