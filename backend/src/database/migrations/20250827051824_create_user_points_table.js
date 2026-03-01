/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 创建用户积分表
    .createTableIfNotExists('user_points', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('total_points').notNullable().defaultTo(0); // 用户总积分
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // 确保每个用户只有一条积分记录
      table.unique(['user_id']);
      
      // 索引
      table.index(['user_id']);
      table.index(['total_points']);
    })
    
    // 从users表中移除points字段
    .alterTable('users', function(table) {
      table.dropColumn('points');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    // 恢复users表中的points字段
    .alterTable('users', function(table) {
      table.integer('points').notNullable().defaultTo(0);
    })
    
    // 删除用户积分表
    .dropTableIfExists('user_points');
};
