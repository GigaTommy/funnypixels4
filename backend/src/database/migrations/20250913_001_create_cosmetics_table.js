/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('cosmetics', function(table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('cosmetic_type', 50).notNullable(); // 装饰品类型：avatar_frame, chat_bubble, badge, background
    table.string('cosmetic_name', 100).notNullable(); // 装饰品名称：golden, rainbow, pixel_master等
    table.jsonb('cosmetic_data').nullable(); // 装饰品数据（JSON格式）
    table.boolean('is_equipped').defaultTo(false); // 是否已装备
    table.boolean('is_active').defaultTo(true); // 是否激活
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // 索引
    table.index(['user_id']);
    table.index(['cosmetic_type']);
    table.index(['user_id', 'cosmetic_type']);
    table.index(['user_id', 'is_equipped']);
    table.unique(['user_id', 'cosmetic_type', 'cosmetic_name']); // 每个用户每种装饰品只能有一条记录
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('cosmetics');
};
