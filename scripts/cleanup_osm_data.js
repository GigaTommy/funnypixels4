const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'funnypixels_postgres',
  password: 'password',
  port: 5432,
});

async function executeCleanup() {
  console.log('🚀 开始执行OpenStreetMap数据清理计划...\n');

  try {
    // 首先检查当前OSM表状态
    console.log('📊 检查当前OSM表状态...');
    const osmTablesQuery = `
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_name LIKE 'planet_osm%'
      AND table_schema = 'public'
      ORDER BY table_name;
    `;

    const osmTablesResult = await pool.query(osmTablesQuery);
    console.log('找到的OSM表:');
    osmTablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name} (${row.column_count} columns)`);
    });

    if (osmTablesResult.rows.length === 0) {
      console.log('✅ 没有找到OSM表，可能已经被清理过了');
      return;
    }

    console.log('\n🔥 开始清理OSM数据表...\n');

    // 阶段一：删除核心OSM数据表 (按依赖关系顺序)
    console.log('📋 阶段一：删除核心OSM数据表');
    const coreTables = [
      'planet_osm_rels',
      'planet_osm_roads',
      'planet_osm_polygon',
      'planet_osm_line',
      'planet_osm_ways',
      'planet_osm_point',
      'planet_osm_nodes'
    ];

    for (const tableName of coreTables) {
      try {
        console.log(`  删除表: ${tableName}`);
        await pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
        console.log(`  ✅ 成功删除: ${tableName}`);
      } catch (error) {
        console.log(`  ❌ 删除失败: ${tableName} - ${error.message}`);
      }
    }

    // 阶段二：清理PostGIS相关表
    console.log('\n📋 阶段二：清理PostGIS相关表');
    const postgisTables = ['osm2pgsql_properties', 'postgis_match_performance'];

    for (const tableName of postgisTables) {
      try {
        console.log(`  删除表: ${tableName}`);
        await pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
        console.log(`  ✅ 成功删除: ${tableName}`);
      } catch (error) {
        console.log(`  ❌ 删除失败: ${tableName} - ${error.message}`);
      }
    }

    // 阶段三：清理无用缓存表
    console.log('\n📋 阶段三：清理无用缓存表');
    const cacheTables = ['geography_columns', 'pixel_location_cache'];

    for (const tableName of cacheTables) {
      try {
        console.log(`  删除表: ${tableName}`);
        await pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
        console.log(`  ✅ 成功删除: ${tableName}`);
      } catch (error) {
        console.log(`  ❌ 删除失败: ${tableName} - ${error.message}`);
      }
    }

    // 阶段四：清理geometry_columns中的OSM记录
    console.log('\n📋 阶段四：清理geometry_columns中的OSM记录');
    try {
      const deleteResult = await pool.query(`
        DELETE FROM geometry_columns
        WHERE f_table_name LIKE 'planet_osm%'
      `);
      console.log(`  ✅ 清理了 ${deleteResult.rowCount} 条geometry_columns记录`);
    } catch (error) {
      console.log(`  ❌ 清理geometry_columns失败: ${error.message}`);
    }

    // 阶段五：清理备份表
    console.log('\n📋 阶段五：清理备份表');
    try {
      const backupResult = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name LIKE 'regions_backup_%'
        AND table_schema = 'public'
      `);

      for (const row of backupResult.rows) {
        const tableName = row.table_name;
        try {
          console.log(`  删除备份表: ${tableName}`);
          await pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
          console.log(`  ✅ 成功删除: ${tableName}`);
        } catch (error) {
          console.log(`  ❌ 删除失败: ${tableName} - ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`  ❌ 查找备份表失败: ${error.message}`);
    }

    // 验证清理结果
    console.log('\n📋 验证清理结果');
    const remainingOSMTables = await pool.query(osmTablesQuery);

    if (remainingOSMTables.rows.length === 0) {
      console.log('✅ 所有OSM表已成功清理！');
    } else {
      console.log('⚠️ 仍有OSM表未清理:');
      remainingOSMTables.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // 检查保留的重要表
    console.log('\n📋 检查保留的重要表');
    const importantTables = ['spatial_ref_sys', 'geometry_columns', 'region_codes', 'tianditu_regions', 'regions'];

    for (const tableName of importantTables) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = '${tableName}'
            AND table_schema = 'public'
          );
        `);
        const exists = result.rows[0].exists;
        console.log(`  ${tableName}: ${exists ? '✅ 保留' : '❌ 不存在'}`);
      } catch (error) {
        console.log(`  ${tableName}: ❌ 检查失败 - ${error.message}`);
      }
    }

    console.log('\n🎉 OpenStreetMap数据清理完成！');

  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error);
  } finally {
    await pool.end();
  }
}

// 执行清理
executeCleanup();