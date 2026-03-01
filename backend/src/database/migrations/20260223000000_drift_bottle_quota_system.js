/**
 * 漂流瓶配额系统数据库迁移
 * 创建每日使用记录表，并为用户表添加像素兑换字段
 */

exports.up = async function(knex) {
  // 1. 创建每日使用记录表
  await knex.schema.createTable('drift_bottle_daily_usage', (table) => {
    table.increments('id').primary();
    table.string('user_id', 255).notNullable();
    table.date('date').notNullable().comment('日期 YYYY-MM-DD');
    table.integer('used').defaultTo(0).comment('当天已使用次数');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 索引
    table.unique(['user_id', 'date'], 'unique_user_date');
    table.index(['user_id', 'date'], 'idx_user_date');
  });

  // 2. 为users表添加字段（如果不存在）
  const hasColumn = await knex.schema.hasColumn('users', 'drift_bottle_pixels_redeemed');
  if (!hasColumn) {
    await knex.schema.alterTable('users', (table) => {
      table.integer('drift_bottle_pixels_redeemed').defaultTo(0)
        .comment('已兑换漂流瓶的像素数');
    });
  }

  console.log('✅ Drift bottle quota system tables created');
};

exports.down = async function(knex) {
  // 删除表
  await knex.schema.dropTableIfExists('drift_bottle_daily_usage');

  // 删除字段
  const hasColumn = await knex.schema.hasColumn('users', 'drift_bottle_pixels_redeemed');
  if (hasColumn) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('drift_bottle_pixels_redeemed');
    });
  }

  console.log('✅ Drift bottle quota system tables dropped');
};
