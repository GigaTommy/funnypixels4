/**
 * 为pixels表添加grid_id唯一约束
 * 修复ON CONFLICT约束冲突问题
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 检查约束是否已存在
  const constraintExists = await knex.raw(`
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'pixels_grid_id_unique' 
    AND table_name = 'pixels'
  `);
  
  if (constraintExists.rows.length === 0) {
    return knex.schema.alterTable('pixels', function(table) {
      // 添加grid_id的唯一约束
      table.unique('grid_id', 'pixels_grid_id_unique');
    });
  } else {
    console.log('✅ 约束 pixels_grid_id_unique 已存在，跳过创建');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('pixels', function(table) {
    // 删除grid_id的唯一约束
    table.dropUnique('grid_id', 'pixels_grid_id_unique');
  });
};
