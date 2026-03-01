/**
 * 添加版本管理功能到系统配置表
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 检查表是否存在
  const hasSystemConfigs = await knex.schema.hasTable('system_configs');
  const hasHistory = await knex.schema.hasTable('system_config_history');

  if (!hasSystemConfigs || !hasHistory) {
    return; // 表不存在，跳过此迁移
  }

  // 检查哪些字段已存在
  const existingConfigColumns = await knex.raw(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'system_configs' AND table_schema = 'public'
  `);
  const existingHistoryColumns = await knex.raw(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'system_config_history' AND table_schema = 'public'
  `);

  const hasConfigColumn = (name) => existingConfigColumns.rows.some(row => row.column_name === name);
  const hasHistoryColumn = (name) => existingHistoryColumns.rows.some(row => row.column_name === name);

  // 检查是否需要添加字段
  const configColumnsToAdd = [];
  if (!hasConfigColumn('version_number')) configColumnsToAdd.push('version_number');
  if (!hasConfigColumn('effective_date')) configColumnsToAdd.push('effective_date');
  if (!hasConfigColumn('status')) configColumnsToAdd.push('status');

  const historyColumnsToAdd = [];
  if (!hasHistoryColumn('version_number')) historyColumnsToAdd.push('version_number');
  if (!hasHistoryColumn('status')) historyColumnsToAdd.push('status');

  if (configColumnsToAdd.length === 0 && historyColumnsToAdd.length === 0) {
    return; // 所有字段都已存在
  }

  // 添加 system_configs 表的字段
  if (configColumnsToAdd.length > 0) {
    await knex.schema.alterTable('system_configs', function(table) {
      if (configColumnsToAdd.includes('version_number')) {
        table.string('version_number', 50).nullable();
      }
      if (configColumnsToAdd.includes('effective_date')) {
        table.timestamp('effective_date').nullable();
      }
      if (configColumnsToAdd.includes('status')) {
        table.string('status', 20).defaultTo('draft').nullable();
      }
    });
  }

  // 添加 system_config_history 表的字段
  if (historyColumnsToAdd.length > 0) {
    await knex.schema.alterTable('system_config_history', function(table) {
      if (historyColumnsToAdd.includes('version_number')) {
        table.string('version_number', 50).nullable();
      }
      if (historyColumnsToAdd.includes('status')) {
        table.string('status', 20).nullable();
      }
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .alterTable('system_configs', function(table) {
      table.dropColumn('version_number');
      table.dropColumn('effective_date');
      table.dropColumn('status');
    })
    .alterTable('system_config_history', function(table) {
      table.dropColumn('version_number');
      table.dropColumn('status');
    });
};
