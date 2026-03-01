/**
 * 添加 alliance_id 字段到 pixels 和 pixels_history 表
 * 存储绘制时所属联盟ID，避免用户更换联盟后旧像素显示错误的联盟旗帜
 * 同时减少 MVT 查询中的 JOIN 操作
 */
exports.up = function(knex) {
  return knex.schema.table('pixels', function(table) {
    table.integer('alliance_id').comment('绘制时所属联盟ID');
    table.index('alliance_id');
  }).then(() => {
    return knex.schema.table('pixels_history', function(table) {
      table.integer('alliance_id').comment('绘制时所属联盟ID');
    });
  });
};

exports.down = function(knex) {
  return knex.schema.table('pixels', function(table) {
    table.dropIndex('alliance_id');
    table.dropColumn('alliance_id');
  }).then(() => {
    return knex.schema.table('pixels_history', function(table) {
      table.dropColumn('alliance_id');
    });
  });
};
