/**
 * 添加战果缩略图字段到battle_results表
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  console.log('  📝 检查battle_results表的缩略图字段...');

  // 检查thumbnail_url列是否已存在
  const columnExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'battle_results'
      AND column_name = 'thumbnail_url'
    );
  `);

  if (!columnExists.rows[0].exists) {
    await knex.schema.alterTable('battle_results', function(table) {
      // 添加战果缩略图相关字段
      table.string('thumbnail_url', 1000).nullable();
      table.string('thumbnail_path', 500).nullable();
      table.timestamp('thumbnail_generated_at').nullable();
      table.json('thumbnail_metadata').nullable();

      // 添加索引
      table.index(['thumbnail_generated_at']);
    });
    console.log('  ✅ 成功添加战果缩略图字段');
  } else {
    console.log('  ℹ️  战果缩略图字段已存在，跳过迁移');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('battle_results', function(table) {
    // 删除添加的字段
    table.dropColumn('thumbnail_url');
    table.dropColumn('thumbnail_path');
    table.dropColumn('thumbnail_generated_at');
    table.dropColumn('thumbnail_metadata');
  });
};