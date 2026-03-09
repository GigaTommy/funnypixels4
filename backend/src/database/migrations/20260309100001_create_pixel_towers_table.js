/**
 * Create pixel_towers aggregation table
 * Task: #32 - Week 1 数据层改造
 *
 * 用于存储预聚合的像素塔数据
 * - 避免实时统计，提升 3D 渲染性能
 * - 支持视口查询（bbox 索引）
 * - 预计算高度（对数缩放）
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = async function(knex) {
  console.log('🏗️  创建 pixel_towers 聚合表...');

  try {
    // 检查表是否已存在
    const tableExists = await knex.schema.hasTable('pixel_towers');
    if (tableExists) {
      console.log('✅ pixel_towers 表已存在，跳过创建');
      return;
    }

    // 创建表
    await knex.schema.createTable('pixel_towers', (table) => {
      // 主键：tile_id
      table.string('tile_id', 20).primary();

      // 地理位置（瓦片中心坐标）
      table.decimal('lat', 10, 8).notNullable();
      table.decimal('lng', 11, 8).notNullable();

      // 统计数据
      table.integer('pixel_count').defaultTo(0).notNullable()
        .comment('总像素数（楼层数）');
      table.decimal('height', 8, 2).defaultTo(0).notNullable()
        .comment('视觉高度 = log(pixel_count) * 8');
      table.integer('unique_users').defaultTo(0).notNullable()
        .comment('参与玩家数');

      // 时间范围
      table.timestamp('first_pixel_time')
        .comment('最早像素时间');
      table.timestamp('last_pixel_time')
        .comment('最新像素时间');

      // 性能优化：顶楼信息
      table.string('top_color', 7)
        .comment('顶楼颜色（最新像素）');
      table.uuid('top_user_id')
        .comment('顶楼玩家ID');

      // 时间戳
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 表注释
      table.comment('3D 像素塔聚合数据（预计算缓存）');
    });

    console.log('✅ pixel_towers 表创建成功');

    // 创建索引
    console.log('📊 创建索引...');

    // 1. 视口查询索引（bbox）
    await knex.raw(`
      CREATE INDEX idx_towers_bbox ON pixel_towers(lat, lng)
    `);
    console.log('✅ idx_towers_bbox 索引创建成功');

    // 2. 高度排序索引
    await knex.raw(`
      CREATE INDEX idx_towers_height ON pixel_towers(height DESC)
    `);
    console.log('✅ idx_towers_height 索引创建成功');

    // 3. 最新活动时间索引
    await knex.raw(`
      CREATE INDEX idx_towers_last_pixel_time ON pixel_towers(last_pixel_time DESC)
    `);
    console.log('✅ idx_towers_last_pixel_time 索引创建成功');

    console.log('🎉 pixel_towers 表创建完成！');

  } catch (error) {
    console.error('❌ 创建失败:', error);
    throw error;
  }
};

/**
 * Rollback migration
 */
exports.down = async function(knex) {
  console.log('🔙 删除 pixel_towers 表...');

  try {
    await knex.schema.dropTableIfExists('pixel_towers');
    console.log('✅ pixel_towers 表删除成功');
  } catch (error) {
    console.error('❌ 删除失败:', error);
    throw error;
  }
};
