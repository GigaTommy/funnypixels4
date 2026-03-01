/**
 * 直接MVT性能测试
 * 使用实际的productionPixelTileQuery来测试
 */

const { getMVTTile } = require('../../src/models/productionPixelTileQuery');
const { db } = require('../../src/config/database');
const logger = require('../../src/utils/logger');

// 测试tiles
const TEST_CASES = [
  { z: 12, x: 3337, y: 1777, name: '广州-Zoom12（问题tile）', expected: 'slow' },
  { z: 14, x: 13349, y: 7110, name: '广州-Zoom14', expected: 'fast' },
  { z: 16, x: 53398, y: 28442, name: '广州-Zoom16', expected: 'fast' },
  { z: 16, x: 53957, y: 24832, name: '北京-Zoom16', expected: 'fast' },
  { z: 18, x: 213592, y: 113768, name: '广州-Zoom18', expected: 'fast' }
];

async function testMVTPerformance() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 直接MVT性能测试');
  console.log('═══════════════════════════════════════════════════════\n');

  const results = [];

  for (const testCase of TEST_CASES) {
    console.log(`\n📍 测试: ${testCase.name}`);
    console.log(`   Tile: ${testCase.z}/${testCase.x}/${testCase.y}`);

    const times = [];
    const sizes = [];

    // 执行3次测试
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      try {
        const mvtBuffer = await getMVTTile(testCase.z, testCase.x, testCase.y);
        const elapsed = Date.now() - startTime;
        times.push(elapsed);
        sizes.push(mvtBuffer ? mvtBuffer.length : 0);

        console.log(`   第${i + 1}次: ${elapsed}ms, ${(mvtBuffer.length / 1024).toFixed(2)}KB`);
      } catch (error) {
        console.log(`   第${i + 1}次: ❌ 失败 - ${error.message}`);
      }
    }

    if (times.length > 0) {
      const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const avgSize = (sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024).toFixed(2);

      console.log(`\n   📊 统计:`);
      console.log(`      时间: min=${minTime}ms, avg=${avgTime}ms, max=${maxTime}ms`);
      console.log(`      大小: avg=${avgSize}KB`);

      const status = maxTime > 200 ? '❌ 慢' : maxTime > 100 ? '⚠️ 一般' : '✅ 快';
      console.log(`      评级: ${status}`);

      results.push({
        ...testCase,
        avgTime: parseFloat(avgTime),
        maxTime,
        minTime,
        avgSize: parseFloat(avgSize),
        status
      });
    }
  }

  // 总结
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 性能总结');
  console.log(`${'='.repeat(60)}\n`);

  console.log('| Zoom | 平均时间 | 最大时间 | 大小 | 状态 |');
  console.log('|------|---------|---------|------|------|');
  results.forEach(r => {
    console.log(`| ${r.z.toString().padEnd(4)} | ${r.avgTime.toString().padEnd(7)}ms | ${r.maxTime.toString().padEnd(7)}ms | ${r.avgSize.toString().padEnd(4)}KB | ${r.status} |`);
  });

  // 分析
  console.log(`\n${'='.repeat(60)}`);
  console.log('🔍 性能分析');
  console.log(`${'='.repeat(60)}\n`);

  const slowTiles = results.filter(r => r.maxTime > 200);
  if (slowTiles.length > 0) {
    console.log('⚠️  发现慢查询:');
    slowTiles.forEach(t => {
      console.log(`   - ${t.name}: ${t.maxTime}ms (大小: ${t.avgSize}KB)`);
    });

    console.log('\n   原因分析:');
    slowTiles.forEach(t => {
      if (t.z <= 12) {
        console.log(`   - Zoom${t.z}: tile覆盖范围大，包含大量像素`);
      }
      if (t.avgSize > 100) {
        console.log(`   - ${t.name}: tile过大 (${t.avgSize}KB)，考虑采样或优化`);
      }
    });
  } else {
    console.log('✅ 所有测试都表现良好 (最大时间 < 200ms)');
  }

  // 检查索引使用
  console.log(`\n${'='.repeat(60)}`);
  console.log('📋 索引检查');
  console.log(`${'='.repeat(60)}\n`);

  try {
    const indexes = await db.raw(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'pixels'
        AND indexname IN ('idx_pixels_geom_spgist', 'idx_pixels_geom_quantized', 'idx_pixels_grid_id')
      ORDER BY indexname
    `);

    console.log('关键索引状态:');
    const criticalIndexes = ['idx_pixels_geom_spgist', 'idx_pixels_geom_quantized', 'idx_pixels_grid_id'];
    const existingIndexes = new Set(indexes.rows.map(idx => idx.indexname));

    criticalIndexes.forEach(indexName => {
      if (existingIndexes.has(indexName)) {
        console.log(`   ✅ ${indexName}`);
      } else {
        console.log(`   ❌ ${indexName} - 缺失!`);
      }
    });

    // 检查索引使用统计
    const stats = await db.raw(`
      SELECT
        indexrelname,
        idx_scan,
        idx_tup_read
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND tablename = 'pixels'
        AND indexrelname LIKE 'idx_pixels_geom%'
      ORDER BY idx_scan DESC
    `);

    if (stats.rows.length > 0) {
      console.log('\n索引使用统计:');
      stats.rows.forEach(stat => {
        console.log(`   ${stat.indexrelname}: ${stat.idx_scan} 次扫描, ${stat.idx_tup_read} 行读取`);
      });
    }

  } catch (error) {
    console.log(`   ⚠️  索引检查失败: ${error.message}`);
  }

  await db.destroy();
}

testMVTPerformance().catch(console.error);
