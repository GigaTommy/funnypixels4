/**
 * 漂流瓶 2.0 重新设计迁移
 * - 修改 drift_bottles 表: 新增像素快照、打开计数、沉没状态
 * - 新建 journey_cards 表: 旅途卡片
 * - 新建 user_bottle_quota 表: 用户瓶子配额(绘画赚取)
 * - 修改 drift_bottle_messages 表: 新增站点编号
 * - 删除 drift_bottle_products, user_drift_bottles 表
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. 修改 drift_bottles 表
  await knex.schema.alterTable('drift_bottles', function(table) {
    // 新增列
    table.jsonb('pixel_snapshot').comment('5x5 像素颜色矩阵快照');
    table.float('direction_angle').defaultTo(0).comment('漂流方向角度(0-360)');
    table.integer('open_count').defaultTo(0).comment('已被打开次数(上限5)');
    table.integer('max_openers').defaultTo(5).comment('最大打开人数');
    table.boolean('is_sunk').defaultTo(false).comment('是否已沉没');
    table.timestamp('sunk_at').nullable().comment('沉没时间');

    // 索引
    table.index(['is_sunk', 'is_active']);
  });

  // 删除旧列 (title, image_url) - 使用 raw 以兼容不同数据库
  await knex.schema.alterTable('drift_bottles', function(table) {
    table.dropColumn('title');
    table.dropColumn('image_url');
  });

  // 2. 新建 journey_cards 表
  await knex.schema.createTable('journey_cards', function(table) {
    table.increments('id').primary();
    table.string('bottle_id', 32).notNullable().comment('漂流瓶ID');
    table.uuid('participant_id').notNullable().comment('参与者ID');
    table.enu('participant_role', ['creator', 'opener']).notNullable().comment('参与者角色');
    table.integer('station_number').notNullable().comment('站点编号: 0=创建者, 1-5=打开者');
    table.string('city', 100).comment('站点城市');
    table.string('country', 100).comment('站点国家');
    table.text('message').nullable().comment('留言(50字上限)');
    table.integer('distance_from_prev').defaultTo(0).comment('距上一站距离(米)');
    table.integer('cumulative_distance').defaultTo(0).comment('累计距离(米)');
    table.boolean('is_read').defaultTo(false).comment('是否已读');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');

    table.foreign('bottle_id').references('bottle_id').inTable('drift_bottles').onDelete('CASCADE');
    table.foreign('participant_id').references('id').inTable('users').onDelete('CASCADE');

    table.index(['bottle_id', 'station_number']);
    table.index(['participant_id', 'is_read', 'created_at']);
  });

  // 3. 新建 user_bottle_quota 表
  await knex.schema.createTable('user_bottle_quota', function(table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().unique().comment('用户ID');
    table.integer('available_bottles').defaultTo(0).comment('可用瓶子数');
    table.integer('pixels_since_last_bottle').defaultTo(0).comment('距上次获得瓶子已画像素数');
    table.integer('pixels_per_bottle').defaultTo(200).comment('每个瓶子所需像素数');
    table.integer('max_reserve').defaultTo(5).comment('最大储备瓶子数');
    table.integer('max_active').defaultTo(3).comment('最大活跃瓶子数');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // 4. 修改 drift_bottle_messages 表: 新增 station_number
  await knex.schema.alterTable('drift_bottle_messages', function(table) {
    table.integer('station_number').defaultTo(0).comment('站点编号');
  });

  // 5. 删除旧表
  await knex.schema.dropTableIfExists('user_drift_bottles');
  await knex.schema.dropTableIfExists('drift_bottle_products');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // 恢复 drift_bottle_messages
  await knex.schema.alterTable('drift_bottle_messages', function(table) {
    table.dropColumn('station_number');
  });

  // 删除新表
  await knex.schema.dropTableIfExists('user_bottle_quota');
  await knex.schema.dropTableIfExists('journey_cards');

  // 恢复 drift_bottles
  await knex.schema.alterTable('drift_bottles', function(table) {
    table.dropColumn('pixel_snapshot');
    table.dropColumn('direction_angle');
    table.dropColumn('open_count');
    table.dropColumn('max_openers');
    table.dropColumn('is_sunk');
    table.dropColumn('sunk_at');
  });

  await knex.schema.alterTable('drift_bottles', function(table) {
    table.string('title', 200).comment('漂流瓶标题');
    table.string('image_url', 500).comment('图片URL');
  });

  // 恢复旧表
  await knex.schema.createTable('drift_bottle_products', function(table) {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.text('description');
    table.decimal('price', 10, 2).notNullable().defaultTo(29.99);
    table.string('category', 50).notNullable().defaultTo('special');
    table.string('image_url', 500);
    table.json('properties');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('stock').notNullable().defaultTo(-1);
    table.timestamps(true, true);
    table.index(['is_active', 'category']);
  });

  await knex.schema.createTable('user_drift_bottles', function(table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable();
    table.string('bottle_id', 32).notNullable();
    table.string('status', 20).notNullable().defaultTo('inventory');
    table.boolean('is_new').notNullable().defaultTo(true);
    table.timestamp('acquired_at').defaultTo(knex.fn.now());
    table.timestamp('last_action_at').defaultTo(knex.fn.now());
    table.text('note');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('bottle_id').references('bottle_id').inTable('drift_bottles').onDelete('CASCADE');
    table.unique(['user_id', 'bottle_id']);
    table.index(['user_id', 'status']);
    table.index(['bottle_id']);
  });
};
