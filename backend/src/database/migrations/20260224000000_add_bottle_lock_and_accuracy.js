/**
 * 漂流瓶优化：添加锁定机制和GPS精度字段
 *
 * 新增字段：
 * - locked_by: 锁定用户ID
 * - locked_at: 锁定时间
 * - locked_distance: 锁定时的距离
 * - location_accuracy: GPS精度
 */

exports.up = function(knex) {
  return knex.schema.table('drift_bottles', function(table) {
    // 锁定相关字段
    table.integer('locked_by').nullable().comment('锁定用户ID');
    table.timestamp('locked_at').nullable().comment('锁定时间');
    table.float('locked_distance').nullable().comment('锁定时的距离（米）');

    // GPS精度字段
    table.float('location_accuracy').nullable().comment('位置记录时的GPS精度（米）');

    // 索引
    table.index(['locked_by', 'locked_at'], 'idx_bottle_lock');
  });
};

exports.down = function(knex) {
  return knex.schema.table('drift_bottles', function(table) {
    table.dropIndex(['locked_by', 'locked_at'], 'idx_bottle_lock');
    table.dropColumn('locked_by');
    table.dropColumn('locked_at');
    table.dropColumn('locked_distance');
    table.dropColumn('location_accuracy');
  });
};
