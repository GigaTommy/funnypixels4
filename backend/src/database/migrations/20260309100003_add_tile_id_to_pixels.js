/**
 * Add tile_id to pixels table
 * Task: #31 补充 - 为 pixels 表添加 tile_id（数据一致性）
 *
 * 与 pixels_history 保持一致
 * - 使用相同的 Web Mercator Tile 计算
 * - 生成列自动计算
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = async function(knex) {
  console.log('🏗️  添加 tile_id 到 pixels 表...');

  try {
    // 检查表是否存在
    const tableExists = await knex.schema.hasTable('pixels');
    if (!tableExists) {
      console.log('⚠️  pixels 表不存在，跳过迁移');
      return;
    }

    // 检查 tile_id 列是否已存在
    const hasColumn = await knex.schema.hasColumn('pixels', 'tile_id');
    if (hasColumn) {
      console.log('✅ tile_id 列已存在，跳过创建');
      return;
    }

    // 添加 tile_id 生成列（使用现有的 calculate_tile_id() 函数）
    await knex.raw(`
      ALTER TABLE pixels
      ADD COLUMN tile_id VARCHAR(20) GENERATED ALWAYS AS (
        calculate_tile_id(latitude, longitude, 18)
      ) STORED
    `);

    console.log('✅ tile_id 列创建成功');

    // 创建索引
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_pixels_tile_id ON pixels(tile_id)
    `);

    console.log('✅ idx_pixels_tile_id 索引创建成功');

    console.log('🎉 pixels 表 tile_id 迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  }
};

/**
 * Rollback migration
 */
exports.down = async function(knex) {
  console.log('🔙 回滚 pixels 表 tile_id 迁移...');

  try {
    await knex.raw('DROP INDEX IF EXISTS idx_pixels_tile_id');
    await knex.schema.table('pixels', (table) => {
      table.dropColumn('tile_id');
    });
    console.log('✅ 回滚完成');
  } catch (error) {
    console.error('❌ 回滚失败:', error);
    throw error;
  }
};
