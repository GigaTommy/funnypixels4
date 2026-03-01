/**
 * 瓦片优化索引迁移
 * 添加瓦片渲染和性能优化相关的数据库索引
 */

exports.up = async function(knex) {
  console.log('🚀 开始添加瓦片优化索引...');
  
  try {
    // 1. 添加瓦片查询优化索引（移除PostGIS依赖，使用标准B-tree索引）
    console.log('📊 添加瓦片查询优化索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_tile_geom
      ON pixels (longitude, latitude)
    `);
    
    // 2. 添加复合索引优化瓦片查询
    console.log('📊 添加复合索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_lat_lng_created 
      ON pixels (latitude, longitude, created_at DESC)
    `);
    
    // 3. 添加网格ID哈希索引
    console.log('📊 添加网格ID哈希索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_grid_id_hash 
      ON pixels USING HASH (grid_id)
    `);
    
    // 4. 添加用户活动索引
    console.log('📊 添加用户活动索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_user_activity 
      ON pixels (user_id, created_at DESC, pixel_type)
    `);
    
    // 5. 添加瓦片查询优化索引（按时间过滤）
    console.log('📊 添加时间过滤索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_tile_query 
      ON pixels (latitude, longitude, created_at DESC)
    `);
    
    // 6. 添加像素类型索引
    console.log('📊 添加像素类型索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_type_created 
      ON pixels (pixel_type, created_at DESC)
    `);
    
    // 7. 添加空间范围查询索引（使用标准B-tree索引代替PostGIS）
    console.log('📊 添加空间范围查询索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_spatial_range
      ON pixels (longitude, latitude, created_at)
    `);
    
    // 8. 添加瓦片统计索引
    console.log('📊 添加瓦片统计索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_tile_stats 
      ON pixels (latitude, longitude, user_id, created_at)
    `);
    
    // 9. 添加像素历史表索引
    console.log('📊 添加像素历史表索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_history_partition 
      ON pixels_history (history_date, user_id)
    `);
    
    // 10. 添加像素历史空间索引（使用标准B-tree索引代替PostGIS）
    console.log('📊 添加像素历史空间索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_history_geom
      ON pixels_history (longitude, latitude, history_date)
    `);
    
    console.log('✅ 瓦片优化索引添加完成');
    
  } catch (error) {
    console.error('❌ 添加瓦片优化索引失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  console.log('🔄 开始回滚瓦片优化索引...');
  
  try {
    // 删除所有添加的索引
    const indexes = [
      'idx_pixels_tile_geom',
      'idx_pixels_lat_lng_created',
      'idx_pixels_grid_id_hash',
      'idx_pixels_user_activity',
      'idx_pixels_tile_query',
      'idx_pixels_type_created',
      'idx_pixels_spatial_range',
      'idx_pixels_tile_stats',
      'idx_pixels_history_partition',
      'idx_pixels_history_geom'
    ];
    
    for (const indexName of indexes) {
      try {
        await knex.raw(`DROP INDEX IF EXISTS ${indexName}`);
        console.log(`✅ 删除索引: ${indexName}`);
      } catch (error) {
        console.warn(`⚠️ 删除索引失败: ${indexName}`, error.message);
      }
    }
    
    console.log('✅ 瓦片优化索引回滚完成');
    
  } catch (error) {
    console.error('❌ 回滚瓦片优化索引失败:', error);
    throw error;
  }
};
