/**
 * 广告系统监控工具
 *
 * 功能:
 * 1. 监控广告放置统计
 * 2. 检查像素渲染完整性
 * 3. 分析网格ID冲突
 * 4. 生成系统健康报告
 */

const { db } = require('../config/database');
const { PIXEL_TYPES } = require('../constants/pixelTypes');

/**
 * 获取广告放置统计
 */
async function getAdPlacementStats() {
  console.log(`\n📊 广告放置统计:`);

  try {
    // 总放置数
    const totalPlacements = await db('ad_placements')
      .count('* as count')
      .first();

    console.log(`  总广告数: ${totalPlacements.count}`);

    // 活跃广告数
    const activePlacements = await db('ad_placements')
      .where('is_active', true)
      .count('* as count')
      .first();

    console.log(`  活跃广告: ${activePlacements.count}`);

    // 按尺寸统计
    const bySize = await db('ad_placements')
      .select('width', 'height')
      .count('* as count')
      .groupBy('width', 'height')
      .orderBy('count', 'desc');

    console.log(`\n  按尺寸分布:`);
    bySize.forEach(({ width, height, count }) => {
      console.log(`    ${width}×${height}: ${count}个`);
    });

    // 像素统计
    const pixelStats = await db('ad_placements')
      .select(db.raw('SUM(pixel_count) as total_pixels'))
      .select(db.raw('AVG(pixel_count) as avg_pixels'))
      .select(db.raw('MAX(pixel_count) as max_pixels'))
      .first();

    console.log(`\n  像素统计:`);
    console.log(`    总像素数: ${pixelStats.total_pixels || 0}`);
    console.log(`    平均像素: ${Math.round(pixelStats.avg_pixels || 0)}`);
    console.log(`    最大像素: ${pixelStats.max_pixels || 0}`);

    return {
      total: parseInt(totalPlacements.count),
      active: parseInt(activePlacements.count),
      bySize,
      pixelStats
    };

  } catch (error) {
    console.error(`❌ 获取广告统计失败:`, error);
    return null;
  }
}

/**
 * 检查像素渲染完整性
 */
async function checkPixelIntegrity() {
  console.log(`\n🔍 像素渲染完整性检查:`);

  try {
    // 获取所有广告放置
    const placements = await db('ad_placements')
      .where('is_active', true)
      .select('*');

    console.log(`  检查 ${placements.length} 个活跃广告...\n`);

    let totalIssues = 0;

    for (const placement of placements) {
      // 查询该广告的实际像素数
      const actualPixels = await db('pixels')
        .where('pixel_type', PIXEL_TYPES.AD)
        .where('related_id', placement.id)
        .count('* as count')
        .first();

      const expected = placement.pixel_count;
      const actual = parseInt(actualPixels.count);
      const loss = expected - actual;
      const lossRate = (loss / expected * 100).toFixed(2);

      if (loss > 0) {
        totalIssues++;
        console.log(`  ⚠️ 广告 ${placement.id}:`);
        console.log(`     期望: ${expected}个像素`);
        console.log(`     实际: ${actual}个像素`);
        console.log(`     丢失: ${loss}个 (${lossRate}%)`);
        console.log(`     尺寸: ${placement.width}×${placement.height}`);
        console.log(`     中心: (${placement.center_lat}, ${placement.center_lng})`);
        console.log(``);
      }
    }

    if (totalIssues === 0) {
      console.log(`  ✅ 所有广告像素完整，无丢失。`);
    } else {
      console.log(`  ❌ 发现 ${totalIssues} 个广告存在像素丢失。`);
    }

    return {
      checked: placements.length,
      issues: totalIssues
    };

  } catch (error) {
    console.error(`❌ 像素完整性检查失败:`, error);
    return null;
  }
}

/**
 * 分析网格ID冲突
 */
async function analyzeGridConflicts() {
  console.log(`\n🔬 网格ID冲突分析:`);

  try {
    // 查找重复的网格ID（广告像素）
    const conflicts = await db('pixels')
      .where('pixel_type', PIXEL_TYPES.AD)
      .select('grid_id')
      .count('* as count')
      .groupBy('grid_id')
      .having('count', '>', 1)
      .orderBy('count', 'desc')
      .limit(10);

    if (conflicts.length === 0) {
      console.log(`  ✅ 未发现网格ID冲突。`);
    } else {
      console.log(`  ⚠️ 发现 ${conflicts.length} 个网格ID存在冲突:\n`);

      for (const conflict of conflicts) {
        const pixels = await db('pixels')
          .where('grid_id', conflict.grid_id)
          .select('*');

        console.log(`  网格ID: ${conflict.grid_id}`);
        console.log(`  重复次数: ${conflict.count}`);
        console.log(`  像素详情:`);
        pixels.forEach((pixel, index) => {
          console.log(`    [${index + 1}] 坐标: (${pixel.latitude}, ${pixel.longitude}), 颜色: ${pixel.color}, 用户: ${pixel.user_id}`);
        });
        console.log(``);
      }
    }

    return {
      conflicts: conflicts.length
    };

  } catch (error) {
    console.error(`❌ 网格冲突分析失败:`, error);
    return null;
  }
}

/**
 * 检查256色调色板状态
 */
async function check256ColorPalette() {
  console.log(`\n🎨 256色调色板检查:`);

  try {
    const base256Colors = await db('pattern_assets')
      .where('category', 'base256color')
      .count('* as count')
      .first();

    const expectedCount = 256; // 216 Web安全色 + 40 灰度级
    const actual = parseInt(base256Colors.count);

    console.log(`  期望: ${expectedCount}个颜色`);
    console.log(`  实际: ${actual}个颜色`);

    if (actual === expectedCount) {
      console.log(`  ✅ 调色板完整`);
    } else if (actual === 0) {
      console.log(`  ❌ 调色板未初始化，请运行: npx knex migrate:latest`);
    } else {
      console.log(`  ⚠️ 调色板不完整，缺少 ${expectedCount - actual} 个颜色`);
    }

    return {
      expected: expectedCount,
      actual: actual,
      complete: actual === expectedCount
    };

  } catch (error) {
    console.error(`❌ 调色板检查失败:`, error);
    return null;
  }
}

/**
 * 生成系统健康报告
 */
async function generateHealthReport() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🏥 广告系统健康报告`);
  console.log(`${'='.repeat(60)}`);
  console.log(`生成时间: ${new Date().toLocaleString('zh-CN')}`);

  const report = {
    timestamp: new Date(),
    stats: {},
    integrity: {},
    conflicts: {},
    palette: {},
    overall: 'healthy'
  };

  // 1. 广告统计
  report.stats = await getAdPlacementStats();

  // 2. 像素完整性
  report.integrity = await checkPixelIntegrity();

  // 3. 网格冲突
  report.conflicts = await analyzeGridConflicts();

  // 4. 调色板状态
  report.palette = await check256ColorPalette();

  // 评估整体健康状态
  if (report.integrity?.issues > 0) {
    report.overall = 'warning';
  }
  if (report.conflicts?.conflicts > 0) {
    report.overall = 'critical';
  }
  if (!report.palette?.complete) {
    report.overall = 'critical';
  }

  // 输出总结
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 健康状态总结:`);
  console.log(`${'='.repeat(60)}\n`);

  const statusIcon = {
    'healthy': '✅',
    'warning': '⚠️',
    'critical': '❌'
  };

  console.log(`  整体状态: ${statusIcon[report.overall]} ${report.overall.toUpperCase()}`);
  console.log(`  活跃广告: ${report.stats?.active || 0}个`);
  console.log(`  像素问题: ${report.integrity?.issues || 0}个`);
  console.log(`  网格冲突: ${report.conflicts?.conflicts || 0}个`);
  console.log(`  调色板: ${report.palette?.complete ? '✅ 正常' : '❌ 异常'}`);

  // 提供建议
  if (report.overall !== 'healthy') {
    console.log(`\n💡 修复建议:`);

    if (!report.palette?.complete) {
      console.log(`  1. 初始化256色调色板: npx knex migrate:latest`);
    }

    if (report.conflicts?.conflicts > 0) {
      console.log(`  2. 检查网格对齐算法: backend/src/utils/gridUtils.js`);
      console.log(`  3. 检查像素投影算法: backend/src/services/AdPixelRenderer.js`);
    }

    if (report.integrity?.issues > 0) {
      console.log(`  4. 检查像素批量写入逻辑: backend/src/services/pixelBatchService.js`);
    }
  }

  console.log(``);

  return report;
}

/**
 * 主监控流程
 */
async function runMonitoring() {
  try {
    const report = await generateHealthReport();

    // 根据健康状态返回退出码
    if (report.overall === 'critical') {
      process.exit(1);
    } else if (report.overall === 'warning') {
      process.exit(0); // 警告状态仍返回0，避免中断CI
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error(`\n❌ 监控过程中发生错误:`, error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 执行监控
runMonitoring();
