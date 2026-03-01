const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');

/**
 * 填充pixels_history表的OSM匹配数据
 * 使用PostGIS函数将像素点精确匹配到OpenStreetMap行政区划
 */
async function fillOSMMatchData() {
  try {
    logger.info('🌍 开始填充pixels_history表的OSM匹配数据...');

    // 检查planet_osm_polygon表是否存在
    const tableExists = await db.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'planet_osm_polygon'
      ) as exists
    `);

    if (!tableExists.rows[0].exists) {
      logger.error('❌ planet_osm_polygon表不存在！请先导入OpenStreetMap数据。');
      logger.info('提示: 使用osm2pgsql工具导入OSM数据到PostgreSQL数据库');
      process.exit(1);
    }

    // 检查OSM数据中是否有中国城市数据
    const osmCityCount = await db.raw(`
      SELECT COUNT(*) as count
      FROM planet_osm_polygon
      WHERE admin_level = '6'
        AND boundary = 'administrative'
        AND name IS NOT NULL
    `);

    const cityCount = parseInt(osmCityCount.rows[0].count);
    logger.info(`📊 OSM数据库中共有 ${cityCount} 个地级市数据`);

    if (cityCount === 0) {
      logger.error('❌ planet_osm_polygon表中没有城市数据！');
      process.exit(1);
    }

    // 检查match_point_to_admin_smart函数是否存在
    const functionExists = await db.raw(`
      SELECT EXISTS (
        SELECT FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'match_point_to_admin_smart'
      ) as exists
    `);

    if (!functionExists.rows[0].exists) {
      logger.error('❌ PostGIS匹配函数不存在！请先运行数据库迁移。');
      logger.info('运行命令: npm run migrate:latest');
      process.exit(1);
    }

    // 统计需要处理的数据量
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
    logger.info(`📊 需要处理的记录数: ${total.toLocaleString()}`);

    if (total === 0) {
      logger.info('✅ 所有记录已匹配，无需处理');
      process.exit(0);
    }

    // 批量匹配（每批1000条）
    const batchSize = 1000;
    let processed = 0;
    let successCount = 0;
    let failCount = 0;

    logger.info(`🚀 开始批量处理，每批 ${batchSize} 条记录...`);

    while (processed < total) {
      const batchNum = Math.floor(processed / batchSize) + 1;
      const startTime = Date.now();

      logger.info(`🔄 处理批次 ${batchNum} (${processed.toLocaleString()} / ${total.toLocaleString()})...`);

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
              m.admin_level,
              m.matched_method,
              m.distance_m,
              m.match_quality,
              m.city,
              m.province,
              m.country
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

        logger.info(`  ✅ 批次 ${batchNum} 完成: ${batchSuccess} 条成功匹配 (${rate} 条/秒)`);

        // 延迟以避免数据库过载
        if (processed < total) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        logger.error(`  ❌ 批次 ${batchNum} 处理失败:`, error.message);
        failCount += batchSize;
        processed += batchSize;
      }
    }

    logger.info('\n🎉 OSM匹配数据填充完成！');
    logger.info(`📊 处理统计: 成功 ${successCount.toLocaleString()} 条, 失败 ${failCount.toLocaleString()} 条`);

    // 统计匹配质量分布
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

    logger.info('\n📊 匹配质量统计:');
    qualityStats.rows.forEach(row => {
      const bar = '█'.repeat(Math.round(row.percentage / 2));
      logger.info(`  ${row.match_quality.padEnd(10)}: ${row.count.toString().padStart(8)} (${row.percentage}%) ${bar}`);
    });

    // 统计城市分布
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

    logger.info('\n🏙️ Top 10 城市（像素数量）:');
    cityStats.rows.forEach((row, index) => {
      logger.info(`  ${(index + 1).toString().padStart(2)}. ${row.city} (${row.province}): ${row.count.toLocaleString()} 像素`);
    });

    // 统计数据源分布
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

    logger.info('\n📊 数据源统计:');
    sourceStats.rows.forEach(row => {
      logger.info(`  ${row.match_source}: ${row.count.toLocaleString()} (${row.percentage}%)`);
    });

    process.exit(0);

  } catch (error) {
    logger.error('❌ 填充OSM匹配数据失败:', error);
    process.exit(1);
  }
}

// 运行脚本
fillOSMMatchData();
