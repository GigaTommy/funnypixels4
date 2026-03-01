/**
 * 添加文件存储字段到系统配置表
 * 用于支持PDF文件上传管理
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
  if (!hasConfigColumn('file_path')) configColumnsToAdd.push('file_path');
  if (!hasConfigColumn('file_name')) configColumnsToAdd.push('file_name');
  if (!hasConfigColumn('file_type')) configColumnsToAdd.push('file_type');
  if (!hasConfigColumn('file_size')) configColumnsToAdd.push('file_size');
  if (!hasConfigColumn('file_url')) configColumnsToAdd.push('file_url');

  const historyColumnsToAdd = [];
  if (!hasHistoryColumn('file_path')) historyColumnsToAdd.push('file_path');
  if (!hasHistoryColumn('file_name')) historyColumnsToAdd.push('file_name');

  if (configColumnsToAdd.length === 0 && historyColumnsToAdd.length === 0) {
    return; // 所有字段都已存在
  }

  // 添加 system_configs 表的字段
  if (configColumnsToAdd.length > 0) {
    await knex.schema.alterTable('system_configs', function(table) {
      if (configColumnsToAdd.includes('file_path')) {
        table.string('file_path', 500).nullable();
      }
      if (configColumnsToAdd.includes('file_name')) {
        table.string('file_name', 255).nullable();
      }
      if (configColumnsToAdd.includes('file_type')) {
        table.string('file_type', 50).nullable();
      }
      if (configColumnsToAdd.includes('file_size')) {
        table.integer('file_size').nullable();
      }
      if (configColumnsToAdd.includes('file_url')) {
        table.string('file_url', 500).nullable();
      }
    });
  }

  // 添加 system_config_history 表的字段
  if (historyColumnsToAdd.length > 0) {
    await knex.schema.alterTable('system_config_history', function(table) {
      if (historyColumnsToAdd.includes('file_path')) {
        table.string('file_path', 500).nullable();
      }
      if (historyColumnsToAdd.includes('file_name')) {
        table.string('file_name', 255).nullable();
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
      table.dropColumn('file_path');
      table.dropColumn('file_name');
      table.dropColumn('file_type');
      table.dropColumn('file_size');
      table.dropColumn('file_url');
    })
    .alterTable('system_config_history', function(table) {
      table.dropColumn('file_path');
      table.dropColumn('file_name');
    });
};
