const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'funnypixels_postgres',
  password: 'password',
  port: 5432,
});

async function reclaimDiskSpace() {
  console.log('🔧 开始回收磁盘空间...\n');

  try {
    // 1. 显示操作前的数据库大小
    console.log('📊 操作前数据库大小:');
    const beforeSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size('funnypixels_postgres')) AS total_size,
             pg_database_size('funnypixels_postgres') AS total_size_bytes
    `);
    console.log(`  总大小: ${beforeSize.rows[0].total_size}`);

    // 2. 检查数据库活跃连接
    console.log('\n🔍 检查数据库活跃连接:');
    const connectionsResult = await pool.query(`
      SELECT pid, usename, application_name, state, query
      FROM pg_stat_activity
      WHERE datname = 'funnypixels_postgres'
      AND state != 'idle'
    `);

    if (connectionsResult.rows.length > 0) {
      console.log('  ⚠️ 发现活跃连接，建议先停止应用:');
      connectionsResult.rows.forEach(row => {
        console.log(`    PID ${row.pid}: ${row.application_name} - ${row.state}`);
      });
      console.log('  💡 提示：继续操作可能会影响性能');
    } else {
      console.log('  ✅ 没有活跃连接，可以安全执行清理');
    }

    // 3. 执行标准VACUUM (清理dead tuples)
    console.log('\n🧹 执行标准VACUUM清理dead tuples...');
    const vacuumResult = await pool.query('VACUUM');
    console.log('  ✅ VACUUM完成');

    // 4. 对最大的表执行VACUUM FULL (需要独占锁)
    console.log('\n🔧 对大表执行VACUUM FULL (可能需要较长时间)...');

    const largeTables = [
      'region_codes',
      'pixels',
      'pixels_history_202510',
      'custom_flag_orders',
      'pixels_history_202509',
      'tianditu_regions'
    ];

    for (const tableName of largeTables) {
      try {
        console.log(`  正在处理表: ${tableName}`);

        // 获取表操作前大小
        const beforeTableSize = await pool.query(`
          SELECT pg_size_pretty(pg_total_relation_size('${tableName}')) AS size
        `);

        console.log(`    操作前大小: ${beforeTableSize.rows[0].size}`);

        // 执行VACUUM FULL
        await pool.query(`VACUUM FULL ${tableName}`);

        // 获取表操作后大小
        const afterTableSize = await pool.query(`
          SELECT pg_size_pretty(pg_total_relation_size('${tableName}')) AS size
        `);

        console.log(`    操作后大小: ${afterTableSize.rows[0].size}`);
        console.log(`    ✅ ${tableName} 完成`);

      } catch (error) {
        console.log(`    ❌ ${tableName} 处理失败: ${error.message}`);
      }
    }

    // 5. 重建索引以回收索引空间
    console.log('\n🔧 重建大表的索引...');
    const indexTables = ['region_codes', 'pixels', 'pixels_history_202510'];

    for (const tableName of indexTables) {
      try {
        console.log(`  重建 ${tableName} 的索引...`);

        // 获取表的索引
        const indexesResult = await pool.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = '${tableName}'
          AND schemaname = 'public'
        `);

        for (const indexRow of indexesResult.rows) {
          const indexName = indexRow.indexname;
          try {
            console.log(`    重建索引: ${indexName}`);
            await pool.query(`REINDEX INDEX ${indexName}`);
          } catch (error) {
            console.log(`    ❌ 重建索引 ${indexName} 失败: ${error.message}`);
          }
        }

        console.log(`    ✅ ${tableName} 索引重建完成`);

      } catch (error) {
        console.log(`  ❌ ${tableName} 索引重建失败: ${error.message}`);
      }
    }

    // 6. 清理未使用的大对象
    console.log('\n🗑️ 清理未使用的大对象...');
    try {
      const vacuumLoResult = await pool.query('VACUUM FULL pg_largeobject');
      console.log('  ✅ 大对象清理完成');
    } catch (error) {
      console.log(`  ❌ 大对象清理失败: ${error.message}`);
    }

    // 7. 更新表统计信息
    console.log('\n📊 更新表统计信息...');
    try {
      await pool.query('ANALYZE');
      console.log('  ✅ 统计信息更新完成');
    } catch (error) {
      console.log(`  ❌ 统计信息更新失败: ${error.message}`);
    }

    // 8. 显示操作后的数据库大小
    console.log('\n📊 操作后数据库大小:');
    const afterSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size('funnypixels_postgres')) AS total_size,
             pg_database_size('funnypixels_postgres') AS total_size_bytes
    `);

    const beforeBytes = beforeSize.rows[0].total_size_bytes;
    const afterBytes = afterSize.rows[0].total_size_bytes;
    const savedBytes = beforeBytes - afterBytes;
    const savedPercent = ((savedBytes / beforeBytes) * 100).toFixed(2);

    console.log(`  操作前: ${beforeSize.rows[0].total_size}`);
    console.log(`  操作后: ${afterSize.rows[0].total_size}`);
    console.log(`  节省空间: ${savedBytes > 0 ? '✅' : '⚠️'} ${Math.abs(savedBytes).toLocaleString()} bytes (${savedPercent}%)`);

    if (savedBytes > 0) {
      console.log('\n🎉 磁盘空间回收成功！');
    } else {
      console.log('\n⚠️ 磁盘空间没有明显变化，可能的原因：');
      console.log('  1. 表已经相当紧凑，没有明显的膨胀');
      console.log('  2. 需要重启PostgreSQL服务以释放文件系统层面的空间');
      console.log('  3. 存在其他占用空间的因素');
    }

    // 9. 提供后续建议
    console.log('\n💡 后续建议:');
    console.log('  1. 定期执行VACUUM (特别是针对频繁更新的表)');
    console.log('  2. 监控表膨胀情况，必要时执行VACUUM FULL');
    console.log('  3. 考虑设置autovacuum参数优化自动清理');
    console.log('  4. 如果空间仍紧张，考虑清理历史数据表');
    console.log('  5. 重启PostgreSQL服务以确保文件系统层面空间释放');

  } catch (error) {
    console.error('❌ 空间回收过程中发生错误:', error);
  } finally {
    await pool.end();
  }
}

// 执行空间回收
reclaimDiskSpace();