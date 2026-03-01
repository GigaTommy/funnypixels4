const { Knex } = require('knex');

/**
 * @param {Knex} knex
 */
exports.up = function(knex) {
  return knex.schema
    // 自定义旗帜订单表
    .createTableIfNotExists('custom_flag_orders', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('pattern_name', 100).notNullable();
      table.text('pattern_description');
      table.text('original_image_url').notNullable();
      table.text('ai_processed_image_url');
      table.text('emoji_version');
      table.string('status', 20).defaultTo('pending'); // pending, processing, approved, rejected
      table.integer('price').defaultTo(2000);
      table.text('admin_notes');
      table.uuid('processed_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('processed_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // 索引
      table.index(['user_id', 'status']);
      table.index(['status', 'created_at']);
    })
    
    // 用户自定义图案权限表
    .createTableIfNotExists('user_custom_patterns', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('pattern_id').notNullable().references('id').inTable('pattern_assets').onDelete('CASCADE');
      table.uuid('order_id').notNullable().references('id').inTable('custom_flag_orders').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // 唯一约束：一个用户只能拥有一个图案的一个实例
      table.unique(['user_id', 'pattern_id']);
      
      // 索引
      table.index(['user_id']);
      table.index(['pattern_id']);
    });
};

/**
 * @param {Knex} knex
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('user_custom_patterns')
    .dropTableIfExists('custom_flag_orders');
};
