/**
 * SQL性能深度诊断工具
 *
 * 功能：
 * 1. 分析当前SQL的执行计划（EXPLAIN ANALYZE）
 * 2. 检测JOIN性能瓶颈
 * 3. 评估索引使用效率
 * 4. 对比优化前后的性能差异
 * 5. 生成优化建议
 */

const { db } = require('../../src/config/database');
const logger = require('../../src/utils/logger');

// 测试用的tile坐标
const TEST_TILES = {
  guangzhou_z12: { z: 12, x: 3337, y: 1777, name: '广州-Zoom12（大tile）' },
  guangzhou_z16: { z: 16, x: 53398, y: 28442, name: '广州-Zoom16（常规）' },
  beijing_z16: { z: 16, x: 53957, y: 24832, name: '北京-Zoom16（常规）' },
  empty_z16: { z: 16, x: 51882, y: 25958, name: '荒野-Zoom16（空tile）' }
};

/**
 * 执行EXPLAIN ANALYZE并解析结果
 */
async function analyzeQuery(queryName, sql, params) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 分析查询: ${queryName}`);
  console.log(`${'='.repeat(80)}`);

  try {
    const startTime = Date.now();
    const result = await db.raw(`EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ${sql}`, params);
    const elapsed = Date.now() - startTime;

    const plan = result.rows[0]['QUERY PLAN'][0];

    // 基础性能指标
    console.log(`\n⏱️  性能指标:`);
    console.log(`   执行时间: ${plan['Execution Time'].toFixed(2)}ms`);
    console.log(`   规划时间: ${plan['Planning Time'].toFixed(2)}ms`);
    console.log(`   总时间: ${(plan['Execution Time'] + plan['Planning Time']).toFixed(2)}ms`);
    console.log(`   实际耗时: ${elapsed}ms (包含网络)`);

    // 分析执行计划树
    const analysis = analyzePlanTree(plan.Plan);

    console.log(`\n📋 执行计划分析:`);
    console.log(`   扫描方式: ${analysis.scanTypes.join(', ')}`);
    console.log(`   使用的索引: ${analysis.indexesUsed.join(', ') || '无'}`);
    console.log(`   JOIN次数: ${analysis.joinCount}`);
    console.log(`   顺序扫描: ${analysis.seqScans.length > 0 ? '⚠️ ' + analysis.seqScans.join(', ') : '✅ 无'}`);

    // Buffer使用情况
    const buffers = calculateBuffers(plan.Plan);
    console.log(`\n💾 Buffer使用:`);
    console.log(`   命中: ${buffers.shared_hit} blocks (${(buffers.shared_hit * 8 / 1024).toFixed(2)} MB)`);
    console.log(`   读取: ${buffers.shared_read} blocks (${(buffers.shared_read * 8 / 1024).toFixed(2)} MB)`);
    console.log(`   写入: ${buffers.shared_written} blocks`);
    console.log(`   命中率: ${((buffers.shared_hit / (buffers.shared_hit + buffers.shared_read) * 100) || 0).toFixed(1)}%`);

    // 识别性能瓶颈
    const bottlenecks = identifyBottlenecks(plan.Plan);
    if (bottlenecks.length > 0) {
      console.log(`\n🚨 性能瓶颈:`);
      bottlenecks.forEach((bottleneck, i) => {
        console.log(`   ${i + 1}. ${bottleneck.type}: ${bottleneck.description}`);
        console.log(`      耗时: ${bottleneck.time.toFixed(2)}ms (${bottleneck.percentage.toFixed(1)}%)`);
      });
    } else {
      console.log(`\n✅ 未发现明显性能瓶颈`);
    }

    // 优化建议
    const recommendations = generateRecommendations(analysis, buffers, bottlenecks);
    if (recommendations.length > 0) {
      console.log(`\n💡 优化建议:`);
      recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    return {
      executionTime: plan['Execution Time'],
      planningTime: plan['Planning Time'],
      totalTime: plan['Execution Time'] + plan['Planning Time'],
      analysis,
      buffers,
      bottlenecks,
      recommendations,
      plan
    };

  } catch (error) {
    console.log(`   ❌ 分析失败: ${error.message}`);
    return null;
  }
}

/**
 * 分析执行计划树
 */
function analyzePlanTree(node, depth = 0) {
  const analysis = {
    scanTypes: new Set(),
    indexesUsed: new Set(),
    joinCount: 0,
    seqScans: [],
    tablesAccessed: new Set()
  };

  function traverse(n) {
    // 记录节点类型
    if (n['Node Type']) {
      analysis.scanTypes.add(n['Node Type']);
    }

    // 记录索引使用
    if (n['Index Name']) {
      analysis.indexesUsed.add(n['Index Name']);
    }

    // 记录表访问
    if (n['Relation Name']) {
      analysis.tablesAccessed.add(n['Relation Name']);
    }

    // 检测顺序扫描
    if (n['Node Type'] === 'Seq Scan' && n['Relation Name']) {
      analysis.seqScans.push(n['Relation Name']);
    }

    // 统计JOIN
    if (n['Node Type'] && n['Node Type'].includes('Join')) {
      analysis.joinCount++;
    }

    // 递归处理子节点
    if (n.Plans) {
      n.Plans.forEach(traverse);
    }
  }

  traverse(node);

  return {
    scanTypes: Array.from(analysis.scanTypes),
    indexesUsed: Array.from(analysis.indexesUsed),
    joinCount: analysis.joinCount,
    seqScans: analysis.seqScans,
    tablesAccessed: Array.from(analysis.tablesAccessed)
  };
}

/**
 * 计算Buffer使用情况
 */
function calculateBuffers(node) {
  const buffers = {
    shared_hit: 0,
    shared_read: 0,
    shared_dirtied: 0,
    shared_written: 0
  };

  function traverse(n) {
    if (n['Shared Hit Blocks']) buffers.shared_hit += n['Shared Hit Blocks'];
    if (n['Shared Read Blocks']) buffers.shared_read += n['Shared Read Blocks'];
    if (n['Shared Dirtied Blocks']) buffers.shared_dirtied += n['Shared Dirtied Blocks'];
    if (n['Shared Written Blocks']) buffers.shared_written += n['Shared Written Blocks'];

    if (n.Plans) {
      n.Plans.forEach(traverse);
    }
  }

  traverse(node);
  return buffers;
}

/**
 * 识别性能瓶颈
 */
function identifyBottlenecks(node) {
  const bottlenecks = [];
  const totalTime = node['Actual Total Time'];

  function traverse(n, parentTime) {
    const nodeTime = n['Actual Total Time'] || 0;
    const nodeType = n['Node Type'];
    const percentage = (nodeTime / totalTime) * 100;

    // 识别耗时超过20%的节点
    if (percentage > 20 && nodeTime > 10) {
      bottlenecks.push({
        type: nodeType,
        description: formatNodeDescription(n),
        time: nodeTime,
        percentage: percentage
      });
    }

    if (n.Plans) {
      n.Plans.forEach(child => traverse(child, nodeTime));
    }
  }

  traverse(node, totalTime);

  // 按耗时排序
  bottlenecks.sort((a, b) => b.time - a.time);

  return bottlenecks;
}

/**
 * 格式化节点描述
 */
function formatNodeDescription(node) {
  const parts = [node['Node Type']];

  if (node['Relation Name']) {
    parts.push(`on ${node['Relation Name']}`);
  }

  if (node['Index Name']) {
    parts.push(`using ${node['Index Name']}`);
  }

  if (node['Actual Rows']) {
    parts.push(`(${node['Actual Rows']} rows)`);
  }

  return parts.join(' ');
}

/**
 * 生成优化建议
 */
function generateRecommendations(analysis, buffers, bottlenecks) {
  const recommendations = [];

  // 检查顺序扫描
  if (analysis.seqScans.length > 0) {
    recommendations.push(`⚠️ 发现顺序扫描: ${analysis.seqScans.join(', ')} - 考虑添加索引`);
  }

  // 检查Buffer命中率
  const hitRate = (buffers.shared_hit / (buffers.shared_hit + buffers.shared_read) * 100) || 0;
  if (hitRate < 90) {
    recommendations.push(`📊 Buffer命中率偏低 (${hitRate.toFixed(1)}%) - 考虑增加shared_buffers或优化查询`);
  }

  // 检查JOIN次数
  if (analysis.joinCount > 4) {
    recommendations.push(`🔗 JOIN次数较多 (${analysis.joinCount}) - 考虑减少不必要的JOIN`);
  }

  // 检查索引使用
  if (analysis.indexesUsed.length === 0 && analysis.tablesAccessed.length > 0) {
    recommendations.push(`⚠️ 查询未使用任何索引 - 严重性能问题`);
  }

  // 根据瓶颈给出建议
  bottlenecks.forEach(bottleneck => {
    if (bottleneck.type === 'Seq Scan') {
      recommendations.push(`🎯 优化${bottleneck.description}的顺序扫描`);
    } else if (bottleneck.type.includes('Join')) {
      recommendations.push(`🎯 优化${bottleneck.description}的JOIN性能`);
    }
  });

  return [...new Set(recommendations)]; // 去重
}

/**
 * 对比当前SQL vs 优化SQL
 */
async function compareQueries(tile) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔬 对比分析: ${tile.name}`);
  console.log(`${'='.repeat(80)}`);

  const params = [tile.z, tile.x, tile.y, 1.0, 100, 100000];

  // 当前SQL（简化版，用于测试）
  const currentSQL = `
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
        p.geom_quantized,
        CASE
          WHEN p.pixel_type = 'ad' THEN 'ad'
          WHEN p.pixel_type = 'emoji' THEN 'emoji'
          ELSE 'color'
        END AS pixel_type
      FROM pixels p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN privacy_settings ps ON p.user_id = ps.user_id
      LEFT JOIN alliances a ON p.alliance_id = a.id
      WHERE
        ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds))
        AND p.lng_quantized IS NOT NULL
        AND p.lat_quantized IS NOT NULL
        AND ST_IsValid(p.geom_quantized)
        AND ($4 >= 1.0 OR (hashtext(p.grid_id::text)::bigint % 100) < $5)
      LIMIT $6
    )
    SELECT COUNT(*), pixel_type FROM pixels_in_tile GROUP BY pixel_type
  `;

  // 优化SQL（消除冗余JOIN）
  const optimizedSQL = `
    WITH tile_bounds AS (
      SELECT ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS geom
    ),
    pixels_raw AS (
      SELECT
        p.id,
        p.grid_id,
        p.user_id,
        p.pixel_type,
        p.geom_quantized
      FROM pixels p
      WHERE
        ST_Intersects(p.geom_quantized, (SELECT geom FROM tile_bounds))
        AND p.lng_quantized IS NOT NULL
        AND p.lat_quantized IS NOT NULL
        AND ST_IsValid(p.geom_quantized)
        AND ($4 >= 1.0 OR (hashtext(p.grid_id::text)::bigint % 100) < $5)
      LIMIT $6
    ),
    pixels_enriched AS (
      SELECT
        p.id,
        p.grid_id,
        p.user_id,
        COALESCE(u.username, '游客') AS username,
        u.avatar,
        p.geom_quantized,
        CASE
          WHEN p.pixel_type = 'ad' THEN 'ad'
          WHEN p.pixel_type = 'emoji' THEN 'emoji'
          ELSE 'color'
        END AS computed_pixel_type
      FROM pixels_raw p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN privacy_settings ps ON p.user_id = ps.user_id
      LEFT JOIN alliances a ON p.alliance_id = a.id
    )
    SELECT COUNT(*), computed_pixel_type FROM pixels_enriched GROUP BY computed_pixel_type
  `;

  // 分析当前SQL
  const currentResult = await analyzeQuery('当前SQL（直接JOIN）', currentSQL, params);

  // 分析优化SQL
  const optimizedResult = await analyzeQuery('优化SQL（分步JOIN）', optimizedSQL, params);

  // 对比结果
  if (currentResult && optimizedResult) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 性能对比总结`);
    console.log(`${'='.repeat(80)}`);

    const improvement = ((currentResult.executionTime - optimizedResult.executionTime) / currentResult.executionTime * 100);
    const speedup = (currentResult.executionTime / optimizedResult.executionTime);

    console.log(`\n⏱️  执行时间:`);
    console.log(`   当前SQL: ${currentResult.executionTime.toFixed(2)}ms`);
    console.log(`   优化SQL: ${optimizedResult.executionTime.toFixed(2)}ms`);
    console.log(`   提升: ${improvement.toFixed(1)}% (${speedup.toFixed(2)}x 加速)`);

    console.log(`\n🔗 JOIN次数:`);
    console.log(`   当前SQL: ${currentResult.analysis.joinCount}`);
    console.log(`   优化SQL: ${optimizedResult.analysis.joinCount}`);

    console.log(`\n💾 Buffer使用:`);
    console.log(`   当前SQL: ${currentResult.buffers.shared_hit} 命中, ${currentResult.buffers.shared_read} 读取`);
    console.log(`   优化SQL: ${optimizedResult.buffers.shared_hit} 命中, ${optimizedResult.buffers.shared_read} 读取`);

    // 判断优化是否值得
    console.log(`\n✅ 优化建议:`);
    if (improvement > 20) {
      console.log(`   ⭐ 强烈推荐实施优化 (性能提升${improvement.toFixed(1)}%)`);
    } else if (improvement > 10) {
      console.log(`   ⚠️  可以考虑优化 (性能提升${improvement.toFixed(1)}%)`);
    } else if (improvement > 0) {
      console.log(`   ℹ️  优化收益有限 (性能提升${improvement.toFixed(1)}%)`);
    } else {
      console.log(`   ❌ 优化无效果或性能下降 (${Math.abs(improvement).toFixed(1)}%)`);
    }
  }
}

/**
 * 检查索引使用情况
 */
async function checkIndexUsage() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 检查数据库索引使用情况`);
  console.log(`${'='.repeat(80)}`);

  try {
    // 1. 检查所有索引
    const allIndexes = await db.raw(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_indexes
      WHERE tablename = 'pixels'
      ORDER BY indexname
    `);

    console.log(`\n📊 Pixels表的所有索引 (共${allIndexes.rows.length}个):`);
    allIndexes.rows.forEach(idx => {
      console.log(`   ${idx.indexname} - ${idx.index_size}`);
    });

    // 2. 检查索引使用统计
    const indexStats = await db.raw(`
      SELECT
        schemaname,
        tablename,
        indexrelname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes
      WHERE tablename = 'pixels'
      ORDER BY idx_scan DESC
    `);

    console.log(`\n📈 索引使用统计 (按扫描次数排序):`);
    indexStats.rows.slice(0, 10).forEach(stat => {
      console.log(`   ${stat.indexrelname}:`);
      console.log(`      扫描次数: ${stat.idx_scan}`);
      console.log(`      读取行数: ${stat.idx_tup_read}`);
      console.log(`      索引大小: ${stat.index_size}`);
    });

    // 3. 查找未使用的索引
    const unusedIndexes = indexStats.rows.filter(stat => stat.idx_scan === '0');
    if (unusedIndexes.length > 0) {
      console.log(`\n⚠️  未使用的索引 (${unusedIndexes.length}个):`);
      unusedIndexes.forEach(idx => {
        console.log(`   ${idx.indexrelname} (${idx.index_size}) - 考虑删除`);
      });
    }

    // 4. 检查缺失的索引（基于常见查询模式）
    console.log(`\n🔍 检查推荐索引:`);

    const recommendedIndexes = [
      { name: 'idx_pixels_geom_quantized', column: 'geom_quantized', type: 'GIST' },
      { name: 'idx_pixels_grid_id', column: 'grid_id', type: 'BTREE' },
      { name: 'idx_pixels_user_id', column: 'user_id', type: 'BTREE' },
      { name: 'idx_pixels_alliance_id', column: 'alliance_id', type: 'BTREE' }
    ];

    const existingIndexNames = new Set(allIndexes.rows.map(idx => idx.indexname));

    recommendedIndexes.forEach(rec => {
      if (existingIndexNames.has(rec.name)) {
        console.log(`   ✅ ${rec.name} - 已存在`);
      } else {
        console.log(`   ❌ ${rec.name} - 缺失，建议创建:`);
        console.log(`      CREATE INDEX ${rec.name} ON pixels USING ${rec.type} (${rec.column});`);
      }
    });

    return {
      totalIndexes: allIndexes.rows.length,
      unusedIndexes: unusedIndexes.length,
      indexStats: indexStats.rows
    };

  } catch (error) {
    console.log(`   ❌ 检查失败: ${error.message}`);
    return null;
  }
}

/**
 * 主诊断流程
 */
async function runDiagnostics() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║           SQL性能深度诊断工具                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    // 1. 检查索引使用情况
    await checkIndexUsage();

    // 2. 对比当前SQL vs 优化SQL（不同zoom级别）
    for (const [key, tile] of Object.entries(TEST_TILES)) {
      await compareQueries(tile);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 避免过载
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ 诊断完成`);
    console.log(`${'='.repeat(80)}`);

  } catch (error) {
    console.error('❌ 诊断失败:', error);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

// 运行诊断
runDiagnostics().catch(console.error);
