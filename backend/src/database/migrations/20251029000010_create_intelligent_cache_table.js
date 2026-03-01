/**
 * 创建智能缓存表 (L3缓存)
 * 支持智能分层缓存服务的数据库缓存层
 */

exports.up = async function(knex) {
  try {
    console.log('🧠 创建智能缓存表...');

    // 创建缓存表
    await knex.raw(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    // 创建索引
    console.log('📝 创建缓存表索引...');

    // 主键索引 (已由SERIAL创建)

    // 唯一键索引
    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_entries_key
      ON cache_entries (key)
    `);

    // 过期时间索引 (用于清理过期缓存)
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at
      ON cache_entries (expires_at)
    `);

    // 复合索引 (过期时间 + 创建时间，用于查询优化)
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_created
      ON cache_entries (expires_at, created_at)
    `);

    // 创建分区表 (可选，用于大数据量场景)
    // 按过期时间范围分区，提升查询性能
    const enablePartitioning = process.env.ENABLE_CACHE_PARTITIONING === 'true';
    if (enablePartitioning) {
      console.log('📂 创建缓存表分区...');

      // 创建分区表
      await knex.raw(`
        CREATE TABLE IF NOT EXISTS cache_entries_partitioned (
          LIKE cache_entries INCLUDING ALL
        ) PARTITION BY RANGE (expires_at)
      `);

      // 创建按月的分区
      const currentMonth = new Date();
      for (let i = 0; i <= 3; i++) {
        const partitionDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i, 1);
        const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i + 1, 1);

        const partitionName = `cache_entries_${partitionDate.getFullYear()}_${String(partitionDate.getMonth() + 1).padStart(2, '0')}`;

        await knex.raw(`
          CREATE TABLE IF NOT EXISTS ${partitionName}
          PARTITION OF cache_entries_partitioned
          FOR VALUES FROM ('${partitionDate.toISOString()}') TO ('${nextMonth.toISOString()}')
        `);
      }
    }

    // 创建缓存统计视图
    console.log('📊 创建缓存统计视图...');
    await knex.raw(`
      CREATE OR REPLACE VIEW cache_stats AS
      SELECT
        COUNT(*) as total_entries,
        COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as valid_entries,
        COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_entries,
        AVG(EXTRACT(EPOCH FROM (expires_at - NOW()))) as avg_ttl_seconds,
        MAX(created_at) as latest_entry,
        MIN(created_at) as earliest_entry
      FROM cache_entries
    `);

    // 创建缓存使用情况统计函数
    await knex.raw(`
      CREATE OR REPLACE FUNCTION get_cache_usage_stats()
      RETURNS TABLE(
        total_entries BIGINT,
        valid_entries BIGINT,
        expired_entries BIGINT,
        hit_rate DECIMAL,
        avg_size_kb DECIMAL,
        oldest_entry TIMESTAMP WITH TIME ZONE,
        newest_entry TIMESTAMP WITH TIME ZONE
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT
          COUNT(*) as total_entries,
          COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as valid_entries,
          COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_entries,
          -- 注意：命中率需要从应用层统计，这里返回NULL
          NULL::DECIMAL as hit_rate,
          -- 平均缓存大小 (KB)
          ROUND(AVG(LENGTH(value::text)) / 1024.0, 2) as avg_size_kb,
          MIN(created_at) as oldest_entry,
          MAX(created_at) as newest_entry
        FROM cache_entries;
      END;
      $$ LANGUAGE plpgsql
    `);

    // 创建缓存清理函数
    await knex.raw(`
      CREATE OR REPLACE FUNCTION cleanup_expired_cache()
      RETURNS BIGINT AS $$
      DECLARE
        deleted_count BIGINT;
      BEGIN
        DELETE FROM cache_entries
        WHERE expires_at <= NOW();

        GET DIAGNOSTICS deleted_count = ROW_COUNT;

        RETURN deleted_count;
      END;
      $$ LANGUAGE plpgsql
    `);

    // 创建缓存优化函数 (重建索引和更新统计)
    await knex.raw(`
      CREATE OR REPLACE FUNCTION optimize_cache_table()
      RETURNS TEXT AS $$
      BEGIN
        -- 更新表统计信息
        ANALYZE cache_entries;

        -- 重建索引 (如果需要) - 使用异常处理避免错误
        BEGIN
          REINDEX INDEX CONCURRENTLY idx_cache_entries_key;
        EXCEPTION WHEN OTHERS THEN
          -- 索引不存在或其他错误，忽略
          NULL;
        END;

        BEGIN
          REINDEX INDEX CONCURRENTLY idx_cache_entries_expires_at;
        EXCEPTION WHEN OTHERS THEN
          -- 索引不存在或其他错误，忽略
          NULL;
        END;

        BEGIN
          REINDEX INDEX CONCURRENTLY idx_cache_entries_expires_created;
        EXCEPTION WHEN OTHERS THEN
          -- 索引不存在或其他错误，忽略
          NULL;
        END;

        RETURN 'Cache table optimization completed';
      END;
      $$ LANGUAGE plpgsql
    `);

    // 创建缓存监控函数
    await knex.raw(`
      CREATE OR REPLACE FUNCTION monitor_cache_health()
      RETURNS TABLE(
        metric_name TEXT,
        metric_value TEXT,
        status TEXT,
        recommendation TEXT
      ) AS $$
      BEGIN
        RETURN QUERY

        -- 检查总缓存条目数
        SELECT
          'total_entries'::TEXT,
          COUNT(*)::TEXT,
          CASE
            WHEN COUNT(*) < 1000 THEN 'OK'::TEXT
            WHEN COUNT(*) < 10000 THEN 'WARNING'::TEXT
            ELSE 'CRITICAL'::TEXT
          END,
          CASE
            WHEN COUNT(*) < 1000 THEN 'Cache size is optimal'::TEXT
            WHEN COUNT(*) < 10000 THEN 'Consider cache cleanup'::TEXT
            ELSE 'Cache size is too large, immediate cleanup required'::TEXT
          END
        FROM cache_entries;

        -- 检查过期缓存比例
        RETURN QUERY
        SELECT
          'expired_ratio'::TEXT,
          ROUND(COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2)::TEXT,
          CASE
            WHEN COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) < 10 THEN 'OK'::TEXT
            WHEN COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) < 30 THEN 'WARNING'::TEXT
            ELSE 'CRITICAL'::TEXT
          END,
          CASE
            WHEN COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) < 10 THEN 'Expired cache ratio is optimal'::TEXT
            WHEN COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) < 30 THEN 'Consider running cleanup'::TEXT
            ELSE 'High expired cache ratio, run cleanup immediately'::TEXT
          END
        FROM cache_entries;

        -- 检查缓存表大小
        RETURN QUERY
        SELECT
          'table_size_mb'::TEXT,
          ROUND(pg_total_relation_size('cache_entries') / 1024.0 / 1024.0, 2)::TEXT,
          CASE
            WHEN pg_total_relation_size('cache_entries') / 1024.0 / 1024.0 < 100 THEN 'OK'::TEXT
            WHEN pg_total_relation_size('cache_entries') / 1024.0 / 1024.0 < 500 THEN 'WARNING'::TEXT
            ELSE 'CRITICAL'::TEXT
          END,
          CASE
            WHEN pg_total_relation_size('cache_entries') / 1024.0 / 1024.0 < 100 THEN 'Table size is optimal'::TEXT
            WHEN pg_total_relation_size('cache_entries') / 1024.0 / 1024.0 < 500 THEN 'Consider cache optimization'::TEXT
            ELSE 'Table size is too large, immediate optimization required'::TEXT
          END;

      END;
      $$ LANGUAGE plpgsql
    `);

    // 创建自动清理触发器 (可选)
    const enableAutoCleanup = process.env.ENABLE_CACHE_AUTO_CLEANUP === 'true';
    if (enableAutoCleanup) {
      console.log('🤖 创建自动清理触发器...');

      // 创建清理函数
      await knex.raw(`
        CREATE OR REPLACE FUNCTION auto_cleanup_expired_cache()
        RETURNS TRIGGER AS $$
        BEGIN
          -- 只删除超过24小时的过期缓存
          DELETE FROM cache_entries
          WHERE expires_at <= NOW() - INTERVAL '24 hours';

          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);

      // 创建触发器，每小时执行一次
      await knex.raw(`
        DROP TRIGGER IF EXISTS trigger_auto_cleanup_cache ON cache_entries;
        CREATE TRIGGER trigger_auto_cleanup_cache
        AFTER INSERT ON cache_entries
        FOR EACH STATEMENT
        EXECUTE FUNCTION auto_cleanup_expired_cache()
      `);
    }

    // 设置表权限
    console.log('🔐 设置表权限...');
    await knex.raw(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON cache_entries TO CURRENT_USER
    `);

    // 设置序列权限
    await knex.raw(`
      GRANT USAGE, SELECT ON SEQUENCE cache_entries_id_seq TO CURRENT_USER
    `);

    // 设置视图权限
    await knex.raw(`
      GRANT SELECT ON cache_stats TO CURRENT_USER
    `);

    // 验证表创建
    const tableExists = await knex.raw(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'cache_entries'
      )
    `);

    if (tableExists.rows[0].exists) {
      console.log('✅ 智能缓存表创建成功');

      // 显示表信息
      const tableInfo = await knex.raw(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'cache_entries'
        ORDER BY ordinal_position
      `);

      console.log('📋 表结构:');
      tableInfo.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
      });

      // 显示索引信息
      const indexInfo = await knex.raw(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'cache_entries'
        ORDER BY indexname
      `);

      if (indexInfo.rows.length > 0) {
        console.log('📝 已创建的索引:');
        indexInfo.rows.forEach(idx => {
          console.log(`  - ${idx.indexname}`);
        });
      }

    } else {
      throw new Error('缓存表创建失败');
    }

    console.log('🎉 智能缓存表和辅助对象创建完成！');

  } catch (error) {
    console.error('❌ 创建智能缓存表失败:', error.message);
    throw error;
  }
};

exports.down = async function(knex) {
  try {
    console.log('🔄 回滚智能缓存表...');

    // 删除触发器
    await knex.raw(`DROP TRIGGER IF EXISTS trigger_auto_cleanup_cache ON cache_entries`);

    // 删除函数
    await knex.raw(`DROP FUNCTION IF EXISTS auto_cleanup_expired_cache() CASCADE`);
    await knex.raw(`DROP FUNCTION IF EXISTS cleanup_expired_cache() CASCADE`);
    await knex.raw(`DROP FUNCTION IF EXISTS optimize_cache_table() CASCADE`);
    await knex.raw(`DROP FUNCTION IF EXISTS monitor_cache_health() CASCADE`);
    await knex.raw(`DROP FUNCTION IF EXISTS get_cache_usage_stats() CASCADE`);

    // 删除视图
    await knex.raw(`DROP VIEW IF EXISTS cache_stats`);

    // 删除分区表 (如果存在)
    await knex.raw(`DROP TABLE IF EXISTS cache_entries_partitioned CASCADE`);

    // 删除主表
    await knex.raw(`DROP TABLE IF EXISTS cache_entries CASCADE`);

    console.log('✅ 智能缓存表回滚完成');

  } catch (error) {
    console.error('❌ 回滚智能缓存表失败:', error.message);
    throw error;
  }
};