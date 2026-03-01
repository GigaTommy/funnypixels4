/**
 * 添加 total_pixels 列到排行榜表
 * 修复 leaderboard_alliance 和 leaderboard_region 表缺少 total_pixels 列的问题
 */

exports.up = async function(knex) {
  // 检查并添加 total_pixels 列到 leaderboard_alliance 表
  const hasAllianceColumn = await knex.schema.hasColumn('leaderboard_alliance', 'total_pixels');
  if (!hasAllianceColumn) {
    await knex.schema.table('leaderboard_alliance', function(table) {
      table.bigInteger('total_pixels').notNullable().defaultTo(0);
    });
    console.log('✅ Added total_pixels column to leaderboard_alliance table');
  } else {
    console.log('ℹ️  total_pixels column already exists in leaderboard_alliance table');
  }

  // 检查并添加 total_pixels 列到 leaderboard_region 表
  const hasRegionColumn = await knex.schema.hasColumn('leaderboard_region', 'total_pixels');
  if (!hasRegionColumn) {
    await knex.schema.table('leaderboard_region', function(table) {
      table.bigInteger('total_pixels').notNullable().defaultTo(0);
    });
    console.log('✅ Added total_pixels column to leaderboard_region table');
  } else {
    console.log('ℹ️  total_pixels column already exists in leaderboard_region table');
  }
};

exports.down = async function(knex) {
  // 回滚：删除 total_pixels 列
  await knex.schema.table('leaderboard_alliance', function(table) {
    table.dropColumn('total_pixels');
  });
  await knex.schema.table('leaderboard_region', function(table) {
    table.dropColumn('total_pixels');
  });
  console.log('✅ Removed total_pixels column from leaderboard tables');
};
