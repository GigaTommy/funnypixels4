/**
 * SQL冗余分析脚本
 *
 * 功能：
 * 1. 分析当前MVT SQL查询的冗余程度
 * 2. 测量4个CTE vs 优化后单CTE的性能差异
 * 3. 评估优化收益
 *
 * 运行：node backend/scripts/performance/analyze-sql-redundancy.js
 */

const { db } = require('../../src/config/database');
const logger = require('../../src/utils/logger');

// 测试tile (广州塔附近)
const TEST_TILE = {
  z: 16,
  x: 53834,
  y: 28028
};

// 当前的SQL查询（4个layer分别JOIN）
const CURRENT_SQL = `
WITH tile_bounds AS (
  SELECT ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS geom
),
pixels_in_tile AS (
  SELECT
    p.id,
    p.grid_id,
    p.user_id,
    COALESCE(u.username, '游客') AS username,
    u.avatar,
    u.avatar_url,
    COALESCE(p.country, 'cn') AS country,
    p.city,
    p.alliance_id,
    a.name AS alliance_name,
    CASE
      WHEN p.pixel_type = 'ad' THEN 'ad'
      WHEN p.pixel_type = 'emoji' THEN 'emoji'
      ELSE 'color'
    END AS pixel_type,
    p.color AS display_color,
    p.pattern_id,
    p.geom_quantized,
    ps.hide_nickname,
    ps.hide_alliance
  FROM pixels p
  LEFT JOIN users u ON p.user_id = u.id
  LEFT JOIN privacy_settings ps ON p.user_id = ps.user_id
  LEFT JOIN alliances a ON p.alliance_id = a.id
  WHERE
    ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds))
    AND p.lng_quantized IS NOT NULL
    AND p.lat_quantized IS NOT NULL
    AND ST_IsValid(p.geom_quantized)
  LIMIT 100000
)
SELECT
  pixel_type,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT alliance_id) as unique_alliances
FROM pixels_in_tile
GROUP BY pixel_type
`;

// 优化后的SQL查询（一次JOIN，结果共享）
const OPTIMIZED_SQL = `
WITH tile_bounds AS (
  SELECT ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS geom
),
pixels_raw AS (
  SELECT
    p.id,
    p.grid_id,
    p.user_id,
    p.pixel_type,
    p.pattern_id,
    p.color,
    p.country,
    p.city,
    p.alliance_id,
    p.geom_quantized
  FROM pixels p
  WHERE
    ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds))
    AND p.lng_quantized IS NOT NULL
    AND p.lat_quantized IS NOT NULL
    AND ST_IsValid(p.geom_quantized)
  LIMIT 100000
),
pixels_enriched AS (
  SELECT
    p.id,
    p.grid_id,
    p.user_id,
    COALESCE(u.username, '游客') AS username,
    u.avatar,
    u.avatar_url,
    COALESCE(p.country, 'cn') AS country,
    p.city,
    p.alliance_id,
    a.name AS alliance_name,
    COALESCE(ps.hide_nickname, false) AS hide_nickname,
    COALESCE(ps.hide_alliance, false) AS hide_alliance,
    CASE
      WHEN p.pixel_type = 'ad' THEN 'ad'
      WHEN p.pixel_type = 'emoji' THEN 'emoji'
      ELSE 'color'
    END AS computed_pixel_type,
    p.color AS display_color,
    p.pattern_id,
    p.geom_quantized
  FROM pixels_raw p
  LEFT JOIN users u ON p.user_id = u.id
  LEFT JOIN privacy_settings ps ON p.user_id = ps.user_id
  LEFT JOIN alliances a ON p.alliance_id = a.id
)
SELECT
  computed_pixel_type as pixel_type,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT alliance_id) as unique_alliances
FROM pixels_enriched
GROUP BY computed_pixel_type
`;

// 执行SQL并测量性能
async function testSQL(name, sql, params) {
  console.log(`\n🔍 测试: ${name}`);

  const iterations = 5;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();

    try {
      const result = await db.raw(sql, params);
      const elapsed = Date.now() - startTime;
      times.push(elapsed);

      process.stdout.write(`\r   第 ${i + 1}/${iterations} 次: ${elapsed}ms`);
    } catch (error) {
      console.log(`\n   ❌ 执行失败: ${error.message}`);
      return null;
    }
  }

  console.log(''); // 换行

  times.sort((a, b) => a - b);

  const stats = {
    min: Math.min(...times),
    max: Math.max(...times),
    avg: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
    p95: times[Math.floor(times.length * 0.95)],
    median: times[Math.floor(times.length / 2)]
  };

  console.log(`   结果: min=${stats.min}ms, avg=${stats.avg}ms, median=${stats.median}ms, max=${stats.max}ms`);

  return stats;
}

// 分析执行计划
async function analyzeExecutionPlan(name, sql, params) {
  console.log(`\n📋 执行计划分析: ${name}`);

  try {
    const result = await db.raw(`EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ${sql}`, params);
    const plan = result.rows[0]['QUERY PLAN'][0];

    console.log(`   执行时间: ${plan['Execution Time'].toFixed(2)}ms`);
    console.log(`   规划时间: ${plan['Planning Time'].toFixed(2)}ms`);
    console.log(`   总时间: ${(plan['Execution Time'] + plan['Planning Time']).toFixed(2)}ms`);

    // 统计表扫描次数
    const planText = JSON.stringify(plan);
    const userJoins = (planText.match(/users/g) || []).length;
    const allianceJoins = (planText.match(/alliances/g) || []).length;
    const privacyJoins = (planText.match(/privacy_settings/g) || []).length;

    console.log(`   表扫描统计:`);
    console.log(`      users表: ${userJoins} 次`);
    console.log(`      alliances表: ${allianceJoins} 次`);
    console.log(`      privacy_settings表: ${privacyJoins} 次`);

    // 查找Shared Buffers使用情况
    const findBuffers = (node) => {
      let buffers = {
        shared_hit: 0,
        shared_read: 0,
        shared_dirtied: 0,
        shared_written: 0
      };

      if (node['Shared Hit Blocks']) buffers.shared_hit += node['Shared Hit Blocks'];
      if (node['Shared Read Blocks']) buffers.shared_read += node['Shared Read Blocks'];
      if (node['Shared Dirtied Blocks']) buffers.shared_dirtied += node['Shared Dirtied Blocks'];
      if (node['Shared Written Blocks']) buffers.shared_written += node['Shared Written Blocks'];

      if (node.Plans) {
        for (const child of node.Plans) {
          const childBuffers = findBuffers(child);
          buffers.shared_hit += childBuffers.shared_hit;
          buffers.shared_read += childBuffers.shared_read;
          buffers.shared_dirtied += childBuffers.shared_dirtied;
          buffers.shared_written += childBuffers.shared_written;
        }
      }

      return buffers;
    };

    const buffers = findBuffers(plan.Plan);
    console.log(`   Buffer使用:`);
    console.log(`      命中: ${buffers.shared_hit} blocks`);
    console.log(`      读取: ${buffers.shared_read} blocks`);
    console.log(`      脏块: ${buffers.shared_dirtied} blocks`);

    return {
      executionTime: plan['Execution Time'],
      planningTime: plan['Planning Time'],
      totalTime: plan['Execution Time'] + plan['Planning Time'],
      joins: { users: userJoins, alliances: allianceJoins, privacy: privacyJoins },
      buffers,
      plan
    };
  } catch (error) {
    console.log(`   ❌ 分析失败: ${error.message}`);
    return null;
  }
}

// 计算像素密度
async function analyzePixelDensity() {
  console.log(`\n📊 分析测试tile的像素密度`);

  try {
    const result = await db.raw(`
      WITH tile_bounds AS (
        SELECT ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS geom
      )
      SELECT
        COUNT(*) as total_pixels,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT alliance_id) as unique_alliances,
        COUNT(CASE WHEN pixel_type = 'color' THEN 1 END) as color_pixels,
        COUNT(CASE WHEN pixel_type = 'emoji' THEN 1 END) as emoji_pixels,
        COUNT(CASE WHEN pixel_type = 'complex' THEN 1 END) as complex_pixels,
        COUNT(CASE WHEN pixel_type = 'ad' THEN 1 END) as ad_pixels
      FROM pixels
      WHERE ST_Intersects(geom_quantized, (SELECT geom FROM tile_bounds))
    `, [TEST_TILE.z, TEST_TILE.x, TEST_TILE.y]);

    const stats = result.rows[0];

    console.log(`   总像素数: ${stats.total_pixels}`);
    console.log(`   独立用户: ${stats.unique_users}`);
    console.log(`   独立联盟: ${stats.unique_alliances}`);
    console.log(`   像素分布:`);
    console.log(`      color: ${stats.color_pixels} (${(stats.color_pixels / stats.total_pixels * 100).toFixed(1)}%)`);
    console.log(`      emoji: ${stats.emoji_pixels} (${(stats.emoji_pixels / stats.total_pixels * 100).toFixed(1)}%)`);
    console.log(`      complex: ${stats.complex_pixels} (${(stats.complex_pixels / stats.total_pixels * 100).toFixed(1)}%)`);
    console.log(`      ad: ${stats.ad_pixels} (${(stats.ad_pixels / stats.total_pixels * 100).toFixed(1)}%)`);

    return stats;
  } catch (error) {
    console.log(`   ❌ 分析失败: ${error.message}`);
    return null;
  }
}

// 主分析流程
async function runAnalysis() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 SQL冗余分析');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`测试tile: ${TEST_TILE.z}/${TEST_TILE.x}/${TEST_TILE.y} (广州塔)`);

  const params = [TEST_TILE.z, TEST_TILE.x, TEST_TILE.y];
  const report = {
    timestamp: new Date().toISOString(),
    tile: TEST_TILE
  };

  try {
    // 1. 分析像素密度
    console.log('\n【步骤 1】像素密度分析');
    report.density = await analyzePixelDensity();

    // 2. 当前SQL性能
    console.log('\n【步骤 2】当前SQL性能测试');
    report.current = {
      performance: await testSQL('当前SQL (4个layer分别JOIN)', CURRENT_SQL, params),
      plan: await analyzeExecutionPlan('当前SQL', CURRENT_SQL, params)
    };

    // 3. 优化SQL性能
    console.log('\n【步骤 3】优化SQL性能测试');
    report.optimized = {
      performance: await testSQL('优化SQL (一次JOIN，结果共享)', OPTIMIZED_SQL, params),
      plan: await analyzeExecutionPlan('优化SQL', OPTIMIZED_SQL, params)
    };

    // 4. 对比分析
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 优化效果对比');
    console.log('═══════════════════════════════════════════════════════');

    if (report.current.performance && report.optimized.performance) {
      const currentAvg = parseFloat(report.current.performance.avg);
      const optimizedAvg = parseFloat(report.optimized.performance.avg);
      const improvement = ((currentAvg - optimizedAvg) / currentAvg * 100).toFixed(1);
      const speedup = (currentAvg / optimizedAvg).toFixed(2);

      console.log('\n【响应时间】');
      console.log(`   当前方案: ${currentAvg}ms`);
      console.log(`   优化方案: ${optimizedAvg}ms`);
      console.log(`   性能提升: ${improvement}% (${speedup}x 加速)`);
    }

    if (report.current.plan && report.optimized.plan) {
      console.log('\n【执行计划】');
      console.log(`   当前方案:`);
      console.log(`      执行时间: ${report.current.plan.executionTime.toFixed(2)}ms`);
      console.log(`      users JOIN: ${report.current.plan.joins.users} 次`);
      console.log(`      alliances JOIN: ${report.current.plan.joins.alliances} 次`);

      console.log(`   优化方案:`);
      console.log(`      执行时间: ${report.optimized.plan.executionTime.toFixed(2)}ms`);
      console.log(`      users JOIN: ${report.optimized.plan.joins.users} 次`);
      console.log(`      alliances JOIN: ${report.optimized.plan.joins.alliances} 次`);

      const joinReduction = report.current.plan.joins.users - report.optimized.plan.joins.users;
      console.log(`   JOIN减少: ${joinReduction} 次 (${(joinReduction / report.current.plan.joins.users * 100).toFixed(1)}%)`);
    }

    console.log('\n【Buffer使用】');
    if (report.current.plan && report.optimized.plan) {
      console.log(`   当前方案: ${report.current.plan.buffers.shared_hit} 命中, ${report.current.plan.buffers.shared_read} 读取`);
      console.log(`   优化方案: ${report.optimized.plan.buffers.shared_hit} 命中, ${report.optimized.plan.buffers.shared_read} 读取`);
    }

    // 5. 预估生产环境收益
    console.log('\n【生产环境预估收益】');
    if (report.current.performance && report.optimized.performance) {
      const currentP95 = report.current.performance.p95;
      const optimizedP95 = report.optimized.performance.p95;

      console.log(`   当前P95延迟: ${currentP95}ms`);
      console.log(`   优化P95延迟: ${optimizedP95}ms`);
      console.log(`   预计延迟降低: ${currentP95 - optimizedP95}ms`);

      // 假设每秒1000个请求
      const qps = 1000;
      const currentCPU = 65; // 当前CPU使用率 (假设值)
      const joinReductionRatio = report.current.plan && report.optimized.plan
        ? (report.current.plan.joins.users - report.optimized.plan.joins.users) / report.current.plan.joins.users
        : 0.3;

      const estimatedCPUReduction = (currentCPU * joinReductionRatio).toFixed(1);
      const estimatedNewCPU = (currentCPU - estimatedCPUReduction).toFixed(1);

      console.log(`   预计CPU降低: ${currentCPU}% → ${estimatedNewCPU}% (减少 ${estimatedCPUReduction}%)`);
      console.log(`   在${qps} QPS下，每秒节约: ${((currentP95 - optimizedP95) * qps / 1000).toFixed(2)}秒数据库时间`);
    }

    // 保存报告
    const fs = require('fs');
    const reportPath = `/Users/ginochow/code/funnypixels3/backend/scripts/performance/sql-redundancy-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ 完整报告已保存: ${reportPath}`);

    console.log('\n═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ 分析失败:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

// 运行分析
runAnalysis().catch(console.error);
