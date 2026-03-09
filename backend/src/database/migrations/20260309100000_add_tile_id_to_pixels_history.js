/**
 * Add tile_id to pixels_history table
 * Task: #31 - Week 1 数据层改造
 *
 * 添加 tile_id 字段用于 3D 像素塔聚合
 * - 使用 Web Mercator Tile 计算（Zoom 18）
 * - 生成列自动计算，不占用存储空间
 * - 添加性能优化索引
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = async function(knex) {
  console.log('🏗️  开始添加 tile_id 到 pixels_history 表...');

  try {
    // 检查表是否存在
    const tableExists = await knex.schema.hasTable('pixels_history');
    if (!tableExists) {
      console.log('⚠️  pixels_history 表不存在，跳过迁移');
      return;
    }

    // 检查 tile_id 列是否已存在
    const hasColumn = await knex.schema.hasColumn('pixels_history', 'tile_id');
    if (hasColumn) {
      console.log('✅ tile_id 列已存在，跳过创建');
      return;
    }

    // 1. 创建 IMMUTABLE 函数来计算 tile_id
    console.log('📐 创建 calculate_tile_id() 函数...');
    await knex.raw(`
      CREATE OR REPLACE FUNCTION calculate_tile_id(lat DECIMAL, lng DECIMAL, zoom INTEGER DEFAULT 18)
      RETURNS VARCHAR(20)
      IMMUTABLE
      LANGUAGE plpgsql
      AS $$
      DECLARE
        tile_x INTEGER;
        tile_y INTEGER;
      BEGIN
        -- Web Mercator Tile Calculation (Zoom 18 for city-level precision)
        tile_x := FLOOR((lng + 180.0) / 360.0 * POWER(2, zoom));
        tile_y := FLOOR(
          (1.0 - LN(TAN(RADIANS(lat)) + 1.0 / COS(RADIANS(lat))) / PI())
          / 2.0 * POWER(2, zoom)
        );

        RETURN CONCAT(zoom, '/', tile_x, '/', tile_y);
      END;
      $$;
    `);
    console.log('✅ calculate_tile_id() 函数创建成功');

    // 2. 添加 tile_id 生成列（使用 immutable 函数）
    console.log('🔧 添加 tile_id 生成列...');
    await knex.raw(`
      ALTER TABLE pixels_history
      ADD COLUMN tile_id VARCHAR(20) GENERATED ALWAYS AS (
        calculate_tile_id(latitude, longitude, 18)
      ) STORED
    `);

    console.log('✅ tile_id 列创建成功');

    // 创建索引用于快速查询
    console.log('📊 创建 tile_id 索引...');

    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_history_tile_id
      ON pixels_history(tile_id, history_date)
    `);

    console.log('✅ idx_pixels_history_tile_id 索引创建成功');

    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_history_tile_time
      ON pixels_history(tile_id, created_at)
    `);

    console.log('✅ idx_pixels_history_tile_time 索引创建成功');

    console.log('🎉 tile_id 迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  }
};

/**
 * Rollback migration
 */
exports.down = async function(knex) {
  console.log('🔙 回滚 tile_id 迁移...');

  try {
    // 删除索引
    await knex.raw('DROP INDEX IF EXISTS idx_pixels_history_tile_time');
    await knex.raw('DROP INDEX IF EXISTS idx_pixels_history_tile_id');

    // 删除列（生成列可以直接删除）
    await knex.schema.table('pixels_history', (table) => {
      table.dropColumn('tile_id');
    });

    console.log('✅ tile_id 回滚完成');

  } catch (error) {
    console.error('❌ 回滚失败:', error);
    throw error;
  }
};
