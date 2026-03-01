/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasColumn('leaderboard_personal', 'avatar');
  if (!exists) {
    return knex.schema.alterTable('leaderboard_personal', function(table) {
      table.text('avatar').nullable().comment('用户头像数据（像素艺术颜色数据）');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('leaderboard_personal', function(table) {
    table.dropColumn('avatar');
  });
};
