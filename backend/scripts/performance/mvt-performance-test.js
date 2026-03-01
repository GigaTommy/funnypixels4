/**
 * MVT Performance Testing Script
 *
 * 功能：
 * 1. 测试不同zoom级别的MVT tile生成性能
 * 2. 测量SQL执行时间、tile大小、缓存命中率
 * 3. 模拟高并发场景
 * 4. 生成性能报告
 *
 * 运行：node backend/scripts/performance/mvt-performance-test.js
 */

const { db } = require('../../src/config/database');
const productionMVTService = require('../../src/services/productionMVTService');
const logger = require('../../src/utils/logger');

// 测试配置
const TEST_CONFIG = {
  // 测试地点（广州塔附近 - 高密度区域）
  guangzhou: {
    name: '广州塔',
    lat: 23.1097,
    lng: 113.3245,
    zoom: 16
  },
  // 测试地点（天安门 - 中密度区域）
  beijing: {
    name: '天安门',
    lat: 39.9075,
    lng: 116.3972,
    zoom: 16
  },
  // 测试地点（荒野地区 - 低密度区域）
  rural: {
    name: '荒野',
    lat: 35.0,
    lng: 105.0,
    zoom: 16
  },
  // 并发测试配置
  concurrency: {
    levels: [1, 10, 50, 100, 200],
    requestsPerLevel: 20
  }
};

// 将经纬度转换为tile坐标
function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { z: zoom, x, y };
}

// 单次tile请求性能测试
async function testSingleTile(location, zoom) {
  const tile = latLngToTile(location.lat, location.lng, zoom);
  const startTime = Date.now();

  try {
    const result = await productionMVTService.getTile(tile.z, tile.x, tile.y, 'br, gzip');
    const elapsed = Date.now() - startTime;

    return {
      success: true,
      elapsed,
      tileSize: result.buffer.length,
      encoding: result.encoding,
      isEmpty: result.isEmpty,
      tile: `${tile.z}/${tile.x}/${tile.y}`
    };
  } catch (error) {
    return {
      success: false,
      elapsed: Date.now() - startTime,
      error: error.message,
      tile: `${tile.z}/${tile.x}/${tile.y}`
    };
  }
}

// 多次测试并计算统计数据
async function runRepeatedTest(location, zoom, iterations = 10) {
  console.log(`\n📍 测试地点: ${location.name} (zoom ${zoom})`);
  console.log(`   坐标: ${location.lat}, ${location.lng}`);
  console.log(`   测试次数: ${iterations}`);

  const results = [];

  for (let i = 0; i < iterations; i++) {
    const result = await testSingleTile(location, zoom);
    results.push(result);

    // 显示进度
    process.stdout.write(`\r   进度: ${i + 1}/${iterations} (${result.elapsed}ms)`);
  }

  console.log(''); // 换行

  // 计算统计数据
  const successResults = results.filter(r => r.success);
  const times = successResults.map(r => r.elapsed);
  const sizes = successResults.map(r => r.tileSize);

  if (times.length === 0) {
    console.log('   ❌ 所有请求都失败了');
    return null;
  }

  times.sort((a, b) => a - b);
  sizes.sort((a, b) => a - b);

  const stats = {
    location: location.name,
    zoom,
    successRate: (successResults.length / results.length * 100).toFixed(1) + '%',
    times: {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
      p50: times[Math.floor(times.length * 0.5)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)]
    },
    size: {
      min: Math.min(...sizes),
      max: Math.max(...sizes),
      avg: (sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(0),
      encoding: successResults[0]?.encoding || 'unknown'
    },
    emptyTiles: results.filter(r => r.isEmpty).length
  };

  // 打印结果
  console.log(`\n   ✅ 性能统计:`);
  console.log(`      成功率: ${stats.successRate}`);
  console.log(`      响应时间: min=${stats.times.min}ms, avg=${stats.times.avg}ms, p95=${stats.times.p95}ms, p99=${stats.times.p99}ms`);
  console.log(`      Tile大小: min=${stats.size.min}B, avg=${stats.size.avg}B, max=${stats.size.max}B (${stats.size.encoding})`);
  console.log(`      空tile数: ${stats.emptyTiles}/${iterations}`);

  return stats;
}

// 并发测试
async function testConcurrency(location, zoom, concurrency, requests) {
  console.log(`\n🚀 并发测试: ${concurrency} 并发 × ${requests} 请求`);

  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < requests; i++) {
    const promise = testSingleTile(location, zoom);
    promises.push(promise);

    // 控制并发数
    if (promises.length >= concurrency) {
      await Promise.race(promises);
    }
  }

  const results = await Promise.all(promises);
  const elapsed = Date.now() - startTime;

  const successResults = results.filter(r => r.success);
  const times = successResults.map(r => r.elapsed);
  times.sort((a, b) => a - b);

  const stats = {
    concurrency,
    totalRequests: requests,
    successRate: (successResults.length / results.length * 100).toFixed(1) + '%',
    totalTime: elapsed,
    throughput: (requests / (elapsed / 1000)).toFixed(2) + ' req/s',
    times: {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)]
    }
  };

  console.log(`   成功率: ${stats.successRate}`);
  console.log(`   总耗时: ${stats.totalTime}ms`);
  console.log(`   吞吐量: ${stats.throughput}`);
  console.log(`   响应时间: min=${stats.times.min}ms, avg=${stats.times.avg}ms, p95=${stats.times.p95}ms`);

  return stats;
}

// 缓存性能测试
async function testCachePerformance(location, zoom) {
  console.log(`\n💾 缓存性能测试`);

  // 清空缓存
  await productionMVTService.clearAllCaches();
  console.log('   已清空所有缓存');

  // 第一次请求（冷缓存）
  console.log('   第一次请求（冷缓存）...');
  const coldResult = await testSingleTile(location, zoom);
  console.log(`   冷缓存响应时间: ${coldResult.elapsed}ms`);

  // 第二次请求（热缓存 - Memory）
  console.log('   第二次请求（Memory缓存）...');
  const memResult = await testSingleTile(location, zoom);
  console.log(`   Memory缓存响应时间: ${memResult.elapsed}ms`);
  console.log(`   加速比: ${(coldResult.elapsed / memResult.elapsed).toFixed(2)}x`);

  // 获取缓存统计
  const cacheStats = productionMVTService.getCacheStats();
  console.log(`\n   缓存状态:`);
  console.log(`      Raw cache: ${cacheStats.raw.size} tiles, ${(cacheStats.raw.calculatedSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`      Compressed cache: ${cacheStats.compressed.size} tiles, ${(cacheStats.compressed.calculatedSize / 1024 / 1024).toFixed(2)}MB`);

  return {
    coldTime: coldResult.elapsed,
    hotTime: memResult.elapsed,
    speedup: (coldResult.elapsed / memResult.elapsed).toFixed(2),
    cacheStats
  };
}

// SQL执行计划分析
async function analyzeSQLPerformance(location, zoom) {
  console.log(`\n🔍 SQL执行计划分析`);

  const tile = latLngToTile(location.lat, location.lng, zoom);
  const samplingRate = 1.0;
  const maxFeatures = 100000;

  try {
    // 使用EXPLAIN ANALYZE
    const result = await db.raw(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(?, ?, ?), 4326) AS geom
      ),
      pixels_in_tile AS (
        SELECT
          p.id,
          p.grid_id,
          p.geom_quantized
        FROM pixels p
        WHERE
          ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds))
          AND p.lng_quantized IS NOT NULL
          AND p.lat_quantized IS NOT NULL
          AND ST_IsValid(p.geom_quantized)
          AND (? >= 1.0 OR (hashtext(p.grid_id::text)::bigint % 100) < ?)
        LIMIT ?
      )
      SELECT COUNT(*) FROM pixels_in_tile
    `, [tile.z, tile.x, tile.y, samplingRate, Math.floor(samplingRate * 100), maxFeatures]);

    const plan = result.rows[0]['QUERY PLAN'][0];

    console.log(`   执行时间: ${plan['Execution Time'].toFixed(2)}ms`);
    console.log(`   规划时间: ${plan['Planning Time'].toFixed(2)}ms`);

    // 查找是否使用了索引
    const planText = JSON.stringify(plan);
    const usesIndex = planText.includes('Index Scan') || planText.includes('Bitmap Index Scan');
    console.log(`   使用索引: ${usesIndex ? '✅ 是' : '❌ 否'}`);

    // 提取关键节点
    const findNode = (node, type) => {
      if (node['Node Type'] === type) return node;
      if (node.Plans) {
        for (const child of node.Plans) {
          const found = findNode(child, type);
          if (found) return found;
        }
      }
      return null;
    };

    const indexScan = findNode(plan.Plan, 'Index Scan') || findNode(plan.Plan, 'Bitmap Index Scan');
    if (indexScan) {
      console.log(`   索引名称: ${indexScan['Index Name']}`);
      console.log(`   扫描行数: ${indexScan['Actual Rows']}`);
    }

    return {
      executionTime: plan['Execution Time'],
      planningTime: plan['Planning Time'],
      usesIndex,
      plan
    };
  } catch (error) {
    console.log(`   ❌ 分析失败: ${error.message}`);
    return null;
  }
}

// 检查数据库索引状态
async function checkIndexes() {
  console.log(`\n📋 数据库索引检查`);

  try {
    const result = await db.raw(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'pixels'
      ORDER BY indexname
    `);

    console.log(`   找到 ${result.rows.length} 个索引:`);

    const criticalIndexes = {
      'idx_pixels_geom_quantized': false,
      'idx_pixels_grid_id': false
    };

    result.rows.forEach(row => {
      console.log(`      ${row.indexname}`);
      if (row.indexname in criticalIndexes) {
        criticalIndexes[row.indexname] = true;
      }
    });

    console.log(`\n   关键索引检查:`);
    for (const [indexName, exists] of Object.entries(criticalIndexes)) {
      console.log(`      ${indexName}: ${exists ? '✅ 存在' : '❌ 缺失'}`);
    }

    return {
      totalIndexes: result.rows.length,
      indexes: result.rows,
      criticalIndexes
    };
  } catch (error) {
    console.log(`   ❌ 检查失败: ${error.message}`);
    return null;
  }
}

// 主测试流程
async function runPerformanceTest() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 MVT 性能完整评估');
  console.log('═══════════════════════════════════════════════════════');

  const report = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    // 1. 数据库索引检查
    console.log('\n【步骤 1】数据库索引检查');
    report.tests.indexes = await checkIndexes();

    // 2. SQL执行计划分析
    console.log('\n【步骤 2】SQL执行计划分析');
    report.tests.sqlPlan = await analyzeSQLPerformance(TEST_CONFIG.guangzhou, 16);

    // 3. 不同地点性能测试
    console.log('\n【步骤 3】不同地点性能测试');
    report.tests.locations = {
      guangzhou: await runRepeatedTest(TEST_CONFIG.guangzhou, 16, 20),
      beijing: await runRepeatedTest(TEST_CONFIG.beijing, 16, 20),
      rural: await runRepeatedTest(TEST_CONFIG.rural, 16, 20)
    };

    // 4. 不同zoom级别测试
    console.log('\n【步骤 4】不同Zoom级别测试');
    report.tests.zoomLevels = {};
    for (const zoom of [12, 14, 16, 18]) {
      report.tests.zoomLevels[`zoom${zoom}`] = await runRepeatedTest(TEST_CONFIG.guangzhou, zoom, 10);
    }

    // 5. 缓存性能测试
    console.log('\n【步骤 5】缓存性能测试');
    report.tests.cache = await testCachePerformance(TEST_CONFIG.guangzhou, 16);

    // 6. 并发性能测试
    console.log('\n【步骤 6】并发性能测试');
    report.tests.concurrency = {};
    for (const level of [1, 10, 50, 100]) {
      report.tests.concurrency[`c${level}`] = await testConcurrency(
        TEST_CONFIG.guangzhou,
        16,
        level,
        20
      );
    }

    // 生成报告摘要
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 性能评估报告摘要');
    console.log('═══════════════════════════════════════════════════════');

    console.log('\n【索引状态】');
    console.log(`   总索引数: ${report.tests.indexes?.totalIndexes || 'N/A'}`);
    console.log(`   关键索引: ${JSON.stringify(report.tests.indexes?.criticalIndexes || {})}`);

    console.log('\n【SQL性能】');
    console.log(`   执行时间: ${report.tests.sqlPlan?.executionTime?.toFixed(2) || 'N/A'}ms`);
    console.log(`   使用索引: ${report.tests.sqlPlan?.usesIndex ? '✅' : '❌'}`);

    console.log('\n【响应时间 (广州塔 zoom16)】');
    const gz = report.tests.locations?.guangzhou;
    if (gz) {
      console.log(`   P50: ${gz.times.p50}ms`);
      console.log(`   P95: ${gz.times.p95}ms`);
      console.log(`   P99: ${gz.times.p99}ms`);
      console.log(`   Avg: ${gz.times.avg}ms`);
    }

    console.log('\n【缓存效果】');
    const cache = report.tests.cache;
    if (cache) {
      console.log(`   冷缓存: ${cache.coldTime}ms`);
      console.log(`   热缓存: ${cache.hotTime}ms`);
      console.log(`   加速比: ${cache.speedup}x`);
    }

    console.log('\n【并发性能 (100并发)】');
    const c100 = report.tests.concurrency?.c100;
    if (c100) {
      console.log(`   吞吐量: ${c100.throughput}`);
      console.log(`   P95响应: ${c100.times.p95}ms`);
      console.log(`   成功率: ${c100.successRate}`);
    }

    // 保存完整报告
    const fs = require('fs');
    const reportPath = `/Users/ginochow/code/funnypixels3/backend/scripts/performance/mvt-performance-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ 完整报告已保存: ${reportPath}`);

    console.log('\n═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

// 运行测试
runPerformanceTest().catch(console.error);
