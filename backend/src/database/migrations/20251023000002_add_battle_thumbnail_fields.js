/**
 * 添加战果缩略图字段到battle_results表
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 检查表是否存在
  const tableExists = await knex.schema.hasTable('battle_results');
  if (!tableExists) {
    console.log('⚠️ battle_results表不存在，跳过迁移');
    return;
  }

  // 检查列是否已存在
  const columnExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'battle_results'
      AND column_name = 'thumbnail_url'
    )
  `);

  if (!columnExists.rows[0].exists) {
    await knex.schema.alterTable('battle_results', function(table) {
      // 添加战果缩略图相关字段
      table.string('thumbnail_url', 1000).nullable().after('image_path');
      table.string('thumbnail_path', 500).nullable().after('thumbnail_url');
      table.timestamp('thumbnail_generated_at').nullable().after('thumbnail_path');
      table.json('thumbnail_metadata').nullable().after('thumbnail_generated_at');

      // 添加索引
      table.index(['thumbnail_generated_at']);
    });
    console.log('✅ 战果缩略图字段已添加');
  } else {
    console.log('✅ 战果缩略图字段已存在，跳过迁移');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  console.log('⚠️ 跳过回滚：列可能由其他迁移管理');
};