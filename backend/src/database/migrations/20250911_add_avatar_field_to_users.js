/**
 * 添加avatar字段到users表，用于存储像素头像数据
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 检查列是否已存在
  const columnExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'avatar'
    );
  `);

  const hasAvatar = columnExists.rows[0].exists;

  if (!hasAvatar) {
    await knex.schema.alterTable('users', function(table) {
      // 添加avatar字段，用于存储像素头像数据
      table.text('avatar').comment('像素头像数据');
    });
    console.log('✅ 成功添加 avatar 列');
  } else {
    console.log('ℹ️  avatar 列已存在，跳过迁移');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('avatar');
  });
};
