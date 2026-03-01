/**
 * 创建用户分享记录表
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('user_shares', function(table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('platform', ['wechat', 'weibo', 'douyin', 'xiaohongshu']).notNullable();
    table.string('image_url', 500).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // 索引
    table.index(['user_id']);
    table.index(['platform']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_shares');
};
