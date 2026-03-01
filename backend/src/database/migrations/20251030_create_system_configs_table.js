/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 创建系统配置表
    .createTable('system_configs', function(table) {
      table.increments('id').primary();
      table.string('config_key', 100).unique().notNullable(); // 配置键名
      table.text('config_value').nullable(); // 配置值
      table.string('config_type', 20).defaultTo('text'); // 配置类型: text, html, json
      table.text('description').nullable(); // 配置描述
      table.integer('updated_by').unsigned().nullable(); // 更新者ID
      table.timestamps(true, true);

      // 索引
      table.index('config_key');
    })
    // 创建配置历史记录表
    .createTable('system_config_history', function(table) {
      table.increments('id').primary();
      table.string('config_key', 100).notNullable(); // 配置键名
      table.text('old_value').nullable(); // 旧值
      table.text('new_value').nullable(); // 新值
      table.integer('updated_by').unsigned().nullable(); // 更新者ID
      table.text('update_reason').nullable(); // 更新原因
      table.timestamps(true, true);

      // 索引
      table.index('config_key');
      table.index('updated_at');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('system_config_history')
    .dropTableIfExists('system_configs');
};