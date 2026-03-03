#!/usr/bin/env node
/**
 * Event Pixel Listener 验证脚本
 *
 * 检查项：
 * 1. 数据库索引就绪
 * 2. SQL执行计划分析
 * 3. 边界情况测试
 * 4. 性能基准测试
 */

const { db } = require('../src/config/database');
const eventPixelLogListener = require('../src/events/eventPixelLogListener');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// ================== 检查1：索引验证 ==================

async function checkIndexes() {
  log(colors.blue, '\n📊 检查1：验证数据库索引...');

  const requiredIndexes = [
    {
      table: 'events',
      name: 'idx_events_boundary_geom',
      type: 'gist',
      columns: 'boundary_geom',
      critical: true
    },
    {
      table: 'events',
      name: null, // 任意status索引
      type: 'btree',
      columns: 'status',
      critical: true
    },
    {
      table: 'event_participants',
      name: null,
      type: 'btree',
      columns: 'event_id, participant_type, participant_id',
      critical: true
    },
    {
      table: 'alliance_members',
      name: null,
      type: 'btree',
      columns: 'user_id',
      critical: false
    }
  ];

  let allPassed = true;

  for (const index of requiredIndexes) {
    const result = await db.raw(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = ?
      ORDER BY indexname
    `, [index.table]);

    const found = result.rows.some(row => {
      if (index.name) {
        return row.indexname === index.name;
      } else {
        return row.indexdef.toLowerCase().includes(index.columns.toLowerCase());
      }
    });

    if (found) {
      log(colors.green, `  ✅ ${index.table}: ${index.columns} 索引存在`);
    } else {
      if (index.critical) {
        log(colors.red, `  ❌ ${index.table}: ${index.columns} 索引缺失（关键）`);
        allPassed = false;
      } else {
        log(colors.yellow, `  ⚠️  ${index.table}: ${index.columns} 索引缺失（建议添加）`);
      }
    }
  }

  return allPassed;
}

// ================== 检查2：SQL执行计划 ==================

async function analyzeSQLPlan() {
  log(colors.blue, '\n📊 检查2：SQL执行计划分析...');

  // 创建测试数据
  const testSQL = `
    EXPLAIN ANALYZE
    WITH pixel_points(grid_id, user_id, lng, lat, x, y) AS (
      VALUES
        ($1, $2, $3::float, $4::float, $5, $6),
        ($7, $8, $9::float, $10::float, $11, $12)
    ),
    pixel_geoms AS (
      SELECT
        grid_id, user_id, x, y,
        ST_SetSRID(ST_MakePoint(lng, lat), 4326) as geom
      FROM pixel_points
    )
    SELECT DISTINCT
      e.id as event_id,
      pg.grid_id as pixel_id,
      pg.user_id,
      am.alliance_id
    FROM pixel_geoms pg
    INNER JOIN events e
      ON e.status = 'active'
      AND ST_Contains(e.boundary_geom, pg.geom)
    LEFT JOIN alliance_members am
      ON am.user_id = pg.user_id
      AND am.status = 'active'
    WHERE EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = e.id
        AND (
          (ep.participant_type = 'user' AND ep.participant_id = pg.user_id)
          OR
          (ep.participant_type = 'alliance' AND ep.participant_id = am.alliance_id)
        )
    )
  `;

  try {
    const result = await db.raw(testSQL, [
      'test_pixel_1', 'test_user_1', 116.4074, 39.9042, 100, 200,
      'test_pixel_2', 'test_user_2', 116.4075, 39.9043, 101, 201
    ]);

    const plan = result.rows.map(row => row['QUERY PLAN']).join('\n');

    // 分析关键指标
    const hasIndexScan = plan.includes('Index Scan') || plan.includes('Index Only Scan');
    const hasSeqScan = plan.includes('Seq Scan');
    const hasGistScan = plan.toLowerCase().includes('gist');

    log(colors.green, '\n执行计划：');
    console.log(plan);

    log(colors.blue, '\n关键指标分析：');
    log(hasGistScan ? colors.green : colors.red,
      `  ${hasGistScan ? '✅' : '❌'} GIST空间索引: ${hasGistScan ? '已使用' : '未使用'}`);
    log(hasIndexScan ? colors.green : colors.yellow,
      `  ${hasIndexScan ? '✅' : '⚠️'} B-tree索引: ${hasIndexScan ? '已使用' : '可能未使用'}`);
    log(!hasSeqScan ? colors.green : colors.yellow,
      `  ${!hasSeqScan ? '✅' : '⚠️'} 全表扫描: ${hasSeqScan ? '存在（可能影响性能）' : '无'}`);

    return hasGistScan;

  } catch (error) {
    log(colors.red, '  ❌ 执行计划分析失败:', error.message);
    return false;
  }
}

// ================== 检查3：边界情况测试 ==================

async function testEdgeCases() {
  log(colors.blue, '\n📊 检查3：边界情况测试...');

  const testCases = [
    {
      name: '空数组',
      pixels: [],
      expectedLogs: 0
    },
    {
      name: '无坐标像素',
      pixels: [
        { grid_id: 'test1', user_id: 'user1' }  // 缺少latitude/longitude
      ],
      expectedLogs: 0
    },
    {
      name: 'NULL x/y值',
      pixels: [
        { grid_id: 'test2', user_id: 'user2', latitude: 39.9042, longitude: 116.4074, x: null, y: null }
      ],
      expectedLogs: 0  // 取决于是否有活动和用户是否参与
    },
    {
      name: 'undefined x/y值',
      pixels: [
        { grid_id: 'test3', user_id: 'user3', latitude: 39.9042, longitude: 116.4074 }  // x, y不存在
      ],
      expectedLogs: 0
    },
    {
      name: '特殊字符grid_id（SQL注入测试）',
      pixels: [
        { grid_id: "test'; DROP TABLE events; --", user_id: 'user4', latitude: 39.9042, longitude: 116.4074 }
      ],
      expectedLogs: 0
    },
    {
      name: '大批量（500个）',
      pixels: Array.from({ length: 500 }, (_, i) => ({
        grid_id: `batch_test_${i}`,
        user_id: `user_${i % 10}`,  // 10个不同用户
        latitude: 39.9042 + (i * 0.0001),
        longitude: 116.4074 + (i * 0.0001),
        x: i * 10,
        y: i * 20
      })),
      expectedLogs: 0  // 取决于实际活动和参与情况
    }
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    try {
      const activeEvents = await eventPixelLogListener.getActiveEvents();

      if (testCase.name === '大批量（500个）') {
        // 测试分批处理
        const startTime = Date.now();
        const logs = [];

        for (let i = 0; i < testCase.pixels.length; i += 200) {
          const batch = testCase.pixels.slice(i, i + 200);
          const batchLogs = await eventPixelLogListener.processBatch(batch, activeEvents);
          logs.push(...batchLogs);
        }

        const processingTime = Date.now() - startTime;

        log(colors.green, `  ✅ ${testCase.name}: 处理${testCase.pixels.length}个像素, 耗时${processingTime}ms, 生成${logs.length}条日志`);

        if (processingTime > 2000) {
          log(colors.yellow, `     ⚠️  处理时间>2秒，可能需要优化`);
        }

      } else {
        // 普通测试
        const logs = await eventPixelLogListener.processBatch(testCase.pixels, activeEvents);
        log(colors.green, `  ✅ ${testCase.name}: 通过 (生成${logs.length}条日志)`);
      }

    } catch (error) {
      log(colors.red, `  ❌ ${testCase.name}: 失败 - ${error.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

// ================== 检查4：性能基准 ==================

async function performanceBenchmark() {
  log(colors.blue, '\n📊 检查4：性能基准测试...');

  const benchmarks = [
    { size: 10, name: '小批量' },
    { size: 50, name: '中批量' },
    { size: 200, name: '大批量' },
    { size: 500, name: '超大批量' }
  ];

  const results = [];

  for (const benchmark of benchmarks) {
    const pixels = Array.from({ length: benchmark.size }, (_, i) => ({
      grid_id: `perf_test_${i}`,
      user_id: `user_${i % 20}`,
      latitude: 39.9042 + (i * 0.0001),
      longitude: 116.4074 + (i * 0.0001),
      x: i * 10,
      y: i * 20
    }));

    try {
      const activeEvents = await eventPixelLogListener.getActiveEvents();
      const startTime = Date.now();

      // 模拟分批处理
      const logs = [];
      for (let i = 0; i < pixels.length; i += 200) {
        const batch = pixels.slice(i, i + 200);
        const batchLogs = await eventPixelLogListener.processBatch(batch, activeEvents);
        logs.push(...batchLogs);
      }

      const processingTime = Date.now() - startTime;
      const throughput = Math.round((pixels.length / processingTime) * 1000);

      results.push({
        name: benchmark.name,
        size: benchmark.size,
        time: processingTime,
        throughput,
        logsCreated: logs.length
      });

      const performanceLevel =
        processingTime < 100 ? colors.green :
        processingTime < 500 ? colors.yellow :
        colors.red;

      log(performanceLevel,
        `  ${benchmark.name}(${benchmark.size}像素): ${processingTime}ms (${throughput} pixels/s) - ${logs.length}条日志`);

    } catch (error) {
      log(colors.red, `  ❌ ${benchmark.name}: 失败 - ${error.message}`);
    }
  }

  return results;
}

// ================== 主函数 ==================

async function main() {
  log(colors.blue, '🚀 开始验证 Event Pixel Listener...\n');

  try {
    // 检查1：索引
    const indexesOK = await checkIndexes();

    // 检查2：执行计划
    const planOK = await analyzeSQLPlan();

    // 检查3：边界情况
    const edgeCasesOK = await testEdgeCases();

    // 检查4：性能基准
    const perfResults = await performanceBenchmark();

    // 检查5：统计信息
    log(colors.blue, '\n📊 检查5：监听器统计信息...');
    const stats = eventPixelLogListener.getStats();
    console.log(JSON.stringify(stats, null, 2));

    // 总结
    log(colors.blue, '\n\n=================================');
    log(colors.blue, '          验证结果总结');
    log(colors.blue, '=================================\n');

    const allChecks = [
      { name: '索引就绪', passed: indexesOK },
      { name: '执行计划优化', passed: planOK },
      { name: '边界情况处理', passed: edgeCasesOK }
    ];

    allChecks.forEach(check => {
      log(check.passed ? colors.green : colors.red,
        `${check.passed ? '✅' : '❌'} ${check.name}`);
    });

    const allPassed = allChecks.every(c => c.passed);

    if (allPassed) {
      log(colors.green, '\n🎉 所有检查通过！Event Pixel Listener 已就绪。\n');
      process.exit(0);
    } else {
      log(colors.red, '\n⚠️  部分检查未通过，请修复后再部署。\n');
      process.exit(1);
    }

  } catch (error) {
    log(colors.red, '\n❌ 验证过程出错:', error);
    console.error(error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 运行
main();
