/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. 创建漂流瓶商品表
  await knex.schema.createTable('drift_bottle_products', function(table) {
    table.increments('id').primary();
    table.string('name', 100).notNullable().comment('商品名称');
    table.text('description').comment('商品描述');
    table.decimal('price', 10, 2).notNullable().defaultTo(29.99).comment('商品价格');
    table.string('category', 50).notNullable().defaultTo('special').comment('商品分类');
    table.string('image_url', 500).comment('商品图片URL');
    table.json('properties').comment('商品属性配置');
    table.boolean('is_active').notNullable().defaultTo(true).comment('是否启用');
    table.integer('stock').notNullable().defaultTo(-1).comment('库存数量(-1表示无限)');
    table.timestamps(true, true);

    table.index(['is_active', 'category']);
  });

  // 2. 创建漂流瓶表
  await knex.schema.createTable('drift_bottles', function(table) {
    table.increments('id').primary();
    table.string('bottle_id', 32).notNullable().unique().comment('漂流瓶唯一ID');
    table.uuid('owner_id').comment('当前持有者ID');
    table.uuid('original_owner_id').notNullable().comment('最初抛出者ID');
    table.string('title', 200).comment('漂流瓶标题');
    table.text('content').comment('初始内容');
    table.string('image_url', 500).comment('图片URL');
    table.decimal('current_lat', 10, 8).notNullable().comment('当前纬度');
    table.decimal('current_lng', 11, 8).notNullable().comment('当前经度');
    table.decimal('origin_lat', 10, 8).notNullable().comment('抛出位置纬度');
    table.decimal('origin_lng', 11, 8).notNullable().comment('抛出位置经度');
    table.string('current_city', 100).comment('当前所在城市');
    table.string('current_country', 100).comment('当前所在国家');
    table.string('origin_city', 100).comment('抛出时城市');
    table.string('origin_country', 100).comment('抛出时国家');
    table.integer('total_distance').defaultTo(0).comment('总漂流距离(米)');
    table.integer('pickup_count').defaultTo(0).comment('被捡起次数');
    table.integer('message_count').defaultTo(0).comment('消息数量');
    table.timestamp('last_drift_time').comment('最后漂流时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('expires_at').comment('过期时间');
    table.boolean('is_active').notNullable().defaultTo(true).comment('是否在漂流中');

    table.foreign('owner_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('original_owner_id').references('id').inTable('users').onDelete('CASCADE');

    table.index(['bottle_id']);
    table.index(['owner_id']);
    table.index(['is_active', 'last_drift_time']);
    table.index(['current_lat', 'current_lng']);
  });

  // 3. 创建漂流瓶纸条表
  await knex.schema.createTable('drift_bottle_messages', function(table) {
    table.increments('id').primary();
    table.string('bottle_id', 32).notNullable().comment('漂流瓶ID');
    table.uuid('author_id').notNullable().comment('纸条作者ID');
    table.text('message').notNullable().comment('纸条内容');
    table.string('author_name', 100).notNullable().comment('作者名称');
    table.string('author_avatar', 500).comment('作者头像');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.integer('sequence_number').notNullable().comment('纸条序号');

    table.foreign('bottle_id').references('bottle_id').inTable('drift_bottles').onDelete('CASCADE');
    table.foreign('author_id').references('id').inTable('users').onDelete('CASCADE');

    table.index(['bottle_id', 'sequence_number']);
    table.index(['author_id']);
  });

  // 4. 创建漂流瓶漂流历史表
  await knex.schema.createTable('drift_bottle_history', function(table) {
    table.increments('id').primary();
    table.string('bottle_id', 32).notNullable().comment('漂流瓶ID');
    table.uuid('user_id').notNullable().comment('用户ID');
    table.string('action', 20).notNullable().comment('动作类型: throw, pickup, hold');
    table.decimal('lat', 10, 8).notNullable().comment('位置纬度');
    table.decimal('lng', 11, 8).notNullable().comment('位置经度');
    table.string('city', 100).comment('城市');
    table.string('country', 100).comment('国家');
    table.text('message').comment('动作留言');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');

    table.foreign('bottle_id').references('bottle_id').inTable('drift_bottles').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    table.index(['bottle_id', 'created_at']);
    table.index(['user_id']);
    table.index(['action', 'created_at']);
  });

  // 5. 创建用户漂流瓶库存表
  await knex.schema.createTable('user_drift_bottles', function(table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().comment('用户ID');
    table.string('bottle_id', 32).notNullable().comment('漂流瓶ID');
    table.string('status', 20).notNullable().defaultTo('inventory').comment('状态: inventory, drifting, picked');
    table.boolean('is_new').notNullable().defaultTo(true).comment('是否未读');
    table.timestamp('acquired_at').defaultTo(knex.fn.now()).comment('获得时间');
    table.timestamp('last_action_at').defaultTo(knex.fn.now()).comment('最后操作时间');
    table.text('note').comment('备注');

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('bottle_id').references('bottle_id').inTable('drift_bottles').onDelete('CASCADE');

    table.unique(['user_id', 'bottle_id']);
    table.index(['user_id', 'status']);
    table.index(['bottle_id']);
  });

  // 6. 插入默认的漂流瓶商品
  await knex('drift_bottle_products').insert({
    name: '神秘漂流瓶',
    description: '抛出一个神秘的漂流瓶，它会在地图上随机漂流。其他用户可以捡起它，写下纸条，然后继续漂流。每个漂流瓶都记录着它的旅程和所有遇见过它的人的故事。',
    price: 29.99,
    category: 'special',
    image_url: '/images/products/drift-bottle.png',
    properties: JSON.stringify({
      type: 'drift_bottle',
      max_messages: 50,
      max_distance_per_drift: 10000, // 最大漂流距离10公里
      min_drift_interval: 3600, // 最小漂流间隔1小时
      auto_drift_enabled: true,
      can_hold_inventory: true,
      message_max_length: 200
    }),
    is_active: true,
    stock: -1
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('user_drift_bottles');
  await knex.schema.dropTableIfExists('drift_bottle_history');
  await knex.schema.dropTableIfExists('drift_bottle_messages');
  await knex.schema.dropTableIfExists('drift_bottles');
  await knex.schema.dropTableIfExists('drift_bottle_products');
};