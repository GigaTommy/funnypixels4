/**
 * 创建广告表
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('advertisements', function(table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('title', 200).notNullable();
    table.text('description');
    table.string('image_url', 500);
    table.decimal('lat', 10, 8).notNullable();
    table.decimal('lng', 11, 8).notNullable();
    table.string('grid_id', 100).notNullable();
    table.integer('width').notNullable().defaultTo(1);
    table.integer('height').notNullable().defaultTo(1);
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.integer('repeat_count').notNullable().defaultTo(1);
    table.enum('status', ['pending', 'active', 'paused', 'completed', 'rejected']).notNullable().defaultTo('pending');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // 索引
    table.index(['user_id']);
    table.index(['status']);
    table.index(['grid_id']);
    table.index(['start_time', 'end_time']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('advertisements');
};
