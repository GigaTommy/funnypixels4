/**
 * Create user_tower_floors index table
 * Task: #33 - Week 1 数据层改造
 *
 * 用于快速定位用户在哪些塔有贡献
 * - 实现"我的塔"功能
 * - 自动定位到用户楼层
 * - 预计算贡献度
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = async function(knex) {
  console.log('🏗️  创建 user_tower_floors 索引表...');

  try {
    // 检查表是否已存在
    const tableExists = await knex.schema.hasTable('user_tower_floors');
    if (tableExists) {
      console.log('✅ user_tower_floors 表已存在，跳过创建');
      return;
    }

    // 创建表
    await knex.schema.createTable('user_tower_floors', (table) => {
      // 主键
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));

      // 外键
      table.uuid('user_id').notNullable()
        .references('id').inTable('users').onDelete('CASCADE')
        .comment('用户ID');
      table.string('tile_id', 20).notNullable()
        .references('tile_id').inTable('pixel_towers').onDelete('CASCADE')
        .comment('塔ID');

      // 统计信息
      table.integer('floor_count').defaultTo(0).notNullable()
        .comment('用户在该塔的楼层数');
      table.decimal('contribution_pct', 5, 2)
        .comment('贡献占比（百分比）');

      // 楼层范围
      table.integer('first_floor_index')
        .comment('第一层楼层号');
      table.integer('last_floor_index')
        .comment('最后一层楼层号');

      // 时间戳
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 唯一约束
      table.unique(['user_id', 'tile_id']);

      // 表注释
      table.comment('用户塔楼层索引（快速定位用户贡献）');
    });

    console.log('✅ user_tower_floors 表创建成功');

    // 创建索引
    console.log('📊 创建索引...');

    await knex.raw(`
      CREATE INDEX idx_user_floors_user ON user_tower_floors(user_id)
    `);
    console.log('✅ idx_user_floors_user 索引创建成功');

    await knex.raw(`
      CREATE INDEX idx_user_floors_contribution ON user_tower_floors(contribution_pct DESC)
    `);
    console.log('✅ idx_user_floors_contribution 索引创建成功');

    console.log('🎉 user_tower_floors 表创建完成！');

  } catch (error) {
    console.error('❌ 创建失败:', error);
    throw error;
  }
};

/**
 * Rollback migration
 */
exports.down = async function(knex) {
  console.log('🔙 删除 user_tower_floors 表...');

  try {
    await knex.schema.dropTableIfExists('user_tower_floors');
    console.log('✅ user_tower_floors 表删除成功');
  } catch (error) {
    console.error('❌ 删除失败:', error);
    throw error;
  }
};
