/**
 * GPS轨迹日志表
 *
 * 用于记录用户GPS移动轨迹，用于：
 * 1. 异常行为检测
 * 2. 数据分析
 * 3. 风控审计
 */

exports.up = function(knex) {
  return knex.schema.createTable('gps_trajectory_log', function(table) {
    table.increments('id').primary();
    table.integer('user_id').notNullable().comment('用户ID');
    table.decimal('latitude', 10, 8).notNullable().comment('纬度');
    table.decimal('longitude', 11, 8).notNullable().comment('经度');
    table.float('accuracy').nullable().comment('GPS精度（米）');
    table.float('speed').nullable().comment('移动速度（m/s）');
    table.float('distance').nullable().comment('距离上次位置（米）');
    table.string('action', 50).notNullable().comment('动作类型（draw_pixel, pickup_bottle等）');
    table.boolean('is_anomaly').defaultTo(false).comment('是否异常');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 索引
    table.index('user_id', 'idx_trajectory_user');
    table.index('created_at', 'idx_trajectory_time');
    table.index(['user_id', 'is_anomaly'], 'idx_trajectory_anomaly');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('gps_trajectory_log');
};
