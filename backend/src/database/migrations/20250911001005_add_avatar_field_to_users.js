/**
 * 添加avatar字段到users表，用于存储像素头像数据
 * 注意：可能与20250908_001_add_avatar_field_to_users.js重复
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 检查列是否已存在
  const columnExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'avatar'
    )
  `);

  // 如果列不存在，则添加
  if (!columnExists.rows[0].exists) {
    await knex.schema.alterTable('users', function(table) {
      table.text('avatar').comment('像素头像数据');
    });
    console.log('✅ avatar列已添加到users表');
  } else {
    console.log('✅ avatar列已存在，跳过迁移');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // 由于列可能由其他迁移添加，这里不做实际删除
  console.log('⚠️ 跳过回滚：列可能由其他迁移管理');
};
