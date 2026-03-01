/**
 * 创建战果分享记录表
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  console.log('  📝 检查battle_results表...');

  // 检查表是否已存在
  const tableExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'battle_results'
    );
  `);

  if (!tableExists.rows[0].exists) {
    await knex.schema.createTable('battle_results', function(table) {
      table.increments('id').primary();
      table.uuid('user_id').notNullable();
      table.string('username', 100).notNullable();
      table.string('display_name', 100).nullable();
      table.string('avatar', 500).nullable();

      // 联盟信息
      table.string('alliance_name', 100).nullable();
      table.string('alliance_flag', 10).nullable();
      table.string('alliance_color', 20).nullable();

      // 战果统计
      table.integer('session_pixels').notNullable().defaultTo(0);
      table.integer('total_pixels').notNullable().defaultTo(0);
      table.integer('current_pixels').notNullable().defaultTo(0);
      table.integer('draw_time').notNullable().defaultTo(0); // 绘制时长（秒）

      // 地图数据
      table.decimal('center_lat', 10, 8).nullable();
      table.decimal('center_lng', 11, 8).nullable();
      table.integer('zoom_level').nullable();
      table.decimal('bounds_north', 10, 8).nullable();
      table.decimal('bounds_south', 10, 8).nullable();
      table.decimal('bounds_east', 11, 8).nullable();
      table.decimal('bounds_west', 11, 8).nullable();

      // 轨迹数据（JSON格式）
      table.text('track_points').nullable(); // JSON数组存储GPS轨迹点

      // 分享图片
      table.string('image_url', 1000).nullable(); // 生成的战果图URL
      table.string('image_path', 500).nullable(); // 图片文件路径

      // 分享记录
      table.boolean('is_shared').defaultTo(false); // 是否已分享
      table.timestamp('shared_at').nullable(); // 分享时间
      table.text('shared_platforms').nullable(); // JSON数组存储分享的平台

      // 会话信息
      table.timestamp('session_start').nullable(); // 绘制会话开始时间
      table.timestamp('session_end').nullable(); // 绘制会话结束时间
      table.string('session_id', 100).nullable(); // 会话唯一标识

      // 元数据
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 索引
      table.index(['user_id']);
      table.index(['created_at']);
      table.index(['is_shared']);
      table.index(['session_start']);
      table.index(['session_id']);
    });

    // 单独添加外键约束（使用IF NOT EXISTS）
    try {
      await knex.raw(`
        ALTER TABLE battle_results
        ADD CONSTRAINT IF NOT EXISTS battle_results_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      `);
      console.log('  ✅ 成功创建battle_results表');
    } catch (error) {
      console.log('  ⚠️ 外键约束添加失败（可能已存在）:', error.message);
    }
  } else {
    console.log('  ℹ️  battle_results表已存在，跳过迁移');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('battle_results');
};