/**
 * 增强regions表结构，支持行政区划边界数据
 * 添加PostGIS支持，实现地理空间计算
 * @param {Knex} knex
 */
exports.up = async function(knex) {
  console.log('🗺️ 开始增强regions表结构...');
  
  try {
    // 1. 跳过PostGIS扩展（当前环境不可用）
    console.log('  ⚠️ PostGIS扩展不可用，将使用JSON存储边界数据');
    console.log('  💡 如需使用PostGIS功能，请手动安装PostGIS扩展');

    // 2. 检查regions表是否存在以及是否已有新结构
    const hasRegionsTable = await knex.schema.hasTable('regions');
    let needsRecreation = false;

    if (hasRegionsTable) {
      // 检查是否已有新结构的字段（如code字段）
      const columns = await knex.raw(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'regions'
        AND column_name = 'code'
      `);

      if (columns.rows.length === 0) {
        // 旧表结构，需要重建
        needsRecreation = true;
        console.log('  💾 备份现有regions表数据...');
        try {
          await knex.raw(`
            CREATE TEMP TABLE regions_backup AS
            SELECT * FROM regions;
          `);
        } catch (error) {
          console.log('  ⚠️ 无法备份现有数据，将直接重建表');
        }

        // 删除现有regions表
        console.log('  🗑️ 删除现有regions表...');
        await knex.schema.dropTableIfExists('regions');
      } else {
        console.log('  ✅ regions表已是新结构，跳过重建');
      }
    }

    // 3. 创建新的regions表（如果需要重建或表不存在）
    if (needsRecreation || !hasRegionsTable) {
      console.log('  🏗️ 创建新的regions表...');
      await knex.schema.createTable('regions', function(table) {
      table.bigIncrements('id').primary();
      table.string('code', 20).notNullable().unique().comment('行政区划编码 GB/T 2260');
      table.string('name', 200).notNullable().comment('行政区名称');
      table.string('level', 20).notNullable().comment('行政区级别: country/province/city');
      table.string('parent_code', 20).nullable().comment('上级行政区划编码');
      table.json('boundary').nullable().comment('GeoJSON边界数据');
      table.decimal('center_lat', 10, 8).nullable().comment('中心点纬度');
      table.decimal('center_lng', 11, 8).nullable().comment('中心点经度');
      table.integer('population').nullable().comment('人口数量');
      table.string('timezone', 50).nullable().comment('时区');
      table.boolean('is_active').defaultTo(true).comment('是否启用');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // 索引
      table.index(['code']);
      table.index(['level']);
      table.index(['parent_code']);
      table.index(['is_active']);
      // PostGIS空间索引（如果PostGIS可用）
      // table.index(['geometry'], 'gist'); // PostGIS空间索引（暂时禁用，需要PostGIS扩展）
    });

    // 如果有PostGIS，添加geometry列和索引（单独处理以避免在没有PostGIS时报错）
    // 注意：需要在regions表创建成功后，在下一次迁移中处理，以避免事务冲突
    // const hasPostGIS = await knex.raw('SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = \'postgis\')');
    // if (hasPostGIS.rows[0].exists) {
    //   await knex.raw('ALTER TABLE regions ADD COLUMN IF NOT EXISTS geometry geometry(POLYGON,4326)');
    //   await knex.raw('CREATE INDEX IF NOT EXISTS idx_regions_geometry ON regions USING gist(geometry)');
    // }
    }

    // 4. 创建region_codes表
    console.log('  🏗️ 创建region_codes表...');
    await knex.schema.createTableIfNotExists('region_codes', function(table) {
      table.bigIncrements('id').primary();
      table.string('code', 20).notNullable().unique().comment('行政区划编码');
      table.string('name', 200).notNullable().comment('行政区名称');
      table.string('level', 20).notNullable().comment('行政区级别');
      table.string('parent_code', 20).nullable().comment('上级编码');
      table.string('full_name', 500).nullable().comment('完整名称路径');
      table.boolean('is_active').defaultTo(true).comment('是否启用');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // 索引
      table.index(['code']);
      table.index(['level']);
      table.index(['parent_code']);
      table.index(['is_active']);
    });

    // 5. 创建pixel_location_cache表
    console.log('  🏗️ 创建pixel_location_cache表...');
    await knex.schema.createTableIfNotExists('pixel_location_cache', function(table) {
      table.bigIncrements('id').primary();
      table.bigInteger('pixel_id').notNullable().comment('像素ID');
      table.string('province_code', 20).nullable().comment('省份编码');
      table.string('city_code', 20).nullable().comment('城市编码');
      table.string('province_name', 200).nullable().comment('省份名称');
      table.string('city_name', 200).nullable().comment('城市名称');
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 索引
      table.index(['pixel_id']);
      table.index(['province_code']);
      table.index(['city_code']);
      table.index(['updated_at']);

      // 唯一约束
      table.unique(['pixel_id']);
    });

    // 6. 创建leaderboard_stats表（如果不存在）
    console.log('  🏗️ 创建leaderboard_stats表...');
    const hasLeaderboardStats = await knex.schema.hasTable('leaderboard_stats');
    if (!hasLeaderboardStats) {
      await knex.schema.createTableIfNotExists('leaderboard_stats', function(table) {
        table.bigIncrements('id').primary();
        table.string('region_level', 20).notNullable().comment('地区级别: country/province/city');
        table.string('region_code', 20).notNullable().comment('地区编码');
        table.string('region_name', 200).notNullable().comment('地区名称');
        table.bigInteger('pixel_count').defaultTo(0).comment('像素数量');
        table.bigInteger('user_count').defaultTo(0).comment('用户数量');
        table.string('period', 20).notNullable().comment('统计周期: daily/weekly/monthly/yearly');
        table.timestamp('period_start').notNullable().comment('周期开始时间');
        table.timestamp('period_end').notNullable().comment('周期结束时间');
        table.timestamp('updated_at').defaultTo(knex.fn.now());
      
        // 索引
        table.index(['region_level', 'region_code']);
        table.index(['period', 'period_start']);
        table.index(['pixel_count']);
        table.index(['user_count']);
        table.index(['updated_at']);
      
        // 唯一约束
        table.unique(['region_level', 'region_code', 'period', 'period_start']);
      });
    } else {
      console.log('  ✅ leaderboard_stats表已存在，跳过创建');
    }

    // 7. 恢复备份数据（如果有的话）
    console.log('  🔄 恢复备份数据...');
    try {
      const backupCount = await knex.raw('SELECT COUNT(*) as count FROM regions_backup').then(result => result.rows[0].count);
      if (backupCount > 0) {
        // 为备份数据生成默认的code值，避免非空约束错误
        await knex.raw(`
          INSERT INTO regions (code, name, level, center_lat, center_lng, population, timezone, created_at)
          SELECT 
            COALESCE(code, 'REGION_' || id::text) as code,
            name, 
            'city' as level,
            latitude as center_lat, 
            longitude as center_lng, 
            population, 
            timezone, 
            created_at
          FROM regions_backup;
        `);
        console.log(`  ✅ 恢复了 ${backupCount} 条地区数据`);
      }
    } catch (error) {
      console.log('  ⚠️ 恢复备份数据时出错，跳过数据恢复:', error.message);
    }
    
    console.log('✅ regions表结构增强完成');
    
  } catch (error) {
    console.error('❌ 增强regions表结构失败:', error);
    throw error;
  }
};

/**
 * 回滚迁移
 * @param {Knex} knex
 */
exports.down = async function(knex) {
  console.log('🔄 开始回滚regions表结构...');
  
  try {
    // 删除新创建的表
    await knex.schema.dropTableIfExists('leaderboard_stats');
    await knex.schema.dropTableIfExists('pixel_location_cache');
    await knex.schema.dropTableIfExists('region_codes');
    await knex.schema.dropTableIfExists('regions');
    
    // 恢复原始regions表结构
    await knex.schema.createTableIfNotExists('regions', function(table) {
      table.increments('id').primary();
      table.string('name', 200).notNullable();
      table.string('country', 100);
      table.decimal('latitude', 10, 8).notNullable();
      table.decimal('longitude', 11, 8).notNullable();
      table.integer('population');
      table.string('timezone', 50);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
    
    console.log('✅ regions表结构回滚完成');
    
  } catch (error) {
    console.error('❌ 回滚regions表结构失败:', error);
    throw error;
  }
};
