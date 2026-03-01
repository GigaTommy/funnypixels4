/**
 * 简化版OSM数据填充脚本
 * 根据环境自动选择数据库连接
 */

const knex = require('knex');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// 根据NODE_ENV或DATABASE_URL环境变量选择数据库
const getDbConnection = () => {
  // 如果设置了DATABASE_URL，使用它（生产环境）
  if (process.env.DATABASE_URL) {
    console.log('🔗 使用 DATABASE_URL 连接生产数据库');
    return process.env.DATABASE_URL;
  }

  // 否则使用本地开发数据库配置
  console.log('🔗 使用本地开发数据库连接');
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  return {
    host: DB_HOST || 'localhost',
    port: parseInt(DB_PORT) || 5432,
    database: DB_NAME || 'funnypixels_postgres',
    user: DB_USER || 'postgres',
    password: DB_PASSWORD || 'password'
  };
};

const db = knex({
  client: 'postgresql',
  connection: getDbConnection(),
  pool: { min: 0, max: 5 }
});

async function fillOSMMatchData() {
  try {
    console.log('🌍 开始填充pixels_history表的OSM匹配数据...\n');

    // 1. 检查planet_osm_polygon表是否存在
    console.log('📋 检查 planet_osm_polygon 表...');
    const tableExists = await db.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'planet_osm_polygon'
      ) as exists
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ planet_osm_polygon 表不存在！');
      console.log('ℹ️  跳过OSM数据填充，新服务会使用回退方案');
      await db.destroy();
      process.exit(0);
    }

    console.log('✅ planet_osm_polygon 表存在');

    // 2. 检查OSM城市数据
    const osmCityCount = await db.raw(`
      SELECT COUNT(*) as count
      FROM planet_osm_polygon
      WHERE admin_level = '6'
        AND boundary = 'administrative'
        AND name IS NOT NULL
    `);

    const cityCount = parseInt(osmCityCount.rows[0].count);
    console.log(`📊 OSM数据库中共有 ${cityCount} 个地级市数据`);

    if (cityCount === 0) {
      console.log('❌ planet_osm_polygon 表中没有城市数据！');
      await db.destroy();
      process.exit(1);
    }

    // 3. 检查match_point_to_admin_smart函数是否存在
    console.log('\n📋 检查 PostGIS 匹配函数...');
    const functionExists = await db.raw(`
      SELECT EXISTS (
        SELECT FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'match_point_to_admin_smart'
      ) as exists
    `);

    if (!functionExists.rows[0].exists) {
      console.log('❌ PostGIS匹配函数不存在！');
      console.log('💡 需要先运行数据库迁移: npm run migrate:latest');
      await db.destroy();
      process.exit(1);
    }

    console.log('✅ PostGIS 匹配函数存在');

    // 4. 统计需要处理的数据量
    console.log('\n📊 统计需要处理的记录数...');
    const countResult = await db.raw(`
      SELECT COUNT(*) as total
      FROM pixels_history
      WHERE (osm_id IS NULL OR match_quality IS NULL)
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude BETWEEN 18 AND 54
        AND longitude BETWEEN 73 AND 135
    `);

    const total = parseInt(countResult.rows[0].total);
    console.log(`需要处理的记录数: ${total.toLocaleString()}`);

    if (total === 0) {
      console.log('\n✅ 所有记录已匹配，无需处理');
      await db.destroy();
      process.exit(0);
    }

    // 5. 批量匹配
    console.log(`\n🚀 开始批量处理，每批 1000 条记录...\n`);

    const batchSize = 1000;
    let processed = 0;
    let successCount = 0;
    let failCount = 0;
    let batchNum = 0;

    while (processed < total) {
      batchNum++;
      const startTime = Date.now();

      console.log(`🔄 处理批次 ${batchNum} (${processed.toLocaleString()} / ${total.toLocaleString()})...`);

      try {
        const result = await db.raw(`
          WITH unmatched_pixels AS (
            SELECT id, latitude, longitude
            FROM pixels_history
            WHERE (osm_id IS NULL OR match_quality IS NULL)
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND latitude BETWEEN 18 AND 54
              AND longitude BETWEEN 73 AND 135
            ORDER BY id
            LIMIT ${batchSize}
          ),
          matched_data AS (
            SELECT
              up.id,
              m.osm_id,
              m.name,
              m.admin_level,
              m.country,
              m.province,
              m.city,
              m.matched_method,
              m.distance_m,
              m.match_quality
            FROM unmatched_pixels up
            CROSS JOIN LATERAL (
              SELECT * FROM match_point_to_admin_smart(
                up.latitude::FLOAT,
                up.longitude::FLOAT,
                20000
              )
            ) m
          )
          UPDATE pixels_history ph
          SET
            osm_id = md.osm_id,
            admin_level = md.admin_level,
            matched_method = md.matched_method,
            distance_m = md.distance_m,
            match_quality = md.match_quality,
            city = COALESCE(md.city, ph.city),
            province = COALESCE(md.province, ph.province),
            country = COALESCE(md.country, ph.country),
            match_source = 'postgis_osm',
            match_version = '1.0'
          FROM matched_data md
          WHERE ph.id = md.id
            AND md.osm_id IS NOT NULL
          RETURNING ph.id
        `);

        const batchSuccess = result.rows.length;
        successCount += batchSuccess;
        processed += batchSize;

        const elapsed = Date.now() - startTime;
        const rate = Math.round(batchSize / (elapsed / 1000));

        console.log(`  ✅ 批次 ${batchNum} 完成: ${batchSuccess} 条成功匹配 (${rate} 条/秒, 耗时 ${elapsed}ms)`);

        // 延迟以避免数据库过载
        if (processed < total) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        console.error(`  ❌ 批次 ${batchNum} 处理失败:`, error.message);
        failCount += batchSize;
        processed += batchSize;
      }

      // 每10批显示一次进度
      if (batchNum % 10 === 0) {
        const progress = ((processed / total) * 100).toFixed(1);
        console.log(`\n📈 总体进度: ${progress}% (${processed.toLocaleString()} / ${total.toLocaleString()})\n`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 OSM匹配数据填充完成！');
    console.log('='.repeat(60));
    console.log(`📊 处理统计:`);
    console.log(`  - 成功: ${successCount.toLocaleString()} 条`);
    console.log(`  - 失败: ${failCount.toLocaleString()} 条`);
    console.log(`  - 总计: ${processed.toLocaleString()} 条`);

    // 6. 统计匹配质量分布
    console.log('\n📊 匹配质量统计:');
    const qualityStats = await db.raw(`
      SELECT
        match_quality,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM pixels_history
      WHERE match_quality IS NOT NULL
      GROUP BY match_quality
      ORDER BY
        CASE match_quality
          WHEN 'perfect' THEN 1
          WHEN 'excellent' THEN 2
          WHEN 'good' THEN 3
          WHEN 'fair' THEN 4
          WHEN 'poor' THEN 5
          ELSE 6
        END
    `);

    qualityStats.rows.forEach(row => {
      const bar = '█'.repeat(Math.round(row.percentage / 2));
      console.log(`  ${row.match_quality.padEnd(10)}: ${row.count.toString().padStart(8)} (${row.percentage}%) ${bar}`);
    });

    // 7. 统计Top 10城市
    console.log('\n🏙️ Top 10 城市（像素数量）:');
    const cityStats = await db.raw(`
      SELECT
        city,
        province,
        COUNT(*) as count
      FROM pixels_history
      WHERE osm_id IS NOT NULL
        AND city IS NOT NULL
      GROUP BY city, province
      ORDER BY count DESC
      LIMIT 10
    `);

    cityStats.rows.forEach((row, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${row.city.padEnd(12)} (${row.province || ''}): ${row.count.toLocaleString()} 像素`);
    });

    // 8. 统计数据源分布
    console.log('\n📊 数据源统计:');
    const sourceStats = await db.raw(`
      SELECT
        match_source,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM pixels_history
      WHERE match_source IS NOT NULL
      GROUP BY match_source
      ORDER BY count DESC
    `);

    sourceStats.rows.forEach(row => {
      console.log(`  ${row.match_source}: ${row.count.toLocaleString()} (${row.percentage}%)`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ 全部完成！');
    console.log('='.repeat(60));

    await db.destroy();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 填充OSM匹配数据失败:', error.message);
    console.error(error.stack);
    await db.destroy();
    process.exit(1);
  }
}

// 运行脚本
fillOSMMatchData();
