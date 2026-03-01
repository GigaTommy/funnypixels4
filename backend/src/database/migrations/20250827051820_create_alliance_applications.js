/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('alliance_applications', function(table) {
    table.increments('id').primary();
    table.integer('alliance_id').notNullable().references('id').inTable('alliances').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('message').nullable(); // 申请消息
    table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending'); // 申请状态
    table.uuid('reviewed_by').nullable().references('id').inTable('users'); // 审核人
    table.text('review_message').nullable(); // 审核消息
    table.timestamp('reviewed_at').nullable(); // 审核时间
    table.timestamps(true, true); // created_at, updated_at
    
    // 索引
    table.index(['alliance_id', 'status']);
    table.index(['user_id']);
    table.unique(['alliance_id', 'user_id']); // 每个用户对每个联盟只能有一个待处理的申请
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('alliance_applications');
};
