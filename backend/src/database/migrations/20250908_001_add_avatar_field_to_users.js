/**
 * 添加avatar字段到users表，用于存储像素头像数据
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 检查字段是否已存在
  const columnExists = await knex.raw(`
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'avatar'
    AND table_schema = 'public'
  `);
  
  if (columnExists.rows.length === 0) {
    return knex.schema.alterTable('users', function(table) {
      // 添加avatar字段，用于存储像素头像数据
      table.text('avatar').comment('像素头像数据');
    });
  } else {
    console.log('✅ 字段 avatar 已存在，跳过创建');
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
